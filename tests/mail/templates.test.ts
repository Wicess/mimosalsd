import { describe, expect, it } from 'vitest'
import { buildPaymentInstructions } from '@/lib/payments/instructions'
import {
  abandonedCartEmail,
  orderReceivedEmail,
  paymentConfirmedEmail,
  paymentInstructionsEmail,
  reviewRequestEmail,
  shippedEmail,
} from '@/lib/mail/templates'
import { scanText } from '@/lib/compliance/lexicon'
import { CANNED_REPLIES } from '@/lib/support/canned'
import { JURISDICTIONS } from '@/lib/compliance/jurisdictions'
import { url } from '@/lib/seo/routes'
import type { Order } from '@/lib/orders/types'

const order: Order = {
  id: 'o1',
  orderNumber: '202608-A1B2C3',
  orderToken: 'tok_abcdefghijklmnopqrstuvwxyz012345',
  status: 'PENDING_VERIFICATION',
  email: 'buyer@example.com',
  phone: '+15125550123',
  firstName: 'Sam',
  lastName: 'Buyer',
  addressLine1: '1 Main St',
  city: 'Austin',
  stateCode: 'TX',
  postalCode: '78701',
  items: [
    {
      productSlug: 'mhrb-powder',
      variantId: 'v1',
      productName: 'Mimosa Hostilis Root Bark Powder — 100g',
      variantName: 'Default',
      productLine: 'MIMOSA_HOSTILIS',
      fulfillmentChannel: 'PARCEL',
      unitPriceCents: 4500,
      quantity: 2,
      lineTotalCents: 9000,
    },
  ],
  shipments: [
    {
      channel: 'PARCEL',
      label: 'Standard parcel',
      costCents: 795,
      requiresAdultSignature: false,
      estimate: '3–5 business days',
    },
  ],
  subtotalCents: 9000,
  shippingCents: 795,
  paymentDiscountCents: 0,
  discountCents: 0,
  subscriberDiscountCents: 0,
  appDiscountCents: 0,
  totalCents: 9795,
  freeShippingApplied: false,
  preferredPaymentMethod: 'CASHAPP',
  attestations: [],
  events: [],
  complianceSnapshot: {
    stateCode: 'TX',
    evaluatedAt: '2026-08-28T00:00:00.000Z',
    requiresAgeVerification: false,
    requiresAdultSignature: false,
  },
  createdAt: '2026-08-28T00:00:00.000Z',
  expiresAt: '2026-08-30T00:00:00.000Z',
}

const cashApp = buildPaymentInstructions({
  method: 'CASHAPP',
  payTo: '$SnypeGate',
  amountCents: order.totalCents,
  orderId: order.orderNumber,
  payBy: order.expiresAt,
})
const bitcoin = buildPaymentInstructions({
  method: 'BITCOIN',
  payTo: 'bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4',
  amountCents: order.totalCents,
  btcAmount: '0.00100000',
  btcRateUsd: 60000,
  btcQuoteUntil: '2026-08-28T01:00:00.000Z',
  orderId: order.orderNumber,
  payBy: order.expiresAt,
})

const ALL = [
  ['order received', orderReceivedEmail(order)],
  ['payment instructions (Cash App)', paymentInstructionsEmail(order, cashApp)],
  ['payment instructions (Bitcoin)', paymentInstructionsEmail(order, bitcoin)],
  ['payment confirmed', paymentConfirmedEmail(order)],
  ['shipped', shippedEmail(order, 'TRACK123')],
  ['abandoned cart', abandonedCartEmail('buyer@example.com', 'Sam')],
  ['review request', reviewRequestEmail(order)],
] as const

describe('every transactional email passes the compliance lexicon', () => {
  it.each(ALL)('%s is clean', (_name, message) => {
    // Email is content like any other surface. A health claim here is the same FDA
    // exposure as one on a product page.
    const result = scanText(`${message.subject}\n${message.text}`, {
      productLines: ['MIMOSA_HOSTILIS', 'AMANITA', 'VAPE'],
    })
    expect(result.clean, result.blocking.map((m) => m.term).join(', ')).toBe(true)
  })
})

describe('email essentials', () => {
  it.each(ALL)('%s has a recipient, a subject and a body', (_name, message) => {
    expect(message.to).toContain('@')
    expect(message.subject.length).toBeGreaterThan(5)
    expect(message.text.length).toBeGreaterThan(80)
  })

  it.each(ALL)('%s carries the FDA disclaimer', (_name, message) => {
    expect(message.text).toContain('not been evaluated by the Food and Drug Administration')
  })

  it('carries the payment details, the steps and the order page link (owner request, 2026-09-13)', () => {
    const email = paymentInstructionsEmail(order, cashApp)
    expect(email.text).toContain('Send to: $SnypeGate')
    expect(email.text).toContain('How to pay:')
    expect(email.text).toContain(order.orderToken) // the order page, where the same details live
    expect(email.html).toContain('$SnypeGate')
    expect(email.html).not.toContain('&lt;strong&gt;') // no double-escaped markup
  })

  it('tells the customer how to recognise a fake: details always match the order page', () => {
    const email = paymentInstructionsEmail(order, cashApp)
    expect(email.text).toMatch(/always match your order page on snypegate\.com/)
    expect(email.text).not.toContain('never send payment details in an email')
  })

  it('states the Order ID as the payment reference', () => {
    expect(orderReceivedEmail(order).text).toContain(order.orderNumber)
    expect(paymentInstructionsEmail(order, cashApp).text).toContain('Order ID: 202608-A1B2C3')
    expect(paymentInstructionsEmail(order, cashApp).subject).toContain('Order ID 202608-A1B2C3')
  })

  it('says nothing about signing or photo ID, even for a shipment the carrier signs for (owner, 2026-09-15)', () => {
    const withSignature: Order = {
      ...order,
      shipments: [{ ...order.shipments[0]!, requiresAdultSignature: true }],
    }
    for (const email of [paymentConfirmedEmail(order), paymentConfirmedEmail(withSignature)]) {
      expect(email.text).not.toMatch(/photo ID|must sign|signature/i)
      expect(email.text).toContain('We will email tracking as soon as it ships.')
    }
  })

  it('asks reviewers not to describe health effects', () => {
    expect(reviewRequestEmail(order).text).toContain('health or medical effects')
  })
})

describe('quick chat canned replies', () => {
  it('covers the four questions that account for most contacts', () => {
    expect(CANNED_REPLIES.map((r) => r.id)).toEqual([
      'legality',
      'payment',
      'order-status',
      'lab-tested',
    ])
  })

  it('every reply links somewhere real and passes the lexicon', () => {
    for (const reply of CANNED_REPLIES) {
      expect(reply.href.startsWith('/'), reply.id).toBe(true)
      expect(reply.linkLabel.length).toBeGreaterThan(3)
      const result = scanText(`${reply.question} ${reply.answer}`, {
        productLines: ['MIMOSA_HOSTILIS', 'AMANITA', 'VAPE'],
      })
      expect(result.clean, `${reply.id}: ${result.blocking.map((m) => m.term)}`).toBe(true)
    }
  })

  /*
    This test used to assert the opposite, and that is why it is worth a comment.

    It required the legality macro to contain "49 states" and "Louisiana", which
    pinned a support reply to a state position that lives in `state_rules` — a row an
    administrator can change without a deploy. When every line was set to ALLOWED on
    2026-09-05, the macro carried on telling customers we would not ship to Louisiana,
    and this test was what held it there.

    A test that enforces a stale fact is worse than no test at all: it makes the drift
    look deliberate and it fails the person who tries to correct it. So the invariant
    is inverted. A canned reply may not state a position at all — it points at the
    checker, which reads the live rows.
  */
  it('never hardcodes a state count or a state name into a canned reply', () => {
    for (const reply of CANNED_REPLIES) {
      expect(
        /\b\d{1,2}\s+states\b/i.test(reply.answer),
        `${reply.id} hardcodes a state count`,
      ).toBe(false)
      for (const jurisdiction of JURISDICTIONS) {
        expect(
          reply.answer.includes(jurisdiction.name),
          `${reply.id} names ${jurisdiction.name}`,
        ).toBe(false)
      }
    }
  })

  it('sends the legality question to the state checker', () => {
    const legality = CANNED_REPLIES.find((r) => r.id === 'legality')
    expect(legality).toBeDefined()
    // The answer is a link to live data, not a claim. That is the whole point.
    expect(legality?.href).toBe(url.shopNearMe())
  })
})


/*
  THE RECEIPT HAS TO ADD UP.

  Before coupons, the breakdown was Subtotal, Shipping, Bitcoin discount, Total — and
  a coupon order rendered through it would show a Total that was none of those lines
  combined. These assert the coupon line is present, named, and that the lines in the
  plain-text receipt reconcile to the total a customer is asked to pay.
*/
describe('a coupon on the receipt', () => {
  const discounted = {
    ...order,
    subtotalCents: 10_000,
    shippingCents: 895,
    discountCents: 1_000,
    couponCode: 'SAVE10',
    paymentDiscountCents: 630, // 7% of the post-coupon $90
    totalCents: 10_000 - 1_000 - 630 + 895,
  }

  it('names the code and the amount in the text receipt', () => {
    const { text } = orderReceivedEmail(discounted)
    expect(text).toContain('Discount (SAVE10): -$10')
  })

  it('names the code and the amount in the HTML receipt', () => {
    const { html } = orderReceivedEmail(discounted)
    expect(html).toContain('Discount (SAVE10)')
    expect(html).toContain('-$10')
  })

  it('reconciles: every line in the text receipt sums to the total', () => {
    const { text } = orderReceivedEmail(discounted)
    const amount = (label: string) => {
      const match = new RegExp(`${label}[^:]*:\\s*(-?)\\$([\\d,.]+)`).exec(text)
      if (!match) throw new Error(`no ${label} line`)
      const cents = Math.round(Number(match[2]!.replace(/,/g, '')) * 100)
      return match[1] === '-' ? -cents : cents
    }
    const sum =
      amount('Subtotal') + amount('Discount') + amount('Shipping') + amount('Bitcoin discount')
    expect(sum).toBe(amount('Total'))
    expect(sum).toBe(discounted.totalCents)
  })

  it('shows no discount line when there is no coupon', () => {
    const { text } = orderReceivedEmail(order)
    expect(text).not.toMatch(/Discount[^:]*:/)
  })

  it('does not double-escape the code in the HTML', () => {
    const { html } = orderReceivedEmail({ ...discounted, couponCode: 'A&B' })
    expect(html).toContain('A&amp;B')
    expect(html).not.toContain('A&amp;amp;B')
  })
})
