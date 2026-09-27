import { readCart } from '@/lib/cart/storage'
import { cartItemCount, normalizeCart } from '@/lib/cart/cart'
import { CartBadge } from '@/components/commerce/cart-badge'

/**
 * Item-count badge on the header cart and the bottom tab bar.
 *
 * Reads the cart cookie, so it renders inside a Suspense boundary and nowhere near the
 * layout body. Uses `normalizeCart` rather than `resolveCart` — the badge is a count,
 * and resolving it would pull in catalogue lookup and the whole shipping-eligibility
 * evaluation to render one number. The number itself is live: see CartBadge.
 */
export async function CartCount() {
  return <CartBadge initial={cartItemCount(normalizeCart(await readCart()))} />
}
