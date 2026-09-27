import { describe, expect, it } from 'vitest'
import {
  EMPTY_PROFILE,
  explainChange,
  hourlySeries,
  profileFromViews,
  type DayProfile,
  type WindowView,
} from '@/lib/analytics/weekday'
import { hourlyPeriod, parseAnalyticsRange } from '@/lib/analytics/orders'
import { isLinkablePage, pageNameFallback } from '@/lib/seo/page-name-fallback'

const names = { region: (key: string) => ({ 'US-TX': 'Texas', 'US-GA': 'Georgia' })[key] ?? key, page: (path: string) => path }
const day = (over: Partial<DayProfile>): DayProfile => ({ ...EMPTY_PROFILE, ...over })

describe('same day, week on week: the reason', () => {
  it('names what moved the number, largest first', () => {
    const tuesday = day({
      visitors: 40,
      views: 120,
      orders: 3,
      referrers: { 'google.com': 20, 'reddit.com': 2 },
      regions: { 'US-TX': 15, 'US-GA': 5 },
      devices: { mobile: 30, desktop: 10 },
      paths: { '/shop': 50, '/': 40 },
    })
    const lastTuesday = day({
      visitors: 25,
      views: 60,
      orders: 1,
      referrers: { 'google.com': 8, 'reddit.com': 3 },
      regions: { 'US-TX': 6, 'US-GA': 5 },
      devices: { mobile: 16, desktop: 9 },
      paths: { '/shop': 20, '/': 30 },
    })
    const reason = explainChange(tuesday, lastTuesday, names)
    expect(reason.startsWith('Better: +15 visitors, +60 page views.')).toBe(true)
    expect(reason).toContain('+12 from google.com')
    expect(reason).toContain('+9 in Texas')
    expect(reason).toContain('+14 on mobile')
    expect(reason).toContain('+30 views of /shop')
    expect(reason).toContain('3 orders placed (1 the week before)')
    // Reddit fell, but the day rose: it is not a reason for the rise.
    expect(reason).not.toContain('reddit')
  })

  it('explains a worse day by what dropped, direct visits included', () => {
    const reason = explainChange(
      day({ visitors: 10, views: 20, referrers: { 'google.com': 8 } }),
      day({ visitors: 30, views: 70, referrers: { 'google.com': 9 } }),
      names,
    )
    expect(reason.startsWith('Worse: −20 visitors, −50 page views.')).toBe(true)
    expect(reason).toContain('−19 direct visitors')
  })

  it('says so when nothing stands out, and when nobody came', () => {
    const even = explainChange(
      day({ visitors: 4, views: 10, paths: { '/': 5, '/shop': 5 } }),
      day({ visitors: 4, views: 9, paths: { '/': 5, '/shop': 4 } }),
      names,
    )
    expect(even).toContain('spread across them')
    expect(explainChange(day({ visitors: 5, views: 10 }), day({ visitors: 4, views: 9 }), names)).toBe('Better: +1 visitor, +1 page view. Why: +1 direct visitor.')
    expect(explainChange(EMPTY_PROFILE, EMPTY_PROFILE, names)).toBe('No real visitors on either day.')
  })

  it('marks today as so far', () => {
    expect(explainChange(day({ visitors: 3, views: 5 }), day({ visitors: 1, views: 1 }), names, { partial: true })).toMatch(/^Better so far:/)
  })
})

describe('profiles and hours from raw views', () => {
  const at = Date.UTC(2026, 8, 14, 10, 5)
  const view = (over: Partial<WindowView>): WindowView => ({
    visitorId: 'a',
    at,
    path: '/',
    referrer: null,
    utmSource: null,
    utmCampaign: null,
    region: null,
    device: null,
    isNew: false,
    ...over,
  })

  it('counts people once, with their first referrer and latest place', () => {
    const profile = profileFromViews(
      [
        view({ referrer: 'google.com', region: 'US-GA', device: 'mobile', isNew: true }),
        view({ at: at + 60_000, path: '/shop', region: 'US-TX', device: 'mobile' }),
        view({ visitorId: 'b', path: '/shop', device: 'desktop' }),
      ],
      2,
    )
    expect(profile).toMatchObject({ visitors: 2, views: 3, newVisitors: 1, orders: 2 })
    expect(profile.referrers).toEqual({ 'google.com': 1 })
    expect(profile.regions).toEqual({ 'US-TX': 1 })
    expect(profile.paths).toEqual({ '/': 1, '/shop': 2 })
  })

  it('buckets views by hour, with distinct visitors', () => {
    const start = new Date(Date.UTC(2026, 8, 14, 10))
    const series = hourlySeries([view({}), view({ at: at + 60_000 }), view({ visitorId: 'b', at: at + 3_600_000 })], start, 3)
    expect(series.map((h) => [h.views, h.visitors])).toEqual([[2, 1], [1, 1], [0, 0]])
  })
})

describe('the last 24 hours option', () => {
  it('is its own range, hour by hour, ending with the current hour', () => {
    expect(parseAnalyticsRange('24h')).toBe('24h')
    expect(parseAnalyticsRange('nope')).toBe('30d')
    const period = hourlyPeriod(new Date(Date.UTC(2026, 8, 14, 15, 20)))
    expect(period.buckets).toHaveLength(24)
    expect(period.end.toISOString()).toBe('2026-09-14T16:00:00.000Z')
    expect(period.start.toISOString()).toBe('2026-09-13T16:00:00.000Z')
    expect(period.previousStart.toISOString()).toBe('2026-09-12T16:00:00.000Z')
    expect(period.buckets[23]!.label).toBe('3 PM')
  })
})

describe('page names', () => {
  it('reads fixed pages by name and anything else from its address', () => {
    expect(pageNameFallback('/')).toBe('Home')
    expect(pageNameFallback('/about')).toBe('About us')
    expect(pageNameFallback('/locations/fort-worth')).toBe('Locations · Fort worth')
    expect(pageNameFallback('/lab-results/sg-104')).toBe('Lab results · SG-104')
    expect(pageNameFallback('/order/abc123secret')).toBe('Order status')
    expect(isLinkablePage('/order/abc123secret')).toBe(false)
    expect(isLinkablePage('/shop')).toBe(true)
  })
})
