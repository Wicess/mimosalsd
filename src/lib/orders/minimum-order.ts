import { BRAND } from '@/lib/brand'
import { formatCents } from '@/lib/utils'

/** The minimum order, from BRAND, so the rule and every message about it agree. */
export const MINIMUM_ORDER_CENTS = BRAND.minimumOrderCents

/** True when an item subtotal (integer cents, before shipping) meets the minimum. */
export function meetsMinimumOrder(subtotalCents: number): boolean {
  return subtotalCents >= MINIMUM_ORDER_CENTS
}

/** How much more a cart needs, in cents; zero once the minimum is met. */
export function shortOfMinimumCents(subtotalCents: number): number {
  return Math.max(0, MINIMUM_ORDER_CENTS - subtotalCents)
}

/** The sentence every surface shows, so the cart, checkout and the refusal read alike. */
export function minimumOrderMessage(subtotalCents: number): string {
  const short = shortOfMinimumCents(subtotalCents)
  return short > 0
    ? `The minimum order is ${formatCents(MINIMUM_ORDER_CENTS)}. Add ${formatCents(short)} more to check out.`
    : ''
}
