import type { Product } from './types'

/**
 * A row that shows the whole shop, not one corner of it (owner, 2026-09-15).
 *
 * "Most shopped" on the home page used to be the first five products in featured
 * order, which is whatever the catalogue happens to list first — post thirty vapes
 * and the row is five vapes, and a visitor scrolling past learns the site sells
 * vapes. Taking them one category at a time instead means the row always carries
 * every category the shop has, in the order each category would have offered them
 * (featured first), and only doubles up once every category has had a turn.
 *
 * Pure: the order is tested without a database.
 */
export function mixByCategory(products: readonly Product[], limit: number): readonly Product[] {
  const byCategory = new Map<string, Product[]>()
  for (const product of products) {
    const list = byCategory.get(product.categorySlug)
    if (list) list.push(product)
    else byCategory.set(product.categorySlug, [product])
  }

  const mixed: Product[] = []
  // Round by round, one from each category that still has something to give.
  for (let round = 0; mixed.length < limit; round++) {
    let placed = 0
    for (const list of byCategory.values()) {
      const product = list[round]
      if (!product) continue
      mixed.push(product)
      placed += 1
      if (mixed.length === limit) return mixed
    }
    if (placed === 0) break
  }
  return mixed
}
