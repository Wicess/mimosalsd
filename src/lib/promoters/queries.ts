import 'server-only'
import { db } from '@/lib/db/client'
import { isPaid, netCents } from '@/lib/customers/summary'

/**
 * What each promoter has brought in. Money follows the one rule the rest of the
 * admin uses (`lib/customers/summary.ts`): confirmed payments, less refunds.
 *
 * Credit comes from the order's own `attributedPromoterId`, stamped at checkout,
 * so a link that was later renamed, retired or reassigned does not move it.
 */

export interface PromoterTotals {
  readonly links: number
  readonly clicks: number
  /** Orders that followed one of their links, whatever became of them. */
  readonly orders: number
  readonly paidOrders: number
  readonly netCents: number
}

const EMPTY: PromoterTotals = { links: 0, clicks: 0, orders: 0, paidOrders: 0, netCents: 0 }

export async function promoterTotals(): Promise<Map<string, PromoterTotals>> {
  const [links, orders] = await Promise.all([
    db.trackingLink.groupBy({
      by: ['promoterId'],
      where: { promoterId: { not: null } },
      _count: { _all: true },
      _sum: { clicks: true },
    }),
    db.order.findMany({
      where: { attributedPromoterId: { not: null } },
      select: {
        attributedPromoterId: true,
        status: true,
        totalCents: true,
        refunds: { select: { amountCents: true } },
      },
    }),
  ])

  const totals = new Map<string, PromoterTotals>()
  for (const row of links) {
    if (!row.promoterId) continue
    totals.set(row.promoterId, { ...EMPTY, links: row._count._all, clicks: row._sum.clicks ?? 0 })
  }
  for (const order of orders) {
    const id = order.attributedPromoterId!
    const current = totals.get(id) ?? EMPTY
    totals.set(id, {
      ...current,
      orders: current.orders + 1,
      paidOrders: current.paidOrders + (isPaid(order.status) ? 1 : 0),
      netCents: current.netCents + netCents(order),
    })
  }
  return totals
}

export function listPromoters(archived: boolean) {
  return db.promoter.findMany({
    where: { archived },
    orderBy: [{ archived: 'asc' }, { name: 'asc' }],
  })
}

export function promoterById(id: string) {
  return db.promoter.findUnique({
    where: { id },
    include: {
      links: { orderBy: { createdAt: 'desc' } },
    },
  })
}

/**
 * Orders credited to each link slug, counted from the orders themselves.
 *
 * `TrackingLink.orders` is a counter column that nothing has ever written, and a
 * counter beside the rows it counts is a second truth waiting to drift. The
 * orders carry the slug they followed, so they are the ones asked.
 */
export async function linkOrderCounts(): Promise<Map<string, { orders: number; paidOrders: number }>> {
  const rows = await db.order.findMany({
    where: { attributedLinkSlug: { not: null } },
    select: { attributedLinkSlug: true, status: true },
  })
  const counts = new Map<string, { orders: number; paidOrders: number }>()
  for (const row of rows) {
    const slug = row.attributedLinkSlug!
    const current = counts.get(slug) ?? { orders: 0, paidOrders: 0 }
    counts.set(slug, {
      orders: current.orders + 1,
      paidOrders: current.paidOrders + (isPaid(row.status) ? 1 : 0),
    })
  }
  return counts
}

/** Links nobody owns yet, for the assign control on a promoter's page. */
export function unownedLinks() {
  return db.trackingLink.findMany({
    where: { promoterId: null },
    select: { id: true, slug: true, label: true },
    orderBy: { createdAt: 'desc' },
    take: 100,
  })
}

/** Orders credited to a promoter, newest first. */
export function creditedOrders(promoterId: string, take = 50) {
  return db.order.findMany({
    where: { attributedPromoterId: promoterId },
    select: {
      id: true,
      orderNumber: true,
      createdAt: true,
      status: true,
      totalCents: true,
      attributedLinkSlug: true,
      attributedAt: true,
      refunds: { select: { amountCents: true } },
    },
    orderBy: { createdAt: 'desc' },
    take,
  })
}
