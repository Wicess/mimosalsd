import type { Metadata } from 'next'
import { pageMetadata } from '@/lib/seo/meta'
import { Suspense } from 'react'
import {
  ShopResults,
  ShopResultsSkeleton,
} from '@/components/commerce/shop-results'
import { FdaDisclaimer } from '@/components/compliance/fda-disclaimer'
import { GuidesStrip } from '@/components/content/guides-strip'
import { ProductFaq } from '@/components/content/product-faq'
import { listMergedProducts } from '@/lib/catalog/merged'
import { url } from '@/lib/seo/routes'
import { collectionPage, jsonLdScript } from '@/lib/seo/structured-data'
import { PageHeader } from '@/components/layout/page-header'
import { PageSection } from '@/components/layout/page-section'

/*
  Rewritten 2026-09-18. It named Amanita muscaria, which is not what that category
  holds; said "third-party" testing, which the owner does not claim for the
  disposables; and promised legal status "in all 51 jurisdictions" — a blanket claim,
  at 186 characters, that search results cut off at "verified legal status in."
*/
export const metadata: Metadata = pageMetadata({
  title: 'Shop Mimosa Hostilis and Sassafras Root Bark',
  description:
    'Shop Mimosa hostilis root bark in powder, shredded and whole cuts, and sassafras root bark, sold by the pound for natural dyeing and craft. US shipping from California.',
  path: '/shop',
})

export default async function ShopPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  // What the shop actually sells, posted products included: the rich result and the grid agree.
  const listed = await listMergedProducts()
  return (
    <main>
      {/*
        Built from the CATALOG, not from the streamed results. The visible grid below
        is filtered per visitor and per query; a rich result is shown to everyone, so
        the marked-up list has to be the visitor-independent one. It also keeps this
        node inside the prerendered shell.
      */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLdScript(
            collectionPage({
              name: 'Shop',
              description:
                'Mimosa hostilis and sassafras root bark, sold by the pound for natural dyeing and craft.',
              path: url.shop(),
              items: listed.map((p) => ({ name: p.name, path: url.product(p.slug) })),
            }),
          ),
        }}
      />

      {/*
        Masthead and grid are one band: the title is the grid's caption, and a rule
        between them would separate a heading from the thing it heads.
      */}
      <PageSection first>
        {/* Static shell — prerendered, and what a crawler receives. */}
        {/*
          Centred. A shop page opens on a title and a grid, with nothing beside the
          title to anchor it to the left edge — left-aligned it read as a column
          that had failed to fill the width. Centred, it reads as a masthead, and
          the grid beneath it does the filling.
        */}
        <PageHeader
          className="mb-10"
          align="center"
          title="Shop"
          summary="Mimosa hostilis root bark in three cuts, and sassafras root bark, sold by the pound and shipped from California."
        />

        {/* Per-visitor and per-query — streamed in. */}
        <Suspense fallback={<ShopResultsSkeleton />}>
          <ShopResults searchParams={searchParams} />
        </Suspense>
      </PageSection>

      {/*
        Below the grid, not above it: someone who arrived to browse should reach
        the products first. This catches the reader who got to the bottom without
        adding anything — and it is the internal link that makes the guides
        reachable from the highest-authority commercial page on the site.
      */}
      <PageSection tone="sunken" labelledBy="guides-strip">
        <GuidesStrip />
      </PageSection>

      <PageSection>
        <ProductFaq />
        <FdaDisclaimer className="mt-12" />
      </PageSection>
    </main>
  )
}
