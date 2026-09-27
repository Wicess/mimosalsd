/**
 * ─────────────────────────────────────────────────────────────────────────────
 *  WHO GETS THE CREDIT — the cookie a tracking link leaves behind. Pure.
 *
 *  Clicking /r/<slug> drops one cookie: the link's slug and the moment it was
 *  clicked. If an order follows within thirty days, the order is stamped with
 *  that link and its promoter, and the credit stays on the order afterwards —
 *  renaming or retiring a link cannot move money that has already been earned.
 *
 *  ── Last click wins ────────────────────────────────────────────────────────
 *  A later click replaces an earlier one. It is the ordinary convention, and the
 *  honest one to explain to two promoters who both reached the same buyer: the
 *  one whose link they came back through is the one credited.
 *
 *  The click TIME is in the cookie rather than inferred from its expiry, so the
 *  window is enforced from the click itself and the order records when it was.
 * ─────────────────────────────────────────────────────────────────────────────
 */

export const ATTRIBUTION_COOKIE = 'ref'
export const ATTRIBUTION_WINDOW_DAYS = 30
export const ATTRIBUTION_MAX_AGE_SECONDS = ATTRIBUTION_WINDOW_DAYS * 24 * 60 * 60

const SLUG = /^[a-z0-9-]{2,40}$/

export interface Attribution {
  readonly slug: string
  readonly at: Date
}

export function encodeAttribution(slug: string, at: Date): string {
  return `${slug}.${Math.floor(at.getTime() / 1000)}`
}

/** The stored click, or null if it is malformed, foreign or out of the window. */
export function parseAttribution(raw: string | undefined | null, now: Date): Attribution | null {
  if (!raw) return null
  const dot = raw.lastIndexOf('.')
  if (dot < 1) return null
  const slug = raw.slice(0, dot)
  const seconds = Number(raw.slice(dot + 1))
  if (!SLUG.test(slug) || !Number.isSafeInteger(seconds) || seconds <= 0) return null

  const at = new Date(seconds * 1000)
  const age = now.getTime() - at.getTime()
  // A click dated in the future is a clock skew or a forged cookie; either way it
  // is not evidence of anything.
  if (age < 0 || age > ATTRIBUTION_MAX_AGE_SECONDS * 1000) return null
  return { slug, at }
}
