import { HUMAN_PAGE_VIEWS } from './user-agent'

/**
 * ─────────────────────────────────────────────────────────────────────────────
 *  REAL VISITORS ONLY (owner, 2026-09-14): bots are neither listed nor counted.
 *
 *  A page view is recorded from the request, and a request says nothing reliable
 *  about who sent it: a crawler that does not name itself, a link previewer, a
 *  vulnerability scanner or a headless script all arrive looking like a browser.
 *  What they do not do is use the page. So the browser proves a person: the first
 *  time someone touches, types, clicks, wheels or moves the mouse on a page that
 *  actually ran, it records HUMAN_VERIFIED once for that visitor.
 *
 *  THE RULE
 *   · A visitor with that proof is real. Always, from then on.
 *   · Once proofs have started arriving (`since`, the first one ever recorded),
 *     a visitor seen after that moment without one is not counted.
 *   · Visits from before any proof existed keep the older rule, so the history
 *     recorded before this shipped does not vanish: real unless the user-agent
 *     looked automated and they browsed fewer than HUMAN_PAGE_VIEWS pages.
 *
 *  Pure, so the rule is tested without a database.
 * ─────────────────────────────────────────────────────────────────────────────
 */
export interface HumanEvidence {
  /** Visitors whose browser proved a person was there. */
  readonly verified: ReadonlySet<string>
  /** When the first proof ever was recorded; null while there are none yet. */
  readonly since: Date | null
}

export const NO_EVIDENCE: HumanEvidence = { verified: new Set(), since: null }

export function isRealVisitor(
  visitor: {
    readonly visitorId: string
    readonly lastSeen: Date
    /** The user-agent looked automated on at least one view. */
    readonly flagged: boolean
    readonly views: number
  },
  evidence: HumanEvidence = NO_EVIDENCE,
): boolean {
  if (evidence.verified.has(visitor.visitorId)) return true
  if (evidence.since && visitor.lastSeen.getTime() >= evidence.since.getTime()) return false
  return !(visitor.flagged && visitor.views < HUMAN_PAGE_VIEWS)
}
