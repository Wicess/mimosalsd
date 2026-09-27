import 'server-only'
import { db } from '@/lib/db/client'
import { isPaid } from '@/lib/customers/summary'
import { realViewsBetween } from '@/lib/analytics/visits'
import { DIRECT, platformLabel, sourceOf, type Source } from './platforms'

/**
 * ─────────────────────────────────────────────────────────────────────────────
 *  TRAFFIC BY SOURCE, AND BY TRACKING LINK (owner, 2026-09-14).
 *
 *  For a period: each real visitor's source (their tracking link's platform, else
 *  the site that referred them, else direct), and what the visitors from each
 *  source did: pages, carts, checkouts, orders and paid revenue. Tracking links
 *  get the same row each, so one Instagram post can be compared with another.
 *
 *  A visitor is credited to their first source in the period. An order is credited
 *  to the tracking link stamped on it at checkout when there is one, otherwise to
 *  the source of the visitor who placed it.
 * ─────────────────────────────────────────────────────────────────────────────
 */

export interface SourceRow {
  readonly key: string
  readonly label: string
  readonly visitors: number
  readonly views: number
  readonly cartAdds: number
  readonly checkouts: number
  readonly orders: number
  readonly paidOrders: number
  readonly revenueCents: number
}

type Mutable = { -readonly [K in keyof SourceRow]: SourceRow[K] }

const blank = (source: Source): Mutable => ({
  key: source.key,
  label: source.label,
  visitors: 0,
  views: 0,
  cartAdds: 0,
  checkouts: 0,
  orders: 0,
  paidOrders: 0,
  revenueCents: 0,
})

export async function trafficReport(start: Date, end: Date) {
  const [views, links, carts, orders] = await Promise.all([
    realViewsBetween(start, end),
    db.trackingLink.findMany({ select: { slug: true, label: true, source: true } }).catch(() => []),
    db.cartActivity
      .findMany({
        where: { createdAt: { gte: start, lt: end }, type: { in: ['ADDED', 'CHECKOUT_STARTED'] } },
        select: { visitorId: true, type: true, quantity: true, linkSlug: true },
        take: 50_000,
      })
      .catch(() => []),
    db.order
      .findMany({
        where: { createdAt: { gte: start, lt: end } },
        select: { orderNumber: true, status: true, totalCents: true, attributedLinkSlug: true },
        take: 20_000,
      })
      .catch(() => []),
  ])
  const linkBySlug = new Map(links.map((link) => [link.slug, link]))
  const linkSource = (slug: string): Source => {
    const link = linkBySlug.get(slug)
    return sourceOf({ utmSource: link?.source ?? slug, referrer: null })
  }

  // Each visitor's source: the first view in the period that names one.
  const visitorSource = new Map<string, Source>()
  const visitorCampaign = new Map<string, string>()
  const sortedViews = [...views].sort((a, b) => a.at - b.at)
  for (const view of sortedViews) {
    if (!visitorSource.has(view.visitorId) || visitorSource.get(view.visitorId) === DIRECT) {
      const source = sourceOf({ utmSource: view.utmSource, referrer: view.referrer })
      if (!visitorSource.has(view.visitorId) || source !== DIRECT) visitorSource.set(view.visitorId, source)
    }
  }

  const bySource = new Map<string, Mutable>()
  const byLink = new Map<string, Mutable>()
  const row = (map: Map<string, Mutable>, source: Source) => {
    const existing = map.get(source.key)
    if (existing) return existing
    const created = blank(source)
    map.set(source.key, created)
    return created
  }

  // A visitor's tracking link: the first campaign in the period that is one of ours.
  for (const view of sortedViews) {
    if (view.utmCampaign && linkBySlug.has(view.utmCampaign) && !visitorCampaign.has(view.visitorId)) {
      visitorCampaign.set(view.visitorId, view.utmCampaign)
    }
  }

  const counted = new Set<string>()
  const countedForLink = new Set<string>()
  for (const view of sortedViews) {
    const source = visitorSource.get(view.visitorId) ?? DIRECT
    const r = row(bySource, source)
    r.views += 1
    if (!counted.has(view.visitorId)) {
      counted.add(view.visitorId)
      r.visitors += 1
    }
    const slug = visitorCampaign.get(view.visitorId)
    if (slug) {
      const l = row(byLink, { key: slug, label: linkBySlug.get(slug)?.label ?? slug })
      l.views += 1
      if (!countedForLink.has(view.visitorId)) {
        countedForLink.add(view.visitorId)
        l.visitors += 1
      }
    }
  }

  for (const cart of carts) {
    const source = cart.linkSlug ? linkSource(cart.linkSlug) : cart.visitorId ? visitorSource.get(cart.visitorId) ?? DIRECT : DIRECT
    const r = row(bySource, source)
    if (cart.type === 'ADDED') r.cartAdds += Math.max(1, cart.quantity)
    else r.checkouts += 1
    if (cart.linkSlug) {
      const l = row(byLink, { key: cart.linkSlug, label: linkBySlug.get(cart.linkSlug)?.label ?? cart.linkSlug })
      if (cart.type === 'ADDED') l.cartAdds += Math.max(1, cart.quantity)
      else l.checkouts += 1
    }
  }

  // Orders: the link stamped on the order, else the placing visitor's source.
  const numbers = orders.map((o) => o.orderNumber)
  const placedBy = numbers.length
    ? await db.visitorActivity
        .findMany({
          where: { kind: 'ORDER_PLACED', createdAt: { gte: start, lt: end } },
          select: { visitorId: true, detail: true },
          take: 20_000,
        })
        .catch(() => [])
    : []
  const visitorOfOrder = new Map(
    placedBy
      .map((act) => [act.detail?.split(' · ')[0]?.trim() ?? '', act.visitorId] as const)
      .filter(([number]) => number),
  )
  for (const order of orders) {
    const visitor = visitorOfOrder.get(order.orderNumber)
    const source = order.attributedLinkSlug
      ? linkSource(order.attributedLinkSlug)
      : visitor
        ? visitorSource.get(visitor) ?? DIRECT
        : DIRECT
    const paid = isPaid(order.status)
    for (const r of [
      row(bySource, source),
      ...(order.attributedLinkSlug
        ? [row(byLink, { key: order.attributedLinkSlug, label: linkBySlug.get(order.attributedLinkSlug)?.label ?? order.attributedLinkSlug })]
        : []),
    ]) {
      r.orders += 1
      if (paid) {
        r.paidOrders += 1
        r.revenueCents += order.totalCents
      }
    }
  }

  const sorted = (map: Map<string, Mutable>) =>
    [...map.values()].sort((a, b) => b.visitors - a.visitors || b.orders - a.orders || b.views - a.views || a.label.localeCompare(b.label))

  return { sources: sorted(bySource) as SourceRow[], links: new Map([...byLink].map(([k, v]) => [k, v as SourceRow])), platformLabel }
}
