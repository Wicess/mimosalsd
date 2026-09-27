import { describe, expect, it } from 'vitest'
import {
  customerKey,
  groupByCustomer,
  netCents,
  refundedCents,
  summariseCustomer,
  type CustomerOrder,
} from '@/lib/customers/summary'

const r = (...amounts: number[]) => amounts.map((amountCents) => ({ amountCents }))

function order(overrides: Partial<CustomerOrder> = {}): CustomerOrder {
  return {
    status: 'DELIVERED',
    totalCents: 5000,
    refunds: [],
    createdAt: new Date('2026-06-01T12:00:00Z'),
    stateCode: 'TX',
    preferredPaymentMethod: 'CASHAPP',
    couponCode: null,
    ...overrides,
  }
}

describe('customerKey', () => {
  it('treats spellings of one address as one customer', () => {
    expect(customerKey('Jane@Example.com')).toBe('jane@example.com')
    expect(customerKey('  jane@example.com ')).toBe('jane@example.com')
  })
})

describe('refundedCents and netCents', () => {
  it('counts nothing on an order that was never paid', () => {
    for (const status of ['PENDING_VERIFICATION', 'AWAITING_PAYMENT', 'PAYMENT_CLAIMED', 'REJECTED', 'CANCELLED']) {
      expect(netCents(order({ status }))).toBe(0)
      expect(refundedCents(order({ status }))).toBe(0)
    }
  })

  it('takes a partial refund off a paid order', () => {
    const partial = order({ totalCents: 5000, refunds: r(1200) })
    expect(refundedCents(partial)).toBe(1200)
    expect(netCents(partial)).toBe(3800)
  })

  it('sums several refunds against one order', () => {
    expect(netCents(order({ totalCents: 5000, refunds: r(1000, 500) }))).toBe(3500)
  })

  /*
    The status move to REFUNDED does not require a ledger entry, and orders refunded
    before the ledger existed have none. The status is then the only record, and it
    says the money went back.
  */
  it('reads REFUNDED with an empty ledger as the whole total returned', () => {
    const refunded = order({ status: 'REFUNDED', totalCents: 5000 })
    expect(refundedCents(refunded)).toBe(5000)
    expect(netCents(refunded)).toBe(0)
  })

  it('trusts the ledger when a REFUNDED order has one', () => {
    const partial = order({ status: 'REFUNDED', totalCents: 5000, refunds: r(2000) })
    expect(netCents(partial)).toBe(3000)
  })

  it('never reports a negative value when the ledger exceeds the total', () => {
    const over = order({ totalCents: 5000, refunds: r(4000, 4000) })
    expect(refundedCents(over)).toBe(5000)
    expect(netCents(over)).toBe(0)
  })
})

describe('summariseCustomer', () => {
  it('counts only confirmed payments as money, and every order as placed', () => {
    const summary = summariseCustomer([
      order({ totalCents: 4000 }),
      order({ status: 'PAID', totalCents: 6000, refunds: r(1000) }),
      order({ status: 'REJECTED', totalCents: 99_999 }),
      order({ status: 'AWAITING_PAYMENT', totalCents: 12_345 }),
    ])
    expect(summary.placed).toBe(4)
    expect(summary.paid).toBe(2)
    expect(summary.grossCents).toBe(10_000)
    expect(summary.refundedCents).toBe(1000)
    expect(summary.netCents).toBe(9000)
    expect(summary.averageOrderCents).toBe(5000)
  })

  it('keeps gross = net + refunded, whatever the mix', () => {
    const summary = summariseCustomer([
      order({ status: 'REFUNDED', totalCents: 3333 }),
      order({ status: 'SHIPPED', totalCents: 4444, refunds: r(111, 222) }),
      order({ status: 'CANCELLED', totalCents: 5555 }),
    ])
    expect(summary.grossCents).toBe(summary.netCents + summary.refundedCents)
  })

  it('rounds the average to a whole cent', () => {
    const summary = summariseCustomer([
      order({ totalCents: 1000 }),
      order({ totalCents: 1000 }),
      order({ totalCents: 1001 }),
    ])
    expect(summary.averageOrderCents).toBe(1000)
    expect(Number.isInteger(summary.averageOrderCents)).toBe(true)
  })

  it('has no average and no dates for someone with no orders', () => {
    const summary = summariseCustomer([])
    expect(summary.averageOrderCents).toBeNull()
    expect(summary.firstOrderAt).toBeNull()
    expect(summary.lastOrderAt).toBeNull()
  })

  it('has no average when nothing was ever paid', () => {
    expect(summariseCustomer([order({ status: 'REJECTED' })]).averageOrderCents).toBeNull()
  })

  it('finds the first and last order whatever order the rows arrive in', () => {
    const summary = summariseCustomer([
      order({ createdAt: new Date('2026-05-01') }),
      order({ createdAt: new Date('2026-03-01') }),
      order({ createdAt: new Date('2026-07-01') }),
    ])
    expect(summary.firstOrderAt?.toISOString().slice(0, 10)).toBe('2026-03-01')
    expect(summary.lastOrderAt?.toISOString().slice(0, 10)).toBe('2026-07-01')
  })

  it('tallies states, methods and coupons most frequent first, ignoring blanks', () => {
    const summary = summariseCustomer([
      order({ stateCode: 'TX', preferredPaymentMethod: 'CHIME', couponCode: 'SPRING' }),
      order({ stateCode: 'FL', preferredPaymentMethod: 'CHIME', couponCode: null }),
      order({ stateCode: 'TX', preferredPaymentMethod: null, couponCode: 'SPRING' }),
    ])
    expect(summary.states).toEqual([
      { value: 'TX', count: 2 },
      { value: 'FL', count: 1 },
    ])
    expect(summary.paymentMethods).toEqual([{ value: 'CHIME', count: 2 }])
    expect(summary.coupons).toEqual([{ value: 'SPRING', count: 2 }])
  })

  it('breaks tally ties alphabetically so the display is stable', () => {
    const summary = summariseCustomer([order({ stateCode: 'WA' }), order({ stateCode: 'CO' })])
    expect(summary.states.map((t) => t.value)).toEqual(['CO', 'WA'])
  })
})

describe('groupByCustomer', () => {
  it('merges spellings of one address and keeps row order within the group', () => {
    const groups = groupByCustomer([
      { email: 'Jane@x.com', n: 1 },
      { email: 'bob@y.com', n: 2 },
      { email: 'jane@x.com', n: 3 },
    ])
    expect([...groups.keys()]).toEqual(['jane@x.com', 'bob@y.com'])
    expect(groups.get('jane@x.com')?.map((o) => o.n)).toEqual([1, 3])
  })
})
