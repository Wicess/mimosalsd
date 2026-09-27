import { ensureLiveStateRules } from '@/lib/compliance/live-state-rules'
import 'server-only'
import { resolveCart } from '@/lib/cart/cart'
import type { Cart, ResolvedCart } from '@/lib/cart/types'
import type { UsJurisdictionCode } from '@/lib/compliance/types'
import { listMergedProductsForAdmin } from './merged'

/**
 * Resolve a cart at the prices customers are actually being shown.
 *
 * This is the money path. `resolveCart` on its own reads the AUTHORED catalogue, so
 * without this an operator could reprice a product, see the new price on the product
 * page, and have the cart and the confirmation email still charge the old one. A
 * pricing discrepancy between the page and the invoice is not a cosmetic bug.
 *
 * Prices are still recomputed server-side on every resolve and never read from the
 * cookie — that guarantee is unchanged. All that moves is where the price comes from.
 */
export async function resolveCartLive(
  cart: Cart,
  stateCode?: UsJurisdictionCode,
): Promise<ResolvedCart> {
  // Eligibility for the chosen state is decided on the live rules, not the seed.
  await ensureLiveStateRules()
  // ACTIVE only, matching what `catalog.getProduct` does. resolveCart drops a line
  // whose product cannot be found, which is exactly the wanted behaviour for
  // something deactivated after it was added — otherwise a delisted product would
  // stay priced in the cart and could be checked out.
  const merged = (await listMergedProductsForAdmin()).filter((p) => p.isActive)
  const bySlug = new Map(merged.map((p) => [p.slug, p]))
  return resolveCart(cart, stateCode, (slug) => bySlug.get(slug))
}
