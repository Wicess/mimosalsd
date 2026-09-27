import { PRODUCTS } from './catalog.data'
import type { Product } from './types'

/**
 * A built-in product as written in the catalogue, whether or not it is on sale.
 * The admin edits products the shop is not showing (switched off, or waiting for a
 * price per pound), so it must never look them up through the shop's own filter.
 */
export function authoredProduct(slug: string): Product | undefined {
  return PRODUCTS.find((p) => p.slug === slug)
}
