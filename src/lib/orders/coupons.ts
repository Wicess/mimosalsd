import type { FulfillmentChannel } from '@/lib/compliance/types'
import { paymentDiscountCents } from './payment-discount'
import type { PaymentMethod } from './types'

/**
 * ─────────────────────────────────────────────────────────────────────────────
 *  COUPONS — pure, so the money rules can be tested without a database.
 *
 *  Everything is INTEGER CENTS (CLAUDE.md rule 8), and every division rounds DOWN.
 *  A half-cent rounded up is a cent we quoted and cannot take; rounding down means a
 *  customer is never charged more than the figure they were shown.
 *
 *  ── The one formula ─────────────────────────────────────────────────────────
 *  `orderTotals` is the ONLY place a total is assembled. The checkout action stores
 *  its output on the order; the confirmation email, the invoice and the order page
 *  render those stored fields. None of them re-derive a total, so none of them can
 *  disagree with it — and the preview in the checkout form calls the same function,
 *  so what a customer is shown before submitting is the figure of record, not an
 *  estimate of it.
 *
 *  ── Order of operations, and why ───────────────────────────────────────────
 *      subtotal                                   (goods)
 *    − coupon discount     on ELIGIBLE goods      (never vapes, never shipping)
 *    − subscriber discount 10% of eligible goods after the coupon (first order)
 *    − app discount        5% of that same base   (first order; adds to the 10%)
 *    − payment discount    on goods AFTER those   (Bitcoin 7%)
 *    + shipping                                   (never discounted)
 *    = total
 *
 *  The Bitcoin discount stacks on the post-coupon amount, not the original subtotal.
 *  Otherwise a customer is refunded 7% of money they were never asked to pay.
 *
 *  Shipping is untouched, for the same reason the Bitcoin discount already leaves it
 *  alone: postage is a cost paid to a carrier, not margin. And the free-shipping
 *  threshold is judged on the PRE-coupon subtotal, deliberately — the alternative is a
 *  customer typing a code and watching their total go UP as free shipping disappears,
 *  which reads as a trick and costs the sale the coupon was meant to win.
 *
 *  ── Why vapes are excluded ─────────────────────────────────────────────────
 *  Vapor products ship on the PACT_CARRIER channel under the federal PACT Act, and a
 *  number of states restrict or prohibit price discounting and coupon redemption on
 *  tobacco and vapor products. This codebase already excludes that channel from the
 *  one promotion it has — free shipping is `channel === 'PARCEL'` — and CLAUDE.md puts
 *  legal compliance first. So a coupon discounts parcel and courier goods only.
 *  Loosening this is a legal decision, not a code change, and it should be made with
 *  counsel rather than by editing the set below.
 * ─────────────────────────────────────────────────────────────────────────────
 */

/** Channels a coupon may discount. PACT_CARRIER is absent on purpose — see above. */
export const COUPON_ELIGIBLE_CHANNELS: ReadonlySet<FulfillmentChannel> = new Set([
  'PARCEL',
  'LOCAL_COURIER',
])

export interface CouponRecord {
  readonly code: string
  readonly percentOff: number | null
  readonly amountOffCents: number | null
  readonly minSubtotalCents: number
  readonly maxRedemptions: number | null
  readonly timesRedeemed: number
  readonly isActive: boolean
  readonly startsAt: Date | null
  readonly endsAt: Date | null
}

export interface CouponLine {
  readonly lineTotalCents: number
  readonly fulfillmentChannel: FulfillmentChannel
}

export type CouponResult =
  | {
      readonly ok: true
      readonly code: string
      readonly discountCents: number
      /** The goods the coupon applied to — excludes vapes. */
      readonly eligibleSubtotalCents: number
    }
  | { readonly ok: false; readonly error: string }

/**
 * The canonical form of a code: trimmed and upper-cased.
 *
 * Applied on BOTH sides — when an operator creates a code and when a customer types
 * one. A code created as `Summer10` that only matches `Summer10` is a code a customer
 * reads off an email as `SUMMER10` and is told does not exist.
 */
export function normalizeCode(raw: string): string {
  return raw.trim().toUpperCase()
}

/**
 * Is this coupon's configuration coherent?
 *
 * Exactly one of percentOff / amountOffCents, and each within bounds. The admin
 * action refuses anything else on write; this is checked again at redemption because
 * a row can be edited directly in the database, and a malformed coupon must fail
 * closed — refused — rather than open, as a discount nobody intended.
 */
export function couponShapeError(
  coupon: Pick<CouponRecord, 'percentOff' | 'amountOffCents' | 'minSubtotalCents'>,
): string | null {
  const hasPercent = coupon.percentOff !== null
  const hasAmount = coupon.amountOffCents !== null

  if (hasPercent === hasAmount) {
    return 'A coupon needs exactly one of a percentage or a fixed amount.'
  }
  if (hasPercent) {
    const pct = coupon.percentOff!
    if (!Number.isInteger(pct) || pct < 1 || pct > 100) {
      return 'A percentage must be a whole number from 1 to 100.'
    }
  }
  if (hasAmount) {
    const cents = coupon.amountOffCents!
    if (!Number.isInteger(cents) || cents < 1) {
      return 'A fixed amount must be at least one cent.'
    }
  }
  if (!Number.isInteger(coupon.minSubtotalCents) || coupon.minSubtotalCents < 0) {
    return 'The minimum spend cannot be negative.'
  }
  return null
}

function dollars(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`
}

/**
 * Evaluate a coupon against a cart.
 *
 * The messages are written for the CUSTOMER, because they are shown on the checkout
 * form. They say what is wrong and, where there is one, what would fix it — "spend
 * $12.00 more" rather than "minimum not met".
 */
export function evaluateCoupon(
  coupon: CouponRecord | null,
  lines: readonly CouponLine[],
  now: Date,
): CouponResult {
  if (!coupon) {
    return { ok: false, error: 'That code is not valid. Check it and try again.' }
  }
  if (!coupon.isActive) {
    return { ok: false, error: 'That code is no longer active.' }
  }
  if (coupon.startsAt && coupon.startsAt.getTime() > now.getTime()) {
    return { ok: false, error: 'That code is not active yet.' }
  }
  if (coupon.endsAt && coupon.endsAt.getTime() <= now.getTime()) {
    return { ok: false, error: 'That code has expired.' }
  }
  if (coupon.maxRedemptions !== null && coupon.timesRedeemed >= coupon.maxRedemptions) {
    return { ok: false, error: 'That code has been fully redeemed.' }
  }

  // Refused, never guessed at. A malformed coupon must fail closed.
  if (couponShapeError(coupon)) {
    return { ok: false, error: 'That code cannot be applied. Please contact us.' }
  }

  const eligibleSubtotalCents = lines
    .filter((line) => COUPON_ELIGIBLE_CHANNELS.has(line.fulfillmentChannel))
    .reduce((sum, line) => sum + line.lineTotalCents, 0)

  if (eligibleSubtotalCents === 0) {
    return {
      ok: false,
      error:
        lines.length === 0
          ? 'Your cart is empty.'
          : 'That code does not apply to vapor products, and there is nothing else in your cart for it to discount.',
    }
  }

  if (eligibleSubtotalCents < coupon.minSubtotalCents) {
    return {
      ok: false,
      error: `That code needs ${dollars(coupon.minSubtotalCents)} of eligible items. Spend ${dollars(
        coupon.minSubtotalCents - eligibleSubtotalCents,
      )} more to use it.`,
    }
  }

  const raw =
    coupon.percentOff !== null
      ? Math.floor((eligibleSubtotalCents * coupon.percentOff) / 100)
      : coupon.amountOffCents!

  /*
    Capped at the eligible goods. A $50 code on a $30 order discounts $30, not $50:
    the remainder is not credit, not carried forward and never taken off shipping or
    off the vapes that were excluded. A total cannot go below what is owed for the
    parts the coupon was never allowed to touch.
  */
  const discountCents = Math.min(raw, eligibleSubtotalCents)

  return {
    ok: true,
    code: normalizeCode(coupon.code),
    discountCents,
    eligibleSubtotalCents,
  }
}

/** Goods a coupon or a welcome discount may reduce: everything but vapes. */
export function eligibleSubtotalCents(lines: readonly CouponLine[]): number {
  return lines
    .filter((line) => COUPON_ELIGIBLE_CHANNELS.has(line.fulfillmentChannel))
    .reduce((sum, line) => sum + line.lineTotalCents, 0)
}

/**
 * The welcome discounts (owner, 2026-09-14): 10% for joining the email list, 5% for
 * installing the app. Each once per customer email, and they add up to 15% for someone
 * who did both. Whether a customer qualifies is decided on the server
 * (lib/orders/welcome.ts); this file only does the arithmetic.
 */
export const SUBSCRIBER_DISCOUNT_PERCENT = 10
export const APP_DISCOUNT_PERCENT = 5

export interface OrderTotals {
  readonly subtotalCents: number
  readonly couponDiscountCents: number
  /** 10% of eligible goods after any coupon, for a first order from a subscriber. */
  readonly subscriberDiscountCents: number
  /** 5% of eligible goods after any coupon, for a first order from someone with the app. */
  readonly appDiscountCents: number
  readonly paymentDiscountCents: number
  readonly shippingCents: number
  readonly totalCents: number
}

/**
 * THE ONE FORMULA. Every total on the site is assembled here and nowhere else.
 */
export function orderTotals(input: {
  readonly subtotalCents: number
  readonly shippingCents: number
  readonly couponDiscountCents: number
  readonly paymentMethod: PaymentMethod
  /** Goods on channels a discount may touch (never vapes). Defaults to the subtotal. */
  readonly eligibleSubtotalCents?: number
  /** A first order from an email-list subscriber: 10% off eligible goods. */
  readonly subscriber?: boolean
  /** A first order from someone who installed the app: 5% off eligible goods. */
  readonly appInstalled?: boolean
}): OrderTotals {
  // Clamped so a coupon can never take the goods below zero, whatever it was handed.
  const couponDiscountCents = Math.max(
    0,
    Math.min(input.couponDiscountCents, input.subtotalCents),
  )
  /*
    The welcome discounts are taken on the SAME base, eligible goods after the coupon,
    and added rather than compounded: 10% and 5% make 15% of that base, which is what
    the customer was promised. The coupon already came out of eligible goods, so it
    comes out of the base first. Each rounds down, like every other division here.
  */
  const eligible = Math.min(input.eligibleSubtotalCents ?? input.subtotalCents, input.subtotalCents)
  const base = Math.max(0, eligible - couponDiscountCents)
  const subscriberDiscountCents = input.subscriber ? Math.floor((base * SUBSCRIBER_DISCOUNT_PERCENT) / 100) : 0
  const appDiscountCents = input.appInstalled ? Math.floor((base * APP_DISCOUNT_PERCENT) / 100) : 0

  const goodsAfterDiscounts = input.subtotalCents - couponDiscountCents - subscriberDiscountCents - appDiscountCents
  // Bitcoin's 7% comes off what the customer is actually paying for the goods.
  const payment = paymentDiscountCents(goodsAfterDiscounts, input.paymentMethod)

  return {
    subtotalCents: input.subtotalCents,
    couponDiscountCents,
    subscriberDiscountCents,
    appDiscountCents,
    paymentDiscountCents: payment,
    shippingCents: input.shippingCents,
    totalCents: goodsAfterDiscounts - payment + input.shippingCents,
  }
}
