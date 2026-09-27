import { ensureLiveStateRules } from '@/lib/compliance/live-state-rules'
import type { Metadata } from 'next'
import { Suspense } from 'react'
import { catalog } from '@/lib/catalog/repository'
import { getVisitorState } from '@/lib/geo/visitor-state'
import { getAllStateLegality, getStateLegality } from '@/lib/legality/state-pages'
import { publishedLocations } from '@/lib/locations/locations'
import { FAQ_ITEMS } from '@/lib/content/faq'
import { withCompanyEmail } from '@/lib/site/company-email.server'
import { ProductCard } from '@/components/commerce/product-card'
import { FaqList } from '@/components/content/faq-list'
import { FdaDisclaimer } from '@/components/compliance/fda-disclaimer'
import { PageHeader } from '@/components/layout/page-header'
import { PageSection } from '@/components/layout/page-section'
import { ButtonLink } from '@/components/ui/button'
import { BRAND } from '@/lib/brand'
import { absoluteUrl, url } from '@/lib/seo/routes'
import {
  breadcrumbList,
  faqPage,
  jsonLdScript,
  organizationRef,
  type Crumb,
} from '@/lib/seo/structured-data'
import { pageMetadata } from '@/lib/seo/meta'
import { listMergedProducts } from '@/lib/catalog/merged'

/**
 * ─────────────────────────────────────────────────────────────────────────────
 *  "WHAT SHIPS TO YOU" — A UTILITY, WRITTEN TO BE QUOTED.
 *
 *  Two different readers have to be served by the same words.
 *
 *  A PERSON arrives asking one question — can I actually get this where I live —
 *  and wants it answered before anything else is asked of them.
 *
 *  AN ANSWER ENGINE (AI Overviews, ChatGPT, Perplexity, Claude) arrives having
 *  already expanded that into a fan-out of related queries: does this ship to my
 *  state, is there a shop near me, how much is delivery, is it legal here. It does
 *  not extract pages; it extracts PASSAGES. So every section below opens with a
 *  self-contained answer that survives being lifted out of the page with no
 *  surrounding context, and every heading is phrased the way the question is asked.
 *
 *  What this page deliberately does NOT do is chase the literal phrase "near me".
 *  Google resolves it to the searcher's location before ranking, so repeating it is
 *  worthless — and keyword stuffing measurably REDUCES citation rates rather than
 *  raising them. Proximity is earned through real locations and a Google Business
 *  Profile, which is why the storefront question below is answered honestly instead
 *  of being padded out.
 *
 *  Every figure here is computed from the same `state_rules` the cart enforces.
 *  Nothing about coverage is typed by hand, because stored copy written once from
 *  facts that later change is how a site ends up publishing a claim its own data
 *  contradicts.
 * ─────────────────────────────────────────────────────────────────────────────
 */
export const metadata: Metadata = pageMetadata({
  title: 'What Ships to You — Check Your State',
  description:
    'Find out exactly what we can send to your address. Every product, every US state and the District of Columbia, with the legal position for your state and what delivery costs.',
  path: '/shop-near-me',
})

/** Only the shipping questions, and only the ones this page actually renders. */
const SHIPPING_FAQS = FAQ_ITEMS.filter((item) => item.category === 'Shipping')

export default async function ShopNearMePage() {
  const shippingFaqs = await withCompanyEmail(SHIPPING_FAQS)
  await ensureLiveStateRules()
  const states = getAllStateLegality()
  const products = await listMergedProducts()

  /*
    Coverage, counted rather than asserted. `blocked` is the set of jurisdictions
    where at least one line cannot be sent; when it is empty the answer is simply
    "everywhere", and when it is not, the sentence names the exceptions itself.
  */
  const blocked = states.filter((s) =>
    s.verdicts.some((v) => v.rule.status === 'BLOCKED'),
  )
  const shipsEverywhere = blocked.length === 0
  const lastReviewed = states.map((s) => s.lastReviewedAt).sort().at(-1)
  const storefronts = publishedLocations()

  const crumbs: Crumb[] = [{ name: 'What ships to you', path: url.shopNearMe() }]

  const jsonLd = [
    {
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      name: 'What ships to you',
      description: metadata.description,
      url: absoluteUrl(url.shopNearMe()),
      publisher: organizationRef(),
      ...(lastReviewed ? { dateModified: lastReviewed } : {}),
    },
    // Built only from the questions rendered below — never from ones we hide.
    faqPage(shippingFaqs.map((f) => ({ question: f.question, answer: f.answer }))),
    breadcrumbList(crumbs),
  ]

  return (
    <main>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdScript(jsonLd) }}
      />

      <PageSection first>
        <PageHeader
          align="center"
          className="mb-8"
          title="What ships to you"
          summary="One question, answered before we ask you for anything: can we actually send this to your address?"
        />

        {/*
          THE ANSWER, first and unconditional.

          It sits in the static shell rather than behind the Suspense boundary below,
          because a crawler or an answer engine must receive it on the first byte —
          a passage that only exists after a dynamic segment streams in is a passage
          that never gets quoted. Roughly fifty words, which is the length that
          survives extraction intact.
        */}
        <div className="mx-auto max-w-3xl">
          <p className="text-lg leading-relaxed text-pretty text-foreground">
            {shipsEverywhere ? (
              <>
                <strong className="font-medium">Yes — we ship to you.</strong>{' '}
                {/* availability-allow: rendered only when `blocked` is empty, computed from the live rules above. */}
                {BRAND.name} delivers every product in the catalogue to all {states.length}{' '}
                US jurisdictions: all 50 states and the District of Columbia. There are no
                excluded states and no restricted counties. You place the order here, a
                person verifies it, and it ships once payment is confirmed.
              </>
            ) : (
              <>
                <strong className="font-medium">Almost certainly yes.</strong>{' '}
                {BRAND.name} delivers to all {states.length} US jurisdictions, and every
                product reaches all but {blocked.length} of them. The exceptions are{' '}
                {blocked.map((s) => s.name).join(', ')} — where a specific product line is
                barred by that state&rsquo;s own statute, which we cite on its page.
              </>
            )}
          </p>

          {lastReviewed && (
            <p className="mt-3 text-sm text-foreground-subtle">
              Coverage last reviewed{' '}
              <time dateTime={lastReviewed}>{formatDate(lastReviewed)}</time>. We publish
              the statute behind every state position rather than summarising it.
            </p>
          )}
        </div>

        {/* The visitor-specific half. Dynamic, so it streams in under the answer above. */}
        <Suspense fallback={<YourAreaSkeleton />}>
          <YourArea />
        </Suspense>
      </PageSection>

      <PageSection tone="sunken" labelledBy="what-you-can-order">
        <section aria-labelledby="what-you-can-order">
          <h2
            id="what-you-can-order"
            className="font-display text-2xl text-foreground"
          >
            What you can order
          </h2>
          <p className="mt-2 max-w-[70ch] leading-relaxed text-foreground-muted">
            {products.length} products across {catalog.listCategories().length} lines, all
            of them available nationwide. The laboratory report for the batch you receive
            is on file, and we send a certified copy to verified buyers who ask.
          </p>
          <div className="mt-6 grid grid-cols-2 gap-3 sm:gap-5 md:grid-cols-3 xl:grid-cols-4">
            {products.slice(0, 8).map((p) => (
              <ProductCard key={p.slug} product={p} compact />
            ))}
          </div>
          <p className="mt-6">
            <ButtonLink href={url.shop()} variant="secondary">
              See the full catalogue
            </ButtonLink>
          </p>
        </section>
      </PageSection>

      <PageSection labelledBy="store-near-me">
        {/*
          The proximity question, answered straight.

          This is the section a "near me" search is really asking for, and the honest
          answer is worth more than an invented one: a page claiming a local presence
          that does not exist is the doorway pattern search engines penalise, and it is
          a misrepresentation to a customer besides. When a real storefront is published
          this section changes by itself.
        */}
        <section aria-labelledby="store-near-me">
          <h2 id="store-near-me" className="font-display text-2xl text-foreground">
            Is there a store near me?
          </h2>
          {storefronts.length === 0 ? (
            <p className="mt-2 max-w-[70ch] leading-relaxed text-foreground-muted">
              Not yet — we have no public storefront, and we would rather say so than list
              an address that is really a mailbox. Everything is shipped from our
              fulfilment centre to your door, anywhere in the United States, so there is
              nothing you would gain by living closer to us.
            </p>
          ) : (
            <>
              <p className="mt-2 max-w-[70ch] leading-relaxed text-foreground-muted">
                Yes — {storefronts.length} location
                {storefronts.length === 1 ? '' : 's'}, listed with the same address, phone
                number and hours as our Google Business Profile.
              </p>
              <ul className="mt-4 flex flex-wrap gap-x-6 gap-y-2">
                {storefronts.map((l) => (
                  <li key={l.slug}>
                    <a
                      href={url.location(l.slug)}
                      className="inline-flex min-h-11 items-center text-primary underline underline-offset-4"
                    >
                      {l.city}, {l.stateCode}
                    </a>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
      </PageSection>

      <PageSection tone="sunken" labelledBy="shipping-questions">
        <section aria-labelledby="shipping-questions">
          <h2
            id="shipping-questions"
            className="font-display text-2xl text-foreground"
          >
            Delivery, answered
          </h2>
          <p className="mt-2 max-w-[70ch] leading-relaxed text-foreground-muted">
            The same answers we give by email, in the order people ask them.
          </p>
          {/*
            The single FAQ source the rest of the site uses. Sharing it is what keeps the
            structured data above truthful: the schema is generated from these exact
            items, so an answer cannot be marked up here and quietly edited elsewhere.
          */}
          <FaqList
            className="mt-6"
            items={shippingFaqs}
            idFor={(q) => `faq-${slugify(q)}`}
          />
          <p className="mt-6">
            <a
              href={url.faq()}
              className="inline-flex min-h-11 items-center text-primary underline underline-offset-4"
            >
              All {FAQ_ITEMS.length} questions
            </a>
          </p>
        </section>
        <FdaDisclaimer className="mt-14" />
      </PageSection>
    </main>
  )
}

/**
 * What we know about this particular visitor.
 *
 * Dynamic — it reads a cookie and the edge geolocation headers — so it must live
 * behind its own Suspense boundary or it would make the whole route dynamic and
 * cost the page its prerendered shell.
 */
async function YourArea() {
  const stateCode = await getVisitorState()

  if (!stateCode) {
    return (
      <section
        aria-labelledby="your-area"
        className="mx-auto mt-10 max-w-3xl rounded-lg border border-border bg-surface p-6"
      >
        <h2 id="your-area" className="font-display text-xl text-foreground">
          Want it confirmed for your own state?
        </h2>
        <p className="mt-2 leading-relaxed text-foreground-muted">
          Pick yours and we will show the legal position with the statute behind it, and
          the review date, rather than a badge that says &ldquo;compliant&rdquo;.
        </p>
        <div className="mt-5">
          <ButtonLink href={url.legalityHub()} variant="primary">
            Choose your state
          </ButtonLink>
        </div>
      </section>
    )
  }

  await ensureLiveStateRules()
  const legality = getStateLegality(stateCode)
  const available = await listMergedProducts({ shipsTo: stateCode })

  return (
    <section
      aria-labelledby="your-area"
      className="mx-auto mt-10 max-w-3xl rounded-lg border border-border bg-surface p-6"
    >
      <h2 id="your-area" className="font-display text-xl text-foreground">
        Shipping to {legality.name}
      </h2>
      <p className="mt-2 leading-relaxed text-foreground-muted">{legality.answerFirst}</p>
      <p className="mt-4 text-sm text-foreground">
        <span className="font-medium">
          {available.length} product{available.length === 1 ? '' : 's'}
        </span>{' '}
        can be sent to {legality.name} today.
      </p>
      <div className="mt-5 flex flex-wrap gap-x-6 gap-y-2">
        <a
          href={url.legalityState(legality.slug)}
          className="inline-flex min-h-11 items-center text-primary underline underline-offset-4"
        >
          The legal position for {legality.name}
        </a>
        <a
          href={url.legalityHub()}
          className="inline-flex min-h-11 items-center text-foreground-muted underline underline-offset-4"
        >
          Not your state?
        </a>
      </div>
    </section>
  )
}

function YourAreaSkeleton() {
  return (
    <div
      aria-hidden
      className="mx-auto mt-10 h-52 max-w-3xl animate-pulse rounded-lg bg-surface"
    />
  )
}

function slugify(question: string): string {
  return question
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60)
}

function formatDate(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  })
}
