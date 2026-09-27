import 'server-only'
import { db } from '@/lib/db/client'
import { HUMAN_KIND } from './activity'
import { NO_EVIDENCE, type HumanEvidence } from './human'
import { parseVisitEvent, type VisitEvent } from './page-view'

export { whenMigrated, type Migrated } from '@/lib/db/migrated'

/**
 * Reads behind /admin/visitors. Filed data only — today's visits are still in the
 * buffer table, and the one thing read from there is how many are waiting.
 *
 * ── Before migration 0012 ──────────────────────────────────────────────────
 * The columns and tables these read arrive with migration 0012. Until it is
 * applied, `whenMigrated` (lib/db/migrated.ts) turns schema-lag errors into
 * `{ migrated: false }` so the page can say what to do instead of failing.
 */
export function dailyStats(start: Date, end: Date) {
  return db.dailyVisitStat.findMany({
    where: { day: { gte: start, lt: end } },
    orderBy: { day: 'asc' },
  })
}

/** Distinct people (not flagged as automated) active, and first seen, since `start`. */
export async function visitorCounts(start: Date) {
  const [active, fresh] = await Promise.all([
    db.visitor.count({ where: { isLikelyBot: false, lastSeen: { gte: start } } }),
    db.visitor.count({ where: { isLikelyBot: false, firstSeen: { gte: start } } }),
  ])
  return { active, fresh }
}

const LIST_FIELDS = {
  id: true,
  visitorId: true,
  firstSeen: true,
  lastSeen: true,
  pageViews: true,
  sessionCount: true,
  landingPath: true,
  lastPath: true,
  referrer: true,
  utmSource: true,
  country: true,
  region: true,
  city: true,
  postalCode: true,
  latitude: true,
  longitude: true,
  timezone: true,
  device: true,
  browser: true,
  os: true,
  isLikelyBot: true,
} as const

export function recentVisitors({ bots, limit = 100 }: { bots: boolean; limit?: number }) {
  return db.visitor.findMany({
    where: bots ? {} : { isLikelyBot: false },
    select: LIST_FIELDS,
    orderBy: { lastSeen: 'desc' },
    take: limit,
  })
}

export type VisitorListRow = Awaited<ReturnType<typeof recentVisitors>>[number]

export function visitorById(id: string) {
  return db.visitor.findUnique({
    where: { id },
    select: { ...LIST_FIELDS, visitorId: true, utmMedium: true, utmCampaign: true },
  })
}

export function pageHistory(visitorId: string, limit = 200) {
  return db.pageView.findMany({
    where: { visitorId },
    select: { id: true, path: true, at: true },
    orderBy: { at: 'desc' },
    take: limit,
  })
}

/** Chat threads under the same visitor cookie. Handles and dates only, never content. */
export function visitorThreads(visitorId: string) {
  return db.supportThread.findMany({
    where: { visitorId },
    select: { id: true, publicId: true, isOpen: true, lastMessageAt: true, createdAt: true },
    orderBy: { lastMessageAt: 'desc' },
    take: 10,
  })
}

/**
 * Page views recorded today and not yet filed. Null when the table is not there
 * yet — the count is a nicety, and must not take the page down with it.
 */
export async function bufferedToday(now: Date): Promise<number | null> {
  try {
    return await db.visitEvent.count({
      where: { day: new Date(`${now.toISOString().slice(0, 10)}T00:00:00Z`) },
    })
  } catch {
    return null
  }
}

const dayOf = (now: Date) => new Date(`${now.toISOString().slice(0, 10)}T00:00:00Z`)

/**
 * Today's page views from the buffer, optionally for one visitor. Empty rather than
 * an error when the buffer table is missing, so the page still renders.
 */
export async function bufferedEvents(now: Date, visitorId?: string): Promise<VisitEvent[]> {
  try {
    const rows = await db.visitEvent.findMany({
      where: {
        day: dayOf(now),
        ...(visitorId ? { payload: { path: ['v'], equals: visitorId } } : {}),
      },
      select: { payload: true },
      take: 5000,
    })
    return rows.map((row) => parseVisitEvent(JSON.stringify(row.payload))).filter((e): e is VisitEvent => e !== null)
  } catch {
    return []
  }
}

export interface ActivityRow {
  readonly id: string
  readonly visitorId: string
  readonly kind: string
  readonly detail: string | null
  readonly path: string | null
  readonly createdAt: Date
}

const ACTIVITY_FIELDS = { id: true, visitorId: true, kind: true, detail: true, path: true, createdAt: true } as const

/*
  Activity reads are wrapped the same way: a database without migration 0015 shows
  no milestones rather than an error page.
*/

/**
 * What the real-visitor rule needs (lib/visitors/human.ts): which of these visitors
 * have proved a person was there, and when the first proof ever arrived. Two indexed
 * reads. On a failure it says "no proofs yet", which falls back to the older rule
 * rather than hiding everyone.
 */
export async function humanEvidence(visitorIds: readonly string[]): Promise<HumanEvidence> {
  try {
    const [first, proofs] = await Promise.all([
      db.visitorActivity.findFirst({ where: { kind: HUMAN_KIND }, orderBy: { createdAt: 'asc' }, select: { createdAt: true } }),
      visitorIds.length
        ? db.visitorActivity.findMany({ where: { kind: HUMAN_KIND, visitorId: { in: [...new Set(visitorIds)] } }, select: { visitorId: true } })
        : Promise.resolve([]),
    ])
    return { since: first?.createdAt ?? null, verified: new Set(proofs.map((row) => row.visitorId)) }
  } catch {
    return NO_EVIDENCE
  }
}

/** Every milestone recorded since `start`, newest first. */
export async function activitySince(start: Date, limit = 1000): Promise<ActivityRow[]> {
  try {
    return await db.visitorActivity.findMany({
      where: { createdAt: { gte: start } },
      select: ACTIVITY_FIELDS,
      orderBy: { createdAt: 'desc' },
      take: limit,
    })
  } catch {
    return []
  }
}

/** Which milestones each of these visitors has reached, ever. */
export async function milestoneKinds(visitorIds: readonly string[]): Promise<Map<string, Set<string>>> {
  const byVisitor = new Map<string, Set<string>>()
  if (visitorIds.length === 0) return byVisitor
  try {
    const rows = await db.visitorActivity.groupBy({
      by: ['visitorId', 'kind'],
      where: { visitorId: { in: [...visitorIds] } },
    })
    for (const row of rows) {
      const kinds = byVisitor.get(row.visitorId) ?? new Set<string>()
      kinds.add(row.kind)
      byVisitor.set(row.visitorId, kinds)
    }
  } catch {
    // No milestones rather than no page.
  }
  return byVisitor
}

/** One visitor's milestones, newest first. */
export async function activityTimeline(visitorId: string, limit = 300): Promise<ActivityRow[]> {
  try {
    return await db.visitorActivity.findMany({
      where: { visitorId },
      select: ACTIVITY_FIELDS,
      orderBy: { createdAt: 'desc' },
      take: limit,
    })
  } catch {
    return []
  }
}

export function visitorByVisitorId(visitorId: string) {
  return db.visitor.findUnique({
    where: { visitorId },
    select: { ...LIST_FIELDS, utmMedium: true, utmCampaign: true },
  })
}

/** Per visitor and kind: how many times they did it, and when last. For the list's signals. */
export async function activityCounts(
  visitorIds: readonly string[],
): Promise<Map<string, Map<string, { count: number; last: Date }>>> {
  const byVisitor = new Map<string, Map<string, { count: number; last: Date }>>()
  if (visitorIds.length === 0) return byVisitor
  try {
    const rows = await db.visitorActivity.groupBy({
      by: ['visitorId', 'kind'],
      where: { visitorId: { in: [...visitorIds] } },
      _count: { _all: true },
      _max: { createdAt: true },
    })
    for (const row of rows) {
      const kinds = byVisitor.get(row.visitorId) ?? new Map<string, { count: number; last: Date }>()
      kinds.set(row.kind, { count: row._count._all, last: row._max.createdAt ?? new Date(0) })
      byVisitor.set(row.visitorId, kinds)
    }
  } catch {
    // No signals rather than no page.
  }
  return byVisitor
}

/**
 * The email each visitor gave us, where they gave one: on an order first (they
 * bought with it), then in a chat, then signing up for emails. Read from records
 * that already hold the address; nothing new is collected for this.
 */
export async function visitorEmails(visitorIds: readonly string[]): Promise<Map<string, string>> {
  const emails = new Map<string, string>()
  if (visitorIds.length === 0) return emails
  const ids = [...visitorIds]
  try {
    const [acts, threads, unlabelled] = await Promise.all([
      db.visitorActivity.findMany({
        where: { visitorId: { in: ids }, kind: { in: ['ORDER_PLACED', 'SUBSCRIBED'] }, detail: { not: null } },
        select: { visitorId: true, kind: true, detail: true },
        orderBy: { createdAt: 'desc' },
      }),
      db.supportThread.findMany({
        where: { visitorId: { in: ids }, email: { not: null } },
        select: { visitorId: true, email: true },
        orderBy: { lastMessageAt: 'desc' },
      }),
      // Sign-ups from before the address was written on the milestone (2026-09-14).
      db.visitorActivity.findMany({
        where: { visitorId: { in: ids }, kind: 'SUBSCRIBED', detail: null },
        select: { visitorId: true, createdAt: true },
      }),
    ])
    // ORDER_PLACED's detail is "SG-XXXX · $12.00": the order number, then the total.
    const orderOf = new Map<string, string>()
    for (const act of acts) {
      if (act.kind !== 'ORDER_PLACED' || !act.detail) continue
      const number = act.detail.split(' · ')[0]?.trim()
      if (number && !orderOf.has(act.visitorId)) orderOf.set(act.visitorId, number)
    }
    const orders = orderOf.size
      ? await db.order.findMany({ where: { orderNumber: { in: [...new Set(orderOf.values())] } }, select: { orderNumber: true, email: true } })
      : []
    const orderEmail = new Map(orders.map((o) => [o.orderNumber, o.email]))
    const give = (visitorId: string | null, email: string | null | undefined) => {
      if (visitorId && email && email.includes('@') && !emails.has(visitorId)) emails.set(visitorId, email.toLowerCase())
    }
    for (const [visitorId, number] of orderOf) give(visitorId, orderEmail.get(number))
    for (const thread of threads) give(thread.visitorId, thread.email)
    for (const act of acts) if (act.kind === 'SUBSCRIBED') give(act.visitorId, act.detail)
    /*
      An older sign-up recorded no address, but the list row and the milestone were
      written by the same request, moments apart. Matched only when exactly one new
      address joined the list within two minutes of it, so a busy minute never pins
      someone else's email on this visitor.
    */
    const pending = unlabelled.filter((act) => !emails.has(act.visitorId))
    if (pending.length) {
      const WINDOW = 120_000
      const times = pending.map((act) => act.createdAt.getTime())
      const joined = await db.newsletterSubscriber.findMany({
        where: { createdAt: { gte: new Date(Math.min(...times) - WINDOW), lte: new Date(Math.max(...times) + WINDOW) } },
        select: { email: true, createdAt: true },
        take: 500,
      })
      for (const act of pending) {
        const near = joined.filter((row) => Math.abs(row.createdAt.getTime() - act.createdAt.getTime()) <= WINDOW)
        if (near.length === 1) give(act.visitorId, near[0]!.email)
      }
    }
  } catch {
    // No emails rather than no page.
  }
  return emails
}

/** Visitors with a live push subscription. Empty before migration 0017. */
export async function pushVisitorIds(visitorIds: readonly string[]): Promise<Set<string>> {
  if (visitorIds.length === 0) return new Set()
  try {
    const rows = await db.pushSubscription.findMany({
      where: { visitorId: { in: [...visitorIds] } },
      select: { visitorId: true },
      distinct: ['visitorId'],
    })
    return new Set(rows.map((row) => row.visitorId).filter((id): id is string => Boolean(id)))
  } catch {
    return new Set()
  }
}
