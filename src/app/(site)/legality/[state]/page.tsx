/*
 * compliance-allow: psilocybin -- searchers conflate Amanita muscaria with psilocybin
 * constantly, and correcting that is one of the most useful things this page does.
 * The rule exists to stop us implying our products ARE psilocybin; this section says
 * the exact opposite, and naming the substance is unavoidable when drawing the
 * distinction.
 */
import { ensureLiveStateRules } from '@/lib/compliance/live-state-rules'
import type { Metadata } from 'next'
import { AnswerFirst } from '@/components/content/answer-first'
import { notFound } from 'next/navigation'
import { JURISDICTIONS, getJurisdictionBySlug } from '@/lib/compliance/jurisdictions'
import {
  LINE_LABEL,
  NEIGHBOURS,
  neighbourContext,
  getStateLegality,
} from '@/lib/legality/state-pages'
import { FEDERAL_HEMP_BAN } from '@/lib/legality/state-profiles'
import { listMergedProducts } from '@/lib/catalog/merged'
import { listPrice, type Product } from '@/lib/catalog/types'
import type { UsJurisdictionCode } from '@/lib/compliance/types'
import { ProductCard } from '@/components/commerce/product-card'
import { FdaDisclaimer } from '@/components/compliance/fda-disclaimer'
import { PageSection } from '@/components/layout/page-section'
import { Badge } from '@/components/ui/badge'
import { AlertIcon, CheckIcon, CrossIcon, InfoIcon, TruckIcon } from '@/components/ui/icon'
import { BRAND } from '@/lib/brand'
import { absoluteUrl, url } from '@/lib/seo/routes'
import { effectiveMinAge } from '@/lib/compliance/shipping'
import { getStateShipping, stateSearchMeta } from '@/lib/legality/state-shipping'
import { jsonLdScript, organizationRef } from '@/lib/seo/structured-data'
import { pageMetadata } from '@/lib/seo/meta'

export async function generateStaticParams() {
  return JURISDICTIONS.map((j) => ({ state: j.slug }))
}

/**
 * The root bark that ships to a state, from the LIVE catalogue — the listings a buyer
 * can actually order. This page used to read the authored sample catalogue, which has
 * no root bark in it, so its "Available to order" block never rendered and a page
 * found by someone looking to buy offered them nothing to buy.
 */
async function barkFor(code: UsJurisdictionCode): Promise<readonly Product[]> {
  return listMergedProducts({ productLine: 'MIMOSA_HOSTILIS', shipsTo: code }).catch(() => [])
}

/** Lowest per-pound price among them, for the search snippet. */
function fromPoundCents(products: readonly Product[]): number | undefined {
  const perPound = products.map(listPrice).filter((p) => p.per === 'lb' && p.cents > 0)
  return perPound.length ? Math.min(...perPound.map((p) => p.cents)) : undefined
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ state: string }>
}): Promise<Metadata> {
  const { state: slug } = await params
  const jurisdiction = getJurisdictionBySlug(slug)
  if (!jurisdiction) return {}
  await ensureLiveStateRules()
  const legality = getStateLegality(jurisdiction.code)
  const shipping = getStateShipping(legality)
  const bark = await barkFor(jurisdiction.code)

  return {
    // `.slice(0, 300)` cut mid-word at nearly twice the length Google renders. The
    // answer-first block stays whole on the page; only the snippet is clamped.
    ...pageMetadata({
      // Written to the question people type about a state; see stateSearchMeta.
      ...stateSearchMeta(shipping, legality.reviewYear, fromPoundCents(bark)),
      path: url.legalityState(slug),
      type: 'article',
      modifiedTime: legality.lastReviewedAt,
    }),
    // An unpublished page is one without a reviewed statute. It must never be
    // crawlable — a legality claim we cannot stand behind is worse than no page.
    robots: legality.isPublishable
      ? { index: true, follow: true }
      : { index: false, follow: true },
  }
}

function VerdictIcon({ status }: { status: string }) {
  if (status === 'BLOCKED') return <CrossIcon className="size-5" />
  if (status === 'RESTRICTED') return <AlertIcon className="size-5" />
  return <CheckIcon className="size-5" />
}

async function StateBody({ slug }: { slug: string }) {
  const jurisdiction = getJurisdictionBySlug(slug)
  if (!jurisdiction) notFound()

  await ensureLiveStateRules()
  const legality = getStateLegality(jurisdiction.code)
  const shipping = getStateShipping(legality)

  const bark = await barkFor(jurisdiction.code)
  const searchMeta = stateSearchMeta(shipping, legality.reviewYear, fromPoundCents(bark))

  /*
   * Delivery questions first, then the per-line verdicts. "Do you ship to my state"
   * is the question this page is found for; answering it in the structured data is
   * what earns the citation in an AI answer rather than only the legal position.
   */
  const faq = [
    {
      question: `Do you ship to ${jurisdiction.name}?`,
      answer: `${shipping.summary} ${shipping.detail}`,
    },
    ...legality.verdicts.map((v) => ({
      question: `Can I buy ${LINE_LABEL[v.productLine]} in ${jurisdiction.name}?`,
      answer: `${v.headline}. ${v.detail}`,
    })),
  ]

  const jsonLd = [
    {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: faq.map((f) => ({
        '@type': 'Question',
        name: f.question,
        acceptedAnswer: { '@type': 'Answer', text: f.answer },
      })),
    },
    {
      '@context': 'https://schema.org',
      '@type': 'Article',
      headline: searchMeta.title,
      description: searchMeta.description,
      dateModified: legality.lastReviewedAt,
      author: organizationRef(),
      publisher: { '@type': 'Organization', name: BRAND.name },
      mainEntityOfPage: absoluteUrl(url.legalityState(slug)),
    },
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Where we ship', item: absoluteUrl(url.legalityHub()) },
        { '@type': 'ListItem', position: 2, name: jurisdiction.name, item: absoluteUrl(url.legalityState(slug)) },
      ],
    },
  ]

  const neighbours = NEIGHBOURS[jurisdiction.code] ?? []
  const borders = neighbourContext(jurisdiction.code)

  return (
    <>
      <PageSection first>
    {/*
      Reading column plus a rail carrying the neighbouring states.
      "Is it legal in the state next door?" is the question this page reliably
      produces, and answering it in the margin keeps the verdict itself unbroken.
    */}
    <div
      className={
        /*
          Only reserve the rail column when there is something to put in it.
          Hawaii and Alaska border nothing, so an unconditional two-column grid left
          304px of empty page down their right edge — the exact gap this layout was
          meant to close.
        */
        neighbours.length > 0
          ? 'grid gap-10 lg:grid-cols-[minmax(0,1fr)_19rem] lg:gap-14'
          : 'grid gap-10'
      }
    >
      {/* jsonLdScript escapes `<`, so a statute quotation cannot close the tag. */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdScript(jsonLd) }}
      />
      <div className="min-w-0">

      <nav aria-label="Breadcrumb" className="text-sm text-foreground-muted">
        <a href={url.legalityHub()} className="inline-flex min-h-11 items-center underline underline-offset-4">Where we ship</a>
        <span aria-hidden> / </span>
        <span className="text-foreground">{jurisdiction.name}</span>
      </nav>

      {/*
        Service first, law second.

        This page used to open "Is Amanita muscaria legal in <state>?" — a good match
        for the informational query and a poor one for the person who already wants to
        buy and is only checking we deliver to them. The statutory answer has not gone
        anywhere; it moved below the delivery terms, which is the order a customer
        actually reads in.
      */}
      {/*
        The heading says what the search title says, so the result a buyer clicked and
        the page they land on make the same promise. A state root bark cannot be sent
        to keeps the plain shipping heading.
      */}
      <h1 className="mt-4 font-display text-4xl text-foreground">
        {bark.length > 0
          ? `Buy Mimosa Hostilis Root Bark in ${jurisdiction.name}`
          : `Shipping to ${jurisdiction.name} (${legality.reviewYear})`}
      </h1>

      {/*
        ANSWER-FIRST, and still the block an answer engine extracts. It now leads with
        what we deliver here; `answerFirst` carries the legal verdict directly after,
        so the page can be cited for either question without being read further.
      */}
      <AnswerFirst>
        {shipping.summary} {legality.answerFirst}
      </AnswerFirst>

      {bark.length > 0 && (
        <section className="mt-8" aria-labelledby="order-bark">
          <h2 id="order-bark" className="font-display text-2xl text-foreground">
            Root bark, {legality.reviewYear} prices, delivered to {jurisdiction.name}
          </h2>
          <div className="mt-4 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {bark.map((p) => (
              <ProductCard key={p.slug} product={p} visitorState={jurisdiction.code} />
            ))}
          </div>
          <p className="mt-4 text-sm">
            <a href={url.shop()} className="inline-flex min-h-11 items-center text-primary underline underline-offset-4">
              See everything that ships to {jurisdiction.name}
            </a>
          </p>
        </section>
      )}

      {shipping.isServed && (
        <section className="mt-8" aria-labelledby="delivery-terms">
          <h2 id="delivery-terms" className="font-display text-2xl text-foreground">
            Delivering to {jurisdiction.name}
          </h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {shipping.channels.map((c) => (
              <div key={c.key} className="rounded-lg border border-border bg-surface p-4">
                <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <TruckIcon className="size-4 shrink-0 text-foreground-muted" />
                  {c.label}
                </p>
                {/*
                  No figures on this page — neither transit time nor cost.

                  A delivery window is a commitment made before we know the
                  destination and the carrier, and a price published against a state
                  is a number that has to be kept in step with checkout forever, on
                  fifty-one pages. Both are given to the customer with their order,
                  where they are exact. What belongs here is what this state can
                  receive and how it travels — the question the page is found for.
                */}
                <p className="mt-2 text-sm text-foreground-muted">
                  Carries {c.carries.join(', ')}.
                </p>
                {!c.eligibleForFreeShipping && (
                  <p className="mt-2 text-sm text-foreground-muted">
                    Ships on its own and is never eligible for free shipping.
                  </p>
                )}
              </div>
            ))}
          </div>
          <p className="mt-4 leading-relaxed text-foreground-muted">{shipping.detail}</p>
        </section>
      )}

      <p className="mt-4 flex flex-wrap items-center gap-3 text-sm text-foreground-muted">
        <span>
          Last reviewed{' '}
          <time dateTime={legality.lastReviewedAt}>
            {new Date(legality.lastReviewedAt).toLocaleDateString('en-US', {
              year: 'numeric', month: 'long', day: 'numeric',
            })}
          </time>
        </span>
        {legality.hasPendingLegislation && (
          <Badge tone="info" icon={<InfoIcon className="size-3.5" />}>
            Legislation pending
          </Badge>
        )}
      </p>

      {!legality.isPublishable && (
        <div className="mt-6 rounded-lg bg-warning-bg p-4 text-warning-fg">
          <p className="text-sm font-semibold">
            This page is not yet published for search.
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
            {legality.publishBlockers.map((b) => (
              <li key={b}>{b}</li>
            ))}
          </ul>
          <p className="mt-2 text-xs opacity-90">
            Visible to you, excluded from the index and the sitemap until resolved.
          </p>
        </div>
      )}

      <section className="mt-10">
        <h2 className="font-display text-2xl text-foreground">
          What we can ship to {jurisdiction.name}
        </h2>
        <div className="mt-4 space-y-4">
          {legality.verdicts.map((v) => {
            /*
              BLOCKED is neutral, not red — see the note in state-availability.tsx.
              A state saying no is a fact this page exists to report, not a fault, and
              a wall of red on a page someone opened to get an answer reads as though
              the site is broken. The verdict, the reason and the statute all still
              publish; only the alarm colour is gone.
            */
            const tone =
              v.rule.status === 'BLOCKED'
                ? 'border border-border bg-surface-sunken text-foreground'
                : v.rule.status === 'RESTRICTED'
                  ? 'bg-warning-bg text-warning-fg'
                  : 'bg-success-bg text-success-fg'
            return (
              <article key={v.productLine} className={`rounded-lg p-4 ${tone}`}>
                <div className="flex gap-3">
                  <VerdictIcon status={v.rule.status} />
                  <div className="min-w-0">
                    <h3 className="font-semibold">
                      {LINE_LABEL[v.productLine]} — {v.headline}
                    </h3>
                    <p className="mt-1 text-sm leading-relaxed opacity-90">{v.detail}</p>

                    {v.rule.statuteCitation && (
                      <p className="mt-2 text-sm">
                        <span className="font-medium">Authority:</span>{' '}
                        {v.rule.statuteUrl ? (
                          <a
                            href={v.rule.statuteUrl}
                            className="inline-flex min-h-11 items-center underline underline-offset-4"
                            rel="noopener"
                          >
                            {v.rule.statuteCitation}
                          </a>
                        ) : (
                          v.rule.statuteCitation
                        )}
                      </p>
                    )}

                    <dl className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-xs opacity-90">
                      <div className="flex gap-1">
                        <dt>Minimum age:</dt>
                        <dd className="tabular font-medium">{effectiveMinAge(v.rule.minAge)}</dd>
                      </div>
                      {v.rule.requiresProductDirectory && (
                        <div className="flex gap-1">
                          <dt>Restriction:</dt>
                          <dd className="font-medium">State product directory applies</dd>
                        </div>
                      )}
                    </dl>
                  </div>
                </div>
              </article>
            )
          })}
        </div>
      </section>

      <section className="mt-12">
        <h2 className="font-display text-2xl text-foreground">
          Ordering from {jurisdiction.name}
        </h2>
        <p className="mt-3 leading-relaxed text-foreground-muted">
          {legality.orderingGuidance}
        </p>
      </section>

      <section className="mt-12">
        <h2 className="font-display text-2xl text-foreground">
          Regulatory context in {jurisdiction.name}
        </h2>

        <h3 className="mt-5 font-medium text-foreground">
          Where {jurisdiction.name} stands on intoxicating hemp products
        </h3>
        <p className="mt-2 leading-relaxed text-foreground-muted">
          {legality.profile.hempNote}
        </p>

        <h3 className="mt-5 font-medium text-foreground">
          Psilocybin is a different substance
        </h3>
        <p className="mt-2 leading-relaxed text-foreground-muted">
          {legality.profile.psilocybinNote}
        </p>

        {/*
          HOW THIS STATE COMPARES TO THE ONES AROUND IT.

          "Is it the same next door?" is the question a state page reliably
          produces — usually from someone deciding which address to have an order
          sent to — and the answer used to be a rail of links they had to open one
          at a time.

          It is also the only paragraph here whose CONTENT differs because the
          country differs rather than because a template was handed a different
          noun, which is the whole argument for these pages existing as separate
          URLs. Everything in it is computed from the border map and the published
          hemp posture of each neighbour; nothing is asserted.
        */}
        {borders && (
          <>
            <h3 className="mt-5 font-medium text-foreground">
              How {jurisdiction.name} compares to the states around it
            </h3>
            <p className="mt-2 leading-relaxed text-pretty text-foreground-muted">
              {borders.sentence}
            </p>
          </>
        )}

        {/*
          Hand-written substance for this state, when there is any.

          Rendered only when the profile carries it, and nothing is generated to
          fill the gap: a state with no checked sourcing shows no section rather
          than a paragraph of padding that says what the thirteen shared defaults
          already said.
        */}
        {legality.profile.notes?.length ? (
          <>
            <h3 className="mt-5 font-medium text-foreground">
              Specific to {jurisdiction.name}
            </h3>
            {legality.profile.notes.map((note) => (
              <p
                key={note}
                className="mt-2 leading-relaxed text-pretty text-foreground-muted"
              >
                {note}
              </p>
            ))}
          </>
        ) : null}
      </section>

      {/*
        The federal hemp amendment is on every state page because it reshapes what a
        reader will find for sale nationally after 12 November 2026 — and because
        stating plainly that it does NOT reach these products is more useful, and more
        defensible, than staying silent and letting them assume either way.
      */}
      <section className="mt-12 rounded-lg border border-border bg-surface-sunken p-5">
        <h2 className="font-display text-xl text-foreground">
          What changes nationally on 12 November 2026
        </h2>
        <p className="mt-2 leading-relaxed text-foreground-muted">
          {FEDERAL_HEMP_BAN.summary}
        </p>
        <p className="mt-3 leading-relaxed text-foreground">
          {FEDERAL_HEMP_BAN.appliesToUs}
        </p>
        <p className="mt-3 text-xs text-foreground-subtle">
          {FEDERAL_HEMP_BAN.statute} · signed{' '}
          {new Date(FEDERAL_HEMP_BAN.signedAt).toLocaleDateString('en-US', {
            year: 'numeric', month: 'long', day: 'numeric',
          })}
          {' · '}
          <a href={FEDERAL_HEMP_BAN.sourceUrl} rel="noopener nofollow" className="inline-flex min-h-11 items-center underline underline-offset-4">
            analysis
          </a>
        </p>
      </section>


      <section className="mt-12">
        <h2 className="font-display text-2xl text-foreground">
          Questions about {jurisdiction.name}
        </h2>
        <dl className="mt-4 divide-y divide-[var(--border)] rounded-lg border border-border bg-surface">
          {faq.map((f) => (
            <div key={f.question} className="p-4">
              <dt className="font-medium text-foreground">{f.question}</dt>
              <dd className="mt-1 text-sm leading-relaxed text-foreground-muted">{f.answer}</dd>
            </div>
          ))}
        </dl>
      </section>

      </div>

      {neighbours.length > 0 && (
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <nav aria-label="Neighbouring states" className="rounded-lg border border-border bg-surface-sunken p-5">
            <h2 className="text-xs font-medium tracking-[0.2em] text-foreground-subtle uppercase">
              Neighbouring states
            </h2>
            <ul className="mt-3 flex flex-wrap gap-2 lg:flex-col">
              {neighbours.map((code) => {
                const n = JURISDICTIONS.find((j) => j.code === code)
                if (!n) return null
                return (
                  <li key={code}>
                    <a
                      href={url.legalityState(n.slug)}
                      className="inline-flex min-h-11 items-center text-sm text-foreground-muted underline-offset-4 hover:text-foreground hover:underline"
                    >
                      {n.name}
                    </a>
                  </li>
                )
              })}
            </ul>
          </nav>
        </aside>
      )}

      <div className="min-w-0 xl:col-start-1">
      <div className="mt-12 rounded-lg border border-border bg-surface-sunken p-4">
        <p className="text-xs leading-relaxed text-foreground-muted">
          This page summarises our own shipping policy and the statutes we relied on to
          set it. It is not legal advice. Laws change; we review these positions and
          publish the date of the last review above.
        </p>
      </div>

      </div>
    </div>
      </PageSection>

      <PageSection tone="sunken">
        <FdaDisclaimer className="mt-6" />
      </PageSection>
    </>
  )
}

/**
 * NO SUSPENSE BOUNDARY HERE, and that is deliberate.
 *
 * `StateBody` reads nothing per-visitor — no cookies, no headers. Everything on it
 * derives from the route param and the state-rules data, and all 51 jurisdictions are
 * enumerated in `generateStaticParams`, so the whole page prerenders.
 *
 * It used to be wrapped in Suspense anyway. Under PPR that splits the response into a
 * static shell plus a streamed chunk, and the shell carries the header and footer —
 * so in the raw bytes a crawler receives, the FOOTER arrived at 5% of the document
 * and the <h1> and the answer-first verdict did not appear until 14%. Bing's
 * guidance is explicit that essential information belongs near the top of the URL,
 * and these pages exist to be grounded and cited. Boilerplate should not precede the
 * answer.
 *
 * Awaiting params here instead puts the whole page in document order. Add a Suspense
 * boundary back only around something genuinely per-visitor.
 */
export default async function StateLegalityPage({
  params,
}: {
  params: Promise<{ state: string }>
}) {
  const { state } = await params
  return (
    <main>
      <StateBody slug={state} />
    </main>
  )
}
