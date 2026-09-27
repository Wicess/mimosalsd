import { describe, expect, it } from 'vitest'
import {
  COUPON_ELIGIBLE_CHANNELS,
  couponShapeError,
  evaluateCoupon,
  normalizeCode,
  orderTotals,
  type CouponLine,
  type CouponRecord,
} from '@/lib/orders/coupons'
import { paymentDiscountCents } from '@/lib/orders/payment-discount'

const NOW = new Date('2026-09-11T12:00:00Z')

function coupon(overrides: Partial<CouponRecord> = {}): CouponRecord {
  return {
    code: 'SAVE10',
    percentOff: 10,
    amountOffCents: null,
    minSubtotalCents: 0,
    maxRedemptions: null,
    timesRedeemed: 0,
    isActive: true,
    startsAt: null,
    endsAt: null,
    ...overrides,
  }
}

const parcel = (cents: number): CouponLine => ({
  lineTotalCents: cents,
  fulfillmentChannel: 'PARCEL',
})
const vape = (cents: number): CouponLine => ({
  lineTotalCents: cents,
  fulfillmentChannel: 'PACT_CARRIER',
})
const courier = (cents: number): CouponLine => ({
  lineTotalCents: cents,
  fulfillmentChannel: 'LOCAL_COURIER',
})

describe('normalizeCode', () => {
  /*
    A code created as `Summer10` that only matches `Summer10` is a code a customer
    reads off an email as SUMMER10 and is told does not exist.
  */
  it('trims and upper-cases so a code matches however it is typed', () => {
    expect(normalizeCode('  summer10 ')).toBe('SUMMER10')
    expect(normalizeCode('Summer10')).toBe('SUMMER10')
  })
})

describe('couponShapeError', () => {
  const base = { minSubtotalCents: 0 }

  it('accepts exactly one of a percentage or an amount', () => {
    expect(couponShapeError({ ...base, percentOff: 10, amountOffCents: null })).toBeNull()
    expect(couponShapeError({ ...base, percentOff: null, amountOffCents: 500 })).toBeNull()
  })

  it('refuses a coupon with both, or with neither', () => {
    expect(couponShapeError({ ...base, percentOff: 10, amountOffCents: 500 })).not.toBeNull()
    expect(couponShapeError({ ...base, percentOff: null, amountOffCents: null })).not.toBeNull()
  })

  it('refuses a percentage outside 1–100 or with a fraction', () => {
    expect(couponShapeError({ ...base, percentOff: 0, amountOffCents: null })).not.toBeNull()
    expect(couponShapeError({ ...base, percentOff: 101, amountOffCents: null })).not.toBeNull()
    expect(couponShapeError({ ...base, percentOff: 12.5, amountOffCents: null })).not.toBeNull()
    expect(couponShapeError({ ...base, percentOff: 100, amountOffCents: null })).toBeNull()
  })

  it('refuses a zero, negative or fractional fixed amount', () => {
    expect(couponShapeError({ ...base, percentOff: null, amountOffCents: 0 })).not.toBeNull()
    expect(couponShapeError({ ...base, percentOff: null, amountOffCents: -100 })).not.toBeNull()
    expect(couponShapeError({ ...base, percentOff: null, amountOffCents: 1.5 })).not.toBeNull()
  })

  it('refuses a negative minimum spend', () => {
    expect(
      couponShapeError({ minSubtotalCents: -1, percentOff: 10, amountOffCents: null }),
    ).not.toBeNull()
  })
})

describe('evaluateCoupon — refusals', () => {
  it('refuses a code that does not exist', () => {
    const result = evaluateCoupon(null, [parcel(5000)], NOW)
    expect(result.ok).toBe(false)
  })

  it('refuses an inactive code', () => {
    expect(evaluateCoupon(coupon({ isActive: false }), [parcel(5000)], NOW).ok).toBe(false)
  })

  it('refuses a code that has not started', () => {
    const startsAt = new Date(NOW.getTime() + 60_000)
    const result = evaluateCoupon(coupon({ startsAt }), [parcel(5000)], NOW)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toContain('not active yet')
  })

  it('refuses an expired code', () => {
    const endsAt = new Date(NOW.getTime() - 60_000)
    const result = evaluateCoupon(coupon({ endsAt }), [parcel(5000)], NOW)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toContain('expired')
  })

  /*
    The boundary. A code ending AT this instant has ended — otherwise the last
    moment of a promotion is a window that can be held open by a slow request.
  */
  it('treats the exact end instant as expired', () => {
    expect(evaluateCoupon(coupon({ endsAt: NOW }), [parcel(5000)], NOW).ok).toBe(false)
  })

  it('accepts a code that starts exactly now', () => {
    expect(evaluateCoupon(coupon({ startsAt: NOW }), [parcel(5000)], NOW).ok).toBe(true)
  })

  it('refuses a code that has hit its redemption cap', () => {
    const result = evaluateCoupon(
      coupon({ maxRedemptions: 5, timesRedeemed: 5 }),
      [parcel(5000)],
      NOW,
    )
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toContain('fully redeemed')
  })

  it('accepts the last available redemption', () => {
    const result = evaluateCoupon(
      coupon({ maxRedemptions: 5, timesRedeemed: 4 }),
      [parcel(5000)],
      NOW,
    )
    expect(result.ok).toBe(true)
  })

  /*
    A row edited directly in the database can be malformed. It must fail CLOSED —
    refused — rather than open, as a discount nobody configured.
  */
  it('fails closed on a malformed coupon', () => {
    const result = evaluateCoupon(
      coupon({ percentOff: 10, amountOffCents: 500 }),
      [parcel(5000)],
      NOW,
    )
    expect(result.ok).toBe(false)
  })

  it('refuses an empty cart', () => {
    expect(evaluateCoupon(coupon(), [], NOW).ok).toBe(false)
  })

  it('refuses a cart of vapes only, and says why', () => {
    const result = evaluateCoupon(coupon(), [vape(4000)], NOW)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toContain('vapor')
  })

  it('names the shortfall when the minimum spend is not met', () => {
    const result = evaluateCoupon(coupon({ minSubtotalCents: 5000 }), [parcel(3800)], NOW)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toContain('$50.00')
      expect(result.error).toContain('$12.00') // what is still needed
    }
  })
})

describe('evaluateCoupon — discounts', () => {
  it('takes a percentage off eligible goods', () => {
    const result = evaluateCoupon(coupon({ percentOff: 10 }), [parcel(5000)], NOW)
    expect(result).toEqual({
      ok: true,
      code: 'SAVE10',
      discountCents: 500,
      eligibleSubtotalCents: 5000,
    })
  })

  it('takes a fixed amount off eligible goods', () => {
    const result = evaluateCoupon(
      coupon({ percentOff: null, amountOffCents: 750 }),
      [parcel(5000)],
      NOW,
    )
    expect(result.ok && result.discountCents).toBe(750)
  })

  it('rounds a percentage DOWN, never up', () => {
    // 15% of $33.33 is 499.95 cents — quoted as 499, never 500.
    const result = evaluateCoupon(coupon({ percentOff: 15 }), [parcel(3333)], NOW)
    expect(result.ok && result.discountCents).toBe(499)
  })

  it('caps a fixed amount at the eligible goods', () => {
    // A $50 code on a $30 order discounts $30 — the remainder is not credit.
    const result = evaluateCoupon(
      coupon({ percentOff: null, amountOffCents: 5000 }),
      [parcel(3000)],
      NOW,
    )
    expect(result.ok && result.discountCents).toBe(3000)
  })

  /*
    The legal exclusion. Vapor products are PACT-regulated and several states
    restrict discounting them, so a mixed cart discounts only the other goods.
  */
  it('never discounts vapes in a mixed cart', () => {
    const result = evaluateCoupon(coupon({ percentOff: 10 }), [parcel(5000), vape(4000)], NOW)
    expect(result.ok && result.eligibleSubtotalCents).toBe(5000)
    expect(result.ok && result.discountCents).toBe(500) // 10% of $50, not of $90
  })

  it('never lets a fixed amount spill onto excluded vapes', () => {
    // $60 off a cart of $20 gummies and $40 vapes discounts $20, not $60.
    const result = evaluateCoupon(
      coupon({ percentOff: null, amountOffCents: 6000 }),
      [parcel(2000), vape(4000)],
      NOW,
    )
    expect(result.ok && result.discountCents).toBe(2000)
  })

  it('judges the minimum spend on eligible goods only', () => {
    // $30 of gummies plus $40 of vapes does not clear a $50 minimum.
    const result = evaluateCoupon(
      coupon({ minSubtotalCents: 5000 }),
      [parcel(3000), vape(4000)],
      NOW,
    )
    expect(result.ok).toBe(false)
  })

  it('treats local courier goods as eligible', () => {
    const result = evaluateCoupon(coupon({ percentOff: 10 }), [courier(2000)], NOW)
    expect(result.ok && result.discountCents).toBe(200)
  })

  it('returns the code in canonical form', () => {
    const result = evaluateCoupon(coupon({ code: 'save10' }), [parcel(5000)], NOW)
    expect(result.ok && result.code).toBe('SAVE10')
  })

  it('keeps the PACT channel out of the eligible set', () => {
    expect(COUPON_ELIGIBLE_CHANNELS.has('PACT_CARRIER')).toBe(false)
  })
})

describe('orderTotals — the one formula', () => {
  /*
    ── THE REGRESSION THAT MATTERS MOST ────────────────────────────────────
    With no coupon, this must equal exactly what checkout computed before coupons
    existed: `cart.totalCents - paymentDiscountCents(subtotal)`, where
    cart.totalCents = subtotal + shipping. Every existing order was priced that way,
    and a cent of drift here would change what every future Bitcoin customer pays.
  */
  it('reproduces the pre-coupon total exactly when no coupon is applied', () => {
    for (const subtotal of [1, 99, 3333, 9999, 10_000, 12_345, 250_000]) {
      for (const shipping of [0, 895, 1500]) {
        for (const method of ['CASHAPP', 'CHIME', 'APPLE_CASH', 'BITCOIN'] as const) {
          const legacy = subtotal + shipping - paymentDiscountCents(subtotal, method)
          const now = orderTotals({
            subtotalCents: subtotal,
            shippingCents: shipping,
            couponDiscountCents: 0,
            paymentMethod: method,
          })
          expect(now.totalCents, `${subtotal}/${shipping}/${method}`).toBe(legacy)
        }
      }
    }
  })

  it('takes the coupon off the goods and leaves shipping alone', () => {
    expect(
      orderTotals({
        subtotalCents: 10_000,
        shippingCents: 895,
        couponDiscountCents: 1000,
        paymentMethod: 'CASHAPP',
      }),
    ).toEqual({
      subtotalCents: 10_000,
      couponDiscountCents: 1000,
      subscriberDiscountCents: 0,
      appDiscountCents: 0,
      paymentDiscountCents: 0,
      shippingCents: 895,
      totalCents: 9895,
    })
  })

  /*
    Bitcoin's 7% stacks on what is left AFTER the coupon. Taking it off the original
    subtotal would refund 7% of money the customer was never asked to pay.
  */
  it('stacks the Bitcoin discount on the post-coupon goods', () => {
    const totals = orderTotals({
      subtotalCents: 10_000,
      shippingCents: 0,
      couponDiscountCents: 2000,
      paymentMethod: 'BITCOIN',
    })
    expect(totals.paymentDiscountCents).toBe(560) // 7% of $80, not of $100
    expect(totals.totalCents).toBe(10_000 - 2000 - 560)
  })

  it('never lets a coupon take the goods below zero', () => {
    const totals = orderTotals({
      subtotalCents: 3000,
      shippingCents: 895,
      couponDiscountCents: 9999,
      paymentMethod: 'CASHAPP',
    })
    expect(totals.couponDiscountCents).toBe(3000)
    // Shipping is still owed — a coupon never pays the carrier.
    expect(totals.totalCents).toBe(895)
  })

  it('ignores a negative coupon value rather than adding it to the bill', () => {
    const totals = orderTotals({
      subtotalCents: 5000,
      shippingCents: 0,
      couponDiscountCents: -500,
      paymentMethod: 'CASHAPP',
    })
    expect(totals.couponDiscountCents).toBe(0)
    expect(totals.totalCents).toBe(5000)
  })

  /*
    The receipt has to add up. Whatever the inputs, the parts reconcile to the total
    exactly — this is the property the confirmation email depends on.
  */
  it('always reconciles: subtotal − coupon − payment + shipping = total', () => {
    for (const subtotal of [0, 1, 777, 10_000, 99_999]) {
      for (const coupon of [0, 1, 500, 10_000, 200_000]) {
        for (const method of ['CASHAPP', 'BITCOIN'] as const) {
          const t = orderTotals({
            subtotalCents: subtotal,
            shippingCents: 895,
            couponDiscountCents: coupon,
            paymentMethod: method,
          })
          expect(
            t.subtotalCents - t.couponDiscountCents - t.paymentDiscountCents + t.shippingCents,
          ).toBe(t.totalCents)
          expect(Number.isInteger(t.totalCents)).toBe(true)
          expect(t.totalCents).toBeGreaterThanOrEqual(0)
        }
      }
    }
  })
})

describe('orderTotals — the welcome discounts', () => {
  const base = { subtotalCents: 10_000, shippingCents: 795, couponDiscountCents: 0, paymentMethod: 'CASHAPP' as const }

  it('changes nothing for a customer who has neither', () => {
    const plain = orderTotals(base)
    expect(plain).toMatchObject({ subscriberDiscountCents: 0, appDiscountCents: 0, totalCents: 10_795 })
  })

  it('takes 10% for a subscriber and 5% for the app, adding up to 15%', () => {
    expect(orderTotals({ ...base, subscriber: true })).toMatchObject({ subscriberDiscountCents: 1_000, totalCents: 9_795 })
    expect(orderTotals({ ...base, appInstalled: true })).toMatchObject({ appDiscountCents: 500, totalCents: 10_295 })
    const both = orderTotals({ ...base, subscriber: true, appInstalled: true })
    // 15% of the goods, not 10% then 5% of what is left.
    expect(both).toMatchObject({ subscriberDiscountCents: 1_000, appDiscountCents: 500, totalCents: 9_295 })
  })

  it('never discounts vapes or shipping', () => {
    const t = orderTotals({ ...base, eligibleSubtotalCents: 6_000, subscriber: true, appInstalled: true })
    expect(t.subscriberDiscountCents).toBe(600)
    expect(t.appDiscountCents).toBe(300)
    expect(t.shippingCents).toBe(795)
    expect(t.totalCents).toBe(10_000 - 900 + 795)
  })

  it('works on what is left after a coupon, and Bitcoin comes off after both', () => {
    const t = orderTotals({ ...base, couponDiscountCents: 2_000, subscriber: true, appInstalled: true, paymentMethod: 'BITCOIN' })
    expect(t.subscriberDiscountCents).toBe(800)
    expect(t.appDiscountCents).toBe(400)
    const goods = 10_000 - 2_000 - 800 - 400
    expect(t.paymentDiscountCents).toBe(Math.floor(goods * 0.07))
    expect(t.totalCents).toBe(goods - t.paymentDiscountCents + 795)
  })

  it('rounds each discount down, so the customer is never charged more than shown', () => {
    const t = orderTotals({ ...base, subtotalCents: 1_999, subscriber: true, appInstalled: true })
    expect(t.subscriberDiscountCents).toBe(199)
    expect(t.appDiscountCents).toBe(99)
    expect(t.totalCents).toBe(1_999 - 199 - 99 + 795)
  })
})
