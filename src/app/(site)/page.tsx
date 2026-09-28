import type { Metadata } from 'next'
import Image, { getImageProps } from 'next/image'
import { preload } from 'react-dom'
import { listAllPosts } from '@/lib/content/merged-content'
import { LegalityChecker } from '@/components/marketing/legality-checker'
import { ProductCard } from '@/components/commerce/product-card'
import { Proprietor } from '@/components/marketing/proprietor'
import { ShineRule } from '@/components/ui/shine-rule'
import { SectionHeading } from '@/components/layout/section-heading'
import { Standards } from '@/components/marketing/standards'
import { MapPinIcon, PackageIcon, ShieldIcon, TagIcon } from '@/components/ui/icon'
import { PAYMENT_SECURITY_STATEMENT } from '@/lib/compliance/disclaimers'
import { BRAND } from '@/lib/brand'
import { url } from '@/lib/seo/routes'
import { jsonLdScript, organization, website } from '@/lib/seo/structured-data'
import { listMergedProducts } from '@/lib/catalog/merged'
import { getCompanyEmail } from '@/lib/site/company-email.server'
import { Geist, Instrument_Serif } from 'next/font/google'

/*
  THE HERO'S TYPEFACE (owner, 2026-09-19: "use modern font on text on landing page
  hero section").

  The headline was set in Newsreader, the site's editorial serif, which is the right
  voice for an article and an old one for the first screen of a shop. Mona Sans is a
  precise industrial grotesk with a true width axis, so one family covers the whole
  hero: condensed semibold for the headline, which the design brief always asked for
  ("condensed display for headings"), and normal width for the promise, the paragraph
  and the buttons. One family in the hero also avoids setting a second grotesk beside
  Inter at the same size.

  Declared here, not in the root layout, so only the home page downloads it: one
  variable latin file, swapped in over a metric-matched fallback so the line does not
  shift when it arrives.
*/
/*
  The hero's two faces (owner, 2026-09-28: "use better fonts for a premium website").
  Instrument Serif for the headline: a high-contrast editorial serif, one weight, a
  small file. Geist for everything else in the hero: a precise modern grotesk. Both
  declared here so only the home page downloads them, each swapped in over a
  metric-matched fallback so nothing shifts when they arrive.
*/
const heroSerif = Instrument_Serif({ subsets: ['latin'], weight: '400', display: 'swap', variable: '--font-hero-serif' })
const heroSans = Geist({ subsets: ['latin'], display: 'swap', variable: '--font-hero-sans' })

export const metadata: Metadata = {
  alternates: { canonical: '/' },
}

/*
  Rewritten 2026-09-28, when the shop narrowed to root bark. Every item is something
  the business does on every order: the old strip claimed lab testing by batch and
  "51 jurisdictions, cited", and no state rule cites a statute.
*/
const TRUST_STRIP = [
  [MapPinIcon, 'Ships from California', 'To US addresses, with tracking'],
  [PackageIcon, 'Sold by the pound', 'From 1/4 lb, bulk on request'],
  [ShieldIcon, 'Checked by a person', 'Before payment is asked for'],
  [TagIcon, 'Free over $100', 'On parcel orders'],
] as const

/*
  The three cuts, as a buyer chooses between them. The copy answers the question
  people actually search ("powder vs shredded") and each card goes to its product.
*/
const CUTS = [
  {
    name: 'Shredded',
    href: '/product/shredded-mimosa-hostilis-root-bark',
    detail:
      'The everyday dyeing cut. Strains cleanly, builds color steadily and gives a second and third bath from the same bark.',
    best: 'Wool and silk dye lots, whole fleeces, leather',
  },
  {
    name: 'Powder',
    href: '/product/mimosa-hostilis-root-bark-powder',
    detail:
      'Milled fine for the fastest color release and the most color per ounce. Needs settling or fine straining before fiber goes in.',
    best: 'Test skeins, small batches, cold-process soap color',
  },
  {
    name: 'Whole chips and strips',
    href: '/product/whole-mimosa-hostilis-root-bark',
    detail:
      'The least processed cut and the longest-keeping. Break it, soak it overnight, or mill a portion when a job needs powder.',
    best: 'Stocking up, slow leather soaks, milling your own',
  },
] as const

/* The spec sheet beside the products: stable facts about every root bark order. */
const BARK_FACTS = [
  ['Plant', 'Mimosa tenuiflora (syn. Mimosa hostilis), also sold as jurema preta'],
  ['Cuts', 'Powder, shredded, whole chips and strips'],
  ['Also stocked', 'Sassafras root bark (Sassafras albidum)'],
  ['Sold by', 'The pound: 1/4, 1/3, 1/2 and 1 lb, bulk on request'],
  ['Ships from', 'California, to US addresses only'],
  ['Use', 'Natural dyeing, soap color, leather and craft. Not for human consumption'],
] as const

/* The articles the home page points to: the three a new dyer needs first. */
const STARTER_ARTICLES = [
  'the-three-cuts-of-mimosa-root-bark',
  'weighing-bark-against-fibre',
  'iron-as-a-modifier-how-far-to-go',
] as const

/*
  The hero photograph: shredded root bark from the shop's own listing, served from
  object storage, full-bleed behind the copy at every width (2026-09-28). The whole
  bark it replaced was a dark, portrait 960px frame that read as a black box at
  desktop size; the shredded bark is warm red-brown fibre and 1280px square.
*/
const HERO_PHOTO = `https://${process.env.NEXT_PUBLIC_R2_PUBLIC_HOST}/media/13e51ff90939ef04b0db2d7956e35fc9.jpg`

/*
  Decorative here (alt=""): the heading says what the page sells, and the same
  photograph is described properly on its product page. Eager and high priority,
  because it is the largest paint at every width.
*/
const { props: STAGE } = getImageProps({
  src: HERO_PHOTO,
  alt: '',
  fill: true,
  sizes: '100vw',
  loading: 'eager',
  fetchPriority: 'high',
  className: 'object-cover motion-safe:animate-[hero-drift_24s_ease-in-out_infinite_alternate]',
})

export default async function Home() {
  /*
    The phone hero's photograph is the largest paint on a phone, and it sits inside
    a <picture> deep in the body, so the browser found it late (about 1.2s after the
    first byte on a mobile trace). A preload in <head> starts it with the stylesheet.
    It is the backdrop at every width now, so the preload is no longer scoped.
  */
  preload(STAGE.src, {
    as: 'image',
    fetchPriority: 'high',
    ...(STAGE.srcSet ? { imageSrcSet: STAGE.srcSet } : {}),
    ...(STAGE.sizes ? { imageSizes: STAGE.sizes } : {}),
  })
  const bark = (await listMergedProducts({ categorySlug: 'mimosa-hostilis', sort: 'featured' })).slice(0, 8)
  const allPosts = await listAllPosts()
  const articles = STARTER_ARTICLES.flatMap((slug) => allPosts.filter((p) => p.slug === slug))

  /*
    Organization and WebSite are the site's identity nodes — the ones a knowledge
    panel and an answer engine resolve"who is this?" against. Built by the shared
    helper so `sameAs`, `logo` and `telephone` appear automatically the moment the
    real values replace the placeholders in brand.ts, rather than needing a code
    change here as well.
  */
  const jsonLd = [organization(await getCompanyEmail()), website()]

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdScript(jsonLd) }}
      />

      {/*
        1 — Hero (redesigned 2026-09-28: "centralize this in its section on large
        screen, use better fonts for a premium website").

        One centred column at every width, on the shop's own photograph full-bleed
        behind it. Editorial rather than technical: a serif headline, a grotesk for
        everything around it, a small tag above the headline, pill buttons. The scrim
        is darkest where the type sits and lightest at the edges, so the bark reads as
        bark and every line of copy still clears 4.5:1 against it.
      */}
      <section className="relative isolate overflow-hidden border-b border-border bg-stone-950">
        <div aria-hidden className="absolute inset-0 -z-30">
          <Image
            src={HERO_PHOTO}
            alt=""
            fill
            sizes="100vw"
            loading="eager"
            fetchPriority="high"
            className="object-cover motion-safe:animate-[hero-drift_24s_ease-in-out_infinite_alternate]"
          />
        </div>
        <div
          aria-hidden
          className="absolute inset-0 -z-20 bg-[radial-gradient(ellipse_75%_65%_at_50%_52%,rgb(12_10_8/0.9)_0%,rgb(12_10_8/0.72)_48%,rgb(12_10_8/0.38)_100%)]"
        />
        <div aria-hidden className="absolute inset-x-0 bottom-0 -z-10 h-32 bg-linear-to-b from-transparent to-stone-950/80" />

        <div
          className={`hero-seq ${heroSerif.variable} ${heroSans.variable} shell mx-auto flex min-h-[min(40rem,calc(100svh-8rem))] max-w-4xl flex-col items-center justify-center py-10 text-center font-[family-name:var(--font-hero-sans)] text-white sm:py-20 lg:min-h-[min(46rem,calc(100svh-8rem))] lg:py-28`}
        >
          <Image
            src="/brand/logo.png"
            alt={BRAND.name}
            width={1180}
            height={329}
            loading="eager"
            sizes="(max-width: 640px) 220px, 280px"
            /* Tablet and up only: on a phone the header already carries the mark, and a second one pushed the buttons below the fold. */
            className="h-16 w-auto drop-shadow-[0_6px_24px_rgb(0_0_0/0.55)] max-md:hidden lg:h-[4.5rem]"
          />

          <p className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.06] px-3.5 py-1.5 text-[10px] font-medium tracking-[0.14em] whitespace-nowrap text-white/80 uppercase md:mt-8 md:px-4 md:text-[11px] md:tracking-[0.22em]">
            <span aria-hidden className="size-1.5 rounded-full bg-accent" />
            Trading since {BRAND.track.foundedYear} · Ships from {BRAND.location.region}
          </p>

          {/* Named explicitly: the base styles set every h1 in the display serif. */}
          <h1 className="mt-5 max-w-[16ch] font-[family-name:var(--font-hero-serif)] text-[2.5rem] leading-[1.02] font-normal tracking-[-0.015em] text-balance text-white [text-shadow:0_2px_30px_rgb(0_0_0/0.45)] sm:text-6xl lg:text-7xl xl:text-[5.25rem]">
            Mimosa hostilis root bark <em className="text-[#e6d282] not-italic sm:italic">for natural dye and soap.</em>
          </h1>

          <p className="mt-5 max-w-[46ch] text-[15px] leading-relaxed text-pretty text-white/80 sm:text-lg">
            Powder, shredded and whole root bark, plus sassafras, for natural dyers, soap
            makers and leather workers. Sold by the pound from a quarter pound, shipped
            to every US state.
          </p>

          <div className="mt-7 flex w-full max-w-[20rem] flex-col gap-3 md:max-w-none md:flex-row md:justify-center">
            <a
              href={url.category('mimosa-hostilis')}
              className="group inline-flex min-h-12 items-center justify-center gap-3 rounded-full bg-accent py-2 pr-2 pl-7 text-base font-medium text-on-accent shadow-[0_10px_30px_-10px_rgb(230_210_130/0.6)] transition-transform duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] active:scale-[0.98] focus-visible:outline-white!"
            >
              Shop root bark
              <span
                aria-hidden
                className="flex size-9 items-center justify-center rounded-full bg-black/10 transition-transform duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] group-hover:translate-x-0.5 group-hover:-translate-y-px motion-reduce:transition-none"
              >
                &rarr;
              </span>
            </a>
            <a
              href={url.bulk()}
              className="inline-flex min-h-12 items-center justify-center rounded-full border border-white/25 bg-white/[0.04] px-7 text-base font-medium text-white transition-colors duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] hover:border-white/60 hover:bg-white/[0.08] focus-visible:outline-white!"
            >
              Bulk pricing
            </a>
          </div>

          <dl className="mt-12 grid w-full max-w-2xl grid-cols-3 divide-x divide-white/10 border-t border-white/10 pt-6 text-left max-sm:hidden">
            {[
              ['Cuts', 'Powder, shredded, whole'],
              ['Sold by', 'The pound, from 1/4 lb'],
              ['Ships from', `${BRAND.location.region}, US only`],
            ].map(([term, detail]) => (
              <div key={term} className="px-5 first:pl-0 last:pr-0">
                <dt className="text-[11px] font-medium tracking-[0.2em] text-white/55 uppercase">{term}</dt>
                <dd className="mt-1.5 text-sm text-white/90">{detail}</dd>
              </div>
            ))}
          </dl>
        </div>

        {/*
          Trust strip as a banded rail rather than four floating columns — the generic
          feature row is four equal cards, and this is the same information with a
          structure that says the items belong together.
        */}
        <div className="relative border-t border-border bg-surface-sunken">
          <ShineRule />
          <ul className="shell grid divide-y divide-border sm:grid-cols-2 sm:divide-y-0 lg:grid-cols-4 lg:divide-x">
            {TRUST_STRIP.map(([Icon, title, detail], i) => (
              <li
                key={title}
                /*
                  The cell holds the divider; the CARD inside it holds the hover.
                  Painting the hover on the cell itself would run the grey right up
                  against the rule between items, which reads as a table row rather
                  than as four separate assurances.

                  The stagger is inline because it is per-item data, not a style —
                  60ms apart, so the eye is led across the four claims in the order
                  they are meant to be read and the whole run is over in a quarter
                  of a second.
                */
                className="animate-rise p-1 lg:px-3 lg:first:pl-0 lg:last:pr-0"
                style={{ animationDelay: `${i * 60}ms` }}
              >
                <div className="group/trust flex gap-3 rounded-xl px-3 py-6 transition-colors duration-200 ease-[var(--ease-standard)] hover:bg-surface motion-reduce:transition-none lg:py-7">
                  {/*
                    The only thing that moves on hover, and it moves 2px.

                    Transform only, so it never touches layout. The touch-device
                    guard is `hover:` itself — Tailwind v4 compiles it to
                    `@media (hover: hover)`, so a phone, which fires hover on tap
                    and would strand one icon in its lifted state, never matches.
                    Writing that media query by hand as an arbitrary variant
                    produced `(hover:hover)and(pointer:fine)` with no space before
                    the `and`, which is invalid CSS and failed the stylesheet.
                  */}
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
        2 — The root bark. Rewritten 2026-09-28 when the shop narrowed to it: the pitch
        and spec sheet on the reading side, the live products on the wide side. On a
        phone it stacks: the pitch, the buttons under the thumb, then the products.
      */}
      <section aria-labelledby="home-bark" className="relative border-b border-border bg-surface py-10 lg:py-14">
        <div className="shell">
          <div className="grid gap-10 lg:grid-cols-12 lg:gap-12">
            <div className="reveal lg:col-span-5">
              <h2
                id="home-bark"
                className="font-display text-3xl leading-tight tracking-[-0.015em] text-balance text-foreground"
              >
                Mimosa hostilis root bark, by the pound
              </h2>
              <div aria-hidden className="mt-4 h-0.5 w-10 rounded-full bg-accent" />
              <p className="mt-5 max-w-[60ch] text-lg leading-relaxed text-pretty text-foreground">
                The root bark of Mimosa tenuiflora is one of the richest natural dyes a
                dyer can buy: dusky rose, plum and burgundy on wool and silk, slate and
                charcoal with iron, and warm red-browns on leather. We sell it in three
                cuts, with sassafras root bark alongside.
              </p>

              <div className="mt-7 flex flex-col gap-3 max-sm:max-w-[20rem] sm:flex-row sm:flex-wrap">
                <a
                  href={url.category('mimosa-hostilis')}
                  className="inline-flex min-h-12 items-center justify-center rounded-md bg-accent px-7 text-base font-medium text-on-accent shadow-md transition-[translate,box-shadow] duration-[180ms] ease-[var(--ease-standard)] hover:-translate-y-0.5 hover:shadow-lg active:translate-y-0 active:shadow-sm motion-reduce:transition-none motion-reduce:hover:translate-y-0"
                >
                  Shop root bark
                </a>
                <a
                  href={url.bulk()}
                  className="inline-flex min-h-12 items-center justify-center rounded-md border border-border-strong bg-surface px-7 text-base font-medium text-foreground transition-colors duration-[180ms] hover:border-primary motion-reduce:transition-none"
                >
                  Bulk pricing
                </a>
              </div>

              <dl className="mt-9 divide-y divide-border border-y border-border">
                {BARK_FACTS.map(([term, detail]) => (
                  <div key={term} className="flex flex-col gap-0.5 py-3 sm:grid sm:grid-cols-[minmax(0,12ch)_1fr] sm:gap-4">
                    <dt className="text-sm text-foreground-muted">{term}</dt>
                    <dd className="text-sm leading-relaxed text-pretty text-foreground">{detail}</dd>
                  </div>
                ))}
              </dl>
            </div>

            <div className="lg:col-span-7">
              {/*
                Two columns, then more as the width allows. `compact`: no buy button,
                because the product page is where the size ladder and the real buy
                controls are.
              */}
              <div className="stagger grid grid-cols-2 gap-3 sm:gap-4 2xl:grid-cols-3">
                {bark.map((p) => (
                  <ProductCard key={p.slug} product={p} compact />
                ))}
              </div>
              <a
                href={url.category('mimosa-hostilis')}
                className="mt-5 inline-flex min-h-11 items-center gap-1.5 text-sm text-accent-fg underline decoration-accent/40 underline-offset-4 transition-colors hover:decoration-accent"
              >
                Every cut and size
                <span aria-hidden>&rarr;</span>
              </a>
            </div>
          </div>
        </div>
      </section>

      {/*
        3 — Which cut? The question every first-time buyer searches ("powder vs
        shredded"), answered where they will decide, with a link to each product.
      */}
      <section aria-labelledby="home-cuts" className="shell relative py-10">
        <ShineRule />
        <SectionHeading
          id="home-cuts"
          title="Which cut of Mimosa hostilis should you buy?"
          summary="The same root bark in three forms. Pick by the job, not the price."
        />
        <ul className="stagger grid gap-4 md:grid-cols-3">
          {CUTS.map((cut) => (
            <li key={cut.name}>
              <a
                href={cut.href}
                className="card-lift flex h-full flex-col rounded-xl border border-border bg-surface p-6"
              >
                <h3 className="font-display text-xl text-foreground">{cut.name}</h3>
                <p className="mt-2 text-sm leading-relaxed text-pretty text-foreground-muted">{cut.detail}</p>
                <p className="mt-4 text-sm text-foreground">
                  <span className="text-foreground-subtle">Best for: </span>
                  {cut.best}
                </p>
                <span className="mt-auto inline-flex items-center gap-1.5 pt-5 text-sm text-accent-fg underline decoration-accent/40 underline-offset-4">
                  See the {cut.name.toLowerCase()} cut
                  <span aria-hidden>&rarr;</span>
                </span>
              </a>
            </li>
          ))}
        </ul>
      </section>

      {/* 4 — Where it ships. */}
      <LegalityChecker />

      {/* 6 — Trust band. The honest payment line is the strongest thing on it. */}
      <section className="relative border-y border-border bg-accent-muted py-10">
        <ShineRule />
        <ShineRule edge="bottom" />
        <div className="shell reveal">
          <SectionHeading title="How buying here works" />
          <div className="stagger grid gap-6 md:grid-cols-3">
            <div>
              <h3 className="font-medium text-foreground">A person checks every order</h3>
              <p className="mt-2 text-sm leading-relaxed text-foreground-muted">
                You send an order request, not a payment. We check the stock and the
                address it is going to before anything is asked of you, and reply with
                how to pay.
              </p>
              <a href={url.guide('how-ordering-and-payment-works')} className="mt-3 inline-flex min-h-11 items-center text-sm text-primary underline underline-offset-4">
                How ordering works
              </a>
            </div>
            <div>
              <h3 className="font-medium text-foreground">Shipped from California</h3>
              <p className="mt-2 text-sm leading-relaxed text-foreground-muted">
                Once payment is confirmed the bark is weighed, packed in a double-sealed,
                smell-proof bag flushed with nitrogen to keep it fresh, and shipped with
                tracking, to any address in the United States. Parcel orders from 100
                dollars ship free.
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
              <a href={url.contact()} className="mt-3 inline-flex min-h-11 items-center text-sm text-primary underline underline-offset-4">
                Talk to a person
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

      {/* 8 — Guides and articles. Feeds the content engine. */}
      {/*
        Banded, like the trust band and the bulk row.

        Three plain sections ran together with nothing but whitespace between them, so
        the page read as one long scroll rather than distinct parts. `field-moss` is a
        wash mixed from `--primary` rather than a fixed colour, so it re-tints itself
        in dark mode instead of becoming a grey slab — and the rules above and below
        do the separating that spacing alone was failing to do.
      */}
      <section className="relative field-moss border-y border-border bg-surface-sunken py-10">
        <ShineRule />
        <ShineRule edge="bottom" />
        <div className="shell reveal">
        <SectionHeading
          title="Dyeing with root bark: start here"
          summary="How much bark to use, which cut to choose, and how to steer the color."
        />
        <div className="stagger grid gap-5 md:grid-cols-3">
          {articles.map((item) => (
            <a
              key={item.slug}
              href={url.blogPost(item.slug)}
              className="card-lift rounded-lg border border-border bg-surface p-5"
            >
              <h3 className="font-display text-lg text-foreground">{item.title}</h3>
              <p className="mt-2 line-clamp-4 text-sm leading-relaxed text-foreground-muted">
                {item.summary}
              </p>
            </a>
          ))}
        </div>
        </div>
      </section>

      {/* 9 — Bulk. The B2B funnel. */}
      <section className="relative border-y border-border bg-surface py-10">
        <ShineRule />
        <ShineRule edge="bottom" />
        <div className="shell flex flex-wrap items-center gap-6">
          <div className="min-w-0 flex-1">
            <h2 className="font-display text-2xl text-foreground">Buying in volume?</h2>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-foreground-muted">
              Mimosa hostilis and sassafras root bark by the pound or by the case, for
              dye studios, soap makers, schools and resellers. Tell us the cut and the
              quantity and a person replies with a quote.
            </p>
          </div>
          <a
            href={url.bulk()}
            className="inline-flex min-h-12 items-center rounded-md border border-border-strong bg-surface px-6 text-base font-medium text-foreground"
          >
            Bulk enquiry
          </a>
        </div>
      </section>

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
