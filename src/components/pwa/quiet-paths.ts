/**
 * Pages where the subscribe, install and notification pop-ups never appear.
 *
 * Owner, 2026-11-23: a customer at checkout must not be interrupted. Asking for an
 * email or an install in the middle of placing an order costs orders, and the cart,
 * an order page and the account are the same moment of the visit. A card already
 * open when the visitor arrives on one of these is put away (engagement.tsx).
 */
export const QUIET_PATHS = ['/checkout', '/cart', '/order', '/offline', '/account'] as const

export function isQuietPath(pathname: string): boolean {
  return QUIET_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))
}
