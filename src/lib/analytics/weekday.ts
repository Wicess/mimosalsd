import { asCounts, type Counts } from '@/lib/visitors/aggregate'

/**
 * ─────────────────────────────────────────────────────────────────────────────
 *  SAME DAY, WEEK ON WEEK — and why it changed (owner, 2026-09-14).
 *
 *  Visits have a weekly rhythm, so Tuesday is judged against last Tuesday, not
 *  against Monday. Each day is reduced to a profile of real visitors (bots are
 *  already out, lib/visitors/human.ts): how many, how many pages, where they came
 *  from, where they are, what device, which pages, and how many orders. Two
 *  profiles are then compared, and the reason is written from the differences that
 *  actually moved the number, largest first. Nothing is guessed: if no source,
 *  place, device or page stands out, the reason says so.
 *
 *  Pure, so the arithmetic and the wording are tested without a database.
 * ─────────────────────────────────────────────────────────────────────────────
 */

export interface DayProfile {
  readonly visitors: number
  readonly views: number
  readonly newVisitors: number
  readonly orders: number
  /** Page views per page. */
  readonly paths: Counts
  /** Visitors per referring site. Direct visits are not listed. */
  readonly referrers: Counts
  /** Visitors per region, keyed "US-TX". */
  readonly regions: Counts
  /** Visitors per device: mobile, tablet, desktop. */
  readonly devices: Counts
}

export const EMPTY_PROFILE: DayProfile = {
  visitors: 0,
  views: 0,
  newVisitors: 0,
  orders: 0,
  paths: {},
  referrers: {},
  regions: {},
  devices: {},
}

/** A filed day. */
export function profileFromStat(
  stat: {
    readonly humanVisitors: number
    readonly humanViews: number
    readonly newVisitors: number
    readonly paths: unknown
    readonly referrers: unknown
    readonly regions: unknown
    readonly devices: unknown
  },
  orders: number,
): DayProfile {
  return {
    visitors: stat.humanVisitors,
    views: stat.humanViews,
    newVisitors: stat.newVisitors,
    orders,
    paths: asCounts(stat.paths),
    referrers: asCounts(stat.referrers),
    regions: asCounts(stat.regions),
    devices: asCounts(stat.devices),
  }
}

/** One real visitor's page view, from the buffer or the filed history. */
export interface WindowView {
  readonly visitorId: string
  readonly at: number
  readonly path: string
  readonly referrer: string | null
  /** The campaign tag a tracking link put on the visit: its platform. */
  readonly utmSource: string | null
  /** The campaign tag: a tracking link's slug. */
  readonly utmCampaign: string | null
  /** "US-TX", as the daily counts key regions. */
  readonly region: string | null
  readonly device: string | null
  readonly isNew: boolean
}

const bump = (counts: Counts, key: string | null, by = 1) => {
  if (key) counts[key] = (counts[key] ?? 0) + by
}

/** Views that have not been filed as a day yet: today so far, or part of a day. */
export function profileFromViews(views: readonly WindowView[], orders: number): DayProfile {
  const paths: Counts = {}
  const referrers: Counts = {}
  const regions: Counts = {}
  const devices: Counts = {}
  const byVisitor = new Map<string, WindowView[]>()
  for (const view of views) {
    bump(paths, view.path)
    const list = byVisitor.get(view.visitorId)
    if (list) list.push(view)
    else byVisitor.set(view.visitorId, [view])
  }
  let newVisitors = 0
  for (const list of byVisitor.values()) {
    const sorted = [...list].sort((a, b) => a.at - b.at)
    // As the daily filing does: the first referrer seen, the latest place and device.
    bump(referrers, sorted.find((v) => v.referrer)?.referrer ?? null)
    bump(regions, [...sorted].reverse().find((v) => v.region)?.region ?? null)
    bump(devices, [...sorted].reverse().find((v) => v.device)?.device ?? null)
    if (sorted.some((v) => v.isNew)) newVisitors += 1
  }
  return { visitors: byVisitor.size, views: views.length, newVisitors, orders, paths, referrers, regions, devices }
}

export interface HourPoint {
  readonly start: Date
  readonly views: number
  readonly visitors: number
}

/** Views and distinct visitors per hour, from `start`, for `hours` hours. */
export function hourlySeries(views: readonly WindowView[], start: Date, hours = 24): HourPoint[] {
  const HOUR = 3_600_000
  const points = Array.from({ length: hours }, (_, i) => ({
    start: new Date(start.getTime() + i * HOUR),
    views: 0,
    people: new Set<string>(),
  }))
  for (const view of views) {
    const index = Math.floor((view.at - start.getTime()) / HOUR)
    const point = points[index]
    if (!point) continue
    point.views += 1
    point.people.add(view.visitorId)
  }
  return points.map((p) => ({ start: p.start, views: p.views, visitors: p.people.size }))
}

export interface Namers {
  /** "US-TX" → "Texas". */
  readonly region: (key: string) => string
  /** "/product/x" → its name. */
  readonly page: (path: string) => string
}

const MINUS = '\u2212'
const signed = (n: number) => (n > 0 ? `+${n}` : n < 0 ? `${MINUS}${Math.abs(n)}` : '0')
const plural = (n: number, word: string) => `${n} ${word}${Math.abs(n) === 1 ? '' : 's'}`

/** The keys whose change points the same way as the day's, largest first. */
function movers(current: Counts, previous: Counts, direction: number, limit: number, minimum: number) {
  if (direction === 0) return []
  const keys = new Set([...Object.keys(current), ...Object.keys(previous)])
  return [...keys]
    .map((key) => ({ key, diff: (current[key] ?? 0) - (previous[key] ?? 0) }))
    .filter(({ diff }) => (direction > 0 ? diff >= minimum : diff <= -minimum))
    .sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff) || a.key.localeCompare(b.key))
    .slice(0, limit)
}

/** Referring sites, with the visitors nobody referred counted as "direct". */
function sources(profile: DayProfile): Counts {
  const counts: Counts = { ...profile.referrers }
  const referred = Object.values(profile.referrers).reduce((sum, n) => sum + n, 0)
  const direct = profile.visitors - referred
  if (direct > 0) counts['(direct)'] = direct
  return counts
}

/**
 * Why `current` differs from `previous`, in one or two sentences built only from
 * the data: the headline change, then the sources, places, devices and pages that
 * moved with it, pages per visitor, first-time visitors and orders.
 */
export function explainChange(
  current: DayProfile,
  previous: DayProfile,
  names: Namers,
  { partial = false, before = 'the week before' }: { partial?: boolean; before?: string } = {},
): string {
  const dVisitors = current.visitors - previous.visitors
  const dViews = current.views - previous.views
  const orders =
    current.orders !== previous.orders ? `${plural(current.orders, 'order')} placed (${previous.orders} ${before})` : null

  if (current.visitors === 0 && previous.visitors === 0) {
    return orders ? `No real visitors on either day. ${orders}.` : 'No real visitors on either day.'
  }

  const direction = dVisitors !== 0 ? Math.sign(dVisitors) : Math.sign(dViews)
  const verdict = direction > 0 ? 'Better' : direction < 0 ? 'Worse' : 'Level'
  const headline = `${verdict}${partial ? ' so far' : ''}: ${signed(dVisitors)} visitor${Math.abs(dVisitors) === 1 ? '' : 's'}, ${signed(dViews)} page view${Math.abs(dViews) === 1 ? '' : 's'}`

  const why: string[] = []
  for (const { key, diff } of movers(sources(current), sources(previous), direction, 2, 1)) {
    why.push(key === '(direct)' ? `${signed(diff)} direct visitor${Math.abs(diff) === 1 ? '' : 's'}` : `${signed(diff)} from ${key}`)
  }
  for (const { key, diff } of movers(current.regions, previous.regions, direction, 1, 2)) {
    why.push(`${signed(diff)} in ${names.region(key)}`)
  }
  for (const { key, diff } of movers(current.devices, previous.devices, direction, 1, 2)) {
    why.push(`${signed(diff)} on ${key}`)
  }
  const viewDirection = Math.sign(dViews) || direction
  for (const { key, diff } of movers(current.paths, previous.paths, viewDirection, 1, 3)) {
    why.push(`${signed(diff)} views of ${names.page(key)}`)
  }
  if (current.visitors > 0 && previous.visitors > 0) {
    const now = current.views / current.visitors
    const before = previous.views / previous.visitors
    if (Math.abs(now - before) >= 0.5) why.push(`${now.toFixed(1)} pages per visitor (was ${before.toFixed(1)})`)
  }
  const dNew = current.newVisitors - previous.newVisitors
  if (Math.abs(dNew) >= 2 && Math.sign(dNew) === direction) why.push(`${signed(dNew)} first-time visitors`)
  if (orders) why.push(orders)

  if (why.length === 0) {
    return `${headline}. No single source, place, device or page stands out: the change is spread across them.`
  }
  return `${headline}. Why: ${why.join('; ')}.`
}

export interface WeekdayRow {
  readonly day: Date
  readonly previousDay: Date
  /** Today: compared up to the same time of day. */
  readonly partial: boolean
  readonly current: DayProfile
  readonly previous: DayProfile
  readonly reason: string
}
