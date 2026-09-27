import { describe, expect, it } from 'vitest'
import {
  BITCOIN_DISCOUNT_RATE,
  discountPercent,
  discountRateFor,
  paymentDiscountCents,
} from '@/lib/orders/payment-discount'
import { PAYMENT_METHODS } from '@/lib/orders/types'

describe('bitcoin payment discount', () => {
  it('applies only to Bitcoin', () => {
    for (const method of PAYMENT_METHODS) {
      expect(discountRateFor(method)).toBe(method === 'BITCOIN' ? BITCOIN_DISCOUNT_RATE : 0)
    }
  })

  it('is 7 percent', () => {
    expect(discountPercent('BITCOIN')).toBe(7)
    expect(paymentDiscountCents(10_000, 'BITCOIN')).toBe(700)
  })

  /*
   * Rounding down is the whole point. A half-cent rounded up is a cent we quoted and
   * cannot collect, and money here is integer cents everywhere by project rule.
   */
  it('always rounds down, never up', () => {
    // 7% of 1499 is 104.93 — must be 104, not 105.
    expect(paymentDiscountCents(1499, 'BITCOIN')).toBe(104)
    expect(paymentDiscountCents(1, 'BITCOIN')).toBe(0)
    for (let cents = 0; cents < 3000; cents += 7) {
      const d = paymentDiscountCents(cents, 'BITCOIN')
      expect(Number.isInteger(d)).toBe(true)
      expect(d).toBeLessThanOrEqual(cents * BITCOIN_DISCOUNT_RATE)
      expect(d).toBeGreaterThanOrEqual(0)
    }
  })

  it('never exceeds the subtotal', () => {
    for (const cents of [0, 1, 99, 100_000]) {
      expect(paymentDiscountCents(cents, 'BITCOIN')).toBeLessThan(Math.max(cents, 1))
    }
  })

  it('is zero for every non-Bitcoin method', () => {
    for (const method of PAYMENT_METHODS.filter((m) => m !== 'BITCOIN')) {
      expect(paymentDiscountCents(50_000, method)).toBe(0)
    }
  })
})
