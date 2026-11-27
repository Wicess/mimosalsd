'use server'

import { z } from 'zod'
import { db } from '@/lib/db/client'
import { reportError } from '@/lib/observability/report-error'
import { recordActivity } from '@/lib/visitors/record-activity'

export type NewsletterSignupState = { ok?: string; error?: string }

/*
  One answer whatever happened — new address, known address, or a bot filling the
  hidden field — so the form cannot be used to find out who is on the list.
*/
const DONE =
  'Thanks — if this address can receive our emails, you are on the list. Every email has a one-click unsubscribe link.'

const schema = z.object({
  email: z.string().trim().max(254).email(),
  consent: z.literal('on'),
  /** Where the form was: the account page, or the sign-up pop-up on any page. */
  source: z.enum(['account-page', 'site-popup']).catch('account-page'),
  path: z
    .string()
    .max(200)
    .regex(/^\/[^\s]*$/)
    .catch('/account/subscription'),
})

/**
 * Join the email list, from the account page or the sign-up pop-up.
 *
 * Adds new addresses only. An address that unsubscribed before is NOT switched back
 * on from a public form: anyone can type anyone's email here, and undoing someone's
 * opt-out on a stranger's say-so is exactly what an unsubscribe must protect against.
 * Re-joining after unsubscribing is done by asking us, where the operator re-adds it.
 */
export async function subscribeToNewsletter(
  _prev: NewsletterSignupState,
  formData: FormData,
): Promise<NewsletterSignupState> {
  // A field people never see. Something that fills it in is not a person.
  if (String(formData.get('website') ?? '').length > 0) return { ok: DONE }

  const parsed = schema.safeParse({
    email: formData.get('email') ?? '',
    consent: formData.get('consent') ?? undefined,
    source: formData.get('source') ?? undefined,
    path: formData.get('path') ?? undefined,
  })
  if (!parsed.success) {
    const consent = parsed.error.issues.some((issue) => issue.path[0] === 'consent')
    return { error: consent ? 'Tick the box to agree to receive our emails.' : 'Enter a valid email address.' }
  }

  const email = parsed.data.email.toLowerCase()
  const { source, path } = parsed.data
  try {
    // `update: {}` — an existing row, active or unsubscribed, is left exactly as it is.
    await db.newsletterSubscriber.upsert({
      where: { email },
      update: {},
      create: { email, source },
    })
  } catch (error) {
    await reportError(error, { source: 'action', routePath: '/account/subscription', context: { stage: 'subscribe', from: source } })
    return { error: 'Could not sign you up just now. Please try again in a moment.' }
  }
  // The address goes with it, so the visitor list can show who this visitor is.
  await recordActivity('SUBSCRIBED', { path, detail: email })
  return { ok: DONE }
}
