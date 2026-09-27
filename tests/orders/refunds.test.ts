import { describe, expect, it } from 'vitest'
import { checkRefund, parseAmount, summariseRefunds } from '@/lib/orders/refunds'

const r = (...amounts: number[]) => amounts.map((amountCents) => ({ amountCents }))

describe('parseAmount', () => {
  it('reads whole dollars and cents as integer cents', () => {
    expect(parseAmount('28')).toEqual({ ok: true, amountCents: 2800 })
    expect(parseAmount('28.50')).toEqual({ ok: true, amountCents: 2850 })
    expect(parseAmount('0.01')).toEqual({ ok: true, amountCents: 1 })
  })

  it('reads a single decimal place as tens of cents, not units', () => {
    // "28.1" is twenty-eight dollars ten, not twenty-eight dollars one.
    expect(parseAmount('28.1')).toEqual({ ok: true, amountCents: 2810 })
  })

  it('tolerates the way people actually type money', () => {
    expect(parseAmount('$28.50')).toEqual({ ok: true, amountCents: 2850 })
    expect(parseAmount('  28.50  ')).toEqual({ ok: true, amountCents: 2850 })
    // Thousands separators are stripped, so a pasted "1,250.00" is $1,250.
    expect(parseAmount('1,250.00')).toEqual({ ok: true, amountCents: 125_000 })
  })

  /*
    REFUSED, not rounded. A refund is reconciled against a bank statement, and an
    unexplained cent that nobody chose is worse than a rejected form.
  */
  it('refuses fractions of a cent rather than rounding them', () => {
    expect(parseAmount('28.999').ok).toBe(false)
    expect(parseAmount('0.005').ok).toBe(false)
  })

  it('refuses anything that is not a plain positive amount', () => {
    expect(parseAmount('').ok).toBe(false)
    expect(parseAmount('abc').ok).toBe(false)
    expect(parseAmount('-5').ok).toBe(false)
    expect(parseAmount('1e3').ok).toBe(false)
    expect(parseAmount('NaN').ok).toBe(false)
  })

  /*
    Floating point is why this parser splits the string instead of multiplying.
    `28.15 * 100` is 2814.9999999999995 in IEEE 754; rounding it happens to work,
    and "happens to work" is not a property you want on money.
  */
  it('is exact for the amounts a float would get wrong', () => {
    expect(parseAmount('28.15')).toEqual({ ok: true, amountCents: 2815 })
    expect(parseAmount('1.10')).toEqual({ ok: true, amountCents: 110 })
    expect(parseAmount('4.35')).toEqual({ ok: true, amountCents: 435 })
  })
})

describe('summariseRefunds', () => {
  it('reports nothing refunded on a fresh order', () => {
    expect(summariseRefunds(10_000, [])).toEqual({
      refundedCents: 0,
      remainingCents: 10_000,
      fullyRefunded: false,
    })
  })

  it('sums partial refunds', () => {
    expect(summariseRefunds(10_000, r(2500, 1500))).toEqual({
      refundedCents: 4000,
      remainingCents: 6000,
      fullyRefunded: false,
    })
  })

  it('marks an order fully refunded once the total is returned', () => {
    const summary = summariseRefunds(10_000, r(4000, 6000))
    expect(summary.remainingCents).toBe(0)
    expect(summary.fullyRefunded).toBe(true)
  })

  it('never reports a negative remainder', () => {
    // Should not arise, but if historical rows exceed the total the honest answer
    // is "nothing remains" — not a negative presented as though it were owed.
    const summary = summariseRefunds(10_000, r(12_000))
    expect(summary.remainingCents).toBe(0)
    expect(summary.fullyRefunded).toBe(true)
  })

  it('does not call a zero-total order fully refunded', () => {
    expect(summariseRefunds(0, []).fullyRefunded).toBe(false)
  })
})

describe('checkRefund', () => {
  it('allows a refund within the remaining balance', () => {
    expect(checkRefund(2500, 10_000, [])).toEqual({ ok: true, amountCents: 2500 })
    expect(checkRefund(2500, 10_000, r(5000))).toEqual({ ok: true, amountCents: 2500 })
  })

  it('allows a refund of exactly what remains', () => {
    expect(checkRefund(5000, 10_000, r(5000)).ok).toBe(true)
  })

  it('refuses zero and negative amounts', () => {
    expect(checkRefund(0, 10_000, []).ok).toBe(false)
    expect(checkRefund(-100, 10_000, []).ok).toBe(false)
  })

  it('refuses more than the order total', () => {
    const result = checkRefund(10_001, 10_000, [])
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toContain('$100.00')
  })

  /*
    The case the transaction re-check exists for: two operators on two tabs each see
    an unrefunded $100 order, and each passes a check against the total alone. Only
    a check against the SUM refuses the second one.
  */
  it('refuses a second refund that would exceed the total in aggregate', () => {
    const result = checkRefund(6000, 10_000, r(6000))
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toContain('$60.00') // already refunded
      expect(result.error).toContain('$40.00') // remaining
    }
  })

  it('refuses any refund once the order is fully refunded', () => {
    const result = checkRefund(1, 10_000, r(10_000))
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toContain('already been refunded in full')
  })
})
