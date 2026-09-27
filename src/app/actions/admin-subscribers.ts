'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { getAdminIdentity } from '@/lib/admin/auth'
import { canAccessAdminPath } from '@/lib/admin/areas'
import { recordAdminAction } from '@/lib/admin/audit'
import { db } from '@/lib/db/client'
import { reportError } from '@/lib/observability/report-error'

export type SubscriberState = { error?: string; ok?: string }

const NEWSLETTER_PATH = '/admin/newsletter'

/**
 * Newsletter subscriber management.
 *
 * CONSENT IS THE WHOLE POINT OF THIS FILE. A subscriber list for a business selling
 * age-restricted botanicals is a compliance artefact, not a marketing asset:
 *
 *  · Unsubscribing is a SOFT delete. `isActive` goes false and `unsubscribedAt` is
 *    stamped. Hard-deleting the row would lose the evidence that they opted out, and
 *    the next import of an old list would happily re-add them.
 *  · Re-subscribing is therefore an operator action with a real consequence, and it
 *    clears `unsubscribedAt` so the record does not claim two contradictory things.
 *  · Adding by hand records a source of `admin`, never a fake one. If a regulator or
 *    a mailbox provider asks where an address came from, "an operator typed it in"
 *    is a defensible answer and a forged double-opt-in is not.
 *
 * Hard delete exists only for a genuine erasure request, and it is the one operation
 * that destroys evidence — which is why it is separate from unsubscribe rather than
 * being the same button with a different label.
 */

/*
  Returns the whole identity, not just the address.

  It used to return `{ email }`, which is enough to stamp a row and not enough to
  write an audit entry — `actorId` would have had nothing to hold. Every audit row
  in this file names a real operator by id AND address, because an address can be
  changed and a deletion here is not reversible.
*/
type SubscriberGuard = { identity: { userId: string; email: string } } | { error: string }

async function guard(): Promise<SubscriberGuard> {
  const identity = await getAdminIdentity()
  if (!identity) return { error: 'Not signed in.' }
  if (!canAccessAdminPath(identity.role, identity.adminAreas, NEWSLETTER_PATH)) {
    return { error: 'You do not have access to the newsletter.' }
  }
  return { identity: { userId: identity.userId, email: identity.email } }
}

/**
 * `a***@example.com` — enough to recognise a row, not enough to be a mailing list.
 *
 * The erasure entry below is written AFTER the subscriber is gone. Storing their
 * full address there would re-create, in a table nobody thinks of as a mailing
 * list, the exact record the person asked to have destroyed. What the trail has to
 * prove is that an erasure happened, who performed it, and when — not who it was.
 */
function maskEmail(email: string): string {
  const [local = '', domain = ''] = email.split('@')
  return `${local.slice(0, 1)}***@${domain}`
}

const idSchema = z.object({ id: z.string().min(1).max(60) })

const addSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email('That does not look like an email address.')
    .max(320),
})

/** Flip a subscriber between active and unsubscribed. Never deletes. */
export async function toggleSubscriber(
  _previous: SubscriberState,
  formData: FormData,
): Promise<SubscriberState> {
  const auth = await guard()
  if ('error' in auth) return auth

  const parsed = idSchema.safeParse({ id: formData.get('id') })
  if (!parsed.success) return { error: 'Invalid request.' }

  try {
    const current = await db.newsletterSubscriber.findUnique({
      where: { id: parsed.data.id },
      select: { isActive: true, email: true },
    })
    if (!current) return { error: 'That subscriber no longer exists.' }

    const reactivating = !current.isActive
    const after = await db.newsletterSubscriber.update({
      where: { id: parsed.data.id },
      data: reactivating
        ? { isActive: true, unsubscribedAt: null }
        : { isActive: false, unsubscribedAt: new Date() },
    })

    await recordAdminAction({
      entityType: 'NewsletterSubscriber',
      entityId: parsed.data.id,
      action: 'UPDATE',
      actor: auth.identity,
      before: current,
      after,
      reason: reactivating
        ? 'Re-subscribed by an operator asserting fresh consent'
        : 'Unsubscribed by an operator',
    })

    revalidatePath(NEWSLETTER_PATH)
    return {
      ok: reactivating
        ? `${current.email} re-subscribed.`
        : `${current.email} unsubscribed.`,
    }
  } catch (error) {
    await reportError(error, {
      source: 'action',
      routePath: NEWSLETTER_PATH,
      context: { stage: 'toggle-subscriber' },
    })
    return { error: 'Could not update that subscriber. It has been logged.' }
  }
}

/**
 * Permanently erase a subscriber.
 *
 * For a deletion request, not for tidying the list. Requires the operator to retype
 * the address, because a misfired click here is unrecoverable and the row is the only
 * proof of what the person consented to.
 */
export async function deleteSubscriber(
  _previous: SubscriberState,
  formData: FormData,
): Promise<SubscriberState> {
  const auth = await guard()
  if ('error' in auth) return auth

  const parsed = z
    .object({ id: z.string().min(1).max(60), confirm: z.string().trim().toLowerCase() })
    .safeParse({ id: formData.get('id'), confirm: formData.get('confirm') })
  if (!parsed.success) return { error: 'Invalid request.' }

  try {
    const current = await db.newsletterSubscriber.findUnique({
      where: { id: parsed.data.id },
      select: { email: true },
    })
    if (!current) return { error: 'That subscriber no longer exists.' }

    if (parsed.data.confirm !== current.email.toLowerCase()) {
      return { error: 'Type the exact email address to confirm erasure.' }
    }

    await db.newsletterSubscriber.delete({ where: { id: parsed.data.id } })

    // Masked, and no `before` row — see `maskEmail`. This entry proves the erasure
    // happened and who performed it; it is not a copy of what was erased.
    await recordAdminAction({
      entityType: 'NewsletterSubscriber',
      entityId: parsed.data.id,
      action: 'DELETE',
      actor: auth.identity,
      reason: `Permanently erased ${maskEmail(current.email)} on request`,
    })

    revalidatePath(NEWSLETTER_PATH)
    return { ok: `${current.email} erased.` }
  } catch (error) {
    await reportError(error, {
      source: 'action',
      routePath: NEWSLETTER_PATH,
      context: { stage: 'delete-subscriber' },
    })
    return { error: 'Could not erase that subscriber. It has been logged.' }
  }
}

/** Add an address by hand — a phone order, a trade show, a reply to an email. */
export async function addSubscriber(
  _previous: SubscriberState,
  formData: FormData,
): Promise<SubscriberState> {
  const auth = await guard()
  if ('error' in auth) return auth

  const parsed = addSchema.safeParse({ email: formData.get('email') })
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Check the address.' }
  }

  try {
    const existing = await db.newsletterSubscriber.findUnique({
      where: { email: parsed.data.email },
      select: { isActive: true },
    })

    if (existing?.isActive) return { error: 'Already subscribed.' }

    if (existing) {
      // Previously unsubscribed. Re-activating is a deliberate act, and the operator
      // is asserting they have fresh consent.
      const revived = await db.newsletterSubscriber.update({
        where: { email: parsed.data.email },
        data: { isActive: true, unsubscribedAt: null, source: 'admin' },
      })
      await recordAdminAction({
        entityType: 'NewsletterSubscriber',
        entityId: revived.id,
        action: 'UPDATE',
        actor: auth.identity,
        before: existing,
        after: revived,
        reason: 'Re-added by hand after a previous unsubscribe — operator asserts fresh consent',
      })
      revalidatePath(NEWSLETTER_PATH)
      return { ok: `${parsed.data.email} re-subscribed.` }
    }

    const created = await db.newsletterSubscriber.create({
      data: { email: parsed.data.email, source: 'admin' },
    })
    await recordAdminAction({
      entityType: 'NewsletterSubscriber',
      entityId: created.id,
      action: 'CREATE',
      actor: auth.identity,
      after: created,
      reason: 'Added by hand from an offline signup',
    })
    revalidatePath(NEWSLETTER_PATH)
    return { ok: `${parsed.data.email} added.` }
  } catch (error) {
    await reportError(error, {
      source: 'action',
      routePath: NEWSLETTER_PATH,
      context: { stage: 'add-subscriber' },
    })
    return { error: 'Could not add that address. It has been logged.' }
  }
}
