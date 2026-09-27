import 'server-only'
import { listMergedCategories, listMergedProductsForAdmin } from '@/lib/catalog/merged'
import { getJurisdictionBySlug } from '@/lib/compliance/jurisdictions'
import { getGuide, getPost } from '@/lib/content/content.data'
import { POLICIES } from '@/lib/content/policies'
import { pageNameFallback } from './page-name-fallback'

/**
 * What a visited address is called, for people reading the admin: "Mimosa hostilis
 * root bark", not "/product/mimosa-hostilis-inner-root-bark-powder".
 *
 * Batched, because a visitor's timeline or a day's top pages is dozens of paths: the
 * catalogue is loaded once, and only when a product or category path is present.
 * Anything it cannot name falls back to a readable version of the address.
 */
export async function pageNames(paths: Iterable<string>): Promise<Map<string, string>> {
  const unique = [...new Set(paths)]
  const wantsProducts = unique.some((path) => path.startsWith('/product/'))
  const wantsCategories = unique.some((path) => path.startsWith('/shop/'))
  const [products, categories] = await Promise.all([
    wantsProducts ? listMergedProductsForAdmin().catch(() => []) : Promise.resolve([]),
    wantsCategories ? listMergedCategories().catch(() => []) : Promise.resolve([]),
  ])
  const productName = new Map(products.map((product) => [product.slug, product.name]))
  const categoryName = new Map(categories.map((category) => [category.slug, category.name]))

  const names = new Map<string, string>()
  for (const path of unique) {
    const [, root, slug] = path.split('?')[0]!.split('/')
    let name: string | undefined
    if (slug) {
      if (root === 'product') name = productName.get(slug)
      else if (root === 'shop') name = categoryName.get(slug)
      else if (root === 'blog') name = getPost(slug)?.title
      else if (root === 'guides') name = getGuide(slug)?.title
      else if (root === 'policies') name = POLICIES.find((policy) => policy.slug === slug)?.title
      else if (root === 'legality') {
        const state = getJurisdictionBySlug(slug)
        name = state ? `Legality in ${state.name}` : undefined
      }
    }
    names.set(path, name ?? pageNameFallback(path))
  }
  return names
}
