'use server'

import { z } from 'zod'
import { getCompanyEmail } from '@/lib/site/company-email.server'
import { clientIp, createThread, isBlocked, messagesUrl, visitorId as visitorKey } from '@/lib/chat/core'
import { scanReview } from '@/lib/compliance/lexicon'
import { notify } from '@/lib/notify/ntfy'
import { absoluteUrl } from '@/lib/seo/routes'
import { getMailProvider } from '@/lib/mail/mailer'
import {
  CONTACT_TOPICS,
  contactAcknowledgementEmail,
  contactNotificationEmail,
  type ContactTopic,
} from '@/lib/mail/templates'
import { reportError } from '@/lib/observability/report-error'

export type ContactState = { ok?: boolean; error?: string }

/**
 * Contact enquiry.
 *
 * Six visible fields, which is the same budget checkout runs on. Everything the
 * form asks for is something we would otherwise have to ask for in the first
 * reply — the topic routes it to the right inbox, and the order number is the
 * single most common reason a support thread needs a second round trip.
 *
 * The message lands in THREE places and each has a different job:
 *
 *   · A `SupportThread` — the durable record, and the one the admin inbox reads.
 *     Email can bounce, be filtered, or be sent before the mail provider exists;
 *     the database row is what makes a lost message impossible.
 *   · An ntfy push to ops — because a business where a human verifies every
 *     payment cannot afford to discover a message the next morning.
 *   · Two emails — one to the company inbox with the customer as `replyTo`, one
 *     back to the sender as their receipt.
 *
 * Only the FIRST of those can fail the submission. If the mail provider is down,
 * the customer has still reached us and telling them otherwise would be false.
 */
const schema = z.object({
  name: z.string().trim().min(2, 'Tell us your name.').max(120),
  email: z.string().trim().email('Enter a valid email address.').max(200),
  topic: z.enum(['order', 'bulk', 'general']),
  orderNumber: z.string().trim().max(40).optional().or(z.literal('')),
  message: z.string().trim().min(10, 'Say a little more so we can answer properly.').max(4000),
  /*
    Honeypot. A real person never sees this field and never fills it; the
    scripted submitters that fill every input in a form always do. Cheaper than a
    CAPTCHA, invisible to screen readers, and it costs a legitimate sender
    nothing — which a CAPTCHA cannot claim.
  */
  company: z.string().max(0).optional().or(z.literal('')),
})

export async function submitContact(
  _previous: ContactState,
  formData: FormData,
): Promise<ContactState> {
  const parsed = schema.safeParse({
    name: formData.get('name'),
    email: formData.get('email'),
    topic: formData.get('topic'),
    orderNumber: formData.get('orderNumber') ?? '',
    message: formData.get('message'),
    company: formData.get('company') ?? '',
  })

  if (!parsed.success) {
    /*
      The honeypot is not reported as an error. Telling a bot which field gave it
      away is how the next attempt gets past — and no human can trigger it, so
      there is no one to help by explaining.
    */
    if (parsed.error.issues.some((i) => i.path[0] === 'company')) return { ok: true }
    return { error: parsed.error.issues[0]?.message ?? 'Could not send that message.' }
  }

  const { name, email, topic, message } = parsed.data
  const orderNumber = parsed.data.orderNumber || undefined
  const routed = CONTACT_TOPICS[topic as ContactTopic]

  // A visitor blocked from chat is blocked here too — it is the same inbox.
  const ip = await clientIp()
  if (await isBlocked(ip)) {
    return { error: `We could not send that just now. Please email ${await getCompanyEmail()} directly.` }
  }

  // Same anonymous visitor key the chat uses, so the enquiry is also in their chat.
  const visitor = await visitorKey(true)

  const subject = `${routed.label}${orderNumber ? ` — ${orderNumber}` : ''}`

  let threadId: string | undefined
  try {
    if (!visitor) throw new Error('No visitor key could be issued')
    // Kept so the notification opens this exact conversation.
    const thread = await createThread({
      visitor,
      email,
      name,
      subject,
      body: orderNumber ? `Order ID ${orderNumber}\n\n${message}` : message,
      ip,
    })
    threadId = thread.id
  } catch (error) {
    await reportError(error, {
      source: 'action',
      severity: 'FATAL',
      routePath: '/contact',
      context: { stage: 'persist' },
    })
    return {
      error: `We could not send that just now. Please email ${await getCompanyEmail()} directly.`,
    }
  }

  /*
    Flagged, not blocked. A customer may write whatever they like — but an
    operator answering at speed should not accidentally affirm a health claim,
    and the flag on the notification is what stops that.
  */
  const flags = scanReview(message)

  await notify({
    topic: 'chat-inbound',
    title: `Contact: ${routed.label} — ${name}`,
    body:
      message.slice(0, 240) +
      (flags.matches.length > 0
        ? `\n\n⚠ Mentions: ${flags.matches.map((m) => m.term).join(', ')} — take care replying.`
        : ''),
    tags: ['envelope'],
    clickUrl: absoluteUrl(messagesUrl(threadId)),
  })

  const enquiry = { name, email, topic: topic as ContactTopic, message, ...(orderNumber ? { orderNumber } : {}) }
  const mail = getMailProvider()
  // Never fails the submission — the message is already recorded and ops is
  // already pushed. A mail outage must not tell a customer we did not hear them.
  await Promise.allSettled([
    mail.send(contactNotificationEmail(enquiry)),
    mail.send(contactAcknowledgementEmail(enquiry)),
  ]).then((results) => {
    for (const r of results) {
      if (r.status === 'rejected') {
        void reportError(r.reason, {
          source: 'mail',
          routePath: '/contact',
          context: { stage: 'acknowledgement' },
        })
      }
    }
  })

  return { ok: true }
}
