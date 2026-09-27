/**
 * Every canonical, indexable path on the site, collected from the same sources the
 * sitemap reads — without the Next runtime.
 *
 * `src/app/sitemap.ts` cannot be imported from a script: it is a `use cache` route and
 * pulls in `next/cache` and `server-only` modules. So this module rebuilds the same
 * list from the underlying data, and the ONE rule it follows is the sitemap's: a path
 * that renders `noindex` is never listed. Submitting a noindex URL contradicts its own
 * robots tag and costs trust in the whole file.
 *
 * Used by `scripts/urls.ts` (writes URL.md) and `scripts/indexnow.ts --all`. Both
 * reading one collector is deliberate — when they drifted apart on the parent build,
 * the 50 admin-published articles were live, linked, and in neither list.
 */
import { PrismaClient } from '@prisma/client'
import { ROUTES, url } from '../../src/lib/seo/routes'
import { catalog } from '../../src/lib/catalog/repository'
import { getAllStateLegality } from '../../src/lib/legality/state-pages'
import { publishedGuides, publishedPosts } from '../../src/lib/content/content.data'
import { POLICIES } from '../../src/lib/content/policies'
import { publishedLocations } from '../../src/lib/locations/locations'

/** The groups URL.md is written in, in the order it writes them. */
export const GROUPS = [
  'Core pages',
  'Categories',
  'Products',
  'Guides',
  'Articles',
  'State legality',
  'Lab batches',
  'Locations',
  'Policies',
] as const

export type Group = (typeof GROUPS)[number]

export interface SiteUrl {
  readonly path: string
  readonly group: Group
  /** ISO date, where the page carries a real one. Never invented. */
  readonly lastmod?: string
}

/**
 * Products and articles live in the database once an operator has posted them, so a
 * collector that reads only the authored files misses most of the site. Passing a
 * client in keeps this callable from a script that already has one open.
 */
export async function collectUrls(client?: PrismaClient): Promise<SiteUrl[]> {
  const db = client ?? new PrismaClient()
  const owned = !client
  try {
    const out: SiteUrl[] = []
    const add = (path: string, group: Group, lastmod?: string) => {
      out.push(lastmod ? { path, group, lastmod } : { path, group })
    }

    for (const route of Object.values(ROUTES)) {
      if (!route.inSitemap || route.pattern.includes('[')) continue
      // Policies carry their own reviewed date and are grouped with each other.
      if (route.pattern.startsWith('/policies/')) continue
      add(route.pattern, 'Core pages')
    }

    for (const policy of POLICIES) add(url.policy(policy.slug), 'Policies', policy.lastReviewedAt)

    // ── Catalogue. The MERGED view: authored products plus what was posted from the
    // admin panel, minus anything deactivated.
    const posted = await db.postedProduct.findMany({
      where: { isActive: true },
      select: { slug: true, categorySlug: true, updatedAt: true },
    })
    const authored = catalog.listProducts().map((p) => ({
      slug: p.slug,
      categorySlug: p.categorySlug,
      updatedAt: undefined as Date | undefined,
    }))
    const products = [...authored, ...posted.filter((p) => !authored.some((a) => a.slug === p.slug))]

    // An empty category renders noindex, so it is not listed.
    for (const category of catalog.listCategories()) {
      if (products.some((p) => p.categorySlug === category.slug)) add(url.category(category.slug), 'Categories')
    }
    for (const product of products) {
      add(url.product(product.slug), 'Products', product.updatedAt?.toISOString().slice(0, 10))
    }

    for (const batch of catalog.listBatches()) {
      add(url.labBatch(batch.batchCode), 'Lab batches', batch.testedAt.slice(0, 10))
    }

    // Only a state page with a reviewed statute is publishable; the rest are noindex.
    for (const state of getAllStateLegality()) {
      if (state.isPublishable) add(url.legalityState(state.slug), 'State legality', state.lastReviewedAt.slice(0, 10))
    }

    for (const location of publishedLocations()) add(url.location(location.slug), 'Locations')

    // ── Content. Authored pieces, then the published rows the authored list does not
    // already cover — the same precedence `merged-content.ts` applies.
    const authoredPosts = publishedPosts()
    const authoredGuides = publishedGuides()
    for (const post of authoredPosts) add(url.blogPost(post.slug), 'Articles', post.updatedAt.slice(0, 10))
    for (const guide of authoredGuides) add(url.guide(guide.slug), 'Guides', guide.updatedAt.slice(0, 10))

    const [postRows, guideRows] = await Promise.all([
      db.post.findMany({ where: { isPublished: true }, select: { slug: true, updatedAt: true, updatedAtContent: true } }),
      db.guide.findMany({ where: { isPublished: true }, select: { slug: true, updatedAt: true } }),
    ])
    const date = (row: { updatedAt: Date; updatedAtContent?: Date | null }) =>
      (row.updatedAtContent ?? row.updatedAt).toISOString().slice(0, 10)
    for (const row of postRows) {
      if (!authoredPosts.some((p) => p.slug === row.slug)) add(url.blogPost(row.slug), 'Articles', date(row))
    }
    for (const row of guideRows) {
      if (!authoredGuides.some((g) => g.slug === row.slug)) add(url.guide(row.slug), 'Guides', date(row))
    }

    // Deduplicate on path, keeping the first (authored) entry.
    const seen = new Set<string>()
    return out.filter((entry) => (seen.has(entry.path) ? false : (seen.add(entry.path), true)))
  } finally {
    if (owned) await db.$disconnect()
  }
}

/** Grouped, each group's paths sorted, for writing out. */
export function byGroup(urls: readonly SiteUrl[]): Map<Group, SiteUrl[]> {
  const map = new Map<Group, SiteUrl[]>()
  for (const group of GROUPS) {
    const entries = urls.filter((u) => u.group === group).sort((a, b) => a.path.localeCompare(b.path))
    if (entries.length > 0) map.set(group, entries)
  }
  return map
}
