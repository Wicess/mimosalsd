import { getGuide, getPost } from '@/lib/content/content.data'
import { getRulesForLine } from '@/lib/compliance/state-rules'
import { ensureLiveStateRules } from '@/lib/compliance/live-state-rules'
import { JURISDICTIONS } from '@/lib/compliance/jurisdictions'
import type { ProductLine } from '@/lib/compliance/types'
import type { CategoryAbout, CategoryFact } from '@/lib/catalog/types'
import { url } from '@/lib/seo/routes'

/**
 * ─────────────────────────────────────────────────────────────────────────────
 *  THE ABOUT BAND on a category page.
 *
 *  It replaced one 40-word paragraph pinned to a `max-w-[70ch]` on the left of an
 *  otherwise empty band. The paragraph was not wrong, it was just the shape a page
 *  takes when nobody has decided what the page is for: on a 1920px display it left
 *  two thirds of a tinted band holding nothing, and it gave an answer engine one
 *  undifferentiated block to guess at.
 *
 *  ── Why the width is spent this way ────────────────────────────────────────
 *  "Use the whole screen" and "keep a readable line" are in direct conflict, and
 *  the wrong resolution — stretching the paragraph to the viewport — produces
 *  140-character lines that nobody finishes. So the BAND spans the screen and the
 *  PROSE does not: seven columns of reading, four columns of spec sheet, and a real
 *  gutter between them. The second column is what earns the width, and it is not
 *  decoration — it is the part that gets lifted.
 *
 *  ── Why a bare `<dl>` and not a panel ──────────────────────────────────────
 *  The band is already tinted. A bordered, rounded card inside it is a box inside a
 *  box, which `guides-strip.tsx` ran into and backed out of for the same reason.
 *  Hairlines between rows do the separating, the tone change does the framing, and
 *  nothing is drawn twice.
 *
 *  ── What this is doing for an answer engine ────────────────────────────────
 *  Every acquisition channel here is organic and a growing share of it is a machine
 *  reading the page on someone's behalf, so the shape is the strategy:
 *
 *   · the lede is a definition that survives being quoted with no page around it
 *   · each `<h3>` is the question as a person types it, not a marketing label
 *   · each answer reaches its verdict in the first sentence
 *   · the spec sheet is a real `<dl>` — the most liftable structure in HTML, and
 *     the one an accessibility tree and an agent both read without guessing
 *   · a review date is on the page, because undated claims lose to dated ones
 *
 *  ── The rule that shapes it most ───────────────────────────────────────────
 *  NOTHING about state availability, minimum age or review dates is authored in
 *  the catalogue. All three are derived below from the same `state_rules` rows the
 *  cart enforces (CLAUDE.md rule 1). Authored copy is written once from facts that
 *  later change and nobody re-reads it — which is precisely how a site ends up
 *  insisting on a restriction its own database dropped months ago. Derived copy
 *  cannot do that: change the row and this paragraph changes with it.
 * ─────────────────────────────────────────────────────────────────────────────
 */

/**
 * Resolve a content slug without the caller having to know what it is.
 *
 * `what-is-muscimol` is a post and `amanita-muscaria-explained` is a guide, and
 * which is which is an editorial decision that has already moved once. A hardcoded
 * `/guides/…` in the catalogue would 404 the day it moves again, and the sitemap
 * would keep submitting it. Unresolvable slugs return null and the link simply is
 * not rendered — `lib/seo/routes.ts` learned that rule the expensive way.
 */
function resolveContentLink(slug: string): { href: string; title: string } | null {
  const guide = getGuide(slug)
  if (guide?.isPublished) return { href: url.guide(slug), title: guide.title }
  const post = getPost(slug)
  if (post?.isPublished) return { href: url.blogPost(slug), title: post.title }
  return null
}

const DATE_FORMAT = new Intl.DateTimeFormat('en-US', {
  year: 'numeric',
  month: 'long',
  day: 'numeric',
  timeZone: 'UTC',
})

function formatReviewDate(iso: string): string {
  const parsed = new Date(`${iso}T00:00:00Z`)
  return Number.isNaN(parsed.getTime()) ? iso : DATE_FORMAT.format(parsed)
}

/**
 * The three facts that must never be authored by hand, read from the rules table.
 *
 * Returns null rather than inventing a fallback when the table has nothing for this
 * line. A spec sheet that quietly says "ships to 0 jurisdictions" because a query
 * came back empty is worse than a spec sheet with three fewer rows.
 */
function derivedFacts(
  productLine: ProductLine,
): { facts: CategoryFact[]; reviewedAt: string | null } {
  const rules = getRulesForLine(productLine)
  if (rules.length === 0) return { facts: [], reviewedAt: null }

  const shippable = rules.filter((rule) => rule.status !== 'BLOCKED')
  const total = JURISDICTIONS.length
  // 51 jurisdictions is 50 states PLUS the District of Columbia, and saying "all 51
  // states" is the kind of small wrong number that costs a reader their confidence in
  // every other number on the page. Counted, not hardcoded, so it survives the list
  // changing.
  const states = JURISDICTIONS.filter((j) => j.code !== 'DC').length
  const minAge = Math.max(...rules.map((rule) => rule.minAge))
  // The OLDEST review date, not the newest. "Reviewed September" has to mean every
  // position was, or the date is doing reassurance rather than reporting.
  const reviewedAt = rules
    .map((rule) => rule.lastReviewedAt)
    .reduce((oldest, date) => (date < oldest ? date : oldest))

  const availability =
    shippable.length === total
      ? `All ${states} US states and DC`
      : `${shippable.length} of ${total} US jurisdictions`

  return {
    facts: [
      { label: 'Where it ships', value: availability },
      { label: 'Minimum age', value: `${minAge} or over` },
    ],
    reviewedAt,
  }
}

/** One row of the spec sheet. Stacks on a phone, two columns from `sm` up. */
function FactRow({ fact }: { fact: CategoryFact }) {
  return (
    <div className="flex flex-col gap-1 py-3 sm:grid sm:grid-cols-[minmax(0,15ch)_1fr] sm:gap-4">
      <dt className="text-xs leading-relaxed text-foreground-muted">{fact.label}</dt>
      <dd className="text-sm leading-relaxed text-pretty text-foreground">{fact.value}</dd>
    </div>
  )
}

/**
 * Where to go next.
 *
 * Three destinations rather than three more articles: `GuidesStrip` sits directly
 * below this band and is already three article cards, and a second grid of cards
 * saying almost the same thing is how a page starts repeating itself. These are the
 * three things a reader who is not ready to add to cart actually wants — is it
 * available here, is the testing real, and how does paying work — and each one is a
 * commercial page linking to a page that needs the link.
 */
const NEXT_STEPS: readonly { href: string; label: string; detail: string }[] = [
  {
    href: url.legalityHub(),
    label: 'Check your state',
    detail: 'Every position with the statute behind it and the date it was reviewed.',
  },
  {
    href: url.labResults(),
    label: 'Request a certificate',
    detail: 'The laboratory report for the batch code on your package, sent on request.',
  },
  {
    href: url.faq(),
    label: 'How ordering works',
    detail: 'Why nothing is paid for on this site, and what happens after you submit.',
  },
]

export async function CategoryAboutBand({
  about,
  productLine,
}: {
  about: CategoryAbout
  productLine: ProductLine
}) {
  /*
    Loaded before `derivedFacts` reads the rules. Without it this band read the SEED
    rules while the cart enforced the ADMIN's — so the day an operator changed a
    state's position, "Where it ships" here would have kept saying the old thing
    while checkout said the new one. That is the exact drift this band derives its
    facts to avoid, and the same gap f25bbfe closed for the cart and legality pages.
  */
  await ensureLiveStateRules()
  const { facts: derived, reviewedAt } = derivedFacts(productLine)
  const facts = [...about.facts, ...derived]

  return (
    <div>
      <div className="grid gap-x-12 gap-y-12 lg:grid-cols-12">
        {/* ── Reading column ──────────────────────────────────────────────── */}
        <div className="lg:col-span-7">
          <h2
            id="category-about"
            className="font-display text-3xl leading-tight text-balance text-foreground"
          >
            {about.heading}
          </h2>
          <div aria-hidden className="mt-4 h-0.5 w-10 rounded-full bg-accent" />

          {/*
            The lede is set larger than the blocks below it and in the foreground
            colour rather than the muted one. It is the sentence most likely to be
            quoted back at someone who never reaches this page, so it is also the
            sentence that should be legible from across a desk.
          */}
          <p className="mt-6 max-w-[68ch] text-lg leading-relaxed text-pretty text-foreground">
            {about.lede}
          </p>

          <div className="mt-10 space-y-9">
            {about.blocks.map((block) => {
              const link = block.linkSlug ? resolveContentLink(block.linkSlug) : null
              return (
                <div key={block.question}>
                  <h3 className="font-product text-base leading-snug font-semibold tracking-[-0.01em] text-balance text-foreground">
                    {block.question}
                  </h3>
                  <p className="mt-2 max-w-[68ch] leading-relaxed text-pretty text-foreground-muted">
                    {block.answer}
                  </p>
                  {link && (
                    <a
                      href={link.href}
                      /*
                        A real underlined link, not a button and not a bare arrow.
                        `min-h-11` keeps the tap target at the 44px floor without
                        padding the text away from the paragraph it belongs to.
                      */
                      className="mt-2 inline-flex min-h-11 items-center gap-1.5 text-sm text-accent-fg underline decoration-accent/40 underline-offset-4 transition-colors hover:decoration-accent"
                    >
                      {link.title}
                      <span aria-hidden>&rarr;</span>
                    </a>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* ── Spec sheet ──────────────────────────────────────────────────── */}
        <aside className="lg:col-span-4 lg:col-start-9">
          {/*
            Sticky only where there is height to be sticky against. On a phone this
            is simply the next thing down the page.
          */}
          <div className="lg:sticky lg:top-28">
            <h3
              id="category-about-facts"
              className="font-product text-sm font-semibold tracking-[-0.01em] text-foreground"
            >
              At a glance
            </h3>
            <dl
              aria-labelledby="category-about-facts"
              className="mt-4 divide-y divide-border border-t border-border"
            >
              {facts.map((fact) => (
                <FactRow key={fact.label} fact={fact} />
              ))}
            </dl>

            {reviewedAt && (
              <p className="mt-5 text-xs leading-relaxed text-foreground-muted">
                Availability and age positions last reviewed{' '}
                <time dateTime={reviewedAt}>{formatReviewDate(reviewedAt)}</time>. They
                are read from the same records the cart checks at checkout.
              </p>
            )}
          </div>
        </aside>
      </div>

      {/* ── Where to go next ──────────────────────────────────────────────── */}
      <nav
        aria-label="Related pages"
        className="mt-14 grid gap-x-12 gap-y-6 border-t border-border pt-8 sm:grid-cols-2 lg:grid-cols-3"
      >
        {NEXT_STEPS.map((step) => (
          <a key={step.href} href={step.href} className="group/next block">
            <span className="font-product text-sm font-semibold tracking-[-0.01em] text-foreground underline decoration-transparent underline-offset-4 transition-colors group-hover/next:decoration-accent">
              {step.label}
            </span>
            <span className="mt-1 block max-w-[42ch] text-sm leading-relaxed text-pretty text-foreground-muted">
              {step.detail}
            </span>
          </a>
        ))}
      </nav>
    </div>
  )
}
