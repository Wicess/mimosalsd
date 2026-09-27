'use server'

import { z } from 'zod'
import { getCompanyEmail } from '@/lib/site/company-email.server'
import { clientIp, createThread, isBlocked, messagesUrl, visitorId as visitorKey } from '@/lib/chat/core'
import { catalog } from '@/lib/catalog/repository'
import { JURISDICTIONS } from '@/lib/compliance/jurisdictions'
import { notify } from '@/lib/notify/ntfy'
import { absoluteUrl } from '@/lib/seo/routes'
import { getMailProvider } from '@/lib/mail/mailer'
import {
  bulkEnquiryAcknowledgementEmail,
  bulkEnquiryNotificationEmail,
  type BulkEnquiry,
} from '@/lib/mail/templates'
import { CADENCES, VOLUME_BANDS } from '@/lib/bulk/options'
import { reportError } from '@/lib/observability/report-error'

export type BulkState = { ok?: boolean; error?: string }



/**
 * Bulk / wholesale enquiry.
 *
 * The four things a quote actually needs are the product line, the quantity, the
 * destination state and the reorder cadence — a bare mailto gets three of them at
 * best, and every missing one is a round trip before a price can be given. The
 * form asks for all four, so the first reply can carry a figure.
 *
 * SELECTIONS ARE RE-RESOLVED AGAINST THE CATALOGUE HERE. The form posts slugs;
 * this turns them back into names from live data rather than trusting the label
 * the browser sent. A server action is a public endpoint, and a product name in
 * the request body is user-controlled text that would otherwise land verbatim in
 * an email we send.
 *
 * The enquiry lands in three places for the same reason a contact message does:
 * a `SupportThread` is the durable record, ntfy wakes ops, and the two emails are
 * the convenience. Only the database write can fail the submission — a mail
 * outage must not tell someone we did not hear them.
 */
const schema = z.object({
  name: z.string().trim().min(2, 'Tell us your name.').max(120),
  company: z.string().trim().max(160).optional().or(z.literal('')),
  email: z.string().trim().email('Enter a valid email address.').max(200),
  /*
    Deliberately permissive. Extensions, spaces, brackets and +1 are all how real
    people write a number, and a form that rejects "(512) 555-0134 x2" to enforce
    a shape teaches the sender to lie rather than to correct themselves. Digits
    are counted; formatting is not judged.
  */
  phone: z
    .string()
    .trim()
    .min(7, 'Enter a phone number we can reach you on.')
    .max(32)
    .refine((v) => (v.match(/\d/g) ?? []).length >= 7, 'That does not look like a phone number.'),
  stateCode: z.string().trim().max(2).optional().or(z.literal('')),
  volume: z.enum(VOLUME_BANDS),
  cadence: z.enum(CADENCES).optional(),
  categories: z.array(z.string().max(120)).min(1, 'Choose at least one category.').max(10),
  products: z.array(z.string().max(160)).max(40).optional(),
  message: z.string().trim().max(4000).optional().or(z.literal('')),
  /* Honeypot. Invisible to a person, filled by anything that fills everything. */
  website: z.string().max(0).optional().or(z.literal('')),
})

export async function submitBulkEnquiry(
  _previous: BulkState,
  formData: FormData,
): Promise<BulkState> {
  const parsed = schema.safeParse({
    name: formData.get('name'),
    company: formData.get('company') ?? '',
    email: formData.get('email'),
    phone: formData.get('phone'),
    stateCode: formData.get('stateCode') ?? '',
    volume: formData.get('volume'),
    cadence: formData.get('cadence') || undefined,
    categories: formData.getAll('categories').map(String),
    products: formData.getAll('products').map(String),
    message: formData.get('message') ?? '',
    website: formData.get('website') ?? '',
  })

  if (!parsed.success) {
    // The honeypot is never explained. Telling a bot which field caught it is how
    // the next attempt gets through, and no person can trigger it.
    if (parsed.error.issues.some((i) => i.path[0] === 'website')) return { ok: true }
    return { error: parsed.error.issues[0]?.message ?? 'Could not send that enquiry.' }
  }

  const d = parsed.data

  // Names come from the catalogue, never from the request body.
  const categories = catalog
    .listCategories()
    .filter((c) => d.categories?.includes(c.slug))
    .map((c) => c.name)
  const products = catalog
    .listProducts()
    .filter((p) => d.products?.includes(p.slug))
    .map((p) => p.name)
  const state = JURISDICTIONS.find((j) => j.code === d.stateCode)

  const enquiry: BulkEnquiry = {
    name: d.name,
    email: d.email,
    phone: d.phone,
    volume: d.volume,
    categories,
    products,
    ...(d.company ? { company: d.company } : {}),
    ...(state ? { stateCode: state.name } : {}),
    ...(d.cadence ? { cadence: d.cadence } : {}),
    ...(d.message ? { message: d.message } : {}),
  }

  // A visitor blocked from chat is blocked here too — it is the same inbox.
  const ip = await clientIp()
  if (await isBlocked(ip)) {
    return { error: `We could not send that just now. Please email ${await getCompanyEmail()} directly.` }
  }
  const visitor = await visitorKey(true)

  const body = [
    `Bulk enquiry — ${d.volume}`,
    d.company ? `Company: ${d.company}` : '',
    `Phone: ${d.phone}`,
    state ? `Ships to: ${state.name}` : '',
    d.cadence ? `Reorders: ${d.cadence}` : '',
    categories.length ? `Categories: ${categories.join(', ')}` : '',
    products.length ? `Products: ${products.join(', ')}` : '',
    '',
    d.message ?? '',
  ]
    .filter(Boolean)
    .join('\n')

  let threadId: string | undefined
  try {
    if (!visitor) throw new Error('No visitor key could be issued')
    // Kept so the notification opens this exact conversation.
    const thread = await createThread({
      visitor,
      email: d.email,
      name: d.name,
      subject: `Bulk enquiry — ${d.company || d.name}`,
      body,
      ip,
    })
    threadId = thread.id
  } catch (error) {
    await reportError(error, {
      source: 'action',
      severity: 'FATAL',
      routePath: '/bulk',
      context: { stage: 'persist' },
    })
    return {
      error: `We could not send that just now. Please email ${await getCompanyEmail()} directly.`,
    }
  }

  await notify({
    topic: 'chat-inbound',
    title: `Bulk enquiry — ${d.company || d.name} · ${d.volume}`,
    body: body.slice(0, 400),
    tags: ['package'],
    clickUrl: absoluteUrl(messagesUrl(threadId)),
  })

  const mail = getMailProvider()
  await Promise.allSettled([
    mail.send(bulkEnquiryNotificationEmail(enquiry)),
    mail.send(bulkEnquiryAcknowledgementEmail(enquiry)),
  ]).then((results) => {
    for (const r of results) {
      if (r.status === 'rejected') {
        void reportError(r.reason, {
          source: 'mail',
          routePath: '/bulk',
          context: { stage: 'acknowledgement' },
        })
      }
    }
  })

  return { ok: true }
}
