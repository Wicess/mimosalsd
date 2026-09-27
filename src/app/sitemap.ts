import type { MetadataRoute } from 'next'
import { cacheTag } from 'next/cache'
import { CATALOG_TAG, LAB_TAG, listMergedBatches, listMergedProducts } from '@/lib/catalog/merged'
import { catalog } from '@/lib/catalog/repository'
import { getAllStateLegality } from '@/lib/legality/state-pages'
import { ensureLiveStateRules } from '@/lib/compliance/live-state-rules'
import { STATE_RULES_TAG } from '@/lib/compliance/prisma-state-rules'
import { publishedLocations } from '@/lib/locations/locations'
import { CONTENT_TAG, listAllGuides, listAllPosts } from '@/lib/content/merged-content'
import { POLICIES } from '@/lib/content/policies'
import { ROUTES, absoluteUrl, url } from '@/lib/seo/routes'

/**
 * Sitemap.
 *
 * `lastModified` deliberately does NOT use `new Date()`.
 *
 * Stamping "now" on every URL on every request tells Google that the entire site
 * changed today, every day. Google ignores lastmod it does not trust, so a dishonest
 * value is strictly worse than none — it burns the signal we most want when we start
 * publishing state pages and refreshing content weekly. It also made this route
 * render dynamically on every crawler hit.
 *
 * Real per-entry dates arrive with the content models in Steps 15–17; until then a
 * stable release date is both honest and cacheable.
 */
const RELEASE_DATE = new Date('2026-08-28T00:00:00Z')

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  'use cache'
  /*
    Both tags: publishing a product drops this entry, and so does publishing or
    unpublishing a post or guide. With only the catalogue tag, an article written
    in the admin would be live, linked and notified to IndexNow — and missing from
    the sitemap until something unrelated happened to invalidate it.
  */
  cacheTag(CATALOG_TAG, CONTENT_TAG, STATE_RULES_TAG, LAB_TAG)
  // The legality entries take their lastmod from each rule's review date, so they
  // have to be the LIVE rules — a lastmod from the seed is a date that is not true.
  await ensureLiveStateRules()

  /*
   * Policy pages carry their own reviewed date, so they get it. Bing treats lastmod
   * as a freshness signal it can verify, and a real date on a page that genuinely
   * changed is worth more than a uniform one across everything — which is the same
   * argument the comment above makes against `new Date()`.
   */
  const policyDates = new Map(
    POLICIES.map((p) => [url.policy(p.slug), new Date(p.lastReviewedAt)] as const),
  )

  const staticEntries = Object.values(ROUTES)
    .filter((r) => r.inSitemap && !r.pattern.includes('['))
    .map((r) => ({
      url: absoluteUrl(r.pattern),
      lastModified: policyDates.get(r.pattern) ?? RELEASE_DATE,
      changeFrequency: r.changeFrequency,
      priority: r.priority,
    }))

  const merged = await listMergedProducts()
  // An empty category renders noindex (shop/[category]), so it is not submitted either.
  const categoryEntries = catalog.listCategories().filter((c) => merged.some((p) => p.categorySlug === c.slug)).map((c) => ({
    url: absoluteUrl(url.category(c.slug)),
    lastModified: RELEASE_DATE,
    changeFrequency: ROUTES.category.changeFrequency,
    priority: ROUTES.category.priority,
  }))

  /*
    The MERGED catalogue, so a product posted from the admin panel is listed and a
    deactivated one is not. Tagged below, so posting or editing refreshes this.

    A posted product has no `lastModified`. Its dates are not in the merged shape,
    and the authored release date would predate the product itself. A sitemap
    date that is wrong is worse than none: search engines stop trusting all of them.
  */
  const productEntries = merged.map((p) => ({
    url: absoluteUrl(url.product(p.slug)),
    ...(catalog.getProduct(p.slug) ? { lastModified: RELEASE_DATE } : {}),
    changeFrequency: ROUTES.product.changeFrequency,
    priority: ROUTES.product.priority,
  }))

  const batchEntries = (await listMergedBatches()).map((b) => ({
    url: absoluteUrl(url.labBatch(b.batchCode)),
    lastModified: new Date(b.testedAt),
    changeFrequency: ROUTES.labBatch.changeFrequency,
    priority: ROUTES.labBatch.priority,
  }))

  /**
   * Only PUBLISHABLE state pages are submitted.
   *
   * A page without a reviewed statute renders `noindex`, and submitting a noindex URL
   * in a sitemap is a contradiction Google notices — it erodes trust in the whole
   * file. The gate lives in one place (`isPublishable`), and both the meta robots tag
   * and this list read it, so the two can never disagree.
   */
  const stateEntries = getAllStateLegality()
    .filter((s) => s.isPublishable)
    .map((s) => ({
      url: absoluteUrl(url.legalityState(s.slug)),
      lastModified: new Date(s.lastReviewedAt),
      changeFrequency: ROUTES.legalityState.changeFrequency,
      priority: ROUTES.legalityState.priority,
    }))

  // Only locations that physically exist and have a claimed GBP.
  const locationEntries = publishedLocations().map((l) => ({
    url: absoluteUrl(url.location(l.slug)),
    lastModified: RELEASE_DATE,
    changeFrequency: ROUTES.location.changeFrequency,
    priority: ROUTES.location.priority,
  }))

  /*
    Content carries REAL dates — this is where an honest lastmod earns its keep.

    Merged, so admin-published pieces are listed beside the authored ones. If the
    database is unreachable while this is built, the lists degrade to authored
    content only — the same trade the product entries above make: a sitemap missing
    a few entries until the next refresh is better than one that fails to generate.
  */
  const [allPosts, allGuides] = await Promise.all([listAllPosts(), listAllGuides()])
  const postEntries = allPosts.map((p) => ({
    url: absoluteUrl(url.blogPost(p.slug)),
    lastModified: new Date(p.updatedAt),
    changeFrequency: ROUTES.blogPost.changeFrequency,
    priority: ROUTES.blogPost.priority,
  }))

  const guideEntries = allGuides.map((g) => ({
    url: absoluteUrl(url.guide(g.slug)),
    lastModified: new Date(g.updatedAt),
    changeFrequency: ROUTES.guide.changeFrequency,
    priority: ROUTES.guide.priority,
  }))

  return [
    ...staticEntries,
    ...locationEntries,
    ...postEntries,
    ...guideEntries,
    ...categoryEntries,
    ...productEntries,
    ...batchEntries,
    ...stateEntries,
  ]
}
