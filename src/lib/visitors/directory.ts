import { HUMAN_KIND, TEAM_KIND } from './activity'
import { clusterKey } from './clusters'
import type { LiveVisitor } from './live'
import { countryName, regionFullName, sourceOf, stamp } from './present'

/**
 * ─────────────────────────────────────────────────────────────────────────────
 *  THE VISITOR LIST — one row per visitor, today's and everyone filed before.
 *
 *  Filed records stop at last night; today's visits are still in the buffer. A
 *  visitor seen yesterday and again five minutes ago is one person, so both halves
 *  are merged here: views and visits add up, the newest place and device win, and
 *  "last seen" is whichever happened most recently — a page view or something they
 *  did. Then who they are (an email, when they gave one), what they did (the
 *  signals, with counts), and whether it is the team.
 *
 *  Pure, so the merge, the folding and the wording are tested without a database.
 * ─────────────────────────────────────────────────────────────────────────────
 */

export interface FiledVisitor {
  readonly id: string
  readonly visitorId: string
  readonly lastSeen: Date
  readonly pageViews: number
  readonly sessionCount: number
  readonly referrer: string | null
  readonly utmSource: string | null
  readonly country: string | null
  readonly region: string | null
  readonly city: string | null
  readonly postalCode: string | null
  readonly device: string | null
  readonly browser: string | null
  readonly os: string | null
  readonly isLikelyBot: boolean
}

/** Per visitor, per kind: how many times, and the latest. */
export type ActivityCounts = ReadonlyMap<string, ReadonlyMap<string, { readonly count: number; readonly last: Date }>>

export interface VisitorSignals {
  readonly subscribed: boolean
  readonly installed: boolean
  readonly notifications: boolean
  readonly cartAdds: number
  readonly orders: number
  /** The milestones reached in the last 24 hours: these signal on the row. */
  readonly fresh: readonly string[]
}

export interface DirectoryRow {
  readonly visitorId: string
  /** Where the row links: the filed record's id, or the visitor id for someone first seen today. */
  readonly href: string
  readonly shortId: string
  readonly initials: string
  readonly email: string | null
  readonly country: string
  /** City, state and ZIP code, written out in full. Empty when unknown. */
  readonly place: string
  readonly device: string
  readonly source: string
  readonly sessions: number
  readonly views: number
  readonly lastSeen: Date
  readonly lastAgo: string
  readonly lastStamp: string
  readonly team: boolean
  readonly likelyBot: boolean
  readonly signals: VisitorSignals
  /** For folding: the place and device, as the cluster rule reads them. */
  readonly fingerprint: string
}

export interface DirectoryCluster {
  readonly key: string
  /** Most recently seen first; the first is the row shown. */
  readonly members: readonly DirectoryRow[]
}

/** "now", "8m", "3h", "5d", then the date. */
export function ago(date: Date, now: Date): string {
  const minutes = Math.floor((now.getTime() - date.getTime()) / 60_000)
  if (minutes < 1) return 'now'
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d`
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
}

const capitalise = (value: string) => value.charAt(0).toUpperCase() + value.slice(1)

export function buildDirectory({
  filed,
  live,
  activity,
  emails,
  pushVisitors,
  now,
}: {
  filed: readonly FiledVisitor[]
  live: readonly LiveVisitor[]
  activity: ActivityCounts
  emails: ReadonlyMap<string, string>
  pushVisitors: ReadonlySet<string>
  now: Date
}): DirectoryRow[] {
  const filedById = new Map(filed.map((v) => [v.visitorId, v]))
  const liveById = new Map(live.map((v) => [v.visitorId, v]))
  const ids = new Set([...filedById.keys(), ...liveById.keys()])

  const rows: DirectoryRow[] = []
  for (const visitorId of ids) {
    const record = filedById.get(visitorId)
    const today = liveById.get(visitorId)
    const kinds = activity.get(visitorId)
    const count = (kind: string) => kinds?.get(kind)?.count ?? 0

    // The newest place and device win: today's, when today knows one.
    const placed = today && (today.country || today.city) ? today : (record ?? today)!
    const deviced = today && (today.device || today.browser || today.os) ? today : (record ?? today)!

    const actedAt = [...(kinds?.entries() ?? [])].filter(([kind]) => kind !== TEAM_KIND && kind !== HUMAN_KIND).map(([, v]) => v.last)
    const lastSeen = [record?.lastSeen, today?.lastAt, ...actedAt]
      .filter((d): d is Date => d instanceof Date)
      .reduce((latest, d) => (d > latest ? d : latest), new Date(0))

    const views = (record?.pageViews ?? 0) + (today?.views ?? 0)
    const sessions = Math.max((record?.sessionCount ?? 0) + (today?.sessions ?? 0), views > 0 ? 1 : 0)
    const region = regionFullName(placed.country, placed.region)
    const place = [placed.city, [region, placed.postalCode].filter(Boolean).join(' ')].filter(Boolean).join(', ')

    rows.push({
      visitorId,
      // The cookie id: stable, unique, and what every other admin page links by.
      href: `/admin/visitors/${visitorId}`,
      shortId: visitorId.slice(-6),
      initials: visitorId.slice(0, 2).toUpperCase(),
      email: emails.get(visitorId) ?? null,
      country: countryName(placed.country) ?? 'Unknown country',
      place,
      device: [deviced.device ? capitalise(deviced.device) : null, deviced.browser, deviced.os].filter(Boolean).join(' · ') || '—',
      source: sourceOf(record ?? { utmSource: today?.utmSource ?? null, referrer: today?.referrer ?? null }),
      sessions,
      views,
      lastSeen,
      lastAgo: ago(lastSeen, now),
      lastStamp: stamp(lastSeen),
      team: count(TEAM_KIND) > 0,
      likelyBot: Boolean(record?.isLikelyBot || today?.likelyBot),
      signals: {
        subscribed: count('SUBSCRIBED') > 0,
        installed: count('APP_INSTALLED') > 0,
        notifications: count('NOTIFICATIONS_ENABLED') > 0 || pushVisitors.has(visitorId),
        cartAdds: count('CART_ADD'),
        orders: count('ORDER_PLACED'),
        fresh: [...(kinds?.entries() ?? [])]
          .filter(([, v]) => now.getTime() - v.last.getTime() < 24 * 60 * 60 * 1000)
          .map(([kind]) => kind),
      },
      fingerprint: clusterKey({
        id: visitorId,
        country: placed.country,
        region: placed.region,
        city: placed.city,
        device: deviced.device,
        browser: deviced.browser,
        os: deviced.os,
        lastSeen,
      }),
    })
  }
  return rows.sort((a, b) => b.lastSeen.getTime() - a.lastSeen.getTime())
}

/**
 * Fold rows that are likely one person: the same email, or the same place and
 * device. Transitive — if A shares an email with B and B a device with C, all three
 * fold — and display only: every record stays its own, one tap away.
 */
export function clusterDirectory(rows: readonly DirectoryRow[]): DirectoryCluster[] {
  const parent = rows.map((_, i) => i)
  const find = (i: number): number => {
    while (parent[i] !== i) {
      parent[i] = parent[parent[i]!]!
      i = parent[i]!
    }
    return i
  }
  const owner = new Map<string, number>()
  rows.forEach((row, i) => {
    const keys = [row.fingerprint.startsWith('solo:') ? null : row.fingerprint, row.email ? `email:${row.email.toLowerCase()}` : null]
    for (const key of keys) {
      if (!key) continue
      const seen = owner.get(key)
      if (seen === undefined) owner.set(key, i)
      else parent[find(i)] = find(seen)
    }
  })

  const groups = new Map<number, DirectoryRow[]>()
  rows.forEach((row, i) => {
    const root = find(i)
    const group = groups.get(root)
    if (group) group.push(row)
    else groups.set(root, [row])
  })
  return [...groups.values()]
    .map((members) => {
      const sorted = [...members].sort((a, b) => b.lastSeen.getTime() - a.lastSeen.getTime())
      return { key: sorted[0]!.visitorId, members: sorted }
    })
    .sort((a, b) => b.members[0]!.lastSeen.getTime() - a.members[0]!.lastSeen.getTime())
}
