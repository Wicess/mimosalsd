import { SESSION_GAP_MS } from './aggregate'
import { isRealVisitor, NO_EVIDENCE, type HumanEvidence } from './human'
import { CRAWLER_VISITOR, type VisitEvent } from './page-view'

/**
 * ─────────────────────────────────────────────────────────────────────────────
 *  TODAY'S VISITORS, LIVE — before the nightly filing has made rows of them.
 *
 *  The visitor list is built from rows the filing writes the night after a visit.
 *  That is right for history and useless for "who is on the site now". Today's page
 *  views sit in the buffer (VisitEvent) as they arrive, so this folds them into one
 *  line per visitor. Pure, so the folding is tested without a database.
 * ─────────────────────────────────────────────────────────────────────────────
 */

export interface LiveVisitor {
  readonly visitorId: string
  readonly views: number
  /** Visits today: page views more than 30 quiet minutes apart start a new one. */
  readonly sessions: number
  readonly firstAt: Date
  readonly lastAt: Date
  readonly lastPath: string | null
  readonly country: string | null
  readonly region: string | null
  readonly city: string | null
  readonly postalCode: string | null
  readonly latitude: number | null
  readonly longitude: number | null
  readonly timezone: string | null
  readonly device: string | null
  readonly browser: string | null
  readonly os: string | null
  /** The first referring site and campaign tag seen today. */
  readonly referrer: string | null
  readonly utmSource: string | null
  readonly likelyBot: boolean
  /** Their very first request to the site was today. */
  readonly isNew: boolean
}

export function summariseLiveVisitors(events: readonly VisitEvent[], evidence: HumanEvidence = NO_EVIDENCE): LiveVisitor[] {
  const byVisitor = new Map<string, VisitEvent[]>()
  for (const event of events) {
    if (event.v === CRAWLER_VISITOR) continue
    const list = byVisitor.get(event.v)
    if (list) list.push(event)
    else byVisitor.set(event.v, [event])
  }
  const visitors: LiveVisitor[] = []
  for (const [visitorId, list] of byVisitor) {
    const sorted = [...list].sort((a, b) => a.t - b.t)
    const first = sorted[0]!
    const last = sorted[sorted.length - 1]!
    // The newest event that knows a place wins: a later request may lack geo headers.
    let sessions = 1
    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i]!.t - sorted[i - 1]!.t > SESSION_GAP_MS) sessions += 1
    }
    const placed = [...sorted].reverse().find((e) => e.c || e.g || e.ci || e.z || e.la !== undefined) ?? last
    visitors.push({
      visitorId,
      views: sorted.length,
      sessions,
      firstAt: new Date(first.t),
      lastAt: new Date(last.t),
      lastPath: last.p ?? null,
      country: placed.c ?? null,
      region: placed.g ?? null,
      city: placed.ci ?? null,
      postalCode: placed.z ?? null,
      latitude: placed.la ?? null,
      longitude: placed.lo ?? null,
      timezone: placed.tz ?? null,
      device: last.d ?? null,
      browser: last.b ?? null,
      os: last.o ?? null,
      referrer: sorted.find((e) => e.r)?.r ?? null,
      utmSource: sorted.find((e) => e.us)?.us ?? null,
      likelyBot: !isRealVisitor({ visitorId, lastSeen: new Date(last.t), flagged: sorted.some((e) => e.a === 1), views: sorted.length }, evidence),
      isNew: sorted.some((e) => e.n === 1),
    })
  }
  return visitors.sort((a, b) => b.lastAt.getTime() - a.lastAt.getTime())
}
