/**
 * ─────────────────────────────────────────────────────────────────────────────
 *  SIMILAR VISITORS, FOLDED TOGETHER — for display only. Ported from WHAM.
 *
 *  One person often arrives as several visitor records: iOS in-app browsers and
 *  private windows hand out a fresh cookie on each visit, and nothing at write time
 *  can stitch them back. Records sharing a place and a device are often the same
 *  person, so the list shows one row with the rest folded beneath it.
 *
 *  "Often", not "always" — two iPhones in one city look identical here — which is
 *  why the page says "similar" and why nothing is ever merged: the records stay
 *  separate, and the fold is one click away from each of them.
 * ─────────────────────────────────────────────────────────────────────────────
 */

export interface Clusterable {
  readonly id: string
  readonly country: string | null
  readonly region: string | null
  readonly city: string | null
  readonly device: string | null
  readonly browser: string | null
  readonly os: string | null
  readonly lastSeen: Date
}

export function clusterKey(visitor: Clusterable): string {
  const hasPlace = Boolean(visitor.city || visitor.region)
  const hasDevice = Boolean(visitor.device || visitor.browser || visitor.os)
  // Too little to go on: never fold a record on half a fingerprint.
  if (!hasPlace || !hasDevice) return `solo:${visitor.id}`
  return `fp:${[visitor.country, visitor.region, visitor.city, visitor.device, visitor.browser, visitor.os]
    .map((part) => (part ?? '').toLowerCase().trim())
    .join('|')}`
}

export interface Cluster<T> {
  readonly key: string
  /** The most recently seen record, shown as the row. */
  readonly lead: T
  /** The rest, most recent first. */
  readonly others: readonly T[]
}

/** Most recently active cluster first. */
export function clusterVisitors<T extends Clusterable>(visitors: readonly T[]): Cluster<T>[] {
  const groups = new Map<string, T[]>()
  for (const visitor of visitors) {
    const key = clusterKey(visitor)
    const group = groups.get(key)
    if (group) group.push(visitor)
    else groups.set(key, [visitor])
  }
  return [...groups]
    .map(([key, members]) => {
      const sorted = [...members].sort((a, b) => b.lastSeen.getTime() - a.lastSeen.getTime())
      return { key, lead: sorted[0]!, others: sorted.slice(1) }
    })
    .sort((a, b) => b.lead.lastSeen.getTime() - a.lead.lastSeen.getTime())
}
