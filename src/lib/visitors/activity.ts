/**
 * ─────────────────────────────────────────────────────────────────────────────
 *  WHAT A VISITOR DID — the milestones the admin sees on every visitor, live.
 *
 *  Page views tell you someone looked. These tell you what they did about it:
 *  installed the app, joined the email list, put something in the cart, turned on
 *  reply notifications, placed an order. They are rare enough to write the moment
 *  they happen (lib/visitors/record-activity.ts), so a visitor who ordered five
 *  minutes ago already shows it.
 *
 *  Pure, so the labels, the order they are shown in, and which ones a browser may
 *  report for itself can be tested and shared with client code.
 * ─────────────────────────────────────────────────────────────────────────────
 */

export const ACTIVITY_KINDS = [
  'APP_INSTALLED',
  'SUBSCRIBED',
  'CART_ADD',
  'NOTIFICATIONS_ENABLED',
  'ORDER_PLACED',
] as const

export type ActivityKind = (typeof ACTIVITY_KINDS)[number]

export const ACTIVITY_LABEL: Record<ActivityKind, string> = {
  APP_INSTALLED: 'Installed the app',
  SUBSCRIBED: 'Subscribed to emails',
  CART_ADD: 'Added to cart',
  NOTIFICATIONS_ENABLED: 'Turned on notifications',
  ORDER_PLACED: 'Placed an order',
}

/**
 * Not a milestone: written when someone signs in to the admin, against that browser's
 * visitor id, so the team's own visits are marked "Team" in the visitor list instead
 * of passing for customers. Never shown among the five icons.
 */
export const TEAM_KIND = 'TEAM_SIGN_IN'

/**
 * Not a milestone either: proof that a person was at the keyboard. Written the first
 * time a visitor's browser runs the page AND someone touches, types, clicks, scrolls
 * with a wheel or moves the mouse (components/visitors/human-check.tsx). Crawlers,
 * link previewers, scanners and headless scripts fetch pages without doing any of
 * that, so from the moment these proofs start arriving, only visitors with one count
 * as real (lib/visitors/human.ts). Never shown among the five icons.
 */
export const HUMAN_KIND = 'HUMAN_VERIFIED'

/**
 * The only kinds a browser may report about itself. Everything else is recorded by
 * the server action that did the thing — a cart add is written by addToCart, not by
 * a request anyone could send.
 */
export const CLIENT_ACTIVITY_KINDS = ['APP_INSTALLED', 'NOTIFICATIONS_ENABLED'] as const satisfies readonly ActivityKind[]

/** Recorded once per visitor, however many times it happens. */
export const ONCE_PER_VISITOR: ReadonlySet<ActivityKind> = new Set(['APP_INSTALLED', 'NOTIFICATIONS_ENABLED', 'SUBSCRIBED'])

export function isActivityKind(value: unknown): value is ActivityKind {
  return typeof value === 'string' && (ACTIVITY_KINDS as readonly string[]).includes(value)
}

/** Which milestones a visitor has reached, in display order. */
export function milestones(kinds: Iterable<string>): { kind: ActivityKind; done: boolean }[] {
  const seen = new Set(kinds)
  return ACTIVITY_KINDS.map((kind) => ({ kind, done: seen.has(kind) }))
}
