import type { Metadata } from 'next'
import Image from 'next/image'
import { catalog } from '@/lib/catalog/repository'
import { listAllPosts } from '@/lib/content/merged-content'
import { ArticleFeature, BulkBand } from '@/components/marketing/home-sections'
import { LegalityChecker } from '@/components/marketing/legality-checker'
import { ProductCard } from '@/components/commerce/product-card'
import { CategoryRail } from '@/components/commerce/category-rail'
import { CategoryTile } from '@/components/commerce/category-tile'
import { mixByCategory } from '@/lib/catalog/mix'
import { listPrice } from '@/lib/catalog/types'
import { Proprietor } from '@/components/marketing/proprietor'
import { ShineRule } from '@/components/ui/shine-rule'
import { SectionHeading } from '@/components/layout/section-heading'
import { Standards } from '@/components/marketing/standards'
import { CartIcon, FlaskIcon, ShieldIcon, TruckIcon } from '@/components/ui/icon'
import { PAYMENT_SECURITY_STATEMENT } from '@/lib/compliance/disclaimers'
import { BRAND } from '@/lib/brand'
import { url } from '@/lib/seo/routes'
import { jsonLdScript, organization, website } from '@/lib/seo/structured-data'
import { listMergedProducts } from '@/lib/catalog/merged'
import { getCompanyEmail } from '@/lib/site/company-email.server'
import { formatCents } from '@/lib/utils'
import { Mona_Sans } from 'next/font/google'

/*
  THE HERO'S TYPEFACE (owner, 2026-09-19: "use modern font on text on landing page
  hero section"). Mona Sans, condensed for the headline and normal width for the rest,
  declared here so only the home page downloads it.
*/
const heroFace = Mona_Sans({ subsets: ['latin'], axes: ['wdth'], display: 'swap', variable: '--font-hero' })

export const metadata: Metadata = {
  alternates: { canonical: '/' },
}

/*
  ROOT BARK LEADS THE PAGE (2026-11-03).

  The <title>, the guides, the articles and the state pages were all about root bark
  for natural dyeing, while the body of this page opened with disposables. A page that
  argues two subjects ranks for neither, so the body now says what the title says.
  Every other line is still on the page — the "Most shopped" row and the category rail
  below carry all of them — it just no longer leads.

  The hero film and the specimen photograph are gone with it. Both were byte-identical
  to the parent build's files, and the photograph was an openly-licensed Amanita
  captioned "Sample image". In their place the plate lists the root bark actually on
  sale, with its live price: nothing a crawler can find on another domain, and nothing
  that can go stale, because it is read from the catalogue on every build.
*/
const FOCUS_CATEGORY = 'mimosa-hostilis'

const TRUST_STRIP = [
  [FlaskIcon, 'Lab-tested', 'Every batch, before sale'],
  [CartIcon, 'Sold by the pound', '1/4 lb to 1 lb, bulk on request'],
  /*
    Not a count of jurisdictions: where a line may be sent lives in `state_rules`
    (CLAUDE.md rule 1), and tests/compliance/no-stale-availability-claims refuses one.
  */
  [ShieldIcon, 'Ships across the US', 'Root bark abroad on a quote'],
  [TruckIcon, 'Free over $100', 'Parcel-eligible items'],
] as const

/*
  The three cuts, in the owner's own words (the same facts llms.txt gives answer
  engines). Nothing here describes an effect; it is how each cut behaves in a dye pot.
*/
const CUTS = [
  ['Powder', 'Releases its color fastest. The cut for test skeins, small batches and soap.'],
  ['Shredded', 'The everyday dyeing cut. Strains cleanly and gives more than one bath.'],
  ['Whole chips and strips', 'Keeps longest in storage, for dyers who mill their own as they go.'],
] as const

const COLORS = [
  ['On wool and silk', 'Rose, plum, burgundy and brown from Mimosa hostilis'],
  ['With an iron afterbath', 'Grey through to charcoal'],
  ['Sassafras root bark', 'Tans, orange-browns and rose-browns on wool'],
  ['Intended use', 'Natural dyeing, soap color, leather work and craft. Not for human consumption'],
] as const

/* The articles the home page points to: the three a new dyer needs first. */
const STARTER_ARTICLES = [
  'the-three-cuts-of-mimosa-root-bark',
  'weighing-bark-against-fibre',
  'iron-as-a-modifier-how-far-to-go',
] as const

export default async function Home() {
  const categories = catalog.listCategories()
  // A mix: one from each category in turn, so the row shows the whole shop rather than its largest aisle.
  const featured = mixByCategory(await listMergedProducts({ sort: 'featured' }), 5)
  const rootBark = await listMergedProducts({ categorySlug: FOCUS_CATEGORY, sort: 'featured' })
  const allPosts = await listAllPosts()
  const articles = STARTER_ARTICLES.flatMap((slug) => allPosts.filter((p) => p.slug === slug))

  /*
    Organization and WebSite are the site's identity nodes — the ones a knowledge
    panel and an answer engine resolve "who is this?" against.
  */
  const jsonLd = [organization(await getCompanyEmail()), website()]

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdScript(jsonLd) }}
      />

      {/*
        1 — Hero. Copy in seven columns, the root bark plate in five from `lg`; on a
        phone the plate drops below the buttons so both CTAs land under a thumb first.
      */}
      <section className="field-citron relative overflow-hidden border-b border-border">
        <div className="shell grid gap-8 py-8 lg:grid-cols-12 lg:gap-8 lg:pt-6 lg:pb-8">
          <div className={`hero-seq max-lg:text-center lg:col-span-7 font-[family-name:var(--font-hero)] ${heroFace.variable}`}>
            <Image
              src="/brand/logo.png"
              alt={BRAND.name}
              width={1180}
              height={329}
              priority
              sizes="(max-width: 640px) 200px, 260px"
              className="mx-auto h-16 w-auto sm:h-[4.5rem] lg:mx-0 lg:h-[4.5rem]"
            />

            {/* The H1 carries the nouns people search, one per line. */}
            <h1 className="mt-5 font-[family-name:var(--font-hero)] text-3xl font-semibold [font-stretch:82%] lg:mt-7 leading-[1.08] tracking-[-0.02em] text-balance text-foreground">
              {['Mimosa hostilis root bark.', 'Sassafras root bark.', 'Sold for natural dyeing.'].map((line) => (
                <span key={line} className="block">
                  {line}
                </span>
              ))}
            </h1>

            <p className="mt-4 flex items-center gap-3 text-base font-medium text-foreground max-lg:justify-center lg:mt-6 sm:text-lg">
              <span aria-hidden className="h-px w-8 shrink-0 bg-accent max-lg:hidden" />
              {BRAND.tagline}
            </p>

            <p className="mx-auto mt-4 max-w-xl text-base leading-relaxed text-pretty text-foreground-muted lg:mx-0">
              Mimosa hostilis root bark in powder, shredded and whole cuts, and cut
              sassafras root bark, weighed out from a quarter pound to a full pound for
              dyers, soap makers and craft workshops. Shipped from California to US
              addresses; larger root bark orders go abroad on a quote.
            </p>

            <div className="mt-7 flex flex-col gap-3 max-md:mx-auto max-md:max-w-[20rem] md:flex-row md:flex-wrap md:justify-center lg:justify-start">
              <a
                href={url.category(FOCUS_CATEGORY)}
                className="inline-flex min-h-12 items-center justify-center rounded-md bg-accent px-7 text-base font-medium text-on-accent shadow-md transition-[translate,box-shadow] duration-[180ms] ease-[var(--ease-standard)] hover:-translate-y-0.5 hover:shadow-lg active:translate-y-0 active:shadow-sm motion-reduce:transition-none motion-reduce:hover:translate-y-0"
              >
                Shop root bark
              </a>
              <a
                href={url.shop()}
                className="inline-flex min-h-12 items-center justify-center rounded-md border border-border-strong bg-surface px-7 text-base font-medium text-foreground transition-colors duration-[180ms] hover:border-primary motion-reduce:transition-none"
              >
                Shop everything
              </a>
            </div>
          </div>

          {/*
            The plate: every root bark listing with its live per-pound price. Read from
            the catalogue, so a price change or a new cut shows here on the next build
            and a sold-out listing never lingers.
          */}
          {rootBark.length > 0 ? (
            <div className="lg:col-span-5">
              <div className="hero-plate h-full rounded-xl bg-surface p-5 shadow-xl ring-1 ring-border lg:p-7">
                <p className="text-xs font-medium tracking-[0.18em] text-foreground-subtle uppercase">Root bark on the scale today</p>
                <ul className="mt-4 divide-y divide-border">
                  {rootBark.map((p) => {
                    const price = listPrice(p)
                    return (
                      <li key={p.slug}>
                        <a
                          href={url.product(p.slug)}
                          className="group/cut flex min-h-12 items-baseline justify-between gap-4 py-3 text-foreground"
                        >
                          <span className="text-base font-medium underline decoration-transparent underline-offset-4 transition-colors group-hover/cut:decoration-accent">
                            {p.name}
                          </span>
                          <span className="shrink-0 text-sm text-foreground-muted tabular-nums">
                            {formatCents(price.cents)}
                            {price.per === 'lb' ? ' / lb' : ''}
                          </span>
                        </a>
                      </li>
                    )
                  })}
                </ul>
                <p className="mt-4 text-sm leading-relaxed text-foreground-muted">
                  Every cut comes in 1/4, 1/3, 1/2 and 1 lb, each at one fixed price. Need more?{' '}
                  <a href={url.bulk()} className="text-accent-fg underline underline-offset-4">Ask for a bulk quote</a>.
                </p>
              </div>
            </div>
          ) : null}
        </div>

        <div className="relative border-t border-border bg-surface-sunken">
          <ShineRule />
          <ul className="shell grid divide-y divide-border sm:grid-cols-2 sm:divide-y-0 lg:grid-cols-4 lg:divide-x">
            {TRUST_STRIP.map(([Icon, title, detail], i) => (
              <li
                key={title}
                className="animate-rise p-1 lg:px-3 lg:first:pl-0 lg:last:pr-0"
                style={{ animationDelay: `${i * 60}ms` }}
              >
                <div className="group/trust flex gap-3 rounded-xl px-3 py-6 transition-colors duration-200 ease-[var(--ease-standard)] hover:bg-surface motion-reduce:transition-none lg:py-7">
                  <Icon className="mt-0.5 size-5 shrink-0 text-primary transition-transform duration-200 ease-[var(--ease-standard)] group-hover/trust:-translate-y-0.5 motion-reduce:transition-none" />
                  <span>
                    <span className="block text-sm font-medium text-foreground">{title}</span>
                    <span className="block text-sm text-foreground-muted">{detail}</span>
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/*
        2 — Root bark, cut three ways. What each cut is for and what colors the bark
        gives, then the listings themselves. A reading column and a hairline spec
        sheet on one side, the products on the wide side; stacked on a phone.
      */}
      <section aria-labelledby="home-root-bark" className="relative border-b border-border bg-surface py-10 lg:py-14">
        <div className="shell">
          <div className="grid gap-10 lg:grid-cols-12 lg:gap-12">
            <div className="reveal lg:col-span-5">
              <h2
                id="home-root-bark"
                className="font-display text-3xl leading-tight tracking-[-0.015em] text-balance text-foreground"
              >
                Root bark, cut three ways
              </h2>
              <div aria-hidden className="mt-4 h-0.5 w-10 rounded-full bg-accent" />
              <p className="mt-5 max-w-[60ch] text-lg leading-relaxed text-pretty text-foreground">
                Mimosa hostilis root bark is the root bark of Mimosa tenuiflora, a
                tannin-rich tree of northeastern Brazil and southern Mexico, and one of the
                few natural dyes that colors most wool without a separate mordant. Choose the
                cut by how you dye.
              </p>

              <dl className="mt-7 divide-y divide-border border-y border-border">
                {CUTS.map(([term, detail]) => (
                  <div key={term} className="flex flex-col gap-0.5 py-3 sm:grid sm:grid-cols-[minmax(0,14ch)_1fr] sm:gap-4">
                    <dt className="text-sm font-medium text-foreground">{term}</dt>
                    <dd className="text-sm leading-relaxed text-pretty text-foreground-muted">{detail}</dd>
                  </div>
                ))}
              </dl>

              <h3 className="mt-9 text-sm font-medium tracking-[0.12em] text-foreground-subtle uppercase">What it dyes</h3>
              <dl className="mt-3 divide-y divide-border border-y border-border">
                {COLORS.map(([term, detail]) => (
                  <div key={term} className="flex flex-col gap-0.5 py-3 sm:grid sm:grid-cols-[minmax(0,14ch)_1fr] sm:gap-4">
                    <dt className="text-sm text-foreground-muted">{term}</dt>
                    <dd className="text-sm leading-relaxed text-pretty text-foreground">{detail}</dd>
                  </div>
                ))}
              </dl>

              <div className="mt-7 flex flex-col gap-3 max-sm:max-w-[20rem] sm:flex-row sm:flex-wrap">
                <a
                  href={url.category(FOCUS_CATEGORY)}
                  className="inline-flex min-h-12 items-center justify-center rounded-md bg-accent px-7 text-base font-medium text-on-accent shadow-md transition-[translate,box-shadow] duration-[180ms] ease-[var(--ease-standard)] hover:-translate-y-0.5 hover:shadow-lg active:translate-y-0 active:shadow-sm motion-reduce:transition-none motion-reduce:hover:translate-y-0"
                >
                  Shop root bark
                </a>
                <a
                  href={url.guide('what-is-mimosa-hostilis-root-bark')}
                  className="inline-flex min-h-12 items-center justify-center rounded-md border border-border-strong bg-surface px-7 text-base font-medium text-foreground transition-colors duration-[180ms] hover:border-primary motion-reduce:transition-none"
                >
                  The dyer&rsquo;s handbook
                </a>
              </div>
            </div>

            {rootBark.length > 0 ? (
              <div className="lg:col-span-7">
                <div className="stagger grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-3">
                  {rootBark.slice(0, 6).map((p) => (
                    <ProductCard key={p.slug} product={p} compact />
                  ))}
                </div>
                <a
                  href={url.category(FOCUS_CATEGORY)}
                  className="mt-5 inline-flex min-h-11 items-center gap-1.5 text-sm text-accent-fg underline decoration-accent/40 underline-offset-4 transition-colors hover:decoration-accent"
                >
                  All root bark
                  <span aria-hidden>&rarr;</span>
                </a>
              </div>
            ) : null}
          </div>
        </div>
      </section>

      {/*
        3 — Most shopped.

        Products lead now. The legality checker held this slot on the argument that
        "can you even ship to me?" is the buyer's first question — true, but a visitor
        who has not seen a single product yet has no reason to care about the answer.
        Merchandise first, then the constraint that applies to it.
      */}
      <section className="shell py-8">
        <SectionHeading title="Most shopped" />
        {/*
          `compact` — no buy button on these. This row is a showcase, not a picker:
          the reader has arrived, seen a hero, and is being shown what the shop
          sells. The button below each card was the tallest part of it and asked
          for a decision several sections too early. Tapping a card still reaches
          the product page, where the size ladder and the real buy controls are.
        */}
        <div className="grid grid-cols-2 gap-3 sm:gap-5 md:grid-cols-3 xl:grid-cols-4 min-[1600px]:grid-cols-5">
          {featured.map((p) => (
            <ProductCard key={p.slug} product={p} compact />
          ))}
        </div>
      </section>

      {/* 4 — The legality checker, once there is something to want. */}
      <LegalityChecker />

      {/*
        5 — Shop by category.

        Below the state check, not above it. Someone who has just been told what
        can reach their address is being pointed at aisles they can actually buy
        from; above it, the same three tiles were an invitation that might not
        survive the next section.

        A drifting rail rather than three static cards. Three categories in a
        three-column grid is a row that has nothing to say about itself — the
        rail moves, which is what tells a reader these are places to go rather
        than a legend, and it stops the moment a pointer lands on one.
      */}
      <section className="shell relative border-t border-border py-8">
        <ShineRule />
        <SectionHeading title="Shop by category" />
        <CategoryRail label="Product categories">
          {categories.map((c) => (
            <CategoryTile key={c.slug} category={c} />
          ))}
        </CategoryRail>
      </section>

      {/* 6 — Trust band. The honest payment line is the strongest thing on it. */}
      <section className="relative border-y border-border bg-accent-muted py-10">
        <ShineRule />
        <ShineRule edge="bottom" />
        <div className="shell reveal">
          <SectionHeading title="Why you can check us" />
          <div className="stagger grid gap-6 md:grid-cols-3">
            <div>
              <h3 className="font-medium text-foreground">A report for your batch</h3>
              <p className="mt-2 text-sm leading-relaxed text-foreground-muted">
                Nothing goes on sale until its batch has been through the lab. Send us
                the batch code printed on your package and we reply with the report for
                that batch.
              </p>
              <a href={url.labResults()} className="mt-3 inline-flex min-h-11 items-center text-sm text-primary underline underline-offset-4">
                Request a certificate
              </a>
            </div>
            <div>
              {/*
                Was "Every state, cited … we publish the statute behind each position".
                The state pages carry no statute citations, so the claim went
                (2026-11-03); what remains is what the cart actually does.
              */}
              <h3 className="font-medium text-foreground">Your state, checked first</h3>
              <p className="mt-2 text-sm leading-relaxed text-foreground-muted">
                Before you order, the cart checks each item against the state it is going
                to. Our where-we-ship pages read the same records, so the page and the
                checkout cannot disagree.
              </p>
              <a href={url.legalityHub()} className="mt-3 inline-flex min-h-11 items-center text-sm text-primary underline underline-offset-4">
                Where we ship
              </a>
            </div>
            <div>
              <h3 className="font-medium text-foreground">No payment on this site</h3>
              <p className="mt-2 text-sm leading-relaxed text-foreground-muted">
                {PAYMENT_SECURITY_STATEMENT}
              </p>
              <a href={url.guide('how-ordering-and-payment-works')} className="mt-3 inline-flex min-h-11 items-center text-sm text-primary underline underline-offset-4">
                How ordering works
              </a>
            </div>
          </div>
        </div>
      </section>

      {/*
        7 — The proprietor.

        Placed after the trust band and before the products: the reader has just been
        told why the claims can be checked, and this puts a person's name behind them
        before asking them to shop.
      */}
      <Proprietor />

      {/*
        8 and 9 — The article feature and the bulk band, kept from the 2026-09-29
        redesign at the owner's word (2026-10-01).
      */}
      <ArticleFeature articles={articles} />

      <BulkBand />

      {/*
        10 — The close.

        The page ended on a rule and a line of federal small print, which is an
        obligation discharged rather than a close. The disclaimer still renders —
        from inside `Standards`, so the two cannot be separated by a later edit.
      */}
      <Standards />
    </>
  )
}
