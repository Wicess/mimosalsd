'use server'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import {
  BOOTSTRAP_USER_ID,
  checkBootstrapCredentials,
  createAdminSession,
  destroyAdminSession,
  hasBootstrapCredential,
} from '@/lib/admin/auth'
import { verifyPassword } from '@/lib/admin/password'
import { recordAdminAction } from '@/lib/admin/audit'
import { getAdminIdentity } from '@/lib/admin/auth'
import { ADMIN_NEXT_COOKIE, firstAllowedAdminPath, safeAdminNext } from '@/lib/admin/areas'
import { db } from '@/lib/db/client'
import { dbRetry, isTransientDbError } from '@/lib/db/retry'
import { notify } from '@/lib/notify/ntfy'
import { reportError } from '@/lib/observability/report-error'
import { markTeamBrowser } from '@/lib/visitors/team'

export type LoginState = { error?: string }

const schema = z.object({
  email: z.string().trim().email('Enter your email address.').max(200),
  password: z.string().min(1, 'Enter your password.').max(200),
})

/**
 * Admin sign-in.
 *
 * A failure is deliberately slow and vague: the same message whatever the cause, and a
 * fixed delay so timing cannot distinguish "no such user" from "wrong password". A
 * failed attempt also pushes an ops notification — an admin login this business did not
 * perform is something you want to hear about immediately, not in a log review.
 */
export async function adminLogin(
  _previous: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const parsed = schema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
  })
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Check your details.' }
  }
  const { email, password } = parsed.data

  /*
   * Retried, and a database failure is reported as a database failure.
   *
   * Without this a transient Neon blip made sign-in fail with "Incorrect email or
   * password" — sending the operator to chase a credential problem that did not
   * exist, while the real cause was a network error.
   */
  let user
  try {
    user = await dbRetry(() =>
      db.adminUser.findUnique({ where: { email: email.toLowerCase() } }),
    )
  } catch (error) {
    if (isTransientDbError(error)) {
      await reportError(error, {
        source: 'db',
        severity: 'FATAL',
        routePath: '/admin/login',
        context: { stage: 'lookup' },
      })
      return { error: 'We could not reach the database. Please try again in a moment.' }
    }
    throw error
  }

  if (user && user.isActive && verifyPassword(password, user.passwordHash)) {
    // Best-effort: a failure to stamp the login time must not block signing in.
    await dbRetry(() =>
      db.adminUser.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } }),
    ).catch((e) => console.error('[login] could not record lastLoginAt:', e))
    /*
      Recorded BEFORE the redirect: `redirect()` works by throwing, so anything
      after it in this block never runs.

      ── Why successful sign-ins only ────────────────────────────────────────
      A FAILED attempt is attacker-controlled and unbounded. Writing a row per
      failure hands anyone who can reach /admin/login a way to grow this table for
      free — and on Neon, which bills by how long the database stays awake, a
      patient credential-stuffing run would be billed to us twice: once as writes,
      once as compute that never gets to idle.

      Failures are not unmonitored. Each one already pushes a high-priority ntfy
      alert with the address that was tried, which is both faster than a log review
      and immune to being flooded into uselessness. If failures ever need
      persisting, they need a rate limiter first.
    */
    await recordAdminAction({
      entityType: 'AdminUser',
      entityId: user.id,
      action: 'LOGIN',
      actor: { userId: user.id, email: user.email },
      reason: `Signed in as ${user.role}`,
    })
    await createAdminSession(user.id, user.email, user.role, user.adminAreas)
    await markTeamBrowser()
    const next = safeAdminNext(await takeAdminNext(), user.role, user.adminAreas)
    redirect(next ?? firstAllowedAdminPath(user.role, user.adminAreas))
  }

  // Bootstrap credential — lets the first operator in before any user record exists.
  if (!user && hasBootstrapCredential() && checkBootstrapCredentials(password)) {
    // The bootstrap credential grants SUPERADMIN with no user record behind it, so
    // this is the one sign-in that leaves no trace anywhere else. Record it loudly.
    await recordAdminAction({
      entityType: 'AdminUser',
      entityId: BOOTSTRAP_USER_ID,
      action: 'LOGIN',
      actor: { userId: BOOTSTRAP_USER_ID, email },
      reason: 'Signed in with the BOOTSTRAP credential — SUPERADMIN, no user record',
    })
    await createAdminSession(BOOTSTRAP_USER_ID, email, 'SUPERADMIN', [])
    await markTeamBrowser()
    redirect(safeAdminNext(await takeAdminNext(), 'SUPERADMIN', []) ?? '/admin')
  }

  await new Promise((resolve) => setTimeout(resolve, 600))
  await notify({
    topic: 'errors',
    title: 'Failed admin login',
    body: `Sign-in failed for ${email}. If this was not you, rotate the credential.`,
    tags: ['warning'],
  })
  return { error: 'Incorrect email or password.' }
}

export async function adminLogout(): Promise<void> {
  // Resolved before the session is destroyed — afterwards there is nobody to name.
  const identity = await getAdminIdentity()
  if (identity) {
    await recordAdminAction({
      entityType: 'AdminUser',
      entityId: identity.userId,
      action: 'LOGOUT',
      actor: identity,
      reason: 'Signed out',
    })
  }
  await destroyAdminSession()
  redirect('/admin/login')
}

/** Read the destination the proxy stored, and clear it so it is followed only once. */
async function takeAdminNext(): Promise<string | undefined> {
  const store = await cookies()
  const value = store.get(ADMIN_NEXT_COOKIE)?.value
  if (value) store.delete(ADMIN_NEXT_COOKIE)
  return value
}
