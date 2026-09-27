import { FdaDisclaimer } from '@/components/compliance/fda-disclaimer'
import { url } from '@/lib/seo/routes'
import { BRAND } from '@/lib/brand'

/**
 * ─────────────────────────────────────────────────────────────────────────────
 *  THE CLOSING STATEMENT.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * The page used to end on a thin rule and a line of federal small print. That is
 * a legal obligation discharged, not a close — and the last thing a reader sees
 * is the thing they carry away.
 *
 * The test every line here had to pass: COULD A COMPETITOR SAY IT? Anyone can
 * write "trusted", "premium", "the gold standard" — those words cost nothing and
 * are worth what they cost. Every claim below is instead something a reader can
 * go and check from the outside, and something a seller who does not actually do
 * it cannot copy without being caught. That is where authority comes from in a
 * category this heavily regulated: not from adjectives, from receipts.
 *
 * The heading is the site's own sentence, already on /about. It is the strongest
 * thing this business says about itself, because it is a statement about what it
 * is prepared to give up.
 *
 * The FDA disclaimer stays, and it renders HERE rather than beside this — the
 * legal line is required on the page and putting it inside this component means
 * a future edit cannot detach the two.
 */

const STANDARDS = [
  {
    claim: 'Every batch is tested before it is offered.',
    detail:
      'The full panel — potency, heavy metals, pesticides, mycotoxins, solvents and microbials — not potency alone. A certified copy is issued to verified buyers who ask for it, against the code printed on the package.',
    action: { label: 'Request a certificate', href: url.labResults() },
  },
  {
    claim: 'Every state position carries its statute.',
    detail:
      'And the date we last reviewed it. Our public pages and our cart read the same record, which is why this site cannot tell you one thing and the checkout another.',
    action: { label: 'Legality by state', href: url.legalityHub() },
  },
  {
    claim: 'Where we are not certain, we refuse the sale.',
    detail:
      'No verified review for a product in your state means the cart declines rather than guesses. We would rather explain a refusal than defend a shipment.',
    action: { label: 'What ships to you', href: url.shopNearMe() },
  },
  {
    claim: 'No payment is taken on this website.',
    detail:
      'There is no card form here, no processor behind it and nothing stored — so there is nothing for anyone to take. You submit an order, we check the stock and that we can ship to your address, and payment instructions follow.',
    action: { label: 'How ordering works', href: url.guide('how-ordering-and-payment-works') },
  },
] as const

export function Standards() {
  return (
    /*
      TWO BANDS, not one section.

      The standards and the conditions of sale were one block on one ground, so a
      reader arrived at the bottom of the page unsure whether the small print was
      part of the argument or the start of the footer. They are separated now: the
      standards sit on the page's own surface, the legal strip on a darker one,
      and the change of ground is the boundary.
    */
    <>
      <section
        aria-labelledby="standards-heading"
        className="border-t border-border bg-surface-sunken"
      >
        <div className="shell py-16 lg:py-24">
          {/*
            Statement and gloss side by side, not stacked.

            Both were capped and stacked down the left edge. On a 1900px display that
            left most of the band empty while the heading still broke at two lines, so
            the section read as a narrow column that had failed to fill rather than as
            a deliberate measure. Two columns of one grid fill the width with content
            instead of air, and each half keeps a readable line length on its own.

            The type does NOT step up to compensate. `text-4xl` rather than `5xl`:
            this closes the page, it does not open it, and it should not out-shout the
            hero. The width comes from the layout, not from the size — which is the
            fix that a bigger font would only have disguised.
          */}
          <div className="grid gap-x-12 gap-y-5 lg:grid-cols-12 lg:items-end">
            <h2
              id="standards-heading"
              className="font-display text-3xl leading-[1.06] text-balance text-foreground md:text-4xl lg:col-span-7"
            >
              We would rather lose the order than get it wrong.
            </h2>

            <p className="max-w-[54ch] text-base leading-relaxed text-pretty text-foreground-muted lg:col-span-5">
              This is a category where almost everything is asserted and almost nothing
              is shown. Four things we will not move on — each of them checkable, by
              you, without taking our word for any of it.
            </p>
          </div>

          {/*
            Four cards, and the fourth is not like the others.

            An identical card repeated four times is a feature grid, and a feature
            grid is what every competitor in this category ships. The ordinal sets
            each one apart, and the LAST card carries the accent — it is the claim
            that actually distinguishes this business, and giving it the same
            weight as the other three would be filing it under "also".
          */}
          <ul className="stagger mt-14 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {STANDARDS.map((s, i) => {
              const featured = i === STANDARDS.length - 1
              return (
                <li
                  key={s.claim}
                  className={[
                    /*
                      `isolate` so the ordinal behind the text cannot escape the card's
                      stacking context, and `focus-within` carries the ring because the
                      whole card is the hit area (see the stretched link below) — a
                      keyboard user tabbing to the link must see the CARD light up, not
                      an outline around three words at the bottom of it.
                    */
                    'group/std relative isolate flex flex-col overflow-hidden rounded-2xl p-6',
                    'transition-[transform,border-color,background-color] duration-500 ease-[var(--ease-out-expo)]',
                    'hover:-translate-y-1.5 focus-within:-translate-y-1.5',
                    /*
                      The focus ring belongs to the CARD, not to the link inside it.
                      An outline follows the element's own box and not its stretched
                      pseudo-element, so leaving it on the anchor would ring three
                      words at the bottom of a card whose entire face is the hit area.
                    */
                    'focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-[var(--ring)]',
                    'motion-reduce:transition-none motion-reduce:hover:translate-y-0 motion-reduce:focus-within:translate-y-0',
                    featured
                      ? 'border border-transparent bg-accent text-on-accent'
                      : 'border border-border bg-surface hover:border-foreground/25 focus-within:border-foreground/25',
                  ].join(' ')}
                >
                  {/*
                    THE ORDINAL.

                    It was `-top-3` inside an `overflow-hidden` card, so the top of every
                    digit was sliced off by the card's own edge — the numerals read as a
                    rendering fault rather than as a device.

                    Two things put it right. It sits fully INSIDE the card now, and the
                    line box is tightened to `0.72` so it wraps the digit's cap height
                    rather than the font's full em box. Without that second part a digit
                    optically floats well below whatever `top-` value you give it,
                    because roughly a third of the em box above a numeral is empty air.

                    It also responds to hover. Decoration that ignores the interaction
                    reads as a texture; decoration that answers it reads as part of the
                    object.
                  */}
                  <span
                    aria-hidden
                    className={[
                      'pointer-events-none absolute top-5 right-6 -z-10 font-product text-[5rem] leading-[0.72]',
                      'tabular font-semibold select-none',
                      'transition-[opacity,scale] duration-500 ease-[var(--ease-out-expo)] motion-reduce:transition-none',
                      featured
                        ? 'text-on-accent/20 group-hover/std:text-on-accent/30'
                        : 'text-foreground/10 group-hover/std:text-foreground/[0.18]',
                      'group-hover/std:scale-105 motion-reduce:group-hover/std:scale-100',
                    ].join(' ')}
                  >
                    {i + 1}
                  </span>

                  {/*
                    Space Grotesk, not the page's Newsreader.

                    These are technical claims — batch panels, statutes, review dates —
                    and a geometric sans states them plainly where the serif would give
                    them a literary tone they have not earned. It also pairs with the
                    serif heading above on a real contrast axis rather than being a
                    second, nearly-identical voice.
                  */}
                  <h3
                    className={[
                      /*
                        `pr-16` keeps the claim clear of the ordinal. Without it the
                        longest claims — "Where we are not certain," — run under the
                        numeral, and a watermark you have to read through stops being
                        a watermark and becomes noise. The paragraph below needs no
                        such inset: the numeral ends above where it starts.
                      */
                      'pr-16 font-product text-[1.0625rem] leading-[1.3] font-medium tracking-[-0.015em] text-balance sm:text-lg',
                      featured ? 'text-on-accent' : 'text-foreground',
                    ].join(' ')}
                  >
                    {s.claim}
                  </h3>

                  <p
                    className={[
                      'mt-3 flex-1 text-[0.9375rem] leading-[1.6] text-pretty',
                      featured ? 'text-on-accent/85' : 'text-foreground-muted',
                    ].join(' ')}
                  >
                    {s.detail}
                  </p>

                  <a
                    href={s.action.href}
                    className={[
                      'mt-6 inline-flex min-h-11 items-center gap-2 text-[0.8125rem] font-medium tracking-[0.01em]',
                      // Suppressed here because the card above carries the indicator.
                      'focus-visible:outline-none',
                      /*
                        Stretched over the whole card. Four cards each with one small
                        link at the bottom is four small targets; the card is the
                        object, so the card is the target. The label stays visible
                        because "where does this go" still has to be answerable
                        without hovering.
                      */
                      'after:absolute after:inset-0 after:content-[""]',
                      featured ? 'text-on-accent' : 'text-foreground',
                    ].join(' ')}
                  >
                    {s.action.label}
                    <span
                      aria-hidden
                      className="transition-transform duration-500 ease-[var(--ease-out-expo)] group-hover/std:translate-x-1 motion-reduce:transition-none motion-reduce:group-hover/std:translate-x-0"
                    >
                      →
                    </span>
                  </a>
                </li>
              )
            })}
          </ul>
        </div>
      </section>

      {/*
        THE CONDITIONS OF SALE — its own band, running the width of the screen.

        This was two stacked paragraphs capped at a 70-character measure, which on
        a wide display left most of the row empty beside a narrow column of small
        print. Three columns instead: what the terms are, what we stand behind,
        and the federal sentence — each in its own place, filling the width the
        page has.
      */}
      <section aria-label="Conditions of sale" className="border-t border-border">
        <div className="shell grid gap-x-12 gap-y-8 py-10 lg:grid-cols-3 lg:py-12">
          <div>
            <h2 className="text-xs font-medium tracking-[0.2em] text-foreground-subtle uppercase">
              Who we sell to
            </h2>
            {/*
              A list, not a sentence with separators. Three conditions run together
              by middots read as one long line; separated they read as three
              conditions, which is what they are — and a screen reader gets three
              items rather than one run-on.
            */}
            <ul className="mt-3 space-y-1.5 text-sm text-foreground-muted">
              <li>United States only.</li>
              <li>{BRAND.minimumAge} and over.</li>
              <li>
                We do not advertise; paid advertising is not permitted in this
                category, so everything here had to be worth finding.
              </li>
            </ul>
          </div>

          {/*
            The disclaimer carries its own lead sentence and the federal one. It
            spans two columns so its two paragraphs sit side by side on a wide
            screen instead of stacking into a narrow strip.
          */}
          <FdaDisclaimer className="lg:col-span-2 lg:border-t-0 lg:pt-0" />
        </div>
      </section>
    </>
  )
}
