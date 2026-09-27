import { randomUUID } from 'node:crypto'
import { PrismaClient, type OrderStatus } from '@prisma/client'
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * Revenue on the Orders page, against a REAL Postgres: the figure is one raw SQL
 * query, so a mocked database would only prove the mock agrees with itself.
 *
 * Skipped unless TEST_DATABASE_URL points at a disposable local database. It
 * REFUSES any host but this machine: `.env` is production.
 */
const url = process.env.TEST_DATABASE_URL
if (url && !/@(127\.0\.0\.1|localhost)(:\d+)?\//.test(url)) {
  throw new Error('TEST_DATABASE_URL must be a local database; refusing to run against ' + url.replace(/:[^:@/]+@/, ':***@'))
}
const local = url ? new PrismaClient({ datasourceUrl: url }) : null
vi.mock('@/lib/db/client', () => ({ db: local }))

const { paymentStateOf, periodStarts, revenueSummary } = await import('@/lib/orders/revenue')
const { netRevenueAllTime } = await import('@/lib/analytics/queries')

/*
  Other integration files write orders to the same database at the same time, with
  today's date. This suite's paid orders live in 2031, so the period figures are
  exact; the all-time and open figures are measured as the change this suite made.
*/
const NOW = new Date('2031-06-14T15:00:00Z')
const TAG = `rev-${randomUUID().slice(0, 8)}`

async function order(status: OrderStatus, totalCents: number, extra: { paidAt?: string; createdAt?: string } = {}) {
  return local!.order.create({
    data: {
      orderNumber: `${TAG}-${randomUUID().slice(0, 6)}`,
      orderToken: randomUUID(),
      email: `${TAG}@example.test`,
      firstName: 'Test',
      lastName: 'Buyer',
      addressLine1: '1 Main St',
      city: 'Austin',
      stateCode: 'TX',
      postalCode: '78701',
      subtotalCents: totalCents,
      totalCents,
      status,
      paidAt: extra.paidAt ? new Date(extra.paidAt) : null,
      createdAt: extra.createdAt ? new Date(extra.createdAt) : new Date('2031-05-01T00:00:00Z'),
    },
  })
}

describe.skipIf(!local)('revenue on the Orders page (local Postgres)', () => {
  const mine = { email: `${TAG}@example.test` }
  beforeEach(async () => {
    await local!.refund.deleteMany({ where: { order: mine } })
    await local!.order.deleteMany({ where: mine })
  })
  afterAll(async () => {
    await local?.refund.deleteMany({ where: { order: { email: `${TAG}@example.test` } } })
    await local?.order.deleteMany({ where: { email: `${TAG}@example.test` } })
    await local?.$disconnect()
  })

  it('counts only confirmed payments, by when they were confirmed, less refunds', async () => {
    const before = await revenueSummary(NOW)
    const netBefore = await netRevenueAllTime()

    await order('PAID', 10_000, { paidAt: '2031-06-14T09:00:00Z' }) // today
    await order('SHIPPED', 5_000, { paidAt: '2031-06-10T12:00:00Z' }) // this week
    await order('DELIVERED', 2_500, { paidAt: '2031-06-02T12:00:00Z' }) // this month
    const partly = await order('PACKED', 4_000, { paidAt: '2031-05-20T12:00:00Z' }) // last month
    await local!.refund.create({ data: { orderId: partly.id, amountCents: 1_000, reason: 'damaged', issuedBy: 'owner' } })
    await order('REFUNDED', 3_000, { paidAt: '2031-05-10T12:00:00Z' }) // refunded, no refund record
    // Confirmed before paidAt existed: placed by when it was ordered.
    await order('PAID', 700, { createdAt: '2031-06-14T10:00:00Z' })

    // Not revenue yet.
    await order('PAYMENT_CLAIMED', 6_000)
    await order('PAYMENT_CLAIMED', 1_500)
    await order('AWAITING_PAYMENT', 8_000)
    await order('PENDING_VERIFICATION', 900)
    // Never revenue.
    await order('CANCELLED', 50_000)
    await order('REJECTED', 40_000)
    await order('DRAFT', 30_000)

    const r = await revenueSummary(NOW)
    const grew = (after: { cents: number; orders: number }, was: { cents: number; orders: number }) => ({
      cents: after.cents - was.cents,
      orders: after.orders - was.orders,
    })
    expect(grew(r.allTime, before.allTime)).toEqual({ cents: 10_000 + 5_000 + 2_500 + 3_000 + 700, orders: 6 })
    expect(r.refundedCents - before.refundedCents).toBe(1_000 + 3_000)
    expect(r.thisMonth).toEqual({ cents: 10_000 + 5_000 + 2_500 + 700, orders: 4 })
    expect(r.last7Days).toEqual({ cents: 10_000 + 5_000 + 700, orders: 3 })
    expect(r.today).toEqual({ cents: 10_000 + 700, orders: 2 })
    // Other files may add open orders meanwhile, never take ours away.
    expect(grew(r.claimed, before.claimed).cents).toBeGreaterThanOrEqual(7_500)
    expect(grew(r.awaiting, before.awaiting).cents).toBeGreaterThanOrEqual(8_000)
    expect(grew(r.unverified, before.unverified).cents).toBeGreaterThanOrEqual(900)

    // The same rule as the dashboard's net revenue, so the two never disagree.
    expect((await netRevenueAllTime()) - netBefore).toBe(r.allTime.cents - before.allTime.cents)
  })

  it('says zero, not nothing, for a period with no payments', async () => {
    const r = await revenueSummary(new Date('2031-01-15T12:00:00Z'))
    expect(r.today).toEqual({ cents: 0, orders: 0 })
    expect(typeof r.claimed.cents).toBe('number')
  })

  it('starts the periods at UTC midnight, the last seven days including today, and the month on the 1st', () => {
    const starts = periodStarts(new Date('2026-09-14T15:00:00Z'))
    expect(starts.today.toISOString()).toBe('2026-09-14T00:00:00.000Z')
    expect(starts.last7Days.toISOString()).toBe('2026-09-08T00:00:00.000Z')
    expect(starts.thisMonth.toISOString()).toBe('2026-09-01T00:00:00.000Z')
  })
})

describe('paymentStateOf', () => {
  it('marks every order whose payment was confirmed as paid, all the way to delivery', () => {
    for (const status of ['PAID', 'PACKED', 'SHIPPED', 'DELIVERED']) expect(paymentStateOf(status), status).toBe('paid')
    expect(paymentStateOf('REFUNDED')).toBe('refunded')
    expect(paymentStateOf('PAYMENT_CLAIMED')).toBe('claimed')
    expect(paymentStateOf('AWAITING_PAYMENT')).toBe('awaiting')
    expect(paymentStateOf('PENDING_VERIFICATION')).toBe('unverified')
    for (const status of ['CANCELLED', 'REJECTED', 'DRAFT']) expect(paymentStateOf(status), status).toBe('closed')
  })
})
