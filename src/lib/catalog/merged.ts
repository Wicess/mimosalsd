import { ensureLiveStateRules } from '@/lib/compliance/live-state-rules'
import 'server-only'
import { toPostedProduct } from './posted-product'
import { cacheTag } from 'next/cache'
import { CATEGORIES, PRODUCTS } from './catalog.data'
import { createInMemoryCatalog, type CatalogProvider } from './repository'
import { applyOverrides, type ProductOverrideRecord } from './overrides'
import {
  applyCategoryOverrides,
  type CategoryOverrideRecord,
} from './category-overrides'
import type { CatalogFilters, Category, LabBatch, Product } from './types'

/**
 * The catalogue as customers see it: authored data with operator edits applied.
 *
 * ── WHY THIS EXISTS SEPARATELY FROM `catalog` ────────────────────────────────
 *
 * `catalog` (repository.ts) is SYNCHRONOUS and in-memory, and it has to stay that way:
 * `src/proxy.ts` calls it on the EDGE to decide whether a slug exists, so that a
 * missing product returns a real 404 instead of a soft one. The edge cannot reach
 * Neon. Making the catalogue itself async would delete that protection, and organic
 * search is this business's only acquisition channel.
 *
 * The overlay never adds or removes an AUTHORED product, so `catalog` remains the
 * complete answer to "does this authored slug exist?" while this module answers "and
 * what does it say today?". Products posted from the admin panel are the one addition:
 * they exist only here, never in `catalog`, and the proxy lets their slugs through to
 * a page that answers for itself (see `loadPostedProducts`).
 *
 * ── WHY IT IS SAFE FOR PERFORMANCE ───────────────────────────────────────────
 *
 * `use cache` with a tag, not a plain database read. Product pages keep their static
 * shell — on a cache hit there is no query at all, so the LCP budget is untouched and
 * Neon is not woken by browsing traffic. `revalidateTag(CATALOG_TAG)` in the admin
 * save action is what publishes an edit, so the invalidation is precise rather than
 * a timer that keeps the database awake.
 */

export const CATALOG_TAG = 'catalog'

/**
 * Every override, keyed by slug.
 *
 * Loaded as one query rather than per product: a category page renders a dozen
 * products, and a query each would turn one page render into a dozen round trips to a
 * database that bills by how long it stays awake.
 */
async function loadOverrides(): Promise<ReadonlyMap<string, ProductOverrideRecord>> {
  'use cache'
  cacheTag(CATALOG_TAG)

  try {
    const { db } = await import('@/lib/db/client')
    const rows = await db.productOverride.findMany()
    return new Map(rows.map((row) => [row.slug, row as ProductOverrideRecord]))
  } catch (error) {
    // The authored catalogue is a complete, valid catalogue on its own. If the
    // database is unreachable the site serves it unedited rather than failing —
    // stale copy is survivable, a dead shop is not.
    const { reportError } = await import('@/lib/observability/report-error')
    await reportError(error, {
      source: 'db',
      severity: 'WARN',
      context: { degraded: 'catalogue served without operator edits' },
    })
    return new Map()
  }
}

/**
 * Every product posted from the admin panel, as storefront products.
 *
 * Same contract as the overrides above: one query, cached under the same tag so
 * posting or editing publishes through the same invalidation, and a failure
 * degrades to "nothing posted" rather than taking the shop down. That includes
 * the table not existing yet: the code can ship before its migration is applied.
 *
 * Inactive rows are included. The in-memory provider hides them from customers,
 * the same way it hides a deactivated authored product, and the admin list needs
 * to see them.
 */
async function loadPostedProducts(): Promise<readonly Product[]> {
  'use cache'
  cacheTag(CATALOG_TAG)

  try {
    const { db } = await import('@/lib/db/client')
    const rows = await db.postedProduct.findMany({ orderBy: { createdAt: 'asc' } })
    return rows.map(toPostedProduct).filter((p): p is Product => Boolean(p))
  } catch (error) {
    // Migration 0010 not applied yet: nothing has been posted, and that is not an
    // incident. Anything else is.
    const { isMissingTableError } = await import('@/lib/db/errors')
    if (isMissingTableError(error)) return []
    const { reportError } = await import('@/lib/observability/report-error')
    await reportError(error, {
      source: 'db',
      severity: 'WARN',
      context: { degraded: 'catalogue served without posted products' },
    })
    return []
  }
}

/**
 * A catalogue provider built from the merged products.
 *
 * Rebuilding the in-memory provider rather than re-implementing the filters reuses
 * the sorting, the price bands and the `canShipTo` compliance filter exactly as the
 * authored catalogue uses them. Two copies of that logic would eventually disagree,
 * and the one that decides which products are legal in which state is not a good
 * place for a near-duplicate.
 *
 * Filtering therefore happens AFTER the merge, which is also what an operator
 * expects: deactivating a product or repricing it out of a band is reflected in what
 * the shop lists, not just on the product's own page.
 */
async function mergedCatalog(): Promise<CatalogProvider> {
  // Filtering by state (shipsTo, canShipTo) reads the state rules: make them the live ones.
  await ensureLiveStateRules()
  const [overrides, posted] = await Promise.all([loadOverrides(), loadPostedProducts()])
  // PRODUCTS, not catalog.listProducts(): the authored array includes deactivated
  // products, and an override has to be able to bring one back.
  return createInMemoryCatalog([...applyOverrides(PRODUCTS, overrides), ...posted])
}

/** One product, edits applied. `undefined` when the slug is not in the catalogue. */
export async function getMergedProduct(slug: string): Promise<Product | undefined> {
  const provider = await mergedCatalog()
  return provider.getProduct(slug)
}

/** Products matching the filters, edits applied. */
export async function listMergedProducts(
  filters?: CatalogFilters,
): Promise<readonly Product[]> {
  const provider = await mergedCatalog()
  return provider.listProducts(filters)
}

/**
 * Every product including deactivated ones: authored products in authored order,
 * then posted ones, oldest first. Admin list only.
 */
export async function listMergedProductsForAdmin(): Promise<readonly Product[]> {
  const [overrides, posted] = await Promise.all([loadOverrides(), loadPostedProducts()])
  return [...applyOverrides(PRODUCTS, overrides), ...posted]
}

/** The raw override row for one product, for populating the admin editor. */
export async function getOverrideRecord(
  slug: string,
): Promise<ProductOverrideRecord | undefined> {
  const overrides = await loadOverrides()
  return overrides.get(slug)
}


/**
 * ─────────────────────────────────────────────────────────────────────────────
 *  CATEGORIES, edits applied.
 *
 *  Shares `CATALOG_TAG` with the product overlay on purpose. Both are published by
 *  the same admin action path, both are read by the same pages, and two tags would
 *  mean an operator saving a category could leave a shop page showing the old copy
 *  because only half the cache was dropped.
 * ─────────────────────────────────────────────────────────────────────────────
 */
async function loadCategoryOverrides(): Promise<
  ReadonlyMap<string, CategoryOverrideRecord>
> {
  'use cache'
  cacheTag(CATALOG_TAG)

  try {
    const { db } = await import('@/lib/db/client')
    const rows = await db.categoryOverride.findMany()
    return new Map(rows.map((row) => [row.slug, row as CategoryOverrideRecord]))
  } catch (error) {
    // Authored copy is complete copy. A database that cannot be reached costs the
    // edits, not the page — a category page is a ranking page, and serving it
    // unedited beats serving a 500.
    const { reportError } = await import('@/lib/observability/report-error')
    await reportError(error, {
      source: 'db',
      severity: 'WARN',
      context: { degraded: 'categories served without operator edits' },
    })
    return new Map()
  }
}

/** One category, edits applied. `undefined` when the slug is not in the catalogue. */
export async function getMergedCategory(slug: string): Promise<Category | undefined> {
  const overrides = await loadCategoryOverrides()
  const authored = CATEGORIES.find((category) => category.slug === slug)
  if (!authored) return undefined
  return applyCategoryOverrides([authored], overrides)[0]
}

/** Every category, edits applied, in authored order. */
export async function listMergedCategories(): Promise<readonly Category[]> {
  const overrides = await loadCategoryOverrides()
  return applyCategoryOverrides(CATEGORIES, overrides)
}

/** The raw override row for one category, for populating the admin editor. */
export async function getCategoryOverrideRecord(
  slug: string,
): Promise<CategoryOverrideRecord | undefined> {
  const overrides = await loadCategoryOverrides()
  return overrides.get(slug)
}

/**
 * ─────────────────────────────────────────────────────────────────────────────
 *  LABORATORY BATCHES, FROM THE DATABASE (2026-09-17).
 *
 *  The admin panel has written batches to `LabBatch` since the lab pages were built,
 *  and the storefront has never read them. `catalog.listBatches()` reads LAB_BATCHES
 *  in catalog.data.ts, which was emptied when the sample batches were deleted — a
 *  fabricated certificate of analysis being a misrepresentation rather than a
 *  placeholder. So the constant is empty, and it is the only thing the product page
 *  and /lab-results consult.
 *
 *  The effect: an operator can enter a real certificate, publish it, and it appears
 *  nowhere. The admin list even links each batch to a page that cannot find it. This
 *  closes that gap, the same way posted products close it for the catalogue.
 *
 *  Only `isPublished` rows are returned. Results come back in the order the panel
 *  was entered, so a report reads the way the laboratory wrote it.
 * ─────────────────────────────────────────────────────────────────────────────
 */
export const LAB_TAG = 'lab-batches'

export async function listMergedBatches(): Promise<readonly LabBatch[]> {
  'use cache'
  cacheTag(LAB_TAG)

  try {
    const { db } = await import('@/lib/db/client')
    const rows = await db.labBatch.findMany({
      where: { isPublished: true },
      orderBy: { testedAt: 'desc' },
      include: { results: { orderBy: { sortOrder: 'asc' } } },
    })
    return rows.map((row) => ({
      batchCode: row.batchCode,
      labName: row.labName,
      isoAccredited: row.isoAccredited,
      testedAt: row.testedAt.toISOString().slice(0, 10),
      ...(row.pdfKey ? { pdfKey: row.pdfKey } : {}),
      results: row.results.map((r) => ({
        panel: r.panel,
        analyte: r.analyte,
        value: r.value,
        ...(r.unit ? { unit: r.unit } : {}),
        // Nullable in the schema: a result nobody marked is not a result that passed.
        passed: r.passed === true,
      })),
    }))
  } catch {
    /*
      A page that cannot reach the database shows no certificates rather than
      failing. Absent evidence is survivable; a dead product page is not, and
      inventing one to fill the gap is the thing this whole module exists to avoid.
    */
    return []
  }
}

/** One published batch by its code, or undefined. */
export async function getMergedBatch(batchCode: string): Promise<LabBatch | undefined> {
  const all = await listMergedBatches()
  return all.find((b) => b.batchCode === batchCode)
}

/** The published batches for a product, in the order the product lists them. */
export async function batchesForProduct(
  batchCodes: readonly string[],
): Promise<readonly LabBatch[]> {
  if (batchCodes.length === 0) return []
  const all = await listMergedBatches()
  return batchCodes
    .map((code) => all.find((b) => b.batchCode === code))
    .filter((b): b is LabBatch => Boolean(b))
}
