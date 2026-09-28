import type { Metadata } from 'next'
import Image, { getImageProps } from 'next/image'
import { catalog } from '@/lib/catalog/repository'
import { publishedGuides, publishedPosts } from '@/lib/content/content.data'
import { LegalityChecker } from '@/components/marketing/legality-checker'
import { ProductCard } from '@/components/commerce/product-card'
import { CategoryRail } from '@/components/commerce/category-rail'
import { CategoryTile } from '@/components/commerce/category-tile'
import { mixByCategory } from '@/lib/catalog/mix'
import { Proprietor } from '@/components/marketing/proprietor'
import { ShineRule } from '@/components/ui/shine-rule'
import { SectionHeading } from '@/components/layout/section-heading'
import { Standards } from '@/components/marketing/standards'
import { Badge } from '@/components/ui/badge'
import { CartIcon, FlaskIcon, ShieldIcon, TruckIcon } from '@/components/ui/icon'
import { PAYMENT_SECURITY_STATEMENT } from '@/lib/compliance/disclaimers'
import { BRAND } from '@/lib/brand'
import { url } from '@/lib/seo/routes'
import { jsonLdScript, organization, website } from '@/lib/seo/structured-data'
import { listMergedProducts } from '@/lib/catalog/merged'
import { getCompanyEmail } from '@/lib/site/company-email.server'
import { HeroVideo, type HeroVideoClip } from '@/components/marketing/hero-video'
import { Mona_Sans } from 'next/font/google'

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
const heroFace = Mona_Sans({ subsets: ['latin'], axes: ['wdth'], display: 'swap', variable: '--font-hero' })

export const metadata: Metadata = {
  alternates: { canonical: '/' },
}

const TRUST_STRIP = [
  [FlaskIcon, 'Lab-tested', 'Every batch, before sale'],
  [CartIcon, 'Wholesale disposables', 'Volume pricing for retailers'],
  [ShieldIcon, 'State-verified', '51 jurisdictions, cited'],
  [TruckIcon, 'Free over $100', 'Parcel-eligible items'],
] as const

/*
  The disposables band's spec sheet. Every row is something the business does for
  every disposable, never a claim about one product: what a device contains is
  stated on its own page. Testing is "by batch", not "third-party" (the owner
  describes the disposables' labs as second-party), and nothing here mentions
  signatures, ID at the door or state restrictions (owner, 2026-09-15).
*/
const DISPOSABLE_FACTS = [
  ['Families', 'Nicotine disposables, and hemp-derived THCA and THC disposables'],
  ['Lab testing', 'By batch, before it is offered for sale'],
  ['Certificates', 'Issued to verified buyers on request'],
  ['Sold', 'By the unit, with wholesale pricing for retailers'],
  ['Carrier', 'PACT Act compliant, shipped on its own'],
  ['Age', '21 and over'],
] as const

/* When no disposable is posted yet, the band's right column names the two families instead. */
const DISPOSABLE_FAMILIES = [
  ['Nicotine disposables', 'Sealed, pre-filled and ready to use, with the contents stated on each product page.'],
  ['THCA & THC disposables', 'Hemp-derived cannabinoid disposables, lab-tested by batch and sold by the unit.'],
] as const

/*
  The specimen plate's <img> props, built once.

  `getImageProps` rather than <Image> so the photograph can sit inside a
  <picture> and be refused outright on narrow screens — see the plate below.

  `loading` AND `fetchPriority` both, deliberately. With only `fetchPriority`,
  Next falls through to `loading="lazy"`, which on desktop waits for layout
  before it even asks for the LCP image. And not `preload`: the Next 16 docs
  rule it out when a different element is the LCP at different widths, which
  is exactly this page now — the heading on a phone, this plate from `lg`.
*/
const { props: PLATE } = getImageProps({
  src: '/samples/amanita-caps.jpg',
  alt: 'An Amanita muscaria mushroom, its orange-red cap flecked with white, growing in moss.',
  fill: true,
  sizes: '40vw',
  loading: 'eager',
  fetchPriority: 'high',
  className: 'object-cover',
})

/*
  The phone hero's backdrop: the same photograph, framed for a narrow screen.

  The mirror image of the plate's trick. Here the <source> blanks it from `lg` up,
  where the plate carries the photograph instead, so every width downloads it exactly
  once. It is the LCP element on a phone now, hence eager and high priority; `66vw`
  because it sits under a dark scrim, where a touch of softness costs nothing and the
  bytes do. Decorative here (alt=""): the plate's <img> carries the description.
*/
const { props: STAGE } = getImageProps({
  src: '/samples/amanita-caps.jpg',
  alt: '',
  fill: true,
  sizes: '66vw',
  loading: 'eager',
  fetchPriority: 'high',
  // Toned down to the night clips' key, so the copy reads on it as well as on the film.
  className: 'object-cover brightness-[0.85] motion-safe:animate-[hero-drift_24s_ease-in-out_infinite_alternate]',
})

/*
  THE PHONE HERO'S FILM: two clips, crossfading. Empty the list and the photograph
  above is the backdrop again, with no video code sent at all.

  Generated with Veo in Google Flow in the site's own palette: the Amanita in moss,
  then all three lines (bark, the cap, a vape) on slate. Each file was prepared for
  this slot: 7 seconds, its last second crossfaded into its first so it loops
  without a jump, no audio track (the page is muted, so audio was dead weight),
  720x1280 H.264 at about 0.7 MB. MP4 comes first because every iPhone plays it;
  the WebM is for browsers built without H.264, which skip the MP4 and use it.
  Idle loading, reduced motion, data saver, pausing and the carousel itself are all
  in components/marketing/hero-video.tsx.
*/
const HERO_VIDEO: readonly HeroVideoClip[] = [
  {
    sources: [
      { src: '/videos/hero-amanita-moss.mp4', type: 'video/mp4' },
      { src: '/videos/hero-amanita-moss.webm', type: 'video/webm' },
    ],
  },
  {
    sources: [
      { src: '/videos/hero-products-slate.mp4', type: 'video/mp4' },
      { src: '/videos/hero-products-slate.webm', type: 'video/webm' },
    ],
  },
]

/* A 1×1 transparent GIF. Inline, so selecting it costs no request at all. */
const BLANK_PIXEL =
  'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'

export default async function Home() {
  const categories = catalog.listCategories()
  /*
   * Five, to fill the widest row. It was three, which left half the grid empty on a
   * 1900px display — the row goes to five columns at 1600px and up.
   */
  // A mix: one from each category in turn, so the row shows the whole shop rather than its largest aisle.
  const featured = mixByCategory(await listMergedProducts({ sort: 'featured' }), 5)
  // The disposables band's own row: the business leads with them (owner, 2026-09-15).
  const disposables = (await listMergedProducts({ categorySlug: 'disposable-vapes', sort: 'featured' })).slice(0, 8)
  const guides = publishedGuides().slice(0, 3)
  const posts = publishedPosts().slice(0, 2)

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
        1 — Hero.

        Asymmetric on purpose. The previous version was a left-aligned column of text
        with the right half of the viewport left empty, which is the shape a page takes
        when nobody decided what it should look like. Content sits in seven columns and
        the specimen image in five, so the fold carries the promise AND the product.

        The image is a real Amanita muscaria, which is a thing this business actually
        sells — a decorative abstract would have been easier and would have said
        nothing.

        BELOW `lg` IT IS A DIFFERENT COMPOSITION, not the desktop one stacked. The
        picture goes full-bleed BEHIND the copy (the photograph drifting, or the film
        playing over it), under a dark scrim; the copy is centred on it in white and
        cut to the mark, the products, the promise and the two buttons. The long
        paragraph and the specification list are desktop-only. The buttons are
        centred and full-width up to 20rem, so both land under a thumb.
      */}
      <section className="field-citron relative overflow-hidden border-b border-border">
        <div className="relative isolate">
        {/*
          The phone backdrop, back to front: photograph, film, scrim. Three siblings
          with negative z inside this `isolate` box, so they stack beneath the copy
          without a stacking context of their own. The film has no controls: the
          owner asked for the play/pause button to be removed.
        */}
        <div aria-hidden className="absolute inset-0 -z-30 overflow-hidden bg-stone-950 lg:hidden">
          <picture>
            <source media="(width >= 64rem)" srcSet={BLANK_PIXEL} />
            <img {...STAGE} alt="" />
          </picture>
        </div>
        {HERO_VIDEO.length > 0 ? <HeroVideo clips={HERO_VIDEO} /> : null}
        {/*
          ONE GRADIENT, AND THE COPY SITS IN ITS DARK END.

          The film was covered by an even scrim plus a halo over the middle — together
          about 80% black exactly where the picture is — so it played and nobody could
          see it. Dimming less is not the answer either: white text needs 4.5:1, and
          over the brightest frames that alone would drop the tagline to about 3.4:1.

          So the darkness is moved rather than reduced. The top of the film is left
          almost clear, the foot is taken to 92%, and the copy is anchored into that
          foot (`content-end` on the grid below). The picture is plainly moving where
          there is no text over it, and every line of type sits on pixels dark enough
          to read: at the brightest frame sampled, the background under the tagline is
          about 8% luminance, which is roughly 7:1 against white — comfortably past
          the 4.5:1 AA asks for it, and past 3:1 for the display line.
        */}
        <div
          aria-hidden
          className="absolute inset-0 -z-10 bg-linear-to-b from-stone-950/18 from-22% via-stone-950/74 via-62% to-stone-950/93 lg:hidden"
        />
        <div className="shell grid gap-8 py-8 max-lg:min-h-[min(32rem,calc(100svh-12rem))] max-lg:content-end lg:grid-cols-12 lg:gap-8 lg:pt-6 lg:pb-8">
          {/*
            Seven columns, not eight.

            Eight was sized for display type twice this large. Once the heading came
            down to 60px the copy stopped reaching the end of its column, and the
            leftover track read as a gap between the text and the plate — a gap no
            amount of tightening `gap-*` could close, because it was empty grid, not
            spacing. Seven fits the longest line with room to spare and hands the
            width to the image.
          */}
          <div className={`hero-seq max-lg:text-center lg:col-span-7 font-[family-name:var(--font-hero)] ${heroFace.variable}`}>
            {/*
              THE MARK LEADS, THE PRODUCTS FOLLOW.

              This column opened with a tracked uppercase kicker — "Legal
              psychedelics & botanicals · United States" — which is the one piece
              of furniture every generated landing page owns, and it was doing the
              logo's job in words. The logo does it better and does it in one
              glance, so the kicker is gone rather than stacked on top of it.

              With a mark above it the heading no longer has to be the thing that
              announces the brand, so it steps down from `text-4xl` (60px at
              desktop) to `text-3xl` (40px). That is the point of putting a logo
              here: the hero gets an anchor, and the type gets to stop shouting.

              From `lg`, everything in the column shares one left edge — mark,
              heading, promise, detail, buttons — so the eye travels straight
              down instead of re-finding the margin at every step. On a phone the
              mark alone is centred; see its className.
            */}
            <Image
              src="/brand/logo.png"
              alt={BRAND.name}
              width={1180}
              height={329}
              priority
              sizes="(max-width: 640px) 240px, 260px"
              /*
                Centred on phones, left-aligned from `lg`.

                Below `lg` the specimen plate is gone and the column is the whole
                hero, so a mark pinned to the left margin sits off-balance with
                nothing opposite it. From `lg` the plate returns to the right and
                the left edge is a real edge again.
              */
              className="mx-auto h-16 w-auto sm:h-[4.5rem] lg:mx-0 lg:h-[4.5rem] max-lg:drop-shadow-[0_6px_20px_rgb(0_0_0/0.6)]"
            />

            {/*
              THE H1 IS THE PRODUCTS, NOT THE PROMISE.

              It used to set the tagline. That read well and contained not one term
              anybody searches — on a business whose only acquisition channel is
              organic, the strongest on-page signal after the <title> was spent on
              adjectives while the three nouns people actually type sat in the
              paragraph below it.

              One sentence per line, split explicitly rather than left to the
              browser: "State-Verified" carries a real hyphen, and at full-bleed the
              browser broke the line there.
            */}
            {/* Named explicitly: the base styles set every h1 in the display serif. */}
            <h1 className="mt-5 font-[family-name:var(--font-hero)] text-3xl font-semibold [font-stretch:82%] lg:mt-7 leading-[1.08] tracking-[-0.02em] text-balance text-foreground max-lg:text-white max-lg:[text-shadow:0_1px_2px_rgb(0_0_0/0.5),0_2px_24px_rgb(0_0_0/0.55)]">
              {['Disposable vapes.', 'Mimosa Hostilis root bark.', 'Amanita muscaria.'].map(
                (line) => (
                  <span key={line} className="block">
                    {line}
                  </span>
                ),
              )}
            </h1>

            {/*
              The promise, on the accent rule rather than in bold. Weight was the
              only thing separating it from the paragraph beneath, which made two
              different jobs look like one block of text.
            */}
            <p className="mt-4 flex items-center gap-3 text-base font-medium text-foreground max-lg:justify-center lg:mt-6 max-lg:text-white max-lg:[text-shadow:0_1px_2px_rgb(0_0_0/0.5),0_2px_18px_rgb(0_0_0/0.5)] sm:text-lg">
              <span aria-hidden className="h-px w-8 shrink-0 bg-accent max-lg:hidden" />
              {BRAND.tagline}
            </p>

            <p className="mt-4 hidden max-w-xl text-base leading-relaxed text-foreground-muted lg:block">
              A US distributor of nicotine, THCA and THC disposables, with Mimosa
              Hostilis root bark and Amanita muscaria alongside. Distributed to all 50
              states and the District of Columbia, with a laboratory report on file for
              every batch, released to verified buyers who ask.
            </p>

          {/*
            The image column is taller than the copy, which left a void under the
            buttons at desktop widths. Filling it with what the panels actually cover
            says something a spacer would not — and it is the detail that separates a
            published report from a certificate.
          */}
            <div className="mt-7 flex flex-col gap-3 max-md:mx-auto max-md:max-w-[20rem] md:flex-row md:flex-wrap md:justify-center lg:justify-start">
              <a
                href={url.category('disposable-vapes')}
                className="inline-flex min-h-12 items-center justify-center rounded-md bg-accent px-7 text-base font-medium text-on-accent shadow-md max-lg:focus-visible:outline-white! transition-[translate,box-shadow] duration-[180ms] ease-[var(--ease-standard)] hover:-translate-y-0.5 hover:shadow-lg active:translate-y-0 active:shadow-sm motion-reduce:transition-none motion-reduce:hover:translate-y-0"
              >
                Shop disposables
              </a>
              <a
                href={url.shop()}
                className="inline-flex min-h-12 items-center justify-center rounded-md border border-border-strong bg-surface px-7 text-base font-medium text-foreground transition-colors duration-[180ms] hover:border-primary hover:bg-surface motion-reduce:transition-none max-lg:border-white/60! max-lg:bg-stone-950/30 max-lg:text-white max-lg:hover:border-white! max-lg:hover:bg-stone-950/50 max-lg:focus-visible:outline-white!"
              >
                Shop everything
              </a>
            </div>

            <dl className="mt-8 hidden border-t border-border pt-5 lg:block">
              {[
                ['Disposables', 'Nicotine, THCA and THC, sold by the unit'],
                ['Lab testing', 'Every batch, before it is offered for sale'],
                ['Certificate', 'Issued to verified buyers on request, by batch code'],
              ].map(([term, detail]) => (
                <div key={term} className="flex gap-4 py-1.5 text-sm">
                  <dt className="w-28 shrink-0 text-foreground-subtle">{term}</dt>
                  <dd className="text-foreground-muted">{detail}</dd>
                </div>
              ))}
            </dl>
          </div>

          {/*
            Specimen plate. THE PLATE IS DESKTOP-ONLY.

            On a phone it pushed the buttons and the specification list a full
            screen below the fold, so the first thing a visitor could act on
            arrived after a 4:5 photograph they had to scroll past. The copy is
            the hero on a narrow screen; the photograph is what fills the width a
            wide one has spare.
          */}
          <div className="hidden lg:col-span-5 lg:block">
            {/*
              The plate FOLLOWS the copy; it does not set the height.

              A fixed 2:3 ratio looked right at 1440 and then grew with the container —
              at full-bleed the column is 700px wide, so the image rendered 1050px tall
              and pushed the whole hero to 1.18x the viewport. From lg up it simply
              fills the row the text defines, so the two columns finish together at
              whatever height the words actually need.

              No aspect ratio of its own any more: it only ever renders at `lg` and
              up, where the row sets its height, so the old stacked-layout 4:5 box
              was dead code.
            */}
            <figure className="hero-plate relative h-full min-h-[19rem] w-full overflow-hidden rounded-xl bg-surface-sunken shadow-xl ring-1 ring-border">
              {/*
                `hidden` on the wrapper hides the plate; it does not stop the
                photograph downloading. An eager <img> is fetched whether or not
                it has a box, so a phone was paying for a high-priority image it
                never shows — bandwidth, and a request competing with the fonts
                and the logo for the first paint.

                The <source> is the complement of Tailwind's `lg` (`width >=
                64rem`, same syntax), so the two can never disagree about a width.
                Below it the browser — preload scanner included — picks the blank
                pixel and never requests the photograph. The real image stays on
                the <img>, which is what crawlers read and what any browser that
                cannot evaluate the media query falls back to.
              */}
              <picture>
                <source media="(width < 64rem)" srcSet={BLANK_PIXEL} />
                <img {...PLATE} alt={PLATE.alt} />
              </picture>
              {/*
                The caption names the species and says the photograph is a sample —
                nothing more.

                It first read"Batch AM-2026-0388 · ISO 17025", which was a fabricated
                claim: this is an openly-licensed photograph, not documentation of a
                batch we tested. On a site whose entire argument is that every claim can
                be checked against a report, inventing a batch reference for visual
                effect is the one thing the design must not do.
              */}
              <figcaption className="absolute inset-x-0 bottom-0 flex items-baseline justify-between gap-3 bg-stone-950/72 px-4 py-3 text-xs text-white backdrop-blur-sm">
                <span className="font-medium">Amanita muscaria</span>
                <span className="opacity-80">Sample image</span>
              </figcaption>
            </figure>
          </div>
        </div>
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
        2 — Disposables, distributed direct (owner, 2026-09-15: "we are a distributor
        of disposable products").

        The business is built around disposables, so they get the first band after the
        hero and more of the page than any other line: what we distribute, how it is
        tested and sold, and the real disposables posted in the admin.

        Composition matches the category page's about band (a reading column, a bare
        hairline spec sheet, no card around it), with the products on the wide side.
        On a phone it stacks: the pitch, the two buttons under the thumb, then the
        facts and the products.
      */}
      <section aria-labelledby="home-disposables" className="relative border-b border-border bg-surface py-10 lg:py-14">
        <div className="shell">
          <div className="grid gap-10 lg:grid-cols-12 lg:gap-12">
            <div className="reveal lg:col-span-5">
              <h2
                id="home-disposables"
                className="font-display text-3xl leading-tight tracking-[-0.015em] text-balance text-foreground"
              >
                Disposables, distributed direct
              </h2>
              <div aria-hidden className="mt-4 h-0.5 w-10 rounded-full bg-accent" />
              <p className="mt-5 max-w-[60ch] text-lg leading-relaxed text-pretty text-foreground">
                Disposable vapes are what {BRAND.name} is built around. We distribute
                nicotine, THCA and THC disposables to adult customers and to retailers,
                lab-tested by batch and sold by the unit.
              </p>

              <div className="mt-7 flex flex-col gap-3 max-sm:max-w-[20rem] sm:flex-row sm:flex-wrap">
                <a
                  href={url.category('disposable-vapes')}
                  className="inline-flex min-h-12 items-center justify-center rounded-md bg-accent px-7 text-base font-medium text-on-accent shadow-md transition-[translate,box-shadow] duration-[180ms] ease-[var(--ease-standard)] hover:-translate-y-0.5 hover:shadow-lg active:translate-y-0 active:shadow-sm motion-reduce:transition-none motion-reduce:hover:translate-y-0"
                >
                  Shop disposables
                </a>
                <a
                  href={url.bulk()}
                  className="inline-flex min-h-12 items-center justify-center rounded-md border border-border-strong bg-surface px-7 text-base font-medium text-foreground transition-colors duration-[180ms] hover:border-primary motion-reduce:transition-none"
                >
                  Wholesale pricing
                </a>
              </div>

              <dl className="mt-9 divide-y divide-border border-y border-border">
                {DISPOSABLE_FACTS.map(([term, detail]) => (
                  <div key={term} className="flex flex-col gap-0.5 py-3 sm:grid sm:grid-cols-[minmax(0,12ch)_1fr] sm:gap-4">
                    <dt className="text-sm text-foreground-muted">{term}</dt>
                    <dd className="text-sm leading-relaxed text-pretty text-foreground">{detail}</dd>
                  </div>
                ))}
              </dl>
            </div>

            <div className="lg:col-span-7">
              {disposables.length > 0 ? (
                <>
                  {/*
                    The column count climbs with the width, and the number of cards
                    climbs with it, so the products stay level with the reading column
                    beside them instead of running a third of a screen past it.

                    Four cards in two columns, six in three, eight in four — every
                    configuration is two complete rows. Cards beyond the current row
                    count are hidden rather than sliced away, because the slice would
                    have to know the viewport and a ragged final row is what makes a
                    product grid look unfinished.
                  */}
                  <div className="stagger grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-3 2xl:grid-cols-4">
                    {disposables.map((p, i) => (
                      <ProductCard
                        key={p.slug}
                        product={p}
                        compact
                        className={i >= 6 ? 'hidden 2xl:flex' : i >= 4 ? 'hidden xl:flex' : ''}
                      />
                    ))}
                  </div>
                  <a
                    href={url.category('disposable-vapes')}
                    className="mt-5 inline-flex min-h-11 items-center gap-1.5 text-sm text-accent-fg underline decoration-accent/40 underline-offset-4 transition-colors hover:decoration-accent"
                  >
                    Every disposable we carry
                    <span aria-hidden>&rarr;</span>
                  </a>
                </>
              ) : (
                <ul className="stagger grid gap-4 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                  {DISPOSABLE_FAMILIES.map(([name, detail]) => (
                    <li key={name}>
                      <a
                        href={url.category('disposable-vapes')}
                        className="group/family flex h-full flex-col rounded-xl bg-surface-sunken p-6 ring-1 ring-border transition-colors duration-200 hover:ring-primary motion-reduce:transition-none lg:p-8"
                      >
                        <span className="font-display text-2xl leading-tight text-balance text-foreground">{name}</span>
                        <span className="mt-2 max-w-[40ch] text-sm leading-relaxed text-pretty text-foreground-muted">
                          {detail}
                        </span>
                        <span className="mt-auto inline-flex items-center gap-1.5 pt-5 text-sm text-accent-fg underline decoration-accent/40 underline-offset-4 group-hover/family:decoration-accent">
                          Shop disposables
                          <span aria-hidden>&rarr;</span>
                        </span>
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </div>
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
              <h3 className="font-medium text-foreground">Every batch, tested</h3>
              <p className="mt-2 text-sm leading-relaxed text-foreground-muted">
                Every batch is lab-tested before it is offered for sale, disposables
                included. Ask for the certificate covering the code on your package and
                we will send it.
              </p>
              <a href={url.labResults()} className="mt-3 inline-flex min-h-11 items-center text-sm text-primary underline underline-offset-4">
                Request a certificate
              </a>
            </div>
            <div>
              <h3 className="font-medium text-foreground">Every state, cited</h3>
              <p className="mt-2 text-sm leading-relaxed text-foreground-muted">
                We publish the statute behind each position and the date we last reviewed
                it — and our cart enforces the same data, so what you read is what
                happens at checkout.
              </p>
              <a href={url.legalityHub()} className="mt-3 inline-flex min-h-11 items-center text-sm text-primary underline underline-offset-4">
                Legality by state
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
          title="Guides & blogs"
          summary="Informative first. We publish what we can verify and cite what we rely on."
        />
        <div className="stagger grid gap-5 md:grid-cols-3">
          {[...guides, ...posts].slice(0, 3).map((item) => (
            <a
              key={item.slug}
              href={'clusterSlugs' in item ? url.guide(item.slug) : url.blogPost(item.slug)}
              className="card-lift rounded-lg border border-border bg-surface p-5"
            >
              {'clusterSlugs' in item && <Badge tone="accent">Guide</Badge>}
              <h3 className="mt-2 font-display text-lg text-foreground">{item.title}</h3>
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
              Disposables in volume for vape shops, retailers and resellers, and
              botanical materials by the pound, all lab-tested by batch. Tell us what you
              need and we will quote it.
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
