import type { Metadata } from 'next'
import { Suspense } from 'react'
import { notFound } from 'next/navigation'
import { catalog } from '@/lib/catalog/repository'
import { getMergedCategory, listMergedProducts } from '@/lib/catalog/merged'
import { CategoryAboutBand } from '@/components/commerce/category-about'
import {
  CategoryProducts,
  CategoryProductsSkeleton,
} from '@/components/commerce/category-products'
import { FdaDisclaimer } from '@/components/compliance/fda-disclaimer'
import { GuidesStrip } from '@/components/content/guides-strip'
import { ProductFaq } from '@/components/content/product-faq'
import { PageHeader } from '@/components/layout/page-header'
import { PageSection } from '@/components/layout/page-section'
import { url } from '@/lib/seo/routes'
import {
  breadcrumbList,
  collectionPage,
  jsonLdScript,
  type Crumb,
} from '@/lib/seo/structured-data'
import { pageMetadata } from '@/lib/seo/meta'

export async function generateStaticParams() {
  return catalog.listCategories().map((c) => ({ category: c.slug }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ category: string }>
}): Promise<Metadata> {
  const { category: slug } = await params
  // Merged, so an operator's edit to the title or description publishes without a
  // deploy. `generateStaticParams` above stays on the AUTHORED list: an override
  // can change a category, never add or remove one, and the set of prerendered
  // slugs must keep matching what the edge proxy will accept.
  const [category, listed] = await Promise.all([getMergedCategory(slug), listMergedProducts({ categorySlug: slug })])
  if (!category) return {}
  const metadata = pageMetadata({
    title: category.metaTitle,
    description: category.metaDesc,
    path: url.category(slug),
  })
  // A category with nothing in it yet (Others, until its first product) is a thin page: kept out of the index until it is not.
  return listed.length ? metadata : { ...metadata, robots: { index: false, follow: true } }
}

export default async function CategoryPage({
  params,
}: {
  params: Promise<{ category: string }>
}) {
  const { category: slug } = await params
  const category = await getMergedCategory(slug)
  if (!category) notFound()

  // Both branches of the About band shift every tone below them, so the alternation
  // is computed once rather than restated at each section.
  const hasAboutBand = Boolean(category.about ?? category.detail)

  const crumbs: Crumb[] = [
    { name: 'Shop', path: url.shop() },
    { name: category.name, path: url.category(slug) },
  ]

  /*
    Visitor-independent, like the shop hub: the grid below is filtered per state, a
    rich result is not. Products are listed by the category they belong to rather
    than by what the current visitor can buy.
  */
  const products = catalog
    .listProducts()
    .filter((p) => p.categorySlug === slug)
    .map((p) => ({ name: p.name, path: url.product(p.slug) }))

  const jsonLd = [
    collectionPage({
      name: category.name,
      description: category.metaDesc,
      path: url.category(slug),
      items: products,
    }),
    breadcrumbList(crumbs),
  ]

  return (
    <main>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdScript(jsonLd) }}
      />

      <PageSection first>
        <nav aria-label="Breadcrumb" className="mb-4 text-sm text-foreground-muted">
          <a
            href={url.shop()}
            className="inline-flex min-h-11 items-center underline underline-offset-4"
          >
            Shop
          </a>
          <span aria-hidden> / </span>
          <span className="text-foreground">{category.name}</span>
        </nav>

        {/* Centred, to match /shop — the two are the same kind of page. */}
        <PageHeader
          align="center"
          title={category.name}
          // The disposables page is headed by its name alone (owner, 2026-09-15).
          summary={slug === 'disposable-vapes' ? undefined : category.intro}
          className="mb-10"
        />

        <Suspense fallback={<CategoryProductsSkeleton />}>
          <CategoryProducts categorySlug={slug} productLine={category.productLine} />
        </Suspense>
      </PageSection>

      {/*
        The rest of the category copy, below the grid.

        Category pages rank, and this is real content rather than scaffolding — it is
        in the static shell so a crawler always receives it. It sits here rather than
        in the header because centred text stops being readable past a couple of lines.
      */}
      {category.about ? (
        <PageSection tone="sunken" labelledBy="category-about">
          <CategoryAboutBand about={category.about} productLine={category.productLine} />
        </PageSection>
      ) : (
        category.detail && (
          <PageSection tone="sunken">
            {/*
              The fallback, for categories that have not been given an `about` block
              yet. Kept deliberately: the alternative was authoring three at once, and
              copy in this category is reviewed line by line rather than in bulk.
            */}
            <h2 className="font-display text-2xl text-foreground">
              About {category.name.toLowerCase()}
            </h2>
            <div aria-hidden className="mt-4 h-0.5 w-10 rounded-full bg-accent" />
            <p className="mt-5 max-w-[70ch] leading-relaxed text-foreground-muted">
              {category.detail}
            </p>
          </PageSection>
        )
      )}

      <PageSection tone={hasAboutBand ? 'plain' : 'sunken'} labelledBy="guides-strip">
        {/*
          Scoped to the line. Unscoped, this band opened the Amanita category with
          three root-bark articles — the crawler saw a page about one subject linking
          only to another, and a reader saw three recommendations for a product they
          were not looking at.
        */}
        <GuidesStrip productLine={category.productLine} />
      </PageSection>

      <PageSection tone={hasAboutBand ? 'sunken' : 'plain'}>
        <ProductFaq productLine={category.productLine} />
        <FdaDisclaimer className="mt-12" />
      </PageSection>
    </main>
  )
}
