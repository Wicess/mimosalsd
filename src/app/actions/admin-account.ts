'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { BOOTSTRAP_USER_ID } from '@/lib/admin/auth'
import { requireSignedIn } from '@/lib/admin/guard'
import { recordAdminAction } from '@/lib/admin/audit'
import { hashPassword, verifyPassword } from '@/lib/admin/password'
import { db } from '@/lib/db/client'
import type { CrudState } from './admin-crud'

/**
 * The operator's own sign-in credential.
 *
 * Separate from the team CRUD on purpose. That file is about administering OTHER
 * people; this is the one account the person at the keyboard owns, and the rules are
 * different — it always requires the current password, and it is available to every
 * signed-in role rather than to whoever holds the settings area.
 *
 * ── Why the current password is required even though you are already signed in ──
 * The session cookie is the thing an attacker gets from a borrowed laptop or an
 * XSS-adjacent leak. If a live session were enough to set a new password, the session
 * would BE the credential and the password would be decorative. Asking for it again
 * is what keeps a stolen session from becoming a permanent account takeover.
 *
 * ── What this does NOT do ──
 * Changing the password does not sign other sessions out. The cookie is HMAC-signed
 * with a global secret and carries no password material, and the proxy — the only
 * place authorisation runs on every request — cannot query the database to check a
 * per-user token version. Rotating ADMIN_SESSION_SECRET is the documented way to
 * invalidate every outstanding session at once, and it remains the right lever.
 */

const ok = (message: string): CrudState => ({ ok: message })
const fail = (error: string): CrudState => ({ error })

/** Matches the floor the bootstrap script and `npm run admin:hash` enforce. */
const MIN_PASSWORD = 12

const BOOTSTRAP_NOTICE =
  'You are signed in with the bootstrap credential from ADMIN_PASSWORD_HASH, which lives in the environment and cannot be edited from here. Sign in with a real admin account to change its password, or create one under Team.'

const passwordSchema = z
  .object({
    current: z.string().min(1, 'Enter your current password.'),
    next: z
      .string()
      .min(MIN_PASSWORD, `Use at least ${MIN_PASSWORD} characters.`)
      .max(200, 'That is longer than necessary.'),
    confirm: z.string().min(1, 'Repeat the new password.'),
  })
  .refine((d) => d.next === d.confirm, {
    message: 'The two new passwords do not match.',
    path: ['confirm'],
  })
  .refine((d) => d.next !== d.current, {
    message: 'The new password must be different from the current one.',
    path: ['next'],
  })

export async function changeAdminPassword(
  _prev: CrudState,
  formData: FormData,
): Promise<CrudState> {
  const guard = await requireSignedIn()
  if (!guard.ok) return fail(guard.error)
  if (guard.identity.userId === BOOTSTRAP_USER_ID) return fail(BOOTSTRAP_NOTICE)

  const parsed = passwordSchema.safeParse({
    current: formData.get('current'),
    next: formData.get('next'),
    confirm: formData.get('confirm'),
  })
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? 'Check the values.')

  const user = await db.adminUser.findUnique({ where: { id: guard.identity.userId } })
  if (!user) return fail('Your account could not be found. Sign out and in again.')
  if (!verifyPassword(parsed.data.current, user.passwordHash)) {
    return fail('That is not your current password.')
  }

  await db.adminUser.update({
    where: { id: user.id },
    data: { passwordHash: hashPassword(parsed.data.next) },
  })

  /*
    No before/after rows. The only field that changed is the password hash, which
    the audit writer redacts anyway — so capturing both rows would store two copies
    of `[redacted]` and nothing else. What is worth knowing is that a credential
    rotated, whose, and when.
  */
  await recordAdminAction({
    entityType: 'AdminUser',
    entityId: user.id,
    action: 'UPDATE',
    actor: guard.identity,
    reason: 'Changed their own password',
  })

  revalidatePath('/admin/settings')
  return ok('Password changed. It applies the next time you sign in.')
}

const emailSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email('Enter a valid address.')
    .max(200),
  current: z.string().min(1, 'Enter your current password to confirm.'),
})

/**
 * The sign-in email is a USERNAME.
 *
 * Nothing is ever sent to it — the panel has no verification step and no reset flow —
 * so this does not need to be an address that receives mail, and changing it cannot
 * lock anyone out of an inbox. It is here because the sign-in name should not be
 * frozen at whatever the bootstrap script happened to generate.
 */
export async function changeAdminEmail(
  _prev: CrudState,
  formData: FormData,
): Promise<CrudState> {
  const guard = await requireSignedIn()
  if (!guard.ok) return fail(guard.error)
  if (guard.identity.userId === BOOTSTRAP_USER_ID) return fail(BOOTSTRAP_NOTICE)

  const parsed = emailSchema.safeParse({
    email: formData.get('email'),
    current: formData.get('current'),
  })
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? 'Check the values.')

  const user = await db.adminUser.findUnique({ where: { id: guard.identity.userId } })
  if (!user) return fail('Your account could not be found. Sign out and in again.')
  if (!verifyPassword(parsed.data.current, user.passwordHash)) {
    return fail('That is not your current password.')
  }
  if (parsed.data.email === user.email) return fail('That is already your sign-in email.')

  const taken = await db.adminUser.findUnique({ where: { email: parsed.data.email } })
  if (taken) return fail('Another admin account already uses that address.')

  await db.adminUser.update({
    where: { id: user.id },
    data: { email: parsed.data.email },
  })

  /*
    Both addresses are named in the reason on purpose. Every other row in this table
    identifies its actor by `actorEmail`, so a sign-in name changing is the one event
    that makes older rows look like they belong to somebody else. This entry is the
    line that connects them.
  */
  await recordAdminAction({
    entityType: 'AdminUser',
    entityId: user.id,
    action: 'UPDATE',
    actor: guard.identity,
    reason: `Changed their own sign-in email from ${user.email} to ${parsed.data.email}`,
  })

  revalidatePath('/admin/settings')
  return ok(`Sign-in email changed to ${parsed.data.email}.`)
}
