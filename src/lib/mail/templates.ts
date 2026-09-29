import { BRAND } from '@/lib/brand'
import { PAYMENT_LABELS } from '@/lib/orders/types'
import type { Order } from '@/lib/orders/types'
import { jurisdictionName } from '@/lib/compliance/jurisdictions'
import { absoluteUrl, url } from '@/lib/seo/routes'
import { formatCents } from '@/lib/utils'
import type { EmailMessage } from './mailer'
import { instructionsAsText, type PaymentInstructions } from '@/lib/payments/instructions'
import { COMPANY_EMAIL_TOKEN } from '@/lib/site/company-email'
import { welcomeLines } from '@/lib/orders/welcome-lines'
import {
  emailButton,
  emailHeading,
  emailParagraph,
  emailQuote,
  emailRow,
  emailShell,
  INK,
} from './layout'

/**
 * Transactional email copy.
 *
 * TEXT FIRST, always. The plain-text body is written first and is the one that has
 * to make sense on its own — it is what most spam filters read, what a watch and a
 * terminal client render, and what survives when images are blocked. A customer
 * waiting to hear whether their order is confirmed wants the answer, not a layout.
 *
 * The HTML alternative is built beside it from `./layout`, which carries the
 * branded shell. It says the SAME THING — never more, never an offer that only
 * exists in one version. Two bodies that disagree is how an email ends up making
 * a promise nobody in the business knows about.
 *
 * Every string here passes the compliance lexicon: no health claims, no consumption
 * language on botanical lines. Email is content like any other surface.
 */

function signature(): string {
  return [
    '',
    '—',
    BRAND.name,
    absoluteUrl('/'),
    `Questions: ${COMPANY_EMAIL_TOKEN}`,
    '',
    'These statements have not been evaluated by the Food and Drug Administration.',
    'This product is not intended to diagnose, mitigate, or prevent any disease or condition.',
  ].join('\n')
}

function orderSummary(order: Order): string {
  const lines = order.items.map(
    (i) => `  ${i.quantity} x ${i.productName} — ${formatCents(i.lineTotalCents)}`,
  )
  return [
    ...lines,
    '',
    `  Subtotal: ${formatCents(order.subtotalCents)}`,
    /*
      The coupon line sits directly under the subtotal because that is what it
      discounts — goods, never shipping. Without it, a coupon order's receipt reads
      Subtotal + Shipping and then a Total that is neither: the customer's own
      arithmetic fails on the one document meant to reassure them. Named by its
      code so it can be matched to the email the customer found it in.
    */
    ...(order.discountCents > 0
      ? [`  Discount${order.couponCode ? ` (${order.couponCode})` : ''}: -${formatCents(order.discountCents)}`]
      : []),
    ...welcomeLines(order).map((line) => `  ${line.label}: -${formatCents(line.cents)}`),
    `  Shipping: ${formatCents(order.shippingCents)}`,
    /*
      Shown only when there is one. An invoice line reading "Discount: $0.00" invites
      the question of what discount was missed.
    */
    ...(order.paymentDiscountCents > 0
      ? [`  Bitcoin discount: -${formatCents(order.paymentDiscountCents)}`]
      : []),
    `  Total:    ${formatCents(order.totalCents)}`,
  ].join('\n')
}

/** The line items and totals, as a table. Mirrors `orderSummary` exactly. */
function orderSummaryHtml(order: Order): string {
  const rows = order.items
    .map((i) => emailRow(`${i.quantity} × ${i.productName}`, formatCents(i.lineTotalCents)))
    .join('')
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 18px;border-top:1px solid #DFE2E5;border-bottom:1px solid #DFE2E5;padding:4px 0;">
    ${rows}
    ${emailRow('Subtotal', formatCents(order.subtotalCents))}
    ${
      order.discountCents > 0
        ? emailRow(
            // Raw, not escaped here: `emailRow` escapes its label itself, and doing it
            // twice would print `&amp;` in the customer's inbox.
            `Discount${order.couponCode ? ` (${order.couponCode})` : ''}`,
            `-${formatCents(order.discountCents)}`,
          )
        : ''
    }
    ${welcomeLines(order)
      .map((line) => emailRow(line.label, `-${formatCents(line.cents)}`))
      .join('')}
    ${emailRow('Shipping', formatCents(order.shippingCents))}
    ${
      order.paymentDiscountCents > 0
        ? emailRow('Bitcoin discount', `-${formatCents(order.paymentDiscountCents)}`)
        : ''
    }
    ${emailRow('Total', formatCents(order.totalCents))}
  </table>`
}

export function orderReceivedEmail(order: Order): EmailMessage {
  const statusUrl = absoluteUrl(url.orderStatus(order.orderToken))
  return {
    to: order.email,
    subject: `Order ${order.orderNumber} received — next steps`,
    text: [
      `Hi ${order.firstName},`,
      '',
      `We have your order request and we are checking two things: that we can lawfully ship every item to ${jurisdictionName(order.stateCode)}, and that we have the stock.`,
      '',
      'A person is checking your order now. Payment details will follow in your order chat and by email.',
      '',
      `Order ${order.orderNumber}`,
      orderSummary(order),
      '',
      `You chose to pay by ${PAYMENT_LABELS[order.preferredPaymentMethod]}.`,
      '',
      `Track it here: ${statusUrl}`,
      '',
      'Keep that link. It is the only way to reach this order without signing in, and your Order ID is also your payment reference.',
      signature(),
    ].join('\n'),
    html: emailShell({
      title: `Order ${order.orderNumber} received`,
      preheader: 'We have your order. Payment details follow once a person has checked it.',
      body: [
        emailHeading(`Hi ${order.firstName}, we have your order`),
        emailParagraph(
          `We are checking two things: that we can lawfully ship every item to ${jurisdictionName(order.stateCode)}, and that we have the stock.`,
        ),
        emailParagraph(
          'A person is checking your order now. Payment details will follow in your order chat and by email.',
        ),
        orderSummaryHtml(order),
        emailParagraph(
          `You chose to pay by ${PAYMENT_LABELS[order.preferredPaymentMethod]}.`,
        ),
        emailButton('Track this order', statusUrl),
        emailParagraph(
          'Keep that link. It is the only way to reach this order without signing in, and your Order ID is also your payment reference.',
        ),
      ].join(''),
    }),
  }
}

/**
 * The payment details, sent the moment the owner issues them from the admin.
 *
 * It CARRIES the details now, where it used to point at the order page and promise
 * "we never send payment details in an email". The owner asked for details to reach
 * the customer by email and chat at once. The protection that promise gave, against
 * a fake email with someone else's handle, is kept in a form that stays true: the
 * same details are always on the customer's order page on mimosalsd.com, and they
 * are told not to pay if a message ever differs from it.
 *
 * Text and HTML carry everything the invoice image does. The image is attached by
 * the caller (lib/payments/issue.ts); the message stands on its own without it.
 */
export function paymentInstructionsEmail(order: Order, ins: PaymentInstructions): EmailMessage {
  const statusUrl = absoluteUrl(url.orderStatus(order.orderToken))
  return {
    to: order.email,
    subject: `Order ID ${order.orderNumber} — your ${ins.methodLabel} payment details`,
    text: [
      `Hi ${order.firstName},`,
      '',
      'Your order is verified and reserved. Here is how to pay. Your invoice is attached.',
      '',
      instructionsAsText(ins, order.orderNumber),
      '',
      `The same details are on your order page: ${statusUrl}`,
      signature(),
    ].join('\n'),
    html: emailShell({
      title: `Order ID ${order.orderNumber} — payment details`,
      preheader: `${ins.headline}. Order ID ${order.orderNumber}.`,
      body: [
        emailHeading(`Hi ${order.firstName}, here is how to pay`),
        emailParagraph('Your order is verified and reserved. Your invoice is attached to this email.'),
        emailSubheading(ins.headline),
        `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 18px;">
          ${emailRow('Order ID', order.orderNumber)}
          ${ins.summary.map((row) => emailRow(row.label, row.value)).join('')}
        </table>`,
        ...(ins.requirement ? [emailParagraph(ins.requirement)] : []),
        emailSubheading('How to pay'),
        `<ol style="margin:0 0 18px;padding-left:22px;">${ins.steps
          .map((step) => `<li style="margin:0 0 8px;">${escapeHtml(step)}</li>`)
          .join('')}</ol>`,
        emailSubheading('Please note'),
        `<ul style="margin:0 0 18px;padding-left:22px;">${ins.warnings
          .map((w) => `<li style="margin:0 0 8px;">${escapeHtml(w)}</li>`)
          .join('')}</ul>`,
        emailButton('Open your order page', statusUrl),
        emailParagraph(ins.safety),
      ].join(''),
    }),
  }
}

export function paymentConfirmedEmail(order: Order): EmailMessage {
  return {
    to: order.email,
    subject: `Payment received — order ${order.orderNumber}`,
    text: [
      `Hi ${order.firstName},`,
      '',
      'We have confirmed your payment. Your order is now being prepared.',
      '',
      `Order ${order.orderNumber}`,
      orderSummary(order),
      '',
      'We will email tracking as soon as it ships.',
      '',
      `Track it: ${absoluteUrl(url.orderStatus(order.orderToken))}`,
      signature(),
    ].join('\n'),
    html: emailShell({
      title: `Payment received — order ${order.orderNumber}`,
      preheader: 'Payment confirmed. Your order is being prepared.',
      body: [
        emailHeading(`Hi ${order.firstName}, payment confirmed`),
        emailParagraph('Your order is now being prepared.'),
        orderSummaryHtml(order),
        emailParagraph('We will email tracking as soon as it ships.'),
        emailButton('Track this order', absoluteUrl(url.orderStatus(order.orderToken))),
      ].join(''),
    }),
  }
}

export function shippedEmail(order: Order, tracking?: string): EmailMessage {
  return {
    to: order.email,
    subject: `Order ${order.orderNumber} is on its way`,
    text: [
      `Hi ${order.firstName},`,
      '',
      order.shipments.length > 1
        ? `Your order is on its way in ${order.shipments.length} separate shipments, because these products travel under different rules.`
        : 'Your order is on its way.',
      '',
      tracking ? `Tracking: ${tracking}` : 'Tracking details follow shortly.',
      '',
      `Order status: ${absoluteUrl(url.orderStatus(order.orderToken))}`,
      signature(),
    ]
      .filter(Boolean)
      .join('\n'),
    html: emailShell({
      title: `Order ${order.orderNumber} is on its way`,
      preheader: tracking ? `Tracking: ${tracking}` : 'Tracking details follow shortly.',
      body: [
        emailHeading(`Hi ${order.firstName}, your order is on its way`),
        emailParagraph(
          order.shipments.length > 1
            ? `It travels in ${order.shipments.length} separate shipments, because these products move under different rules.`
            : 'It left us today.',
        ),
        emailParagraph(tracking ? `Tracking: ${tracking}` : 'Tracking details follow shortly.'),
        emailButton('Order status', absoluteUrl(url.orderStatus(order.orderToken))),
      ].join(''),
    }),
  }
}

/**
 * Abandoned cart.
 *
 * One reminder, not a sequence. In a category where the buyer is already cautious,
 * repeated chasing reads as pressure and pressure reads as untrustworthy.
 */
export function abandonedCartEmail(email: string, firstName?: string): EmailMessage {
  return {
    to: email,
    subject: 'Your cart is still here',
    text: [
      firstName ? `Hi ${firstName},` : 'Hi,',
      '',
      'You left something in your cart. It is still there if you want it.',
      '',
      'A reminder of how ordering works here: you place the order, a person confirms it, and payment details arrive in your order chat and by email for the method you chose.',
      '',
      `Your cart: ${absoluteUrl(url.cart())}`,
      '',
      'If you were unsure whether we can ship to your state, you can check that in one tap:',
      absoluteUrl(url.shopNearMe()),
      signature(),
    ].join('\n'),
    html: emailShell({
      title: 'Your cart is still here',
      preheader: 'You order, a person confirms it, then payment details arrive in your order chat.',
      body: [
        emailHeading(firstName ? `Hi ${firstName}, your cart is still here` : 'Your cart is still here'),
        emailParagraph('You left something in it. It is still there if you want it.'),
        emailParagraph(
          'A reminder of how ordering works here: you place the order, a person confirms it, and payment details arrive in your order chat and by email for the method you chose.',
        ),
        emailButton('Open your cart', absoluteUrl(url.cart())),
        emailParagraph(
          'If you were unsure whether we can ship to your state, you can check that in one tap.',
        ),
        emailButton('Check your state', absoluteUrl(url.shopNearMe())),
      ].join(''),
    }),
  }
}

/** Sent after delivery. Also asks for the Google review that local SEO depends on. */
export function reviewRequestEmail(order: Order): EmailMessage {
  return {
    to: order.email,
    subject: `How was your order, ${order.firstName}?`,
    text: [
      `Hi ${order.firstName},`,
      '',
      'Your order arrived a few days ago. If you have a moment, we would value your honest impression of the products and the service.',
      '',
      'One thing we have to ask: please do not describe health or medical effects in a review. We are not permitted to publish those, and we would have to withhold it — which we would rather not do to something you took the time to write.',
      '',
      `Order ${order.orderNumber}`,
      signature(),
    ].join('\n'),
    html: emailShell({
      title: `How was your order, ${order.firstName}?`,
      preheader: 'We would value your honest impression.',
      body: [
        emailHeading(`How was your order, ${order.firstName}?`),
        emailParagraph(
          'It arrived a few days ago. If you have a moment, we would value your honest impression of the products and the service.',
        ),
        emailParagraph(
          'One thing we have to ask: please do not describe health or medical effects in a review. We are not permitted to publish those, and we would have to withhold it — which we would rather not do to something you took the time to write.',
        ),
        emailParagraph(`Order ${order.orderNumber}`),
      ].join(''),
    }),
  }
}

// ─────────────────────────────────────────────────────────────────────────────
//  Contact form
// ─────────────────────────────────────────────────────────────────────────────

export type ContactTopic = 'order' | 'bulk' | 'general'

export interface ContactEnquiry {
  readonly name: string
  readonly email: string
  readonly topic: ContactTopic
  readonly orderNumber?: string
  readonly message: string
}

/**
 * `label` goes in the email subject, `short` on the form's radio tiles.
 *
 * They differ because the two jobs differ. "[An order I have placed] Dana
 * Whitfield" is what someone triaging an inbox needs to see; the same string on a
 * 190px-wide radio tile wraps to two lines and makes one option taller than the
 * two beside it.
 */
export const CONTACT_TOPICS: Record<ContactTopic, { label: string; short: string }> = {
  order: { label: 'An order I have placed', short: 'My order' },
  bulk: { label: 'Bulk or wholesale', short: 'Bulk order' },
  general: { label: 'Something else', short: 'Something else' },
}

/**
 * What the sender gets back, immediately.
 *
 * Sent for one reason: a form that swallows a message and says "thanks" on a page
 * the sender then closes leaves them with no record that they wrote to us at all.
 * This is the record. It quotes their own words back so they can see exactly what
 * arrived, and it names the inbox it went to so they can chase it themselves.
 *
 * It promises a reply time and nothing else. No offer, no upsell — this is an
 * acknowledgement, and turning it into marketing is how acknowledgements start
 * getting filtered.
 */
export function contactAcknowledgementEmail(enquiry: ContactEnquiry): EmailMessage {
  const topic = CONTACT_TOPICS[enquiry.topic]
  const first = enquiry.name.split(/\s+/)[0] ?? enquiry.name
  return {
    to: enquiry.email,
    replyTo: COMPANY_EMAIL_TOKEN,
    subject: `We have your message — ${BRAND.name}`,
    text: [
      `Hi ${first},`,
      '',
      'We have your message. A person reads every one of these, and we reply within one business day, US business hours.',
      '',
      `It went to: ${COMPANY_EMAIL_TOKEN}`,
      ...(enquiry.orderNumber ? [`Order reference: ${enquiry.orderNumber}`] : []),
      '',
      'What you sent us:',
      '',
      enquiry.message,
      '',
      'If you need to add anything, reply to this email — it lands on the same thread.',
      signature(),
    ].join('\n'),
    html: emailShell({
      title: 'We have your message',
      preheader: 'A person reads every one of these. We reply within one business day.',
      body: [
        emailHeading(`Hi ${first}, we have your message`),
        emailParagraph(
          'A person reads every one of these, and we reply within one business day, US business hours.',
        ),
        `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 18px;">
          ${emailRow('Subject', topic.label)}
          ${emailRow('Sent to', COMPANY_EMAIL_TOKEN)}
          ${enquiry.orderNumber ? emailRow('Order reference', enquiry.orderNumber) : ''}
        </table>`,
        emailParagraph('What you sent us:'),
        emailQuote(enquiry.message),
        emailParagraph(
          'If you need to add anything, reply to this email — it lands on the same thread.',
        ),
      ].join(''),
    }),
  }
}

/**
 * What the inbox gets.
 *
 * `replyTo` is the CUSTOMER, so hitting reply answers them rather than us. That
 * one header is the difference between a form that works and a form that
 * generates a second copy-and-paste step for whoever is on support that day.
 */
export function contactNotificationEmail(enquiry: ContactEnquiry): EmailMessage {
  const topic = CONTACT_TOPICS[enquiry.topic]
  return {
    to: COMPANY_EMAIL_TOKEN,
    replyTo: enquiry.email,
    subject: `[${topic.label}] ${enquiry.name}${enquiry.orderNumber ? ` — ${enquiry.orderNumber}` : ''}`,
    text: [
      `From: ${enquiry.name} <${enquiry.email}>`,
      `Topic: ${topic.label}`,
      ...(enquiry.orderNumber ? [`Order: ${enquiry.orderNumber}`] : []),
      '',
      enquiry.message,
    ].join('\n'),
    html: emailShell({
      title: `Enquiry from ${enquiry.name}`,
      preheader: enquiry.message.slice(0, 120),
      body: [
        emailHeading(`${topic.label} — ${enquiry.name}`),
        `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 18px;">
          ${emailRow('From', `${enquiry.name} <${enquiry.email}>`)}
          ${enquiry.orderNumber ? emailRow('Order', enquiry.orderNumber) : ''}
        </table>`,
        emailQuote(enquiry.message),
      ].join(''),
    }),
  }
}

// ─────────────────────────────────────────────────────────────────────────────
//  Bulk and wholesale enquiries
// ─────────────────────────────────────────────────────────────────────────────

export interface BulkEnquiry {
  readonly name: string
  readonly company?: string
  readonly email: string
  readonly phone: string
  readonly stateCode?: string
  /** Category names, as shown on the form. */
  readonly categories: readonly string[]
  /** Product names, as shown on the form. */
  readonly products: readonly string[]
  /** The volume band the sender picked, in their own words. */
  readonly volume: string
  readonly cadence?: string
  readonly message?: string
}

function bulkLines(enquiry: BulkEnquiry): ReadonlyArray<readonly [string, string]> {
  return [
    ['From', enquiry.company ? `${enquiry.name}, ${enquiry.company}` : enquiry.name],
    ['Email', enquiry.email],
    ['Phone', enquiry.phone],
    ...(enquiry.stateCode ? ([['Ships to', enquiry.stateCode]] as const) : []),
    ['Volume', enquiry.volume],
    ...(enquiry.cadence ? ([['Reorders', enquiry.cadence]] as const) : []),
    [
      'Categories',
      enquiry.categories.length ? enquiry.categories.join(', ') : 'Not specified',
    ],
    [
      'Products',
      enquiry.products.length ? enquiry.products.join(', ') : 'Not specified',
    ],
  ]
}

/**
 * What the wholesale inbox gets.
 *
 * Every field the quote actually needs, in one table, in the order someone
 * pricing it reads them: who, how to reach them, how much, how often, of what.
 * `replyTo` is the ENQUIRER, so hitting reply answers them rather than us — the
 * difference between a form that works and one that adds a copy-and-paste step
 * to every lead.
 */
export function bulkEnquiryNotificationEmail(enquiry: BulkEnquiry): EmailMessage {
  const rows = bulkLines(enquiry)
  return {
    to: COMPANY_EMAIL_TOKEN,
    replyTo: enquiry.email,
    subject: `Bulk enquiry — ${enquiry.company || enquiry.name} · ${enquiry.volume}`,
    text: [
      'New bulk / wholesale enquiry.',
      '',
      ...rows.map(([k, v]) => `${k}: ${v}`),
      ...(enquiry.message ? ['', 'Message:', '', enquiry.message] : []),
    ].join('\n'),
    html: emailShell({
      title: 'Bulk enquiry',
      preheader: `${enquiry.company || enquiry.name} · ${enquiry.volume}`,
      body: [
        emailHeading(`Bulk enquiry — ${enquiry.company || enquiry.name}`),
        `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 18px;">
          ${rows.map(([k, v]) => emailRow(k, v)).join('')}
        </table>`,
        ...(enquiry.message ? [emailParagraph('What they wrote:'), emailQuote(enquiry.message)] : []),
      ].join(''),
    }),
  }
}

/**
 * What the enquirer gets back, immediately.
 *
 * It quotes their own selection back so they can see exactly what arrived, and it
 * commits to a reply time and nothing else. No pricing, no offer — a quote for
 * volume in this category depends on the destination state and the product line,
 * and a number sent before a human has looked is a number we would have to walk
 * back.
 */
export function bulkEnquiryAcknowledgementEmail(enquiry: BulkEnquiry): EmailMessage {
  const first = enquiry.name.split(/\s+/)[0] ?? enquiry.name
  const rows = bulkLines(enquiry).filter(([k]) => k !== 'Email' && k !== 'Phone')
  return {
    to: enquiry.email,
    replyTo: COMPANY_EMAIL_TOKEN,
    subject: `We have your bulk enquiry — ${BRAND.name}`,
    text: [
      `Hi ${first},`,
      '',
      'We have your bulk enquiry. A person prices these individually — we reply within one business day, US business hours, with a figure rather than a range.',
      '',
      'What you sent us:',
      '',
      ...rows.map(([k, v]) => `${k}: ${v}`),
      ...(enquiry.message ? ['', enquiry.message] : []),
      '',
      `If anything above is wrong, reply to this email — it reaches ${COMPANY_EMAIL_TOKEN} directly.`,
      signature(),
    ].join('\n'),
    html: emailShell({
      title: 'We have your bulk enquiry',
      preheader: 'A person prices these individually. We reply within one business day.',
      body: [
        emailHeading(`Hi ${first}, we have your enquiry`),
        emailParagraph(
          'A person prices these individually — we reply within one business day, US business hours, with a figure rather than a range.',
        ),
        `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 18px;">
          ${rows.map(([k, v]) => emailRow(k, v)).join('')}
        </table>`,
        ...(enquiry.message ? [emailQuote(enquiry.message)] : []),
        emailParagraph(
          `If anything above is wrong, reply to this email — it reaches ${COMPANY_EMAIL_TOKEN} directly.`,
        ),
      ].join(''),
    }),
  }
}

/** A bold line inside the body, for the payment email's sections. Escapes its text. */
function emailSubheading(text: string): string {
  return `<p style="margin:18px 0 8px;font:600 15px/1.5 -apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:${INK};">${escapeHtml(text)}</p>`
}

/** The instruction text is plain text with $ signs and quotes; list items go into HTML escaped. */
function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}
