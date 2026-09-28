import type { Metadata } from 'next'
import { Suspense } from 'react'
import { notFound } from 'next/navigation'
import { catalog } from '@/lib/catalog/repository'
import { fromPriceCents } from '@/lib/catalog/types'
import {
  PurchasePanel,
  PurchasePanelSkeleton,
} from '@/components/commerce/purchase-panel'
import { FdaDisclaimer } from '@/components/compliance/fda-disclaimer'
import { PageSection } from '@/components/layout/page-section'
import { CoaBadge } from '@/components/compliance/coa-badge'
import { Badge } from '@/components/ui/badge'
import { ChevronRightIcon } from '@/components/ui/icon'
import { absoluteUrl, url } from '@/lib/seo/routes'
import {
  breadcrumbList,
  jsonLdScript,
  organizationRef,
  type Crumb,
} from '@/lib/seo/structured-data'
import { pageMetadata } from '@/lib/seo/meta'
import { GuidesStrip } from '@/components/content/guides-strip'
import { ProductFaq } from '@/components/content/product-faq'
import { ProductStory } from '@/components/commerce/product-story'
import { SimilarProducts } from '@/components/commerce/similar-products'
import { ProductSpecs } from '@/components/commerce/product-specs'
import { BRAND } from '@/lib/brand'
import { displayImageFor } from '@/lib/catalog/sample-images'
import { ProductGallery } from '@/components/commerce/product-gallery'
import { batchesForProduct, getMergedProduct } from '@/lib/catalog/merged'

/*
  Cache Components refuses an empty list here, at build and at request time alike,
  and the authored catalogue is empty now that every product is posted from the
  admin panel (2026-09-15). A placeholder satisfies the check, as the Next.js docs
  recommend: it matches no product, so it renders notFound(). Posted products
  render on request exactly as they always have.
*/
export async function generateStaticParams() {
  const authored = catalog.listProducts().map((p) => ({ slug: p.slug }))
  return authored.length > 0 ? authored : [{ slug: '__placeholder__' }]
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const product = await getMergedProduct(slug)
  if (!product) return {}
  // The automatic writer's search title and description, when it wrote this page.
  return {
    ...pageMetadata({
      title: product.seo?.metaTitle ?? product.name,
      description: product.seo?.metaDescription ?? product.shortDescription,
      path: url.product(slug),
    }),
    ...(product.seo?.keywords.length ? { keywords: [...product.seo.keywords] } : {}),
  }
}

export default async function ProductPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const product = await getMergedProduct(slug)
  if (!product) notFound()

  const category = catalog.getCategory(product.categorySlug)
  // Published batches from the database, not the empty code constant (see merged.ts).
  const batches = await batchesForProduct(product.batchCodes)

  const image = displayImageFor(product)

  /*
    The size ladder, rendered SERVER-SIDE as well as in the buy box.

    The buy box is a client component behind a Suspense boundary, so its prices
    are not in the prerendered HTML. "How much is 250g of mimosa hostilis root
    bark" is exactly the question this site needs to be the answer to, and an
    answer engine reading the static shell has to find the number there. Hence
    the table further down — same source as the buttons, so they cannot disagree.
  */

  /** One crumb list, rendered visibly AND marked up. Declared once so they agree. */
  const crumbs: Crumb[] = [
    { name: 'Shop', path: url.shop() },
    ...(category ? [{ name: category.name, path: url.category(category.slug) }] : []),
    { name: product.name, path: url.product(slug) },
  ]

  /**
   * Product schema.
   *
   * Deliberately NOT per-visitor. A rich result is a generic listing shown to
   * everyone, so availability here reflects stock, not one visitor's jurisdiction —
   * and keeping it visitor-independent is also what lets this page prerender.
   * Per-state refusal is handled in the purchase panel, before the cart.
   *
   * NO `aggregateRating` HERE. Read this before adding one back.
   *
   * Google requires that a rating in markup be visible to users on the page it
   * describes, and be sourced from real customers. This page renders neither a rating
   * nor a review, and `product.rating` in the catalog is synthetic seed data derived
   * from an array index — so emitting it was asserting a 4.8 from 137 reviews that do
   * not exist. Markup-only ratings are a documented cause of structured-data manual
   * actions, and a spam penalty is unaffordable when organic search is the only
   * acquisition channel.
   *
   * Re-add it when, and only when, moderated reviews actually RENDER on this page —
   * the `Review` model already exists in the schema, and CLAUDE.md requires
   * moderation before publish. At that point build it from the same rows the page
   * displays, never from a stored aggregate.
   */
  /*
    ── WHY THE PRICE MARKUP IS GATED BY PRODUCT LINE ──────────────────────────
    Google's merchant listing content guidelines: "We don't allow content that
    promotes widely prohibited or regulated goods", and the list names recreational
    drugs and tobacco and vaping products. Merchant listing experiences are the ones
    driven by price, availability and rating markup, so emitting an AggregateOffer on
    a vape or a mushroom listing claims an eligibility those categories do not have.

    What is NOT dropped is the Product entity itself. Name, description, brand, image,
    SKU and the specification table are how a search engine and an answer engine
    understand WHAT this page is about, and that understanding is the whole
    opportunity for a catalogue that cannot chase merchant rich results. So the
    entity stays and the commerce claim goes.

    The botanical line keeps its offers: raw root bark sold for dyeing and craft is
    not a regulated good under that policy, and the price on those pages is real,
    stable and useful in a listing.

    ── AND WHY THE OTHERS ARE NOT TYPED AS A PRODUCT AT ALL (2026-09-18) ──────
    Keeping the entity without offers turned out to be a mistake. Google's product
    snippet documentation: "You must include one of the following properties:
    review, aggregateRating, offers". A Product node with none of the three is an
    invalid item, and about fifty listings were reporting as exactly that in Search
    Console, on pages the same documentation says it will not show results for.

    So a listing without an offer is described as the page it is — a WebPage, with
    its name, description and picture — and its specification stays in the visible
    table, which is where every answer engine reads it from anyway.
  */
  const offerEligible = product.productLine === 'MIMOSA_HOSTILIS'

  const pageEntity = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: product.name,
    description: product.shortDescription,
    url: absoluteUrl(url.product(slug)),
    ...(image ? { primaryImageOfPage: { '@type': 'ImageObject', url: absoluteUrl(image.srcSet[0]!) } } : {}),
  }

  const jsonLd = [
    offerEligible ? {
      '@context': 'https://schema.org',
      '@type': 'Product',
      name: product.name,
      description: product.shortDescription,
      sku: product.variants[0]?.sku,
      brand: { '@type': 'Brand', name: BRAND.name },
      /*
        The visible specification table, as machine-readable pairs.

        This is the part an answer engine can actually use: brand, format, extract,
        classification, battery, coil, testing. It is built from the SAME array the
        table below renders, so the markup can never describe a specification the page
        does not show — which is the rule that keeps structured data out of Bing's
        "misleading structured data" abuse list.
      */
      ...(product.specs?.length
        ? {
            additionalProperty: product.specs.map(([name, value]) => ({
              '@type': 'PropertyValue',
              name,
              value,
            })),
          }
        : {}),
      /*
        `image` is the field Google most wants on a Product node — without one the
        listing is ineligible for most merchant rich results. Absolute, because a
        site-relative path is not resolvable by a crawler reading the JSON in
        isolation. Omitted entirely rather than guessed when no file exists.
      */
      /*
        EVERY view, not just the first. Google takes an array here and prefers a
        listing that offers it more than one crop to choose from — and the gallery
        below renders exactly this set, so the markup cannot describe a picture the
        page does not show.
      */
      ...(image ? { image: image.srcSet.map((u) => absoluteUrl(u)) } : {}),
      // Sold new and unopened; stated explicitly because"condition" is otherwise
      // inferred, and a botanical raw material is an unusual enough listing to guess at.
      itemCondition: 'https://schema.org/NewCondition',
      /*
        One offer per size, wrapped in an AggregateOffer.
    
        A single Offer carrying the cheapest price used to be accurate only because
        every size was its own product. Now that sizes are variants, a lone
        `price: 28.00` on a page whose largest bag is $310 is a misstatement — the
        exact kind that gets a merchant listing suppressed. AggregateOffer states
        the range and then names each size, which is also what an answer engine
        needs to reply to "how much is 250g".
      */
      ...(offerEligible ? { offers: {
        '@type': 'AggregateOffer',
        priceCurrency: 'USD',
        lowPrice: (fromPriceCents(product) / 100).toFixed(2),
        highPrice: (
          Math.max(...product.variants.map((v) => v.priceCents)) / 100
        ).toFixed(2),
        offerCount: product.variants.length,
        availability: 'https://schema.org/InStock',
        url: absoluteUrl(url.product(slug)),
        // Same @id as the Organization node on the home page — one entity, not two.
        seller: organizationRef(),
        // US only. Declared on the offer so no engine infers international supply.
        eligibleRegion: { '@type': 'Country', name: 'United States' },
        offers: product.variants.map((v) => ({
          '@type': 'Offer',
          priceCurrency: 'USD',
          price: (v.priceCents / 100).toFixed(2),
          name: v.name,
          sku: v.sku,
          availability: v.inStock
            ? 'https://schema.org/InStock'
            : 'https://schema.org/OutOfStock',
          url: absoluteUrl(url.product(slug)),
          seller: organizationRef(),
          eligibleRegion: { '@type': 'Country', name: 'United States' },
        })),
      } } : {}),
    } : pageEntity,
    // Built from the same crumbs the visible <nav> below renders, so the two cannot drift.
    breadcrumbList(crumbs),
  ]

  /*
   * The fixed chrome on a phone is 131px: a 74px buy bar sitting on a 57px tab bar.
   * `pb-32` was 128 — three short, so the last line of the page could never quite
   * clear the bar. Padding only rescues the END of the document; what sits at the
   * fold is handled by the gallery ratio instead.
   */
  return (
    <main className="pb-36 md:pb-0">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdScript(jsonLd) }}
      />

      <PageSection first>
        <nav aria-label="Breadcrumb" className="mb-4 text-sm text-foreground-muted">
          {crumbs.map((crumb, i) => {
            const isLast = i === crumbs.length - 1
            return (
              <span key={crumb.path}>
                {isLast ? (
                  <span className="text-foreground">{crumb.name}</span>
                ) : (
                  <>
                    <a href={crumb.path} className="inline-flex min-h-11 items-center underline underline-offset-4">
                      {crumb.name}
                    </a>
                    <span aria-hidden> / </span>
                  </>
                )}
              </span>
            )
          })}
        </nav>

        {/*
          THREE BLOCKS, TWO SHAPES.

          On a phone they stack in the order someone actually reads: photograph,
          then the thing that lets them buy, then the detail. On a wider screen the
          buy panel spans both rows of the right-hand column while the photograph
          and the specifications stack up the left — which is what fills the roughly
          600px of nothing that used to sit beside the buy panel, because the panel
          is twice the height of a square photograph.

          Explicit `order` and explicit grid placement rather than source order,
          because the two arrangements genuinely disagree: the specifications belong
          BELOW the buy panel on a phone and BESIDE it on a desktop, and there is no
          single source order that gives both.

          `grid-rows-[auto_1fr]` matters. Left to itself the grid splits the
          row-spanning buy panel's height across both rows, which padded row one
          past the photograph and reopened a band of nothing above the
          specifications — the exact gap this arrangement exists to close. Pinning
          row one to `auto` sizes it to the photograph and lets row two take the
          remainder.
        */}
        {/*
          Two columns, one row. The left column was image-over-specifications and the
          buy panel spanned both rows; with the specifications gone there is one row,
          and the gap tightens so the photograph sits nearer the thing it is selling
          rather than across a canyon from it.
        */}
        {/*
          A tighter gutter than the page uses elsewhere.

          These two columns are one object — a photograph and the controls for the
          thing in it — and a 48px canyon between them read as two unrelated panels.
          24px on a phone, 32px from `md`.
        */}
        {/*
          The image column is CAPPED, not just proportional.

          At `0.9fr` it kept pace with the viewport, so on a 1800px display the
          photograph was ~660px wide and, being square, ~660px tall — larger than the
          entire buy panel beside it. A bag of powder does not need to be the biggest
          thing on the page. Proportional up to `lg`, then fixed at 520px, so the
          extra width on a wide screen goes to the panel that actually does the work.

          AND THE SPLIT STARTS AT `lg`, NOT `md`. At 768px the two columns measured
          296px and 371px — a photograph cropped to a narrow portrait strip beside a
          buy panel too tight to lay out its own quantity stepper. Tablet portrait is
          not a two-column width for this page; it stacks, and both halves get the
          full measure.
        */}
        <div className="grid gap-6 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1fr)] lg:gap-8 xl:grid-cols-[minmax(0,520px)_minmax(0,1fr)]">
          {/* Aspect ratio reserved so the LCP image cannot shift the layout. */}
          <div className="order-1 lg:col-start-1 lg:row-start-1">
            <ProductGallery
              views={image ? image.srcSet : []}
              alt={image?.alt ?? product.name}
              {...(image && !image.isSample ? { alts: image.alts } : {})}
              caption={
                image?.isSample ? (
                  <figcaption className="absolute inset-x-0 bottom-0 bg-stone-950/75 px-3 py-2 text-xs leading-snug text-white">
                    <strong className="font-medium">Sample image.</strong> Photography of
                    this product is not published yet, so this shows the kind of material
                    only.
                  </figcaption>
                ) : undefined
              }
            />
          </div>

          {/*
            The specifications table lived here and is gone.

            Six label/value rows repeating what the write-up below already says in
            sentences, in a column of its own beside the photograph. The facts that
            were only in the table — origin, part, intended use — are in the write-up
            sections now, where they read as prose rather than as a spec sheet for a
            bag of bark.
          */}
          <div className="order-2 lg:col-start-2 lg:row-start-1">
            <h1 className="font-product text-3xl font-semibold text-foreground">{product.name}</h1>
            {/*
              No price here. The buy box prints one eight lines below, for the size
              actually selected — two prices for one product is one too many, and the
              static one was the cheapest size dressed as "the" price.

              The description moved BELOW the buy controls for the same reason the
              reference layout does it: someone who has opened a product page has
              already been sold on the idea. What they need first is the size, the
              price and the button; the prose is for the ones still deciding.
            */}
            <div className="mt-3 flex flex-wrap gap-2">
              {/*
                No "Botanical use only" badge here. The notice four lines below says
                it in full, and a chip repeating the first three words of the
                sentence under it is the same disclosure twice.
              */}
              {product.ageRestricted && <Badge tone="warning">21+ only</Badge>}
            </div>

            {/*
              ORDER IS LOAD-BEARING. Availability and the consumption notice render
              ABOVE the buy button — see PurchasePanel. The legal basis for the sale is
              that the buyer understood before they bought; a notice below the fold does
              not establish that, and a state refusal discovered at checkout reads as
              bait-and-switch rather than compliance.
            */}
            <div className="mt-5">
              <Suspense fallback={<PurchasePanelSkeleton />}>
                <PurchasePanel product={product} />
              </Suspense>
            </div>

            <p className="mt-5 text-sm leading-relaxed text-foreground-muted">
              {product.shortDescription}
            </p>

          </div>
        </div>

      </PageSection>

      <PageSection tone="sunken" labelledBy="product-story">
        {/*
          The write-up, in named sections.

          This slot held "About this product" beside a "Sizes and prices" table and a
          "Bulk pricing" table. Both tables restated what the buy box shows live and
          pushed the actual description into a half-width column — so the page said
          every price three times and described the product once, narrowly.
        */}
        <ProductStory product={product} />
        <ProductSpecs product={product} className="mt-14" />
      </PageSection>

      {/*
        ── LAB TESTING, ON EVERY PRODUCT (owner, 2026-09-17) ──────────────────
        This block used to render only where a batch code happened to be attached,
        which was four products out of fifty-five, so most of the catalogue said
        nothing at all about testing. It now renders everywhere, because the two
        routes to a certificate are true of every product whether or not a batch is
        linked yet: a licensed reseller gets the official certificate on proving a
        licence, and a verified buyer gets the summary against the code on the pack.

        What it does NOT do is print results for a product that has none. The panel
        below appears only when real batches are linked. A summary that names a
        laboratory and a set of readings the site does not hold would be a fabricated
        certificate of analysis on a regulated storefront, which is the one claim on
        a page like this that can hurt somebody.
      */}
      <PageSection tone="sunken">
          <section>
            <h2 className="font-display text-2xl text-foreground">Lab testing and certificates</h2>
            <p className="mt-1 max-w-prose text-sm text-foreground-muted">
              Every batch is tested before it is offered for sale, on a full panel
              rather than potency alone.
            </p>

            <dl className="mt-5 grid gap-4 sm:grid-cols-2">
              <div className="rounded-lg border border-border bg-surface p-4">
                <dt className="text-sm font-semibold text-foreground">Licensed resellers</dt>
                <dd className="mt-1 text-sm text-foreground-muted">
                  The official certificate is issued to licensed resellers on provision
                  of a licence. Send it with your enquiry on the{' '}
                  <a href={url.bulk()} className="underline underline-offset-4">wholesale page</a>{' '}
                  and the full report for your batch comes back with your pricing.
                </dd>
              </div>
              <div className="rounded-lg border border-border bg-surface p-4">
                <dt className="text-sm font-semibold text-foreground">Everyone else</dt>
                <dd className="mt-1 text-sm text-foreground-muted">
                  The summary for your batch is issued to verified buyers on request,
                  against the batch code printed on your package. Ask us on the{' '}
                  <a href={url.contact()} className="underline underline-offset-4">contact page</a>.
                </dd>
              </div>
            </dl>

            {/*
              The accreditation badges sat beside the photograph until the
              specifications column came out. This is a better home for them: the
              claim and the reports it refers to are now the same block, rather than
              a badge at the top of the page and the evidence four screens down.
            */}
            {batches.length > 0 && (
            <>
            <p className="mt-6 max-w-prose text-sm text-foreground-muted">
              Match the batch code printed on your package to the report for it; sizes
              of the same product are not always filled from the same batch.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {batches.map((b) => (
                <CoaBadge
                  key={b.batchCode}
                  batchCode={b.batchCode}
                  labName={b.labName}
                  isoAccredited={b.isoAccredited}
                />
              ))}
            </div>

            <ul className="mt-4 grid gap-3 sm:grid-cols-2">
              {batches.map((batch) => (
                <li key={batch.batchCode}>
                  <a
                    href={url.labBatch(batch.batchCode)}
                    className="flex min-h-11 items-center justify-between gap-3 rounded-lg border border-border bg-surface px-4 py-3 transition-colors hover:bg-surface-sunken"
                  >
                    <span className="min-w-0">
                      <span className="tabular font-product block text-sm font-semibold text-foreground">
                        Batch {batch.batchCode}
                      </span>
                      <span className="block text-xs text-foreground-muted">
                        {batch.labName} · tested {batch.testedAt}
                      </span>
                    </span>
                    <ChevronRightIcon className="size-4 shrink-0 text-foreground-subtle" />
                  </a>
                </li>
              ))}
            </ul>
            </>
            )}
          </section>
      </PageSection>

      <PageSection labelledBy="guides-strip">
        {/*
          The last thing on the page, and deliberately after the lab results: a
          reader who scrolled this far is either convinced or is looking for the
          thing that would convince them. "How to read a certificate of analysis"
          is that thing, and it sits directly under the certificate.
        */}
        <GuidesStrip
          className="mt-16"
          heading="Before you decide"
          summary="What this material is, how to read the report that comes with it, and what the law says where you are."
        />
      </PageSection>

      <PageSection tone="sunken">
        {/*
          The FAQ closes the page, below the guides.

          Answer engines lift question-and-answer blocks more readily than any other
          shape, and this one is selected by product line rather than repeated whole
          — nineteen identical questions on every product page is duplication at
          scale, which is the thing that costs crawl budget rather than earning it.
        */}
        <ProductFaq productLine={product.productLine} categorySlug={product.categorySlug} productQuestions={product.content?.faqs ?? []} />
        <FdaDisclaimer className="mt-12" />
      </PageSection>

      {/*
        Related products close the page (owner, 2026-09-15): a reader who reached the
        bottom without buying is looking for the next thing to look at, and this is
        where they are when they decide.
      */}
      <PageSection>
        <SimilarProducts product={product} />
      </PageSection>
    </main>
  )
}
