'use server'

import { ensureLiveStateRules } from '@/lib/compliance/live-state-rules'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { eligibleSubtotalCents, evaluateCoupon, orderTotals } from '@/lib/orders/coupons'
import { decideWelcome, joinListFromCheckout } from '@/lib/orders/welcome'
import { trackCart } from '@/lib/cart/track'
import { creditForOrder } from '@/lib/promoters/credit'
import { claimRedemption, findCoupon, releaseRedemption } from '@/lib/orders/coupon-store'
import { resolveCartLive } from '@/lib/catalog/live-cart'
import { readCart, writeCart } from '@/lib/cart/storage'
import { EMPTY_CART } from '@/lib/cart/types'
import { getJurisdiction } from '@/lib/compliance/jurisdictions'
import {
  INTENDED_USE_ATTESTATION,
} from '@/lib/compliance/disclaimers'
import { sendEmail } from '@/lib/mail/mailer'
import { isUniqueViolation } from '@/lib/db/errors'
import { reportError } from '@/lib/observability/report-error'
import { after } from 'next/server'
import { ensureThread, visitorId } from '@/lib/chat/core'
import { linkOrderToChat, sendReceivedInvoice } from '@/lib/invoices/deliver'
import { orderReceivedEmail } from '@/lib/mail/templates'
import { notify } from '@/lib/notify/ntfy'
import {
  generateOrderId,
  generateOrderNumber,
  generateOrderToken,
  orders,
} from '@/lib/orders/repository'
import {
  PAYMENT_LABELS,
  type AcceptedAttestation,
  type Order,
  type PaymentMethod,
} from '@/lib/orders/types'
import { absoluteUrl, url } from '@/lib/seo/routes'
import { formatCents } from '@/lib/utils'
import { recordActivity } from '@/lib/visitors/record-activity'

/**
 * Checkout submission.
 *
 * Eight visible fields. Every field past the eighth costs 4–6% completion, and we can
 * afford eight only because there is no payment step — that is the one real advantage
 * of the manual-payment model, and it should be spent on conversion, not squandered.
 */
const checkoutSchema = z.object({
  email: z.string().email('Enter a valid email address.').max(200),
  phone: z.string().min(7, 'Enter a phone number we can reach you on.').max(30),
  firstName: z.string().min(1, 'Enter your first name.').max(80),
  lastName: z.string().min(1, 'Enter your last name.').max(80),
  addressLine1: z.string().min(3, 'Enter your street address.').max(200),
  addressLine2: z.string().max(200).optional(),
  city: z.string().min(1, 'Enter your city.').max(120),
  stateCode: z.string().length(2, 'Choose your state.'),
  postalCode: z.string().regex(/^\d{5}(-\d{4})?$/, 'Enter a valid ZIP code.'),
  paymentMethod: z.enum(['CASHAPP', 'CHIME', 'APPLE_CASH', 'BITCOIN']),
  // No age or payment confirmation here: 64f18fe removed both checkboxes from the
  // form by decision (the age gate is the age control) and meant to remove this
  // validation with them. Left required, it refused every order with errors the
  // form had no field to show, so "Submit order request" appeared to do nothing.
  intendedUseConfirmed: z.literal('on').optional(),
  /*
    Optional and behind a disclosure in the form, so it does not count against the
    visible-field budget. A blank box submits "", which is treated as no code.
  */
  couponCode: z.string().trim().max(40).optional(),
  /** "Subscribe and take 10% off": joins the email list with this order. */
  subscribe: z.literal('on').optional(),
  /** Set by the form when it is running inside the installed app. */
  appMode: z.enum(['standalone', 'browser']).optional(),
})

export type CheckoutState = {
  errors?: Record<string, string>
  formError?: string
}

export type CouponPreview =
  | { readonly ok: true; readonly code: string; readonly discountCents: number }
  | { readonly ok: false; readonly error: string }

/**
 * Check a code against the cart BEFORE the order is placed, so the customer sees the
 * real discount rather than finding out afterwards.
 *
 * READ-ONLY. It evaluates and never claims: a redemption is taken only when an order
 * is actually created, in `submitOrder`, by the atomic claim there. Taking one here
 * would let anyone exhaust a limited code by pressing Apply.
 *
 * The figure it returns is not trusted later — `submitOrder` re-evaluates the code
 * from scratch against the cart it ships. This exists so the preview is right, not so
 * the preview is believed.
 *
 * Runs only on an explicit Apply, never per keystroke: each call is a database read,
 * and Neon bills by how long the database stays awake.
 */
export async function previewCoupon(rawCode: string): Promise<CouponPreview> {
  const code = String(rawCode ?? '').trim()
  if (!code) return { ok: false, error: 'Enter a code.' }
  if (code.length > 40) return { ok: false, error: 'That code is not valid. Check it and try again.' }

  // No state needed: whether a coupon applies depends on each line's fulfilment
  // channel, and the resolved lines carry that whatever the destination.
  const cart = await resolveCartLive(await readCart())
  const result = evaluateCoupon(
    await findCoupon(code),
    cart.lines.map((line) => ({
      lineTotalCents: line.lineTotalCents,
      fulfillmentChannel: line.product.fulfillmentChannel,
    })),
    new Date(),
  )
  return result.ok
    ? { ok: true, code: result.code, discountCents: result.discountCents }
    : { ok: false, error: result.error }
}

export async function submitOrder(
  _previous: CheckoutState,
  formData: FormData,
): Promise<CheckoutState> {
  // The enforcement point: decide eligibility on the live rules, not the seed.
  await ensureLiveStateRules()
  const raw = Object.fromEntries(formData.entries())
  const parsed = checkoutSchema.safeParse(raw)

  if (!parsed.success) {
    const errors: Record<string, string> = {}
    for (const issue of parsed.error.issues) {
      const key = issue.path[0]
      if (typeof key === 'string' && !errors[key]) errors[key] = issue.message
    }
    return { errors }
  }

  const data = parsed.data
  const jurisdiction = getJurisdiction(data.stateCode)
  if (!jurisdiction) return { errors: { stateCode: 'Choose a valid state.' } }

  // Re-evaluate against the SHIPPING address, not whatever the browsing cookie said.
  // A visitor can browse as Texas and check out to Louisiana; the destination is what
  // the law cares about, and this is the last point at which we can refuse.
  const cart = await resolveCartLive(await readCart(), jurisdiction.code)

  if (cart.lines.length === 0) {
    return { formError: 'Your cart is empty.' }
  }
  if (!cart.compliance.canProceed) {
    const names = cart.compliance.blocked.map((b) => b.item.name).join(', ')
    // Demand refused, and where: the most useful number on the Carts page.
    await trackCart('BLOCKED_BY_STATE', {
      stateCode: jurisdiction.code,
      reason: names ? `Cannot ship to ${jurisdiction.name}: ${names}` : `Cannot ship to ${jurisdiction.name}`,
      valueCents: cart.subtotalCents,
    })
    return {
      formError: names
        ? `We cannot ship the following to ${jurisdiction.name}: ${names}. Please remove them and try again.`
        : 'We cannot ship this order to that address.',
    }
  }

  const needsIntendedUse = cart.compliance.requiredAttestations.includes(
    'NOT_FOR_HUMAN_CONSUMPTION',
  )
  if (needsIntendedUse && data.intendedUseConfirmed !== 'on') {
    return {
      errors: {
        intendedUseConfirmed:
          'Please confirm the intended use of the botanical material in your order.',
      },
    }
  }

  /*
    Computed once, here, and stored on the order. Re-deriving it from a rate when an
    old invoice is rendered means a later rate change silently rewrites what that
    customer was quoted.

    Through `orderTotals`, the one formula every total on the site is assembled by —
    so this figure, the confirmation email and the invoice cannot disagree. With no
    coupon it reproduces the previous arithmetic exactly; tests/orders/coupons.test.ts
    proves that across every payment method.
  */
  const now = new Date()

  /*
    The coupon is checked against the cart AS IT WILL SHIP — the same resolved
    lines, with their channels, that the compliance check above just evaluated.
    Vapes are excluded inside `evaluateCoupon`, not here, so the rule lives in one
    tested place rather than being re-implemented by each caller.
  */
  const rawCode = data.couponCode?.trim()
  const coupon = rawCode ? await findCoupon(rawCode) : null
  let couponDiscountCents = 0
  let couponCode: string | undefined

  if (rawCode) {
    const result = evaluateCoupon(
      coupon,
      cart.lines.map((line) => ({
        lineTotalCents: line.lineTotalCents,
        fulfillmentChannel: line.product.fulfillmentChannel,
      })),
      now,
    )
    if (!result.ok) return { errors: { couponCode: result.error } }
    couponDiscountCents = result.discountCents
    couponCode = result.code
  }

  // The welcome discounts: 10% for a subscriber, 5% for the app, each once per email.
  const welcome = await decideWelcome({
    email: data.email,
    subscribe: data.subscribe === 'on',
    standalone: data.appMode === 'standalone',
  })

  const totals = orderTotals({
    subtotalCents: cart.subtotalCents,
    shippingCents: cart.shippingTotalCents,
    couponDiscountCents,
    paymentMethod: data.paymentMethod,
    eligibleSubtotalCents: eligibleSubtotalCents(
      cart.lines.map((line) => ({
        lineTotalCents: line.lineTotalCents,
        fulfillmentChannel: line.product.fulfillmentChannel,
      })),
    ),
    subscriber: welcome.subscriber,
    appInstalled: welcome.app,
  })
  const acceptedAt = now.toISOString()

  // Attestation text is stored VERBATIM. Wording changes over time; the evidence of
  // what this customer actually agreed to must not.
  const attestations: AcceptedAttestation[] = [
    ...(needsIntendedUse
      ? [
          {
            kind: 'NOT_FOR_HUMAN_CONSUMPTION' as const,
            text: INTENDED_USE_ATTESTATION,
            acceptedAt,
          },
        ]
      : []),
  ]

  // Who sent them, if a tracking link did. Never throws; an order is not lost
  // because attribution could not be worked out.
  const credit = await creditForOrder(now)

  // `let`: on the rare collision with an existing Order ID, checkout draws again.
  let orderToken = generateOrderToken()
  let orderNumber = generateOrderNumber(now)

  let order: Order = {
    id: generateOrderId(),
    orderNumber,
    orderToken,
    status: 'PENDING_VERIFICATION',
    email: data.email,
    phone: data.phone,
    firstName: data.firstName,
    lastName: data.lastName,
    addressLine1: data.addressLine1,
    ...(data.addressLine2 ? { addressLine2: data.addressLine2 } : {}),
    city: data.city,
    stateCode: jurisdiction.code,
    postalCode: data.postalCode,
    items: cart.lines.map((l) => ({
      productSlug: l.product.slug,
      variantId: l.variant.id,
      // Snapshot: catalogue names and prices change; an order must not.
      productName: l.product.name,
      variantName: l.variant.name,
      productLine: l.product.productLine,
      fulfillmentChannel: l.product.fulfillmentChannel,
      unitPriceCents: l.unitPriceCents,
      quantity: l.line.quantity,
      lineTotalCents: l.lineTotalCents,
    })),
    shipments: cart.quotes.map((q) => ({
      channel: q.channel,
      label: q.label,
      costCents: q.costCents,
      requiresAdultSignature: q.requiresAdultSignature,
      estimate: q.estimate,
    })),
    subtotalCents: totals.subtotalCents,
    shippingCents: totals.shippingCents,
    paymentDiscountCents: totals.paymentDiscountCents,
    discountCents: totals.couponDiscountCents,
    ...(couponCode ? { couponCode } : {}),
    subscriberDiscountCents: totals.subscriberDiscountCents,
    appDiscountCents: totals.appDiscountCents,
    totalCents: totals.totalCents,
    freeShippingApplied: cart.quotes.some((q) => q.isFree),
    ...(credit ? { attribution: credit } : {}),
    preferredPaymentMethod: data.paymentMethod as PaymentMethod,
    attestations,
    events: [
      {
        type: 'CREATED',
        // The welcome discounts are named in the record, so an operator can see why the total is lower.
        message: [
          'Order request received.',
          totals.subscriberDiscountCents > 0 ? `Subscriber discount ${formatCents(totals.subscriberDiscountCents)}.` : null,
          totals.appDiscountCents > 0 ? `App discount ${formatCents(totals.appDiscountCents)}.` : null,
        ]
          .filter(Boolean)
          .join(' '),
        at: acceptedAt,
        toStatus: 'PENDING_VERIFICATION',
      },
    ],
    complianceSnapshot: {
      stateCode: jurisdiction.code,
      evaluatedAt: acceptedAt,
      requiresAgeVerification: cart.compliance.requiresAgeVerification,
      requiresAdultSignature: cart.compliance.requiresAdultSignature,
    },
    createdAt: acceptedAt,
    // Unpaid orders expire and restock. 48h balances holding inventory against
    // giving a customer a realistic window to send a manual payment.
    expiresAt: new Date(now.getTime() + 48 * 60 * 60 * 1000).toISOString(),
  }

  /*
    Claimed as late as possible — after every refusal above has had its chance — so
    a customer turned away for an address problem does not burn a redemption.

    `evaluateCoupon` already said a slot was free, but it read the counter a moment
    ago. The claim is a single conditional UPDATE, so of two customers racing for the
    last use exactly one gets it; the other is told here, before any order exists,
    rather than discovering at payment that their discount was never valid.
  */
  if (coupon && couponCode) {
    const claimed = await claimRedemption(coupon, now)
    if (!claimed) {
      return {
        errors: {
          couponCode: 'That code has just been fully redeemed. Remove it to continue.',
        },
      }
    }
  }

  /*
    Up to four attempts, and only for a unique-index refusal: the Order ID is random,
    and two orders drawing the same one is rare but not impossible. The second
    customer's checkout used to fail outright. Any other error is real and surfaces
    on the first attempt.
  */
  for (let attempt = 1; ; attempt++) {
    try {
      await orders.create(order)
      break
    } catch (error) {
      if (isUniqueViolation(error) && attempt < 4) {
        orderToken = generateOrderToken()
        orderNumber = generateOrderNumber(now)
        order = { ...order, orderToken, orderNumber }
        continue
      }
      // The slot was taken for an order that now does not exist. Give it back, then
      // let the failure surface as it always has — this only undoes our own claim.
      if (couponCode) await releaseRedemption(couponCode).catch(() => undefined)
      throw error
    }
  }
  await recordActivity('ORDER_PLACED', { detail: `${orderNumber} · ${formatCents(order.totalCents)}`, path: url.checkout() })
  // The order exists: now the side effects of the discounts it received. Neither may cost the order.
  if (welcome.recordInstall) await recordActivity('APP_INSTALLED', { path: url.checkout() })
  if (welcome.joinList) {
    await joinListFromCheckout(data.email).catch((error) =>
      reportError(error, { source: 'action', routePath: url.checkout(), context: { stage: 'join-list-at-checkout' } }),
    )
  }
  await writeCart(EMPTY_CART)
  await trackCart('ORDER_PLACED', { valueCents: order.totalCents, stateCode: jurisdiction.code, reason: orderNumber })

  /*
    The customer's chat, and their invoice in it.

    Done here because checkout is the one moment the customer's own browser is on the
    line: their chat is keyed to an httpOnly cookie only that browser holds. The
    conversation is found (or opened) now and recorded on the order, so the owner's
    later payment-details invoice lands in the same place. Drawing and posting the
    image waits until the response has gone (`after`), so it never slows the order.
    None of it can lose the order: a failure is reported and the email still goes.
  */
  let chatThreadId: string | null = null
  try {
    const visitor = await visitorId(true)
    if (visitor) {
      const thread = await ensureThread({
        visitor,
        email: order.email,
        name: `${order.firstName} ${order.lastName}`,
      })
      chatThreadId = thread.id
      await linkOrderToChat(order.id, thread.id)
    }
  } catch (error) {
    await reportError(error, {
      source: 'action',
      severity: 'ERROR',
      routePath: '/checkout',
      context: { stage: 'link-order-chat', orderNumber },
    })
  }
  if (chatThreadId) {
    const threadId = chatThreadId
    const placed = order
    after(() => sendReceivedInvoice(placed, threadId, PAYMENT_LABELS[placed.preferredPaymentMethod]))
  }

  // Sent after the order is persisted, and never awaited into a failure path — the
  // order exists and ops has been notified regardless of whether the email lands.
  await sendEmail(orderReceivedEmail(order))

  await notify({
    topic: 'orders-new',
    title: `New order — Order ID ${orderNumber} — ${formatCents(order.totalCents)}`,
    body: `${order.firstName} ${order.lastName} · ${jurisdiction.name} · ${PAYMENT_LABELS[order.preferredPaymentMethod]} · ${order.items.length} line(s)`,
    tags: ['moneybag'],
    // Straight to the page where the owner enters this order's payment details.
    clickUrl: absoluteUrl(`/admin/orders/${orderNumber}/payment`),
  })

  redirect(url.orderStatus(orderToken))
}
