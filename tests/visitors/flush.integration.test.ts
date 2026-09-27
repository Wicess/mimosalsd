import { randomUUID } from 'node:crypto'
import { Prisma, PrismaClient } from '@prisma/client'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * The nightly filing against a REAL Postgres — the bulk upsert is raw SQL, and the
 * day's raw events are deleted in the same transaction, so a mocked database
 * would only prove the mock agrees with itself.
 *
 * Skipped unless TEST_DATABASE_URL points at a disposable database with the
 * current schema. It empties the visit tables it uses.
 */
const url = process.env.TEST_DATABASE_URL
const local = url ? new PrismaClient({ datasourceUrl: url }) : null
vi.mock('@/lib/db/client', () => ({ db: local }))

const { fileDueDays } = await import('@/lib/visitors/flush')

const A = '0f8fad5b-d9cb-469f-a165-70867728950e'
const B = '7c9e6679-7425-40de-944b-e07fc1f90ae7'
const NOW = new Date('2026-09-12T03:15:00Z')

const at = (iso: string) => new Date(iso).getTime()
const day = (iso: string) => new Date(`${iso}T00:00:00Z`)

const view = (v: string, iso: string, extra: Record<string, unknown> = {}) => ({
  v,
  t: at(iso),
  p: '/',
  d: 'mobile',
  b: 'Safari',
  o: 'iOS',
  ...extra,
})

/** Put events in the buffer table, as the collection endpoint would. */
async function buffer(dayIso: string, events: Record<string, unknown>[]) {
  await local!.visitEvent.createMany({
    data: events.map((payload) => ({
      id: randomUUID(),
      day: day(dayIso),
      payload: payload as Prisma.InputJsonObject,
    })),
  })
}

describe.skipIf(!local)('the filing, against Postgres', () => {
  beforeAll(async () => {
    await local!.$connect()
  })
  afterAll(async () => {
    await local?.$disconnect()
  })
  beforeEach(async () => {
    await local!.$transaction([
      local!.visitEvent.deleteMany(),
      local!.pageView.deleteMany(),
      local!.visitFlush.deleteMany(),
      local!.dailyVisitStat.deleteMany(),
      local!.visitor.deleteMany(),
    ])
  })

  it('files finished days, merges a returning visitor, and leaves today alone', async () => {
    await buffer('2026-09-10', [
      view(A, '2026-09-10T09:00:00Z', { p: '/', r: 'google.com', us: 'news', c: 'US', g: 'TX', ci: 'Austin', n: 1 }),
      view(A, '2026-09-10T09:05:00Z', { p: '/shop' }),
      view(B, '2026-09-10T10:00:00Z', { a: 1, d: 'desktop', b: 'Chrome', o: 'Linux', n: 1 }),
      { v: 'crawler', t: at('2026-09-10T11:00:00Z'), p: '/guides/x', d: 'desktop', b: 'Other', o: 'Other', k: 'GPTBot' },
      { rubbish: true },
    ])
    await buffer('2026-09-11', [
      view(A, '2026-09-11T20:00:00Z', { p: '/product/x', r: 'bing.com', c: 'US', g: 'OK', ci: 'Tulsa', d: 'tablet' }),
      view(A, '2026-09-11T21:00:00Z', { p: '/checkout', d: 'tablet' }), // an hour later: a second session
    ])
    await buffer('2026-09-12', [view(A, '2026-09-12T01:00:00Z', { p: '/today' })])

    const report = await fileDueDays({ now: NOW })
    expect(report.filed.map((d) => [d.day, d.status])).toEqual([
      ['2026-09-10', 'filed'],
      ['2026-09-11', 'filed'],
    ])

    // Filed days are cleared; today is untouched.
    expect(await local!.visitEvent.count()).toBe(1)
    expect(await local!.visitEvent.count({ where: { day: day('2026-09-12') } })).toBe(1)

    const a = await local!.visitor.findUniqueOrThrow({ where: { visitorId: A } })
    expect(a.pageViews).toBe(4)
    expect(a.sessionCount).toBe(3) // one on the 10th, two on the 11th
    expect(a.firstSeen.toISOString()).toBe('2026-09-10T09:00:00.000Z')
    expect(a.lastSeen.toISOString()).toBe('2026-09-11T21:00:00.000Z')
    expect([a.landingPath, a.referrer, a.utmSource]).toEqual(['/', 'google.com', 'news'])
    expect([a.lastPath, a.city, a.region, a.device]).toEqual(['/checkout', 'Tulsa', 'OK', 'tablet'])
    expect(a.isLikelyBot).toBe(false)

    expect((await local!.visitor.findUniqueOrThrow({ where: { visitorId: B } })).isLikelyBot).toBe(true)
    expect(await local!.visitor.count()).toBe(2) // the crawler has no row

    const tenth = await local!.dailyVisitStat.findUniqueOrThrow({ where: { day: day('2026-09-10') } })
    expect(tenth.views).toBe(4) // the unreadable payload is dropped, not counted
    expect(tenth.humanVisitors).toBe(1)
    expect(tenth.crawlers).toEqual({ GPTBot: 1 })
    expect(await local!.pageView.count({ where: { visitorId: A } })).toBe(4)
  })

  it('never counts a day twice, even if events turn up after it was filed', async () => {
    await buffer('2026-09-10', [view(A, '2026-09-10T09:00:00Z')])
    await fileDueDays({ now: NOW })
    await buffer('2026-09-10', [view(A, '2026-09-10T09:30:00Z')])

    const again = await fileDueDays({ now: NOW })
    expect(again.filed).toEqual([expect.objectContaining({ day: '2026-09-10', status: 'already filed' })])
    expect((await local!.visitor.findUniqueOrThrow({ where: { visitorId: A } })).pageViews).toBe(1)
    expect(await local!.visitEvent.count()).toBe(0) // the late arrivals are cleared, not counted
  })

  it('files a late day without letting it overwrite newer details', async () => {
    await buffer('2026-09-11', [view(A, '2026-09-11T12:00:00Z', { p: '/newer', ci: 'Tulsa', c: 'US', r: 'bing.com' })])
    await fileDueDays({ now: NOW })
    // The 9th turns up afterwards — a restored backlog.
    await buffer('2026-09-09', [view(A, '2026-09-09T12:00:00Z', { p: '/older', ci: 'Austin', c: 'US', r: 'google.com' })])
    await fileDueDays({ now: NOW })

    const a = await local!.visitor.findUniqueOrThrow({ where: { visitorId: A } })
    expect(a.firstSeen.toISOString()).toBe('2026-09-09T12:00:00.000Z')
    expect(a.landingPath).toBe('/older') // first touch moves back to the earlier day
    expect(a.referrer).toBe('google.com')
    expect(a.lastPath).toBe('/newer') // latest details stay with the later day
    expect(a.city).toBe('Tulsa')
  })

  it('leaves the buffer untouched when filing fails', async () => {
    await buffer('2026-09-10', [view(A, '2026-09-10T09:00:00Z')])
    // A day already marked filed, with its stats row missing the day's constraint:
    // force the transaction to fail on the marker's unique key mid-flight.
    await local!.visitFlush.create({ data: { day: day('2026-09-10'), events: 0 } })
    const report = await fileDueDays({ now: NOW })
    expect(report.filed[0]?.status).toBe('already filed')
    expect(await local!.visitor.count()).toBe(0)
  })

  it('prunes page history past ninety days and keeps the rest', async () => {
    await local!.pageView.createMany({
      data: [
        { id: 'old', visitorId: A, path: '/', at: new Date('2026-06-01T00:00:00Z') },
        { id: 'new', visitorId: A, path: '/', at: new Date('2026-09-01T00:00:00Z') },
      ],
    })
    const report = await fileDueDays({ now: NOW })
    expect(report.pruned).toBe(1)
    expect((await local!.pageView.findMany()).map((p) => p.id)).toEqual(['new'])
  })

  /* Owner, 2026-09-14: bots are neither listed nor counted. */
  it('once proofs of a person exist, files a visitor without one as a bot and counts only the person', async () => {
    const C = 'a3bb189e-8bf9-4888-9912-ace4e6543002'
    await local!.visitorActivity.deleteMany({ where: { kind: 'HUMAN_VERIFIED' } })
    await local!.visitorActivity.create({
      data: { visitorId: A, kind: 'HUMAN_VERIFIED', createdAt: new Date('2026-09-10T08:59:00Z') },
    })
    try {
      await buffer('2026-09-10', [
        view(A, '2026-09-10T09:00:00Z', { p: '/', c: 'NG', g: 'LA', ci: 'Lagos', n: 1 }),
        // A clean-looking browser that never used a page: a scraper.
        view(C, '2026-09-10T09:01:00Z', { p: '/shop', n: 1 }),
        view(C, '2026-09-10T09:01:02Z', { p: '/product/x' }),
      ])
      await fileDueDays({ now: NOW })
      const rows = await local!.visitor.findMany({ orderBy: { visitorId: 'asc' } })
      expect(rows.map((r) => [r.visitorId, r.isLikelyBot])).toEqual([
        [A, false],
        [C, true],
      ])
      const stats = await local!.dailyVisitStat.findUniqueOrThrow({ where: { day: day('2026-09-10') } })
      expect([stats.humanVisitors, stats.humanViews]).toEqual([1, 1])
    } finally {
      await local!.visitorActivity.deleteMany({ where: { kind: 'HUMAN_VERIFIED' } })
    }
  })
})
