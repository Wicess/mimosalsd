import { describe, expect, it } from 'vitest'
import { parseDollars, recalculateInvoice } from '@/lib/orders/invoice-edit'

const current = {
  subtotalCents: 26_000,
  shippingCents: 0,
  discountCents: 0,
  subscriberDiscountCents: 1_000,
  appDiscountCents: 0,
  paymentDiscountCents: 0,
  totalCents: 25_000,
}
const ids = ['a', 'b']

describe('parseDollars', () => {
  it.each([
    ['12', 1200],
    ['12.5', 1250],
    ['$1,250.05', 125_005],
    ['0', 0],
  ])('%s → %i cents', (raw, cents) => expect(parseDollars(raw)).toBe(cents))
  it.each(['', 'abc', '12.555', '-5', '1e3', '200000'])('refuses %s', (raw) => expect(parseDollars(raw)).toBeNull())
})

describe('recalculateInvoice', () => {
  it('recomputes lines, subtotal and total, keeping the discounts earned at checkout', () => {
    const r = recalculateInvoice(current, ids, {
      lines: [
        { id: 'a', quantity: 3, unitPriceCents: 12_000 },
        { id: 'b', quantity: 0, unitPriceCents: 2_000 },
      ],
      shippingCents: 2_500,
      discountCents: 5_000,
    })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.lines).toEqual([{ id: 'a', quantity: 3, unitPriceCents: 12_000, lineTotalCents: 36_000 }])
    expect(r.removed).toEqual(['b'])
    expect(r.totals).toMatchObject({ subtotalCents: 36_000, shippingCents: 2_500, discountCents: 5_000, subscriberDiscountCents: 1_000, totalCents: 32_500 })
  })

  it('needs at least one item left', () => {
    const r = recalculateInvoice(current, ids, {
      lines: [
        { id: 'a', quantity: 0, unitPriceCents: 1 },
        { id: 'b', quantity: 0, unitPriceCents: 1 },
      ],
      shippingCents: 0,
      discountCents: 0,
    })
    expect(r).toMatchObject({ ok: false })
  })

  it('refuses a discount larger than the order', () => {
    const r = recalculateInvoice(current, ids, {
      lines: [
        { id: 'a', quantity: 1, unitPriceCents: 1_000 },
        { id: 'b', quantity: 0, unitPriceCents: 0 },
      ],
      shippingCents: 0,
      discountCents: 5_000,
    })
    expect(r).toMatchObject({ ok: false })
  })

  it('refuses a form that no longer matches the order, or a fractional quantity', () => {
    expect(recalculateInvoice(current, ids, { lines: [{ id: 'a', quantity: 1, unitPriceCents: 1 }], shippingCents: 0, discountCents: 0 })).toMatchObject({ ok: false })
    expect(
      recalculateInvoice(current, ids, {
        lines: [
          { id: 'a', quantity: 1.5, unitPriceCents: 100 },
          { id: 'b', quantity: 1, unitPriceCents: 100 },
        ],
        shippingCents: 0,
        discountCents: 0,
      }),
    ).toMatchObject({ ok: false })
  })
})
