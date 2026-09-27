import { CRAWLER_VISITOR, type VisitEvent } from './page-view'
import { isRealVisitor, NO_EVIDENCE, type HumanEvidence } from './human'

/**
 * ─────────────────────────────────────────────────────────────────────────────
 *  ONE DAY OF EVENTS → VISITOR ROWS AND A DAILY SUMMARY.
 *
 *  Pure: the nightly filing reads a finished day's events, hands them here, and
 *  writes what comes back. Everything about what the numbers MEAN lives in this
 *  file, where it can be tested without a database.
 *
 *  - A session is a run of page views with no gap longer than 30 minutes. A
 *    session that crosses midnight UTC counts once on each day.
 *  - First-touch fields (landing page, referrer, campaign) come from the day's
 *    earliest view; location and device from its latest.
 *  - Only real visitors count (lib/visitors/human.ts): a visitor whose browser
 *    proved a person was there. Visits from before any such proof existed keep
 *    the older rule — a flagged user-agent is cleared by HUMAN_PAGE_VIEWS or more
 *    views in the day.
 *  - Crawlers that name themselves have no visitor: they are counted by name.
 *  - The summary's paths, referrers and places count PEOPLE only. A crawler
 *    reading every page would otherwise top every list.
 * ─────────────────────────────────────────────────────────────────────────────
 */

export const SESSION_GAP_MS = 30 * 60 * 1000

export interface VisitorDay {
  readonly visitorId: string
  readonly firstSeen: Date
  readonly lastSeen: Date
  readonly views: number
  readonly sessions: number
  readonly landingPath: string
  readonly lastPath: string
  readonly referrer: string | null
  readonly utmSource: string | null
  readonly utmMedium: string | null
  readonly utmCampaign: string | null
  readonly country: string | null
  readonly region: string | null
  readonly city: string | null
  readonly postalCode: string | null
  readonly latitude: number | null
  readonly longitude: number | null
  readonly timezone: string | null
  readonly device: string
  readonly browser: string
  readonly os: string
  readonly isLikelyBot: boolean
  /** The cookie was minted during this day: a first visit from this browser. */
  readonly isNew: boolean
  /** Every view, oldest first, for the per-page history. */
  readonly history: readonly { path: string; at: Date }[]
}

export type Counts = Record<string, number>

export interface DayStats {
  readonly views: number
  readonly visitors: number
  readonly humanViews: number
  readonly humanVisitors: number
  readonly newVisitors: number
  readonly crawlerViews: number
  readonly paths: Counts
  readonly referrers: Counts
  readonly countries: Counts
  readonly regions: Counts
  readonly devices: Counts
  readonly crawlers: Counts
}

const bump = (counts: Counts, key: string | undefined | null, by = 1) => {
  if (key) counts[key] = (counts[key] ?? 0) + by
}

/**
 * Counts read back from a JSON column, trusting nothing: anything that is not a
 * finite number under a string key is dropped rather than shown.
 */
export function asCounts(value: unknown): Counts {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  const counts: Counts = {}
  for (const [key, n] of Object.entries(value)) {
    if (typeof n === 'number' && Number.isFinite(n)) counts[key] = n
  }
  return counts
}

/** Several days' counts added together. */
export function sumCounts(days: readonly Counts[]): Counts {
  const total: Counts = {}
  for (const day of days) for (const [key, n] of Object.entries(day)) bump(total, key, n)
  return total
}

/** The `limit` largest entries, largest first, ties alphabetical. */
export function topCounts(counts: Counts, limit: number): Counts {
  return Object.fromEntries(
    Object.entries(counts)
      .sort(([a, x], [b, y]) => y - x || a.localeCompare(b))
      .slice(0, limit),
  )
}

export function aggregateDay(events: readonly VisitEvent[], evidence: HumanEvidence = NO_EVIDENCE): {
  visitors: VisitorDay[]
  stats: DayStats
} {
  const crawlers: Counts = {}
  const byVisitor = new Map<string, VisitEvent[]>()
  for (const event of events) {
    if (event.v === CRAWLER_VISITOR) {
      bump(crawlers, event.k ?? 'Other automated')
      continue
    }
    const list = byVisitor.get(event.v)
    if (list) list.push(event)
    else byVisitor.set(event.v, [event])
  }

  const visitors: VisitorDay[] = []
  for (const [visitorId, list] of byVisitor) {
    const sorted = [...list].sort((a, b) => a.t - b.t)
    const first = sorted[0]!
    const last = sorted.at(-1)!
    let sessions = 1
    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i]!.t - sorted[i - 1]!.t > SESSION_GAP_MS) sessions += 1
    }
    const firstWith = (key: 'r' | 'us' | 'um' | 'uc') => sorted.find((e) => e[key])?.[key] ?? null
    /*
      The place comes whole from the newest view that has one, so a city, a ZIP code
      and a pair of coordinates are never stitched together from different lookups.
    */
    const placed = [...sorted].reverse().find((e) => e.c || e.g || e.ci || e.z || e.la !== undefined)
    const flagged = sorted.some((e) => e.a === 1)

    visitors.push({
      visitorId,
      firstSeen: new Date(first.t),
      lastSeen: new Date(last.t),
      views: sorted.length,
      sessions,
      landingPath: first.p,
      lastPath: last.p,
      referrer: firstWith('r'),
      utmSource: firstWith('us'),
      utmMedium: firstWith('um'),
      utmCampaign: firstWith('uc'),
      country: placed?.c ?? null,
      region: placed?.g ?? null,
      city: placed?.ci ?? null,
      postalCode: placed?.z ?? null,
      latitude: placed?.la ?? null,
      longitude: placed?.lo ?? null,
      timezone: placed?.tz ?? null,
      device: last.d,
      browser: last.b,
      os: last.o,
      isLikelyBot: !isRealVisitor({ visitorId, lastSeen: new Date(last.t), flagged, views: sorted.length }, evidence),
      isNew: sorted.some((e) => e.n === 1),
      history: sorted.map((e) => ({ path: e.p, at: new Date(e.t) })),
    })
  }

  const paths: Counts = {}
  const referrers: Counts = {}
  const countries: Counts = {}
  const regions: Counts = {}
  const devices: Counts = {}
  let humanViews = 0
  let humanVisitors = 0
  let newVisitors = 0
  for (const visitor of visitors) {
    if (visitor.isLikelyBot) continue
    humanVisitors += 1
    humanViews += visitor.views
    if (visitor.isNew) newVisitors += 1
    for (const view of visitor.history) bump(paths, view.path)
    bump(referrers, visitor.referrer)
    bump(countries, visitor.country)
    // Regions only mean something inside a country; key them as US-TX, CA-ON.
    if (visitor.country && visitor.region) bump(regions, `${visitor.country}-${visitor.region}`)
    bump(devices, visitor.device)
  }
  const crawlerViews = Object.values(crawlers).reduce((sum, n) => sum + n, 0)
  return {
    visitors,
    stats: {
      views: events.length,
      visitors: visitors.length,
      humanViews,
      humanVisitors,
      newVisitors,
      crawlerViews,
      paths: topCounts(paths, 100),
      referrers: topCounts(referrers, 50),
      countries: topCounts(countries, 50),
      regions: topCounts(regions, 60),
      devices,
      crawlers: topCounts(crawlers, 50),
    },
  }
}
