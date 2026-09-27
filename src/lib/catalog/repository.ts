import { canShipTo } from '@/lib/compliance/shipping'
import type { UsJurisdictionCode } from '@/lib/compliance/types'
import { CATEGORIES, LAB_BATCHES, PRODUCTS } from './catalog.data'
import {
  fromPriceCents,
  isOnStateDirectory,
  type CatalogFilters,
  type Category,
  type LabBatch,
  type Product,
  type SortKey,
} from './types'

/**
 * Catalog repository.
 *
 * Same pluggable-provider shape as the state rules. The in-memory provider serves
 * the application until the database is provisioned; swapping in a Prisma-backed
 * provider is one call to `setCatalogProvider` at boot, with no page or component
 * touched. That is also what lets the whole catalog be unit-tested without a database.
 */
export interface CatalogProvider {
  listProducts(filters?: CatalogFilters): readonly Product[]
  getProduct(slug: string): Product | undefined
  listCategories(): readonly Category[]
  getCategory(slug: string): Category | undefined
  getBatch(batchCode: string): LabBatch | undefined
  listBatches(): readonly LabBatch[]
}

function matchesQuery(product: Product, query: string): boolean {
  const haystack = [
    product.name,
    product.shortDescription,
    product.categorySlug,
    ...product.variants.map((v) => v.name),
  ]
    .join(' ')
    .toLowerCase()
  // Every term must appear — narrowing as the shopper types, rather than widening.
  return query
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .every((term) => haystack.includes(term))
}

function compare(a: Product, b: Product, sort: SortKey): number {
  switch (sort) {
    case 'price-asc':
      return fromPriceCents(a) - fromPriceCents(b)
    case 'price-desc':
      return fromPriceCents(b) - fromPriceCents(a)
    case 'rating':
      return (b.rating?.average ?? 0) - (a.rating?.average ?? 0)
    case 'newest':
      return 0
    case 'featured':
    default:
      if (a.isFeatured !== b.isFeatured) return a.isFeatured ? -1 : 1
      return (b.rating?.count ?? 0) - (a.rating?.count ?? 0)
  }
}

export function createInMemoryCatalog(
  products: readonly Product[] = PRODUCTS,
  categories: readonly Category[] = CATEGORIES,
  batches: readonly LabBatch[] = LAB_BATCHES,
): CatalogProvider {
  /*
    On sale: active, and priced. A product sold by the pound with no pound price yet
    is kept out of the shop rather than listed at $0 (owner, 2026-09-14).
  */
  const onSale = (p: Product) => p.isActive && !(p.sizing && p.sizing.poundPriceCents <= 0)
  return {
    listProducts(filters = {}) {
      let result = products.filter(onSale)

      if (filters.categorySlug) {
        result = result.filter((p) => p.categorySlug === filters.categorySlug)
      }
      if (filters.productLine) {
        result = result.filter((p) => p.productLine === filters.productLine)
      }
      if (filters.minPriceCents !== undefined) {
        const min = filters.minPriceCents
        result = result.filter((p) => fromPriceCents(p) >= min)
      }
      if (filters.maxPriceCents !== undefined) {
        const max = filters.maxPriceCents
        result = result.filter((p) => fromPriceCents(p) <= max)
      }
      if (filters.query) {
        const q = filters.query
        result = result.filter((p) => matchesQuery(p, q))
      }
      if (filters.shipsTo) {
        const state = filters.shipsTo
        result = result.filter(
          (p) =>
            canShipTo(state, p.productLine, {
              onStateProductDirectory: isOnStateDirectory(p, state),
            }).allowed,
        )
      }

      return [...result].sort((a, b) => compare(a, b, filters.sort ?? 'featured'))
    },
    getProduct: (slug) => products.find((p) => p.slug === slug && onSale(p)),
    listCategories: () => [...categories].sort((a, b) => a.sortOrder - b.sortOrder),
    getCategory: (slug) => categories.find((c) => c.slug === slug),
    getBatch: (batchCode) =>
      batches.find((b) => b.batchCode.toLowerCase() === batchCode.toLowerCase()),
    listBatches: () => batches,
  }
}

let provider: CatalogProvider = createInMemoryCatalog()

export function setCatalogProvider(next: CatalogProvider): void {
  provider = next
}

export function resetCatalogProvider(): void {
  provider = createInMemoryCatalog()
}

export const catalog = {
  listProducts: (filters?: CatalogFilters) => provider.listProducts(filters),
  getProduct: (slug: string) => provider.getProduct(slug),
  listCategories: () => provider.listCategories(),
  getCategory: (slug: string) => provider.getCategory(slug),
  getBatch: (batchCode: string) => provider.getBatch(batchCode),
  listBatches: () => provider.listBatches(),
}

/**
 * Products that cannot reach a jurisdiction, with the reason.
 *
 * Used to tell a visitor plainly what we cannot send them and why, rather than
 * silently returning a shorter list. A silent filter reads as "they don't stock it";
 * an explained one reads as a business that knows the law.
 */
export function unavailableIn(
  stateCode: UsJurisdictionCode,
  products: readonly Product[] = catalog.listProducts(),
): ReadonlyArray<{ product: Product; reason: string }> {
  return products.flatMap((product) => {
    const decision = canShipTo(stateCode, product.productLine, {
      onStateProductDirectory: isOnStateDirectory(product, stateCode),
    })
    return decision.allowed ? [] : [{ product, reason: decision.reason }]
  })
}
