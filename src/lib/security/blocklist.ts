import { createHmac } from 'node:crypto'
import { createSlugSnapshot, stringArray, type Fetcher } from '@/lib/cache/slug-snapshot'

/**
 * ─────────────────────────────────────────────────────────────────────────────
 *  IS THIS ADDRESS BLOCKED? — the proxy's answer, kept in memory.
 *
 *  Operators block specific addresses from the admin (/admin/visitors/blocked) or
 *  from a chat thread. The proxy refuses them on every page and API route before
 *  anything renders, from an in-memory snapshot of a cached endpoint: a refresh
 *  costs one request a minute per instance while there is traffic, and never a
 *  database query.
 *
 *  ── How fresh ──────────────────────────────────────────────────────────────
 *  A minute, for hits and misses alike. A block or an unblock reaches every
 *  instance within about a minute; chat enforces its own blocks immediately.
 *
 *  ── When it cannot tell ────────────────────────────────────────────────────
 *  It lets the request through. A blocklist that fails closed would take the
 *  whole shop offline the moment its endpoint hiccupped; one that fails open
 *  lets a blocked visitor in for as long as the outage lasts.
 *
 *  ── Why the endpoint is not public ─────────────────────────────────────────
 *  It lists people's addresses, and it would tell a blocked visitor they are on
 *  it. The proxy proves the request is its own with a token derived from the
 *  session secret, so there is no new secret to configure or rotate.
 * ─────────────────────────────────────────────────────────────────────────────
 */

export const BLOCKED_IPS_PATH = '/api/security/blocked-ips'
export const BLOCKLIST_TOKEN_HEADER = 'x-blocklist-token'

const FRESH_MS = 60_000

export function blocklistToken(secret: string): string {
  return createHmac('sha256', secret).update('blocked-ips:v1').digest('base64url')
}

/**
 * Paths a blocked address can still reach.
 *
 * - The list endpoint: the proxy's own refresh passes back through the proxy, and
 *   checking it there would wait on the very refresh it is serving.
 * - The admin: an operator who blocks the address they are sitting behind must
 *   still be able to unblock it. The admin has its own sign-in either way.
 */
export function blocklistExempt(pathname: string): boolean {
  return (
    pathname === BLOCKED_IPS_PATH ||
    pathname === '/admin' ||
    pathname.startsWith('/admin/') ||
    pathname.startsWith('/api/admin/')
  )
}

const snapshot = createSlugSnapshot({
  path: BLOCKED_IPS_PATH,
  read: (body) => {
    const ips = stringArray((body as { ips?: unknown } | null)?.ips)
    return ips ? new Set(ips) : null
  },
  // Almost every visitor is NOT on the list; see the note on missRecheckMs.
  missRecheckMs: FRESH_MS,
  headers: (): Record<string, string> => {
    const secret = process.env.ADMIN_SESSION_SECRET
    return secret ? { [BLOCKLIST_TOKEN_HEADER]: blocklistToken(secret) } : {}
  },
})

/** `ip` must already be canonical (see `normaliseIp`). */
export async function isBlockedIp(
  ip: string,
  origin: string,
  options: { now?: number; fetcher?: Fetcher } = {},
): Promise<boolean | 'unknown'> {
  return snapshot.has(ip, origin, options)
}

/** Tests only. */
export function resetBlocklistCache(): void {
  snapshot.reset()
}
