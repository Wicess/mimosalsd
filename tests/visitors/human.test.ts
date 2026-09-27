import { describe, expect, it, vi } from 'vitest'
import { aggregateDay } from '@/lib/visitors/aggregate'
import { isRealVisitor, NO_EVIDENCE, type HumanEvidence } from '@/lib/visitors/human'
import { summariseLiveVisitors } from '@/lib/visitors/live'
import type { VisitEvent } from '@/lib/visitors/page-view'

const PERSON = '0f8fad5b-d9cb-469f-a165-70867728950e'
const BOT = '7c9e6679-7425-40de-944b-e07fc1f90ae7'
const SHIPPED = new Date('2026-09-14T12:00:00Z')
const AFTER = SHIPPED.getTime() + 60_000
const BEFORE = SHIPPED.getTime() - 86_400_000

const view = (v: string, t: number, extra: Partial<VisitEvent> = {}): VisitEvent =>
  ({ v, t, p: '/', d: 'mobile', b: 'Safari', o: 'iOS', ...extra }) as VisitEvent
const evidence = (...verified: string[]): HumanEvidence => ({ verified: new Set(verified), since: SHIPPED })

describe('isRealVisitor', () => {
  const visitor = (over: Partial<Parameters<typeof isRealVisitor>[0]> = {}) => ({
    visitorId: BOT,
    lastSeen: new Date(AFTER),
    flagged: false,
    views: 1,
    ...over,
  })

  it('counts a visitor whose browser proved a person, whatever the user-agent looked like', () => {
    expect(isRealVisitor(visitor({ visitorId: PERSON, flagged: true }), evidence(PERSON))).toBe(true)
  })

  /* A clean-looking user-agent is exactly what a scraper sends: no proof, no count. */
  it('once proofs are arriving, does not count a visitor seen since without one', () => {
    expect(isRealVisitor(visitor({ views: 40 }), evidence(PERSON))).toBe(false)
  })

  it('keeps the history from before the proof existed, under the older rule', () => {
    expect(isRealVisitor(visitor({ lastSeen: new Date(BEFORE) }), evidence())).toBe(true)
    expect(isRealVisitor(visitor({ lastSeen: new Date(BEFORE), flagged: true, views: 2 }), evidence())).toBe(false)
    expect(isRealVisitor(visitor({ lastSeen: new Date(BEFORE), flagged: true, views: 4 }), evidence())).toBe(true)
  })

  it('with no proofs recorded at all yet, behaves exactly as before', () => {
    expect(isRealVisitor(visitor(), NO_EVIDENCE)).toBe(true)
    expect(isRealVisitor(visitor({ flagged: true }), NO_EVIDENCE)).toBe(false)
  })
})

describe('real visitors only, in the filing and the live list', () => {
  const day = [
    view(PERSON, AFTER, { c: 'NG', g: 'LA', ci: 'Lagos', n: 1 }),
    view(PERSON, AFTER + 60_000, { p: '/shop' }),
    view(BOT, AFTER, { n: 1 }),
    view(BOT, AFTER + 1000, { p: '/wp-login.php' }),
    view(BOT, AFTER + 2000, { p: '/.env' }),
    view(BOT, AFTER + 3000, { p: '/admin' }),
  ]

  it('files the unproven visitor as a bot and leaves it out of every count', () => {
    const { visitors, stats } = aggregateDay(day, evidence(PERSON))
    expect(visitors.find((v) => v.visitorId === PERSON)!.isLikelyBot).toBe(false)
    expect(visitors.find((v) => v.visitorId === BOT)!.isLikelyBot).toBe(true)
    expect([stats.humanVisitors, stats.humanViews, stats.newVisitors]).toEqual([1, 2, 1])
    expect(stats.paths).toEqual({ '/': 1, '/shop': 1 })
    expect(stats.regions).toEqual({ 'NG-LA': 1 })
  })

  it('flags the same visitor as a bot in today’s live list', () => {
    const live = summariseLiveVisitors(day, evidence(PERSON))
    // Newest first: the person's last view was a minute in, the bot's three seconds.
    expect(live.map((v) => [v.visitorId, v.likelyBot])).toEqual([
      [PERSON, false],
      [BOT, true],
    ])
  })
})

describe('POST /api/visits/human', () => {
  const recordActivity = vi.fn(async () => {})
  vi.doMock('@/lib/visitors/record-activity', () => ({ recordActivity }))

  const send = async (headers: Record<string, string>, body: unknown = { path: '/shop' }) => {
    const { POST } = await import('@/app/api/visits/human/route')
    recordActivity.mockClear()
    const response = await POST(
      new Request('https://www.mimosalsd.com/api/visits/human', { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body) }),
    )
    expect(response.status).toBe(204)
    return recordActivity.mock.calls.length
  }
  const SAFARI = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Mobile/15E148 Safari/604.1'

  it('records a proof from this site’s own page', async () => {
    expect(await send({ 'user-agent': SAFARI, 'sec-fetch-site': 'same-origin' })).toBe(1)
    expect(recordActivity).not.toHaveBeenCalledWith('ORDER_PLACED', expect.anything())
  })

  it('accepts an older browser without Fetch Metadata when Origin is this site', async () => {
    expect(await send({ 'user-agent': SAFARI, origin: 'https://www.mimosalsd.com' })).toBe(1)
  })

  it('ignores another site, a self-named crawler, no user-agent, and a bad path — with the same answer', async () => {
    expect(await send({ 'user-agent': SAFARI, 'sec-fetch-site': 'cross-site' })).toBe(0)
    expect(await send({ 'user-agent': SAFARI, origin: 'https://evil.test' })).toBe(0)
    expect(await send({ 'user-agent': SAFARI })).toBe(0)
    expect(await send({ 'user-agent': 'Mozilla/5.0 (compatible; Googlebot/2.1)', 'sec-fetch-site': 'same-origin' })).toBe(0)
    expect(await send({ 'sec-fetch-site': 'same-origin' })).toBe(0)
    expect(await send({ 'user-agent': SAFARI, 'sec-fetch-site': 'same-origin' }, { path: 'https://evil.test' })).toBe(0)
  })
})
