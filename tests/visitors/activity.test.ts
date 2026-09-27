import { afterEach, describe, expect, it, vi } from 'vitest'
import { ACTIVITY_KINDS, CLIENT_ACTIVITY_KINDS, isActivityKind, milestones } from '@/lib/visitors/activity'
import { summariseLiveVisitors } from '@/lib/visitors/live'
import type { VisitEvent } from '@/lib/visitors/page-view'

const A = '0f8fad5b-d9cb-469f-a165-70867728950e'
const B = '7c9e6679-7425-40de-944b-e07fc1f90ae7'
const view = (v: string, t: number, extra: Partial<VisitEvent> = {}): VisitEvent =>
  ({ v, t, p: '/', d: 'mobile', b: 'Safari', o: 'iOS', ...extra }) as VisitEvent

describe('milestones', () => {
  it('always lists all five, in the same order, lit for the ones reached', () => {
    expect(milestones(['ORDER_PLACED', 'CART_ADD'])).toEqual([
      { kind: 'APP_INSTALLED', done: false },
      { kind: 'SUBSCRIBED', done: false },
      { kind: 'CART_ADD', done: true },
      { kind: 'NOTIFICATIONS_ENABLED', done: false },
      { kind: 'ORDER_PLACED', done: true },
    ])
    expect(isActivityKind('ORDER_PLACED')).toBe(true)
    expect(isActivityKind('DROP TABLE')).toBe(false)
  })

  /*
    A cart add or an order is recorded by the server action that did it. If the
    browser could report those, anyone could fill the admin with fake orders.
  */
  it('lets the browser report only what only the browser can see', () => {
    expect([...CLIENT_ACTIVITY_KINDS].sort()).toEqual(['APP_INSTALLED', 'NOTIFICATIONS_ENABLED'])
    for (const kind of CLIENT_ACTIVITY_KINDS) expect(ACTIVITY_KINDS).toContain(kind)
  })
})

describe('summariseLiveVisitors', () => {
  it('folds today’s page views into one line per visitor, newest visitor first', () => {
    const live = summariseLiveVisitors([
      view(A, 1000, { p: '/', c: 'US', g: 'TX', ci: 'Austin', n: 1 }),
      view(B, 1500, { p: '/shop', d: 'desktop', b: 'Chrome', o: 'Windows' }),
      view(A, 3000, { p: '/checkout' }), // no geo headers on this one
      view('crawler', 4000, { k: 'GPTBot' }),
    ])
    expect(live.map((v) => v.visitorId)).toEqual([A, B])
    const a = live[0]!
    expect([a.views, a.lastPath, a.city, a.region, a.isNew]).toEqual([2, '/checkout', 'Austin', 'TX', true])
    expect(a.firstAt.getTime()).toBe(1000)
    expect(a.lastAt.getTime()).toBe(3000)
    expect(live[1]!.isNew).toBe(false)
  })

  it('never lists a crawler as a visitor', () => {
    expect(summariseLiveVisitors([view('crawler', 1)])).toEqual([])
  })
})

describe('POST /api/visits/activity', () => {
  afterEach(() => {
    vi.resetModules()
    vi.doUnmock('@/lib/visitors/record-activity')
  })

  it('records install and notifications, and silently ignores anything else', async () => {
    const recordActivity = vi.fn()
    vi.doMock('@/lib/visitors/record-activity', () => ({ recordActivity }))
    const { POST } = await import('@/app/api/visits/activity/route')
    const post = (body: unknown) =>
      POST(new Request('https://shop.test/api/visits/activity', { method: 'POST', body: JSON.stringify(body) }))

    for (const kind of ['APP_INSTALLED', 'NOTIFICATIONS_ENABLED']) expect((await post({ kind })).status).toBe(204)
    for (const kind of ['ORDER_PLACED', 'CART_ADD', 'SUBSCRIBED', 'nonsense']) expect((await post({ kind })).status).toBe(204)
    expect(recordActivity.mock.calls.map((call) => call[0])).toEqual(['APP_INSTALLED', 'NOTIFICATIONS_ENABLED'])
  })
})
