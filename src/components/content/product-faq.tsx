/**
 * compliance-allow: psilocybin -- this file selects FAQ entries by their question
 * text, and one of them is "Is Amanita muscaria the same as psilocybin mushrooms?".
 * That question is the single most valuable thing on an Amanita product page:
 * answer engines conflate the two constantly, and the answer is no. Naming the
 * substance we are distinguishing ourselves FROM is the whole point — refusing to
 * would leave the misconception standing, which is the outcome the rule exists to
 * prevent. `src/lib/content/faq.ts` carries the same directive for the same reason.
 */
import { FAQ_ITEMS, type FaqItem } from '@/lib/content/faq'
import { withCompanyEmail } from '@/lib/site/company-email.server'
import { faqPage, jsonLdScript } from '@/lib/seo/structured-data'
import type { ProductLine } from '@/lib/compliance/types'
import { url } from '@/lib/seo/routes'
import { cn } from '@/lib/utils'
import { FaqList } from '@/components/content/faq-list'
import { ButtonLink } from '@/components/ui/button'

/**
 * ─────────────────────────────────────────────────────────────────────────────
 *  PRODUCT FAQ — written for the answer engine as much as for the reader.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Paid advertising is prohibited in this category, so the only way anyone arrives
 * is by being the answer to a question — increasingly a question typed into an AI
 * rather than a search box. A question-and-answer block on a commercial page is
 * the most liftable content shape there is, and it is the shape that gets quoted
 * back with attribution.
 *
 * Three rules hold it honest, and each one is enforced by construction:
 *
 *  1. THE MARKUP IS BUILT FROM WHAT RENDERS. `faqPage()` is handed the same array
 *     the list below maps over, so the FAQPage schema cannot describe an answer a
 *     visitor is unable to read. Marking up unrendered answers is a documented
 *     cause of manual actions, and this site cannot afford one.
 *  2. ANSWERS LEAD WITH THE ANSWER. That is a rule of `faq.ts` itself; an answer
 *     that reaches its verdict in sentence four does not get cited.
 *  3. QUESTIONS ARE SELECTED BY WHAT THE PRODUCT IS. A vape page answers the PACT
 *     Act carrier question; a root-bark page answers what the material is for.
 *     Repeating all nineteen on every page would be the same block nineteen times
 *     over, which is duplication at scale — the thing Bing names directly.
 *
 * Rendered as real `<details>`. Open by default so the text is in the document for
 * a crawler and for anyone who lands mid-page, collapsible so the block does not
 * push the rest of the page down for someone who already knows.
 */

/**
 * Questions every page answers, in priority order.
 *
 * "Do you ship to my state" first: in this category it is the question that
 * decides whether anything else matters.
 */
const UNIVERSAL = [
  'Do you ship to my state?',
  'Why can I not pay on your website?',
  'How old do I have to be to order?',
] as const

/** The question that only this product line raises. */
const BY_LINE: Record<ProductLine, readonly string[]> = {
  MIMOSA_HOSTILIS: [
    'What is Mimosa hostilis root bark used for?',
    'Should I buy powder, shredded or whole root bark?',
    'How much Mimosa hostilis do I need to dye a pound of wool?',
    'Do you offer bulk or wholesale pricing?',
  ],
  AMANITA: [
    'Is Amanita muscaria the same as psilocybin mushrooms?',
    'Is Amanita muscaria legal in the United States?',
  ],
  VAPE: ['Will my order arrive discreetly?'],
}

/** A category that follows a line's rules without being its product asks its own questions. */
const BY_CATEGORY: Record<string, readonly string[]> = {
  others: ['Will my order arrive discreetly?'],
}

function select(productLine?: ProductLine, categorySlug?: string): readonly FaqItem[] {
  const own = categorySlug ? BY_CATEGORY[categorySlug] : undefined
  const wanted = own
    ? [...own, ...UNIVERSAL]
    : productLine
    ? [...BY_LINE[productLine], ...UNIVERSAL]
    : [...UNIVERSAL, 'What is Mimosa hostilis root bark used for?', 'How much is delivery?']

  /*
    Ordered by the WANTED list, not by the order they happen to sit in `faq.ts`.
    The line-specific questions lead, because a reader on a vape page has already
    decided they want a vape and is now asking how it reaches them.
  */
  return wanted
    .map((q) => FAQ_ITEMS.find((item) => item.question === q))
    .filter((item): item is FaqItem => Boolean(item))
}

export async function ProductFaq({
  productLine,
  categorySlug,
  heading = 'Questions people ask',
  className,
  productQuestions = [],
}: {
  productLine?: ProductLine
  /** The product's category, for a category with its own questions. */
  categorySlug?: string
  heading?: string
  className?: string
  /** Questions written for this product, asked first. Links are reduced to their words. */
  productQuestions?: readonly { readonly question: string; readonly answer: string }[]
}) {
  const own: FaqItem[] = productQuestions.map((q) => ({
    question: q.question,
    answer: q.answer.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1'),
    category: 'Root bark',
  }))
  const shared = await withCompanyEmail(select(productLine, categorySlug))
  const items = [...own, ...shared.filter((item) => !own.some((o) => o.question === item.question))]
  if (items.length === 0) return null

  return (
    /*
      Plain content. It used to cancel the shell gutter with a negative margin to
      fake a full-bleed band, which worked only because it knew the exact clamp
      the gutter used — two places holding the same number. The page wraps this in
      a `PageSection` now, which spans the viewport honestly because the shell sits
      inside it rather than around it.
    */
    <section
      aria-labelledby="product-faq"
      className={cn(className)}
    >
      {/*
        Built from `items` — the same array rendered below. One source, so the
        schema and the page cannot drift apart.
      */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLdScript(
            faqPage(items.map((i) => ({ question: i.question, answer: i.answer }))),
          ),
        }}
      />

      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
        <h2 id="product-faq" className="font-display text-3xl text-foreground">
          {heading}
        </h2>
        <a
          href={url.faq()}
          className="inline-flex min-h-11 items-center text-sm text-primary underline underline-offset-4"
        >
          All questions
        </a>
      </div>

      {/*
        The shared list, not a second copy of the disclosure markup.

        `defaultOpen` is left off: open, this was a wall of prose the reader had
        not asked for, and it pushed the rest of the page off the screen. Closed,
        the block is a list of the QUESTIONS — which is the part that gets scanned
        — and an answer arrives when one is chosen.

        Nothing is lost to a crawler or an answer engine by closing it. The content
        of a closed `<details>` is in the DOM and is indexed, and the FAQPage
        markup above carries every answer regardless of what is on screen.
      */}
      {/*
        ── TWO COLUMNS, because one was the problem ──────────────────────────
        This band spans the shell, and the shell has no max-width. A disclosure row
        is a question on the left and a marker on the right, so at 1900px each row
        was forty pixels of text, eleven hundred pixels of nothing, and a plus sign
        so far from its own question that the two did not read as one control. Seven
        of those stacked is a page of ruled lines.

        Capping the list would have left the same emptiness with a shorter rule
        drawn through it. So the width is SPENT instead: the questions take six
        columns, and the four on the right carry the thing a reader who did not find
        their question actually needs. `wide` is dropped along with it — it existed
        to stop a 72ch measure floating in a full-bleed band, and inside six columns
        the measure is the right one again.
      */}
      <div className="mt-8 grid gap-x-12 gap-y-10 lg:grid-cols-12">
        <div className="lg:col-span-6">
          <FaqList items={items} />
        </div>

        <aside className="lg:col-span-4 lg:col-start-9">
          <div className="lg:sticky lg:top-28">
            <h3 className="font-display text-xl leading-snug text-balance text-foreground">
              Not answered here?
            </h3>
            <div aria-hidden className="mt-4 h-0.5 w-10 rounded-full bg-accent" />
            <p className="mt-5 max-w-[46ch] leading-relaxed text-pretty text-foreground-muted">
              Tell us the product and the state it is going to, and we will tell you
              exactly what we can send — the same check the cart runs on your delivery
              address before it accepts an order.
            </p>
            {/*
              No turnaround quoted here on purpose. /contact states one per channel,
              beside the address it applies to, and a second copy on another page is
              a number that can only ever drift away from the first.
            */}
            <div className="mt-6">
              <ButtonLink href={url.contact()} variant="secondary">
                Contact us
              </ButtonLink>
            </div>
          </div>
        </aside>
      </div>

    </section>
  )
}
