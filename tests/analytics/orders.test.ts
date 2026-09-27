import { describe, expect, it } from 'vitest'
import { labelledBars, niceCeiling } from '@/lib/charts/axis'
import {
  breakdown,
  lineSales,
  orderKpis,
  parseRange,
  payingCustomerKeys,
  percentChange,
  periodFor,
  productSales,
  revenueSeries,
  type AnalyticsOrder,
} from '@/lib/analytics/orders'

const NOW = new Date('2026-09-11T15:30:00Z')
const iso = (d: Date) => d.toISOString()

function order(overrides: Partial<AnalyticsOrder> = {}): AnalyticsOrder {
  return {
    email: 'a@x.com',
    status: 'DELIVERED',
    totalCents: 5000,
    discountCents: 0,
    couponCode: null,
    preferredPaymentMethod: 'CASHAPP',
    stateCode: 'TX',
    createdAt: new Date('2026-09-10T12:00:00Z'),
    refunds: [],
    items: [],
    ...overrides,
  }
}

describe('parseRange', () => {
  it('accepts the four ranges and defaults anything else to 30 days', () => {
    for (const key of ['7d', '30d', '13w', '12m']) expect(parseRange(key)).toBe(key)
    expect(parseRange(undefined)).toBe('30d')
    expect(parseRange('1y')).toBe('30d')
    expect(parseRange(['7d'])).toBe('30d')
  })

  it('does not treat inherited object keys as ranges', () => {
    expect(parseRange('toString')).toBe('30d')
    expect(parseRange('__proto__')).toBe('30d')
  })
})

describe('periodFor', () => {
  it('covers whole UTC days ending today, one bar per day', () => {
    const p = periodFor('7d', NOW)
    expect(iso(p.start)).toBe('2026-09-05T00:00:00.000Z')
    expect(iso(p.end)).toBe('2026-09-12T00:00:00.000Z')
    expect(iso(p.previousStart)).toBe('2026-08-29T00:00:00.000Z')
    expect(p.buckets).toHaveLength(7)
    expect(p.buckets[0]?.label).toBe('Sep 5')
    expect(p.buckets.at(-1)?.label).toBe('Sep 11')
  })

  it('makes thirteen whole weeks, the last ending tonight', () => {
    const p = periodFor('13w', NOW)
    expect(p.buckets).toHaveLength(13)
    expect(iso(p.end)).toBe('2026-09-12T00:00:00.000Z')
    expect(p.end.getTime() - p.start.getTime()).toBe(91 * 24 * 60 * 60 * 1000)
    expect(p.buckets[0]?.title).toMatch(/^Week of /)
  })

  it('makes twelve calendar months, this one last', () => {
    const p = periodFor('12m', NOW)
    expect(iso(p.start)).toBe('2025-10-01T00:00:00.000Z')
    expect(iso(p.end)).toBe('2026-10-01T00:00:00.000Z')
    expect(iso(p.previousStart)).toBe('2024-10-01T00:00:00.000Z')
    expect(p.buckets.map((b) => b.label)).toEqual([
      'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep',
    ])
    expect(p.buckets[0]?.title).toBe('October 2025')
  })

  it('rolls months back across a year boundary', () => {
    const p = periodFor('12m', new Date('2026-01-15T00:00:00Z'))
    expect(iso(p.start)).toBe('2025-02-01T00:00:00.000Z')
    expect(p.buckets.at(-1)?.title).toBe('January 2026')
  })

  it('leaves no gap and no overlap between bars', () => {
    for (const range of ['7d', '30d', '13w', '12m'] as const) {
      const p = periodFor(range, NOW)
      expect(p.buckets[0]?.start.getTime()).toBe(p.start.getTime())
      expect(p.buckets.at(-1)?.end.getTime()).toBe(p.end.getTime())
      p.buckets.slice(1).forEach((b, i) => {
        expect(b.start.getTime()).toBe(p.buckets[i]?.end.getTime())
      })
    }
  })
})

describe('orderKpis', () => {
  const orders = [
    order({ email: 'Jane@x.com', totalCents: 4000 }),
    order({ email: 'jane@x.com', status: 'PAID', totalCents: 6000, refunds: [{ amountCents: 1000 }] }),
    order({ email: 'bob@y.com', status: 'REFUNDED', totalCents: 3000 }),
    order({ email: 'cy@z.com', status: 'REJECTED', totalCents: 9999 }),
    order({ email: 'cy@z.com', status: 'AWAITING_PAYMENT', totalCents: 1234 }),
    order({ email: 'di@z.com', status: 'PAID', totalCents: 2000, couponCode: 'SPRING', discountCents: 300 }),
    order({ email: 'di@z.com', status: 'CANCELLED', couponCode: 'SPRING', discountCents: 500 }),
  ]
  const k = orderKpis(orders)

  it('counts money only from confirmed payments, less refunds', () => {
    expect(k.placed).toBe(7)
    expect(k.paid).toBe(4)
    expect(k.grossCents).toBe(15_000)
    expect(k.refundedCents).toBe(4000) // 1000 ledger + the 3000 REFUNDED with no ledger
    expect(k.netCents).toBe(11_000)
    expect(k.averageOrderCents).toBe(3750)
  })

  it('leaves open orders out of the confirmation rate', () => {
    expect(k.open).toBe(1)
    // 4 paid of 6 decided (4 paid + 1 rejected + 1 cancelled).
    expect(k.confirmationRate).toBeCloseTo(4 / 6)
  })

  it('counts one person under two spellings as one repeat customer', () => {
    expect(k.payingCustomers).toBe(3)
    expect(k.repeatCustomers).toBe(1)
    expect(payingCustomerKeys(orders).sort()).toEqual(['bob@y.com', 'di@z.com', 'jane@x.com'])
  })

  it('counts discounts only on orders that were paid', () => {
    expect(k.couponOrders).toBe(1)
    expect(k.discountCents).toBe(300)
  })

  it('has no rate and no average over nothing', () => {
    const empty = orderKpis([])
    expect(empty.confirmationRate).toBeNull()
    expect(empty.averageOrderCents).toBeNull()
    expect(orderKpis([order({ status: 'PENDING_VERIFICATION' })]).confirmationRate).toBeNull()
  })
})

describe('niceCeiling', () => {
  it('rounds an axis top up to 1, 2, 2.5 or 5 times a power of ten', () => {
    expect(niceCeiling(31_000)).toBe(50_000) // $310 -> $500
    expect(niceCeiling(20_001)).toBe(25_000)
    expect(niceCeiling(20_000)).toBe(20_000)
    expect(niceCeiling(100_000)).toBe(100_000)
    expect(niceCeiling(100_001)).toBe(200_000)
    expect(niceCeiling(7_777_777)).toBe(10_000_000)
  })

  it('takes a floor of its own for counts', () => {
    expect(niceCeiling(0, 2)).toBe(2)
    expect(niceCeiling(3, 2)).toBe(5)
    expect(niceCeiling(17, 2)).toBe(20)
  })

  it('never goes under a dollar, and handles an empty chart', () => {
    expect(niceCeiling(0)).toBe(100)
    expect(niceCeiling(37)).toBe(100)
    expect(niceCeiling(101)).toBe(200)
  })

  it('is never below the value it was given', () => {
    for (let cents = 1; cents < 2_000_000; cents = Math.ceil(cents * 1.37)) {
      expect(niceCeiling(cents)).toBeGreaterThanOrEqual(cents)
    }
  })
})

describe('labelledBars', () => {
  it('always labels the newest bar and keeps to about six labels', () => {
    for (const count of [7, 12, 13, 30]) {
      const labelled = labelledBars(count)
      expect(labelled.has(count - 1)).toBe(true)
      expect(labelled.size).toBeLessThanOrEqual(7)
    }
    expect([...labelledBars(7)].sort((a, b) => a - b)).toEqual([0, 2, 4, 6])
    expect([...labelledBars(30)].sort((a, b) => a - b)).toEqual([4, 9, 14, 19, 24, 29])
  })
})

describe('percentChange', () => {
  it('reports rounded change, and nothing at all against zero', () => {
    expect(percentChange(150, 100)).toBe(50)
    expect(percentChange(100, 150)).toBe(-33)
    expect(percentChange(100, 100)).toBe(0)
    expect(percentChange(5, 0)).toBeNull()
    expect(percentChange(0, 0)).toBeNull()
  })
})

describe('revenueSeries', () => {
  const period = periodFor('7d', NOW)

  it('puts each paid order in the bar for the day it was placed', () => {
    const series = revenueSeries(
      [
        order({ createdAt: new Date('2026-09-05T00:00:00Z'), totalCents: 1000 }),
        order({ createdAt: new Date('2026-09-05T23:59:59Z'), totalCents: 2000 }),
        // Exactly midnight belongs to the next day, not both.
        order({ createdAt: new Date('2026-09-06T00:00:00Z'), totalCents: 4000 }),
        order({ createdAt: new Date('2026-09-11T15:00:00Z'), totalCents: 8000, refunds: [{ amountCents: 500 }] }),
      ],
      period,
    )
    expect(series.map((p) => p.netCents)).toEqual([3000, 4000, 0, 0, 0, 0, 7500])
    expect(series.map((p) => p.paid)).toEqual([2, 1, 0, 0, 0, 0, 1])
  })

  it('ignores unpaid orders and anything outside the period', () => {
    const series = revenueSeries(
      [
        order({ status: 'REJECTED' }),
        order({ createdAt: new Date('2026-09-04T23:59:59Z') }),
        order({ createdAt: new Date('2026-09-12T00:00:00Z') }),
      ],
      period,
    )
    expect(series.every((p) => p.netCents === 0 && p.paid === 0)).toBe(true)
  })

  it('adds up to the period net for orders inside it', () => {
    const inside = [
      order({ createdAt: new Date('2026-09-07T10:00:00Z'), totalCents: 1234 }),
      order({ createdAt: new Date('2026-09-09T10:00:00Z'), status: 'REFUNDED', totalCents: 999 }),
      order({ createdAt: new Date('2026-09-10T10:00:00Z'), totalCents: 777, refunds: [{ amountCents: 77 }] }),
    ]
    const total = revenueSeries(inside, period).reduce((sum, p) => sum + p.netCents, 0)
    expect(total).toBe(orderKpis(inside).netCents)
  })
})

describe('breakdown', () => {
  it('groups by the given field, most revenue first, skipping blanks', () => {
    const rows = breakdown(
      [
        order({ stateCode: 'TX', totalCents: 1000 }),
        order({ stateCode: 'FL', totalCents: 5000 }),
        order({ stateCode: 'TX', totalCents: 1000 }),
        order({ stateCode: 'TX', status: 'REJECTED', totalCents: 99_999 }),
      ],
      (o) => o.stateCode,
    )
    expect(rows).toEqual([
      { key: 'FL', placed: 1, paid: 1, netCents: 5000 },
      { key: 'TX', placed: 3, paid: 2, netCents: 2000 },
    ])
    expect(breakdown([order()], (o) => o.couponCode)).toEqual([])
  })
})

describe('productSales and lineSales', () => {
  const items = (...rows: [string, string, number, number][]) =>
    rows.map(([productName, productLine, quantity, lineTotalCents]) => ({
      productName,
      productLine,
      quantity,
      lineTotalCents,
    }))

  const orders = [
    order({ items: items(['Root Bark 1lb', 'MHRB', 2, 9000], ['Caps 10ct', 'AMANITA', 1, 3000]) }),
    order({ items: items(['Root Bark 1lb', 'MHRB', 1, 4500]) }),
    order({ status: 'REJECTED', items: items(['Caps 10ct', 'AMANITA', 50, 150_000]) }),
  ]

  it('sums units and line totals from paid orders only', () => {
    expect(productSales(orders)).toEqual([
      { name: 'Root Bark 1lb', line: 'MHRB', units: 3, salesCents: 13_500 },
      { name: 'Caps 10ct', line: 'AMANITA', units: 1, salesCents: 3000 },
    ])
  })

  it('rolls products up to their line', () => {
    expect(lineSales(orders).map((r) => [r.line, r.units, r.salesCents])).toEqual([
      ['MHRB', 3, 13_500],
      ['AMANITA', 1, 3000],
    ])
  })
})
