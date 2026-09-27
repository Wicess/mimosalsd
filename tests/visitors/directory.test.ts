import { describe, expect, it } from 'vitest'
import { ago, buildDirectory, clusterDirectory, type FiledVisitor } from '@/lib/visitors/directory'
import type { LiveVisitor } from '@/lib/visitors/live'

const NOW = new Date('2026-09-14T12:00:00Z')
const ID_A = 'aa000000-0000-4000-8000-00000033bc65'
const ID_B = 'bb000000-0000-4000-8000-0000002e5627'
const ID_C = 'cc000000-0000-4000-8000-000000ca515a'

const filed = (over: Partial<FiledVisitor> = {}): FiledVisitor => ({
  id: 'rec_a',
  visitorId: ID_A,
  lastSeen: new Date('2026-09-13T20:00:00Z'),
  pageViews: 10,
  sessionCount: 3,
  referrer: 'google.com',
  utmSource: null,
  country: 'US',
  region: 'TX',
  city: 'Fort Worth',
  postalCode: '76102',
  device: 'mobile',
  browser: 'Safari',
  os: 'iOS',
  isLikelyBot: false,
  ...over,
})

const live = (over: Partial<LiveVisitor> = {}): LiveVisitor => ({
  visitorId: ID_A,
  views: 4,
  sessions: 1,
  firstAt: new Date('2026-09-14T11:50:00Z'),
  lastAt: new Date('2026-09-14T11:59:00Z'),
  lastPath: '/shop',
  country: 'US',
  region: 'TX',
  city: 'Fort Worth',
  postalCode: '76102',
  latitude: null,
  longitude: null,
  timezone: null,
  device: 'mobile',
  browser: 'Safari',
  os: 'iOS',
  referrer: null,
  utmSource: null,
  likelyBot: false,
  isNew: false,
  ...over,
})

const none = { activity: new Map(), emails: new Map(), pushVisitors: new Set<string>(), now: NOW }

describe('the visitor list', () => {
  it('merges a filed visitor with their visits today into one row', () => {
    const [row] = buildDirectory({ ...none, filed: [filed()], live: [live()] })
    expect(row).toMatchObject({
      views: 14,
      sessions: 4,
      lastAgo: '1m',
      // By the cookie id, never the row id: on this database both are UUIDs, and the
      // detail page read a row id as a cookie id and answered 404 (owner, 2026-09-19).
      href: `/admin/visitors/${ID_A}`,
      shortId: '33bc65',
      initials: 'AA',
      country: 'United States',
      place: 'Fort Worth, Texas 76102',
      device: 'Mobile · Safari · iOS',
      source: 'google.com',
    })
  })

  it('lists someone first seen today, linked by their visitor id', () => {
    const [row] = buildDirectory({ ...none, filed: [], live: [live({ visitorId: ID_B, utmSource: 'newsletter' })] })
    expect(row).toMatchObject({ href: `/admin/visitors/${ID_B}`, sessions: 1, views: 4, source: 'newsletter (campaign)' })
  })

  it('shows signals with counts, the email and the team mark', () => {
    const at = new Date('2026-09-14T11:30:00Z')
    const activity = new Map([
      [
        ID_A,
        new Map([
          ['CART_ADD', { count: 8, last: at }],
          ['ORDER_PLACED', { count: 1, last: at }],
          ['SUBSCRIBED', { count: 1, last: at }],
          ['TEAM_SIGN_IN', { count: 1, last: new Date('2026-09-14T11:59:30Z') }],
        ]),
      ],
    ])
    const [row] = buildDirectory({
      ...none,
      filed: [filed()],
      live: [],
      activity,
      emails: new Map([[ID_A, 'buyer@example.com']]),
      pushVisitors: new Set([ID_A]),
    })
    expect(row!.signals).toMatchObject({ subscribed: true, installed: false, notifications: true, cartAdds: 8, orders: 1 })
    // Done within the last 24 hours, so they signal on the row.
    expect(row!.signals.fresh).toEqual(expect.arrayContaining(['CART_ADD', 'ORDER_PLACED', 'SUBSCRIBED']))
    expect(row!.email).toBe('buyer@example.com')
    expect(row!.team).toBe(true)
    // Signing in to the admin is not activity on the shop: last seen is the order.
    expect(row!.lastAgo).toBe('30m')
  })

  it('folds the same place and device, and the same email, as likely one person', () => {
    const rows = buildDirectory({
      ...none,
      filed: [
        filed(),
        filed({ id: 'rec_b', visitorId: ID_B, lastSeen: new Date('2026-09-12T10:00:00Z') }),
        filed({ id: 'rec_c', visitorId: ID_C, city: 'Atlanta', region: 'GA', lastSeen: new Date('2026-09-11T10:00:00Z') }),
      ],
      live: [],
      emails: new Map([
        [ID_B, 'same@example.com'],
        [ID_C, 'SAME@example.com'],
      ]),
    })
    const clusters = clusterDirectory(rows)
    expect(clusters).toHaveLength(1)
    expect(clusters[0]!.members.map((m) => m.visitorId)).toEqual([ID_A, ID_B, ID_C])
  })

  it('never folds a record with no place or device', () => {
    const rows = buildDirectory({
      ...none,
      filed: [filed({ city: null, region: null }), filed({ id: 'rec_b', visitorId: ID_B, city: null, region: null })],
      live: [],
    })
    expect(clusterDirectory(rows)).toHaveLength(2)
  })

  it('writes the last-seen time short', () => {
    expect(ago(new Date('2026-09-14T11:59:40Z'), NOW)).toBe('now')
    expect(ago(new Date('2026-09-14T11:13:00Z'), NOW)).toBe('47m')
    expect(ago(new Date('2026-09-14T09:00:00Z'), NOW)).toBe('3h')
    expect(ago(new Date('2026-09-10T12:00:00Z'), NOW)).toBe('4d')
    expect(ago(new Date('2026-07-01T12:00:00Z'), NOW)).toBe('Jul 1')
  })
})
