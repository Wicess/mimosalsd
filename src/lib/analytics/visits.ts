import 'server-only'
import { db } from '@/lib/db/client'
import { regionName } from '@/lib/visitors/present'
import { isRealVisitor, NO_EVIDENCE } from '@/lib/visitors/human'
import { CRAWLER_VISITOR, parseVisitEvent, type VisitEvent } from '@/lib/visitors/page-view'
import { humanEvidence } from '@/lib/visitors/queries'
import { pageNames } from '@/lib/seo/page-names'
import {
  EMPTY_PROFILE,
  explainChange,
  profileFromStat,
  profileFromViews,
  type DayProfile,
  type WeekdayRow,
  type WindowView,
} from './weekday'

/**
 * Visits behind the analytics page: real visitors only, for any window, and the
 * same-weekday comparison. Read on request; nothing here runs on a timer.
 *
 * A window can straddle the nightly filing, so it reads both halves: the buffer
 * (VisitEvent, today and anything not filed yet) and the filed page views
 * (PageView, kept 90 days). The filing deletes a day's buffer in the same
 * transaction that writes its page views, so no view is counted twice.
 */

const DAY = 86_400_000
const dayOf = (t: number) => new Date(Math.floor(t / DAY) * DAY)

export async function realViewsBetween(start: Date, end: Date): Promise<WindowView[]> {
  const from = start.getTime()
  const to = end.getTime()
  const [buffered, filed] = await Promise.all([
    db.visitEvent
      .findMany({
        where: { day: { gte: dayOf(from), lte: dayOf(to - 1) } },
        select: { payload: true },
        take: 50_000,
      })
      .catch(() => []),
    db.pageView
      .findMany({ where: { at: { gte: start, lt: end } }, select: { visitorId: true, path: true, at: true }, take: 50_000 })
      .catch(() => []),
  ])

  // The buffer: who was a real visitor in this window, by the same rule the filing uses.
  const events = buffered
    .map((row) => parseVisitEvent(JSON.stringify(row.payload)))
    .filter((e): e is VisitEvent => e !== null && e.v !== CRAWLER_VISITOR && e.t >= from && e.t < to)
  const byVisitor = new Map<string, VisitEvent[]>()
  for (const event of events) {
    const list = byVisitor.get(event.v)
    if (list) list.push(event)
    else byVisitor.set(event.v, [event])
  }
  const filedIds = [...new Set(filed.map((view) => view.visitorId))]
  const [evidence, visitors] = await Promise.all([
    // Only when the buffer holds someone: an empty window should cost no more reads.
    byVisitor.size ? humanEvidence([...byVisitor.keys()]) : Promise.resolve(NO_EVIDENCE),
    filedIds.length
      ? db.visitor
          .findMany({
            where: { visitorId: { in: filedIds } },
            select: { visitorId: true, isLikelyBot: true, referrer: true, utmSource: true, utmCampaign: true, country: true, region: true, device: true, firstSeen: true },
          })
          .catch(() => [])
      : Promise.resolve([]),
  ])

  const views: WindowView[] = []
  for (const [visitorId, list] of byVisitor) {
    const last = list.reduce((latest, e) => Math.max(latest, e.t), 0)
    const real = isRealVisitor(
      { visitorId, lastSeen: new Date(last), flagged: list.some((e) => e.a === 1), views: list.length },
      evidence,
    )
    if (!real) continue
    for (const e of list) {
      views.push({
        visitorId,
        at: e.t,
        path: e.p,
        referrer: e.r ?? null,
        utmSource: e.us ?? null,
        utmCampaign: e.uc ?? null,
        region: e.c && e.g ? `${e.c}-${e.g}` : null,
        device: e.d ?? null,
        isNew: e.n === 1,
      })
    }
  }

  // Filed views: the filing already decided who was real, on the visitor record.
  const record = new Map(visitors.map((v) => [v.visitorId, v]))
  for (const view of filed) {
    const visitor = record.get(view.visitorId)
    if (!visitor || visitor.isLikelyBot) continue
    views.push({
      visitorId: view.visitorId,
      at: view.at.getTime(),
      path: view.path,
      referrer: visitor.referrer,
      utmSource: visitor.utmSource,
      utmCampaign: visitor.utmCampaign,
      region: visitor.country && visitor.region ? `${visitor.country}-${visitor.region}` : null,
      device: visitor.device,
      isNew: visitor.firstSeen.getTime() >= from && visitor.firstSeen.getTime() < to,
    })
  }
  return views
}

/** Orders placed in [start, end). */
function ordersBetween(orders: readonly { createdAt: Date }[], start: number, end: number): number {
  return orders.filter((o) => o.createdAt.getTime() >= start && o.createdAt.getTime() < end).length
}

/** Names for the reasons: states and regions in full, pages by what they are called. */
async function namersFor(profiles: readonly DayProfile[]) {
  const names = await pageNames(profiles.flatMap((p) => Object.keys(p.paths)))
  return { region: regionName, page: (path: string) => names.get(path) ?? path }
}

/**
 * The last seven days, today first, each against the same weekday a week earlier,
 * with the reason. Today is compared up to the same time of day, so a morning is
 * never judged against a whole day.
 */
export async function weekdayComparison(now: Date): Promise<WeekdayRow[]> {
  const today = dayOf(now.getTime()).getTime()
  const earliest = today - 13 * DAY
  const [stats, orders] = await Promise.all([
    db.dailyVisitStat.findMany({ where: { day: { gte: new Date(earliest), lt: new Date(today) } } }).catch(() => []),
    db.order
      .findMany({ where: { createdAt: { gte: new Date(earliest), lt: now } }, select: { createdAt: true }, take: 20_000 })
      .catch(() => []),
  ])
  const statFor = new Map(stats.map((stat) => [stat.day.getTime(), stat]))

  const fullDay = async (start: number): Promise<DayProfile> => {
    const stat = statFor.get(start)
    const placed = ordersBetween(orders, start, start + DAY)
    if (stat) return profileFromStat(stat, placed)
    // Not filed yet (the filing runs overnight), or a day nobody visited.
    const views = await realViewsBetween(new Date(start), new Date(start + DAY))
    return views.length ? profileFromViews(views, placed) : { ...EMPTY_PROFILE, orders: placed }
  }
  const elapsed = now.getTime() - today
  const partDay = async (start: number): Promise<DayProfile> =>
    profileFromViews(await realViewsBetween(new Date(start), new Date(start + elapsed)), ordersBetween(orders, start, start + elapsed))

  const pairs = await Promise.all(
    Array.from({ length: 7 }, async (_, i) => {
      const day = today - i * DAY
      const before = day - 7 * DAY
      const partial = i === 0
      const [current, previous] = await Promise.all(partial ? [partDay(day), partDay(before)] : [fullDay(day), fullDay(before)])
      return { day, before, partial, current, previous }
    }),
  )
  const names = await namersFor(pairs.flatMap((p) => [p.current, p.previous]))
  return pairs.map((p) => ({
    day: new Date(p.day),
    previousDay: new Date(p.before),
    partial: p.partial,
    current: p.current,
    previous: p.previous,
    reason: explainChange(p.current, p.previous, names, { partial: p.partial }),
  }))
}

/** The last 24 hours of real visits against the 24 before, with the reason. */
export async function lastDayOfVisits(start: Date, end: Date) {
  const span = end.getTime() - start.getTime()
  const previousStart = new Date(start.getTime() - span)
  const [views, before, orders] = await Promise.all([
    realViewsBetween(start, end),
    realViewsBetween(previousStart, start),
    db.order
      .findMany({ where: { createdAt: { gte: previousStart, lt: end } }, select: { createdAt: true }, take: 20_000 })
      .catch(() => []),
  ])
  const current = profileFromViews(views, ordersBetween(orders, start.getTime(), end.getTime()))
  const previous = profileFromViews(before, ordersBetween(orders, previousStart.getTime(), start.getTime()))
  const names = await namersFor([current, previous])
  return { views, current, previous, reason: explainChange(current, previous, names, { before: 'the 24 hours before' }) }
}

/**
 * Real visitors and page views in a period and the one before it, for the day,
 * week and month ranges: the filed daily counts, plus today so far, which is not
 * filed yet. "Visitors" counts a person once per day, as the daily counts do.
 */
export async function periodVisitTotals(start: Date, end: Date, previousStart: Date, now: Date) {
  const today = dayOf(now.getTime()).getTime()
  const stats = await db.dailyVisitStat
    .findMany({
      where: { day: { gte: previousStart, lt: new Date(Math.min(end.getTime(), today)) } },
      select: { day: true, humanViews: true, humanVisitors: true },
    })
    .catch(() => [])
  const total = (from: number, to: number) =>
    stats
      .filter((s) => s.day.getTime() >= from && s.day.getTime() < to)
      .reduce((sum, s) => ({ visitors: sum.visitors + s.humanVisitors, views: sum.views + s.humanViews }), { visitors: 0, views: 0 })
  const current = total(start.getTime(), end.getTime())
  if (end.getTime() > today && start.getTime() <= today) {
    const views = await realViewsBetween(new Date(today), now)
    current.views += views.length
    current.visitors += new Set(views.map((v) => v.visitorId)).size
  }
  return { current, previous: total(previousStart.getTime(), start.getTime()) }
}
