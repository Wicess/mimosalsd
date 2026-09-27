import 'server-only'
import { createHmac, timingSafeEqual } from 'node:crypto'
import { cookies } from 'next/headers'
import { verifyPassword } from './password'
import { reportError } from '@/lib/observability/report-error'

/**
 * Admin authentication.
 *
 * Deliberately small: a single operator credential held in the environment, a signed
 * session cookie, and nothing else. There is no user table, no password reset, no
 * registration — every one of those is an attack surface, and this dashboard has one
 * user until the business has more than one operator.
 *
 * The password is stored as a scrypt hash, never in plaintext, and compared in
 * constant time (see ./password). `ADMIN_PASSWORD_HASH` is produced by
 * `npm run admin:hash`.
 */

const SESSION_COOKIE = 'admin_session'
const SESSION_TTL_MS = 8 * 60 * 60 * 1000 // one working day

/**
 * The session payload.
 *
 * Role and granted areas are carried IN the signed cookie, not looked up per request.
 * That is deliberate and it is what makes enforcement possible: the proxy is the only
 * place an authorisation decision reliably runs on every request, and the proxy cannot
 * query the database.
 *
 * The cost is that a permission change takes effect at next sign-in rather than
 * instantly (TTL is 8 hours). To lock someone out immediately, disable the user AND
 * rotate ADMIN_SESSION_SECRET — that invalidates every outstanding session.
 *
 * The payload is HMAC-signed, so a user cannot edit their own role.
 */
export interface AdminSession {
  readonly userId: string
  readonly email: string
  readonly role: string
  readonly adminAreas: readonly string[]
  readonly issuedAt: number
  readonly expiresAt: number
}

/** Role and granted areas, resolved from the database on each request. */
export interface AdminIdentity {
  readonly userId: string
  readonly email: string
  readonly name: string
  readonly role: string
  readonly adminAreas: readonly string[]
}

function secret(): string {
  const value = process.env.ADMIN_SESSION_SECRET
  if (!value || value.length < 32) {
    throw new Error(
      'ADMIN_SESSION_SECRET must be set to at least 32 characters. Generate one with: openssl rand -base64 32',
    )
  }
  return value
}

function sign(payload: string): string {
  return createHmac('sha256', secret()).update(payload).digest('base64url')
}

function serialize(session: AdminSession): string {
  const payload = Buffer.from(JSON.stringify(session)).toString('base64url')
  return `${payload}.${sign(payload)}`
}

function deserialize(token: string | undefined): AdminSession | null {
  if (!token) return null
  const [payload, signature] = token.split('.')
  if (!payload || !signature) return null

  // Verify BEFORE parsing. Parsing attacker-controlled JSON first would mean the
  // signature check is guarding a decision already made.
  const expected = sign(payload)
  const a = Buffer.from(signature)
  const b = Buffer.from(expected)
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null

  try {
    const session = JSON.parse(Buffer.from(payload, 'base64url').toString()) as AdminSession
    if (typeof session.expiresAt !== 'number' || Date.now() > session.expiresAt) return null
    return session
  } catch {
    return null
  }
}

export async function createAdminSession(
  userId: string,
  email: string,
  role: string,
  adminAreas: readonly string[],
): Promise<void> {
  const now = Date.now()
  const session: AdminSession = {
    userId,
    email,
    role,
    adminAreas,
    issuedAt: now,
    expiresAt: now + SESSION_TTL_MS,
  }
  const store = await cookies()
  store.set(SESSION_COOKIE, serialize(session), {
    httpOnly: true,
    sameSite: 'strict', // admin actions are state-changing; strict blocks cross-site
    secure: process.env.NODE_ENV === 'production',
    maxAge: Math.floor(SESSION_TTL_MS / 1000),
    path: '/',
  })
}

export async function destroyAdminSession(): Promise<void> {
  ;(await cookies()).delete(SESSION_COOKIE)
}

export async function getAdminSession(): Promise<AdminSession | null> {
  return deserialize((await cookies()).get(SESSION_COOKIE)?.value)
}

export async function isAuthenticated(): Promise<boolean> {
  return (await getAdminSession()) !== null
}

/**
 * True when the panel can be signed into at all.
 *
 * Either a database AdminUser exists, or the bootstrap environment credential is set.
 * The env credential exists so the very first operator can get in before any user
 * record exists — a chicken-and-egg that would otherwise need a seed script run by
 * hand on production.
 */
export function isAdminConfigured(): boolean {
  return Boolean(process.env.ADMIN_SESSION_SECRET)
}

export function hasBootstrapCredential(): boolean {
  return Boolean(process.env.ADMIN_PASSWORD_HASH)
}

/** Bootstrap credential check. Grants SUPERADMIN, so it is the one to retire first. */
export function checkBootstrapCredentials(password: string): boolean {
  const stored = process.env.ADMIN_PASSWORD_HASH
  if (!stored) return false
  return verifyPassword(password, stored)
}

export const BOOTSTRAP_USER_ID = 'bootstrap'

/**
 * The signed-in identity, for display. Enforcement happens in the proxy.
 *
 * Falls back to the SIGNED SESSION when the database lookup fails or finds nothing.
 * That fallback matters: this ran in a layout that redirected to /admin/login whenever
 * it returned null, so a single transient Neon fetch error signed the operator out
 * mid-action — including immediately after login, which made the panel look broken.
 *
 * The session is HMAC-signed, so trusting it for a display name is safe. The one thing
 * the database read still buys is catching a DISABLED account, and that is handled
 * explicitly below rather than by conflating "disabled" with "lookup failed".
 */
export async function getAdminIdentity(): Promise<AdminIdentity | null> {
  const session = await getAdminSession()
  if (!session) return null

  if (session.userId === BOOTSTRAP_USER_ID) {
    return {
      userId: BOOTSTRAP_USER_ID,
      email: session.email,
      name: 'Bootstrap operator',
      role: 'SUPERADMIN',
      adminAreas: [],
    }
  }

  const fromSession: AdminIdentity = {
    userId: session.userId,
    email: session.email,
    name: session.email,
    role: session.role,
    adminAreas: session.adminAreas,
  }

  try {
    const { db } = await import('@/lib/db/client')
    const { dbRetry } = await import('@/lib/db/retry')
    const user = await dbRetry(() =>
      db.adminUser.findUnique({ where: { id: session.userId } }),
    )

    // A record that exists and is disabled is a real revocation — refuse.
    if (user && !user.isActive) return null

    // No record at all, or a lookup that threw: fall back to the signed session rather
    // than signing a working operator out over a network blip.
    if (!user) return fromSession

    return {
      userId: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      adminAreas: user.adminAreas,
    }
  } catch (error) {
    void reportError(error, {
      source: 'db',
      severity: 'WARN',
      context: { stage: 'identity-lookup', degraded: 'fell back to the signed session' },
    })
    return fromSession
  }
}
