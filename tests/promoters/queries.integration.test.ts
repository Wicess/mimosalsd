import { PrismaClient } from '@prisma/client'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * Promoter totals against a REAL Postgres: they join links, orders and refunds,
 * and a mocked database would only prove the mock agrees with itself.
 *
 * Skipped unless TEST_DATABASE_URL points at a disposable database with the
 * current schema. It empties the tables it uses.
 */
const url = process.env.TEST_DATABASE_URL
const local = url ? new PrismaClient({ datasourceUrl: url }) : null
vi.mock('@/lib/db/client', () => ({ db: local }))

const { promoterTotals, creditedOrders, unownedLinks } = await import('@/lib/promoters/queries')

let orderNumber = 1000
async function order(promoterId: string | null, status: string, totalCents: number, refunds: number[] = []) {
  orderNumber += 1
  return local!.order.create({
    data: {
      orderNumber: `T-${orderNumber}`,
      orderToken: `tok-${orderNumber}`,
      email: 'buyer@example.com',
      firstName: 'A',
      lastName: 'B',
      addressLine1: '1 Main St',
      city: 'Austin',
      stateCode: 'TX',
      postalCode: '78701',
      subtotalCents: totalCents,
      totalCents,
      status: status as never,
      ...(promoterId ? { attributedPromoterId: promoterId, attributedLinkSlug: 'a-link', attributedAt: new Date() } : {}),
      ...(refunds.length
        ? { refunds: { create: refunds.map((amountCents) => ({ amountCents, reason: 'test', issuedBy: 'test' })) } }
        : {}),
    },
  })
}

describe.skipIf(!local)('promoter totals against Postgres', () => {
  beforeAll(async () => {
    await local!.$connect()
  })
  afterAll(async () => {
    await local?.$disconnect()
  })
  beforeEach(async () => {
    await local!.refund.deleteMany()
    await local!.order.deleteMany()
    await local!.trackingLink.deleteMany()
    await local!.promoter.deleteMany()
  })

  it('counts a promoter’s links and clicks, and the money their orders kept', async () => {
    const dana = await local!.promoter.create({ data: { slug: 'dana', name: 'Dana' } })
    const sam = await local!.promoter.create({ data: { slug: 'sam', name: 'Sam' } })
    await local!.trackingLink.createMany({
      data: [
        { slug: 'dana-a', label: 'A', targetUrl: '/shop', clicks: 40, promoterId: dana.id },
        { slug: 'dana-b', label: 'B', targetUrl: '/shop', clicks: 2, promoterId: dana.id },
        { slug: 'sam-a', label: 'C', targetUrl: '/shop', clicks: 7, promoterId: sam.id },
        { slug: 'ours', label: 'House', targetUrl: '/shop', clicks: 99 },
      ],
    })
    await order(dana.id, 'DELIVERED', 10_000)
    await order(dana.id, 'PAID', 5_000, [1_000]) // partly refunded
    await order(dana.id, 'REJECTED', 99_999) // never paid: not money
    await order(null, 'DELIVERED', 7_000) // nobody's credit
    await order(sam.id, 'REFUNDED', 4_000) // returned in full

    const totals = await promoterTotals()
    expect(totals.get(dana.id)).toEqual({ links: 2, clicks: 42, orders: 3, paidOrders: 2, netCents: 14_000 })
    expect(totals.get(sam.id)).toEqual({ links: 1, clicks: 7, orders: 1, paidOrders: 1, netCents: 0 })
    // The house link belongs to nobody and shows up for assignment instead.
    expect((await unownedLinks()).map((l) => l.slug)).toEqual(['ours'])
  })

  it('lists a promoter’s credited orders, newest first', async () => {
    const dana = await local!.promoter.create({ data: { slug: 'dana', name: 'Dana' } })
    const first = await order(dana.id, 'DELIVERED', 1_000)
    const second = await order(dana.id, 'PAID', 2_000)
    const credited = await creditedOrders(dana.id)
    expect(credited.map((o) => o.orderNumber)).toEqual([second.orderNumber, first.orderNumber])
    expect(credited[0]?.attributedLinkSlug).toBe('a-link')
  })

  it('keeps the credit on the order when the promoter is archived, and clears it if deleted', async () => {
    const dana = await local!.promoter.create({ data: { slug: 'dana', name: 'Dana' } })
    const placed = await order(dana.id, 'DELIVERED', 1_000)
    await local!.promoter.update({ where: { id: dana.id }, data: { archived: true } })
    expect((await local!.order.findUniqueOrThrow({ where: { id: placed.id } })).attributedPromoterId).toBe(dana.id)

    // Deleting is not offered in the admin; if it ever happens the order survives.
    await local!.promoter.delete({ where: { id: dana.id } })
    const after = await local!.order.findUniqueOrThrow({ where: { id: placed.id } })
    expect(after.attributedPromoterId).toBeNull()
    expect(after.attributedLinkSlug).toBe('a-link')
  })
})
