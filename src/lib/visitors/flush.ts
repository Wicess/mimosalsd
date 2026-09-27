import 'server-only'
import { randomUUID } from 'node:crypto'
import { Prisma } from '@prisma/client'
import { db } from '@/lib/db/client'
import { isSchemaBehindError } from '@/lib/db/errors'
import { aggregateDay, type VisitorDay } from './aggregate'
import { parseVisitEvent, type VisitEvent } from './page-view'
import { humanEvidence } from './queries'

/**
 * ─────────────────────────────────────────────────────────────────────────────
 *  THE FILING — finished days become visitor rows and daily counts.
 *
 *  Page views wait in VisitEvent, written a batch at a time by the proxy through
 *  /api/visits/collect. Filing a day aggregates its events, writes the rows, and
 *  DELETES the day's raw events — all in one transaction, so a day is either
 *  filed and cleared or left exactly as it was.
 *
 *  It runs whenever it is due: from the nightly cron if one is configured, and
 *  otherwise from the collection endpoint, which checks about once an hour. That
 *  is why visit tracking needs no scheduler and no secret to work.
 *
 *  Today is never filed — it is still being written to.
 *
 *  A VisitFlush row marks a filed day. With the delete in the same transaction it
 *  is belt and braces, and it is what makes a day filed by hand, or re-inserted
 *  events, impossible to count twice.
 * ─────────────────────────────────────────────────────────────────────────────
 */

/** Events read per query. Large enough to be few queries, small enough to hold. */
const READ_CHUNK = 5_000
/** Rows per INSERT: far under Postgres's 65,535-parameter ceiling at 19 per row. */
const WRITE_CHUNK = 500
/** Per-page history is kept this long; daily counts are kept for good. */
export const PAGE_VIEW_RETENTION_DAYS = 90
/** Stop starting new days this close to a function's limit; the rest wait. */
const TIME_BUDGET_MS = 40_000

export interface FiledDay {
  readonly day: string
  readonly events: number
  readonly visitors: number
  readonly status: 'filed' | 'already filed'
}

export interface FlushReport {
  readonly filed: readonly FiledDay[]
  /** Days left for the next run because this one ran out of time. */
  readonly deferred: readonly string[]
  readonly pruned: number
}

const iso = (day: Date) => day.toISOString().slice(0, 10)
const asDay = (dayIso: string) => new Date(`${dayIso}T00:00:00Z`)

/** Finished days with events still waiting, oldest first. */
async function dueDays(now: Date): Promise<string[]> {
  const days = await db.visitEvent.findMany({
    where: { day: { lt: asDay(iso(now)) } },
    distinct: ['day'],
    select: { day: true },
    orderBy: { day: 'asc' },
  })
  return days.map((row) => iso(row.day))
}

async function readDay(dayIso: string): Promise<VisitEvent[]> {
  const events: VisitEvent[] = []
  let cursor: string | undefined
  for (;;) {
    const rows = await db.visitEvent.findMany({
      where: { day: asDay(dayIso) },
      select: { id: true, payload: true },
      orderBy: { id: 'asc' },
      take: READ_CHUNK,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    })
    if (rows.length === 0) break
    for (const row of rows) {
      const event = parseVisitEvent(JSON.stringify(row.payload))
      if (event) events.push(event)
    }
    cursor = rows.at(-1)?.id
    if (rows.length < READ_CHUNK) break
  }
  return events
}

function chunks<T>(items: readonly T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size))
  return out
}

/*
  Merge rules for a visitor already on file, in SQL so a batch is one statement.
  Every SET expression reads the row's OLD values, so the comparisons below see
  the stored first and last seen, not the ones being written.
*/
const FIRST_TOUCH = ['landingPath', 'referrer', 'utmSource', 'utmMedium', 'utmCampaign']
const LATEST = ['lastPath', 'country', 'region', 'city', 'postalCode', 'latitude', 'longitude', 'timezone', 'device', 'browser', 'os']
const prefer = (column: string, incomingWins: string) =>
  `"${column}" = CASE WHEN ${incomingWins} THEN COALESCE(EXCLUDED."${column}", "Visitor"."${column}") ELSE COALESCE("Visitor"."${column}", EXCLUDED."${column}") END`
const MERGE = Prisma.raw(
  [
    `"firstSeen" = LEAST("Visitor"."firstSeen", EXCLUDED."firstSeen")`,
    `"lastSeen" = GREATEST("Visitor"."lastSeen", EXCLUDED."lastSeen")`,
    `"pageViews" = "Visitor"."pageViews" + EXCLUDED."pageViews"`,
    `"sessionCount" = "Visitor"."sessionCount" + EXCLUDED."sessionCount"`,
    // Automated only while every day on file says so: one human day clears it.
    `"isLikelyBot" = "Visitor"."isLikelyBot" AND EXCLUDED."isLikelyBot"`,
    ...FIRST_TOUCH.map((c) => prefer(c, `EXCLUDED."firstSeen" < "Visitor"."firstSeen"`)),
    ...LATEST.map((c) => prefer(c, `EXCLUDED."lastSeen" >= "Visitor"."lastSeen"`)),
  ].join(',\n'),
)

/**
 * A Date for a `timestamp without time zone` column, as UTC wall time, spelled out.
 *
 * Passing the Date straight through sends a zone-aware value, which Postgres
 * converts to the SESSION's time zone on the way into the column. On a server set
 * to UTC+1 every visit landed an hour late — found by the integration test, and
 * invisible wherever the session happens to be UTC. Prisma's own writes store UTC,
 * so this must too, whatever the session says.
 */
const utc = (date: Date) => Prisma.sql`(${date.toISOString()}::timestamptz AT TIME ZONE 'UTC')`

function upsertVisitors(rows: readonly VisitorDay[]) {
  const values = rows.map(
    (v) => Prisma.sql`(${randomUUID()}, ${v.visitorId}, ${utc(v.firstSeen)}, ${utc(v.lastSeen)},
      ${v.landingPath}, ${v.referrer}, ${v.views}, ${v.sessions}, ${v.country}, ${v.region},
      ${v.city}, ${v.postalCode}, ${v.latitude}, ${v.longitude}, ${v.timezone}, ${v.device},
      ${v.browser}, ${v.os}, ${v.utmSource}, ${v.utmMedium}, ${v.utmCampaign}, ${v.lastPath},
      ${v.isLikelyBot})`,
  )
  return db.$executeRaw`
    INSERT INTO "Visitor" ("id", "visitorId", "firstSeen", "lastSeen", "landingPath", "referrer",
      "pageViews", "sessionCount", "country", "region", "city", "postalCode", "latitude",
      "longitude", "timezone", "device", "browser", "os",
      "utmSource", "utmMedium", "utmCampaign", "lastPath", "isLikelyBot")
    VALUES ${Prisma.join(values)}
    ON CONFLICT ("visitorId") DO UPDATE SET ${MERGE}`
}

const isUniqueViolation = (error: unknown) =>
  error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002'

async function fileDay(dayIso: string): Promise<FiledDay> {
  const day = asDay(dayIso)
  const marker = await db.visitFlush.findUnique({ where: { day } })
  if (marker) {
    // Filed already: clear whatever turned up afterwards rather than count it twice.
    await db.visitEvent.deleteMany({ where: { day } })
    return { day: dayIso, events: marker.events, visitors: 0, status: 'already filed' }
  }

  const events = await readDay(dayIso)
  // Who proved to be a person, so the day's counts are real visitors only.
  const evidence = await humanEvidence([...new Set(events.map((e) => e.v))])
  const { visitors, stats } = aggregateDay(events, evidence)
  const history = visitors.flatMap((v) =>
    v.history.map((view) => ({ id: randomUUID(), visitorId: v.visitorId, path: view.path, at: view.at })),
  )
  const statFields = {
    views: stats.views,
    visitors: stats.visitors,
    humanViews: stats.humanViews,
    humanVisitors: stats.humanVisitors,
    newVisitors: stats.newVisitors,
    crawlerViews: stats.crawlerViews,
    paths: stats.paths,
    referrers: stats.referrers,
    countries: stats.countries,
    regions: stats.regions,
    devices: stats.devices,
    crawlers: stats.crawlers,
  }

  try {
    await db.$transaction([
      // First, so a second filing of the same day fails before writing anything.
      db.visitFlush.create({ data: { day, events: events.length } }),
      ...chunks(visitors, WRITE_CHUNK).map(upsertVisitors),
      db.dailyVisitStat.upsert({ where: { day }, create: { day, ...statFields }, update: statFields }),
      ...chunks(history, WRITE_CHUNK).map((data) => db.pageView.createMany({ data })),
      // The raw events go with the same commit: filed and cleared, or neither.
      db.visitEvent.deleteMany({ where: { day } }),
    ])
  } catch (error) {
    if (isUniqueViolation(error)) {
      return { day: dayIso, events: events.length, visitors: visitors.length, status: 'already filed' }
    }
    throw error
  }
  return { day: dayIso, events: events.length, visitors: visitors.length, status: 'filed' }
}

/**
 * File every finished day that still has events. Safe to call at any time and
 * from anywhere: a day already filed is skipped, and today is never touched.
 */
export async function fileDueDays({ now = new Date() }: { now?: Date } = {}): Promise<FlushReport> {
  const started = Date.now()
  const filed: FiledDay[] = []
  const deferred: string[] = []

  for (const dayIso of await dueDays(now)) {
    if (Date.now() - started > TIME_BUDGET_MS) {
      deferred.push(dayIso)
      continue
    }
    filed.push(await fileDay(dayIso))
  }

  const cutoff = new Date(now.getTime() - PAGE_VIEW_RETENTION_DAYS * 24 * 60 * 60 * 1000)
  const { count: pruned } = await db.pageView.deleteMany({ where: { at: { lt: cutoff } } })
  return { filed, deferred, pruned }
}

/**
 * The nightly cron's entry point. Reports schema lag as "not ready" rather than
 * failing, so a deploy that lands before migration 0014 does not alarm anyone.
 */
export async function flushVisits(options: { now?: Date } = {}): Promise<FlushReport & { ready: boolean }> {
  try {
    return { ready: true, ...(await fileDueDays(options)) }
  } catch (error) {
    if (isSchemaBehindError(error)) return { ready: false, filed: [], deferred: [], pruned: 0 }
    throw error
  }
}
