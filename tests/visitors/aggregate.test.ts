import { describe, expect, it } from 'vitest'
import { aggregateDay, SESSION_GAP_MS, topCounts } from '@/lib/visitors/aggregate'
import { CRAWLER_VISITOR, type VisitEvent } from '@/lib/visitors/page-view'

const A = '0f8fad5b-d9cb-469f-a165-70867728950e'
const B = '7c9e6679-7425-40de-944b-e07fc1f90ae7'
const T0 = Date.UTC(2026, 8, 10, 9)
const MIN = 60 * 1000

function ev(overrides: Partial<VisitEvent> = {}): VisitEvent {
  return { v: A, t: T0, p: '/', d: 'mobile', b: 'Safari', o: 'iOS', ...overrides } as VisitEvent
}

describe('aggregateDay', () => {
  it('turns one visitor’s views into one row, first touch first and place last', () => {
    const { visitors } = aggregateDay([
      ev({ t: T0 + 2 * MIN, p: '/shop', c: 'US', g: 'TX', ci: 'Austin' }),
      ev({ t: T0, p: '/', r: 'google.com', us: 'news', n: 1, c: 'US', g: 'TX', ci: 'Round Rock' }),
      ev({ t: T0 + 5 * MIN, p: '/product/x', r: 'bing.com', d: 'tablet' }),
    ])
    expect(visitors).toHaveLength(1)
    const v = visitors[0]!
    expect(v.views).toBe(3)
    expect(v.landingPath).toBe('/')
    expect(v.lastPath).toBe('/product/x')
    expect(v.referrer).toBe('google.com') // first touch, not the later one
    expect(v.utmSource).toBe('news')
    expect(v.city).toBe('Austin') // the latest view that carried a place
    expect(v.device).toBe('tablet')
    expect(v.firstSeen.getTime()).toBe(T0)
    expect(v.lastSeen.getTime()).toBe(T0 + 5 * MIN)
    expect(v.isNew).toBe(true)
    expect(v.history.map((x) => x.path)).toEqual(['/', '/shop', '/product/x'])
  })

  it('starts a new session after thirty quiet minutes, not before', () => {
    const { visitors } = aggregateDay([
      ev({ t: T0 }),
      ev({ t: T0 + SESSION_GAP_MS }), // exactly thirty minutes: same session
      ev({ t: T0 + 2 * SESSION_GAP_MS + 1 }), // over thirty: a new one
    ])
    expect(visitors[0]!.sessions).toBe(2)
  })

  it('clears the automated flag once someone browses like a person', () => {
    const flagged = (n: number) =>
      Array.from({ length: n }, (_, i) => ev({ t: T0 + i * MIN, a: 1, b: 'Chrome', o: 'Linux', d: 'desktop' }))
    expect(aggregateDay(flagged(1)).visitors[0]!.isLikelyBot).toBe(true)
    expect(aggregateDay(flagged(3)).visitors[0]!.isLikelyBot).toBe(true)
    expect(aggregateDay(flagged(4)).visitors[0]!.isLikelyBot).toBe(false)
  })

  it('counts crawlers by name and gives them no visitor row', () => {
    const { visitors, stats } = aggregateDay([
      ev({ v: CRAWLER_VISITOR, k: 'GPTBot', p: '/guides/a' }),
      ev({ v: CRAWLER_VISITOR, k: 'GPTBot', p: '/guides/b' }),
      ev({ v: CRAWLER_VISITOR, k: 'ClaudeBot' }),
      ev({ v: CRAWLER_VISITOR }),
      ev(),
    ])
    expect(visitors).toHaveLength(1)
    expect(stats.crawlerViews).toBe(4)
    expect(stats.crawlers).toEqual({ GPTBot: 2, ClaudeBot: 1, 'Other automated': 1 })
    // Crawled pages are not people's pages.
    expect(stats.paths).toEqual({ '/': 1 })
  })

  it('summarises people only, keeping every request in the raw count', () => {
    const { stats } = aggregateDay([
      ev({ v: A, p: '/', r: 'google.com', c: 'US', g: 'TX', n: 1 }),
      ev({ v: A, t: T0 + MIN, p: '/shop' }),
      ev({ v: B, p: '/shop', a: 1, c: 'US', g: 'CA', d: 'desktop', n: 1 }), // one view, flagged
      ev({ v: CRAWLER_VISITOR, k: 'Googlebot', p: '/shop' }),
    ])
    expect(stats.views).toBe(4)
    expect(stats.visitors).toBe(2)
    expect(stats.humanVisitors).toBe(1)
    expect(stats.humanViews).toBe(2)
    expect(stats.newVisitors).toBe(1)
    expect(stats.paths).toEqual({ '/': 1, '/shop': 1 })
    expect(stats.referrers).toEqual({ 'google.com': 1 })
    expect(stats.regions).toEqual({ 'US-TX': 1 })
    expect(stats.devices).toEqual({ mobile: 1 })
  })

  it('handles an empty day', () => {
    const { visitors, stats } = aggregateDay([])
    expect(visitors).toEqual([])
    expect(stats.views).toBe(0)
    expect(stats.paths).toEqual({})
  })
})

describe('topCounts', () => {
  it('keeps the largest, largest first, ties alphabetical', () => {
    expect(Object.entries(topCounts({ b: 2, a: 2, c: 5, d: 1 }, 3))).toEqual([
      ['c', 5],
      ['a', 2],
      ['b', 2],
    ])
  })
})
