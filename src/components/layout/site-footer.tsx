import { PAYMENT_LABELS, PAYMENT_METHODS } from '@/lib/orders/types'
import { ShineRule } from '@/components/ui/shine-rule'
import Image from 'next/image'
import { BRAND } from '@/lib/brand'
import { PaymentMark } from '@/components/commerce/payment-mark'
import { FDA_DISCLAIMER } from '@/lib/compliance/disclaimers'
import { url } from '@/lib/seo/routes'
import { PostalAddress } from '@/components/layout/postal-address'

/**
 * Copyright year as a constant, not `new Date()`.
 *
 * This footer is in the root layout, so a clock read here is runtime data on EVERY
 * page — which stops the whole site prerendering. Same reason the sitemap and the
 * legality pages avoid it. Bump on the annual review.
 */
/** Same marks the checkout picker uses, so the two never disagree about a brand. */
const COPYRIGHT_YEAR = 2026

const COLUMNS = [
  {
    heading: 'Shop',
    links: [
      [url.shop(), 'All products'],
      [url.category('mimosa-hostilis'), 'Mimosa Hostilis'],
      [url.bulk(), 'Bulk purchase'],
    ],
  },
  {
    heading: 'Verify',
    links: [
      [url.labResults(), 'Lab results'],
      [url.legalityHub(), 'Where we ship'],
      [url.shopNearMe(), 'What ships to you'],
      [url.locationsHub(), 'Locations'],
    ],
  },
  {
    heading: 'Learn',
    links: [
      [url.blog(), 'Guides & articles'],
      [url.guide('how-to-read-a-certificate-of-analysis'), 'How to read a COA'],
      [url.guide('how-ordering-and-payment-works'), 'How ordering works'],
      [url.faq(), 'FAQ'],
      [url.contact(), 'Contact us'],
    ],
  },
  {
    heading: 'Policies',
    links: [
      [url.policy('shipping'), 'Shipping'],
      [url.policy('returns'), 'Returns'],
      [url.policy('purchase'), 'Purchase policy'],
      [url.policy('privacy'), 'Privacy'],
      [url.policy('terms'), 'Terms'],
      [url.legalDisclaimer(), 'Legal disclaimer'],
    ],
  },
] as const

export function SiteFooter() {
  return (
    /*
      `mt-8`, down from `mt-20`.

      Eighty pixels of nothing between the last band and the footer read as a gap
      the page had failed to fill — and every page now ends on a section with its
      own padding, so the margin was stacking on top of that rather than creating
      it. A small gap still separates the two; it no longer holds them apart.
    */
    <footer className="relative mt-8 border-t border-border bg-surface-sunken">
      <ShineRule />
      <div className="shell py-12 max-md:py-6">
        {/*
          The mark opens the footer.

          A footer that starts straight into four columns of links is a sitemap; a
          footer that signs its name first is a business closing a page. It is the
          same asset the header uses, set larger here because this is the last thing
          on the page rather than a persistent bar — and it is the second place a
          visitor checks that they are still on the site they think they are.

          Not `priority`: it is below every fold on every page, and preloading it
          would compete with the LCP image for the same early bandwidth.
        */}
        <div className="mb-10 flex flex-wrap items-end justify-between gap-6 border-b border-border pb-8 max-md:mb-5 max-md:gap-3 max-md:pb-5">
          <a
            href={url.home()}
            aria-label={`${BRAND.name} — home`}
            className="inline-flex min-h-11 items-center"
          >
            <Image
              src="/brand/logo.png"
              alt={BRAND.name}
              width={1180}
              height={329}
              sizes="200px"
              className="h-11 w-auto sm:h-12"
            />
          </a>
          <p className="max-w-[46ch] text-sm leading-relaxed text-pretty text-foreground-muted max-md:text-xs">
            {BRAND.tagline}
          </p>
          <PostalAddress className="max-w-[46ch] text-sm leading-relaxed text-foreground-muted max-md:text-xs" />
        </div>

        <div className="grid grid-cols-2 gap-x-4 gap-y-5 md:gap-8 lg:grid-cols-4">
          {COLUMNS.map((col) => (
            <nav key={col.heading} aria-label={col.heading}>
              <h2 className="text-xs font-medium tracking-[0.2em] text-foreground-subtle uppercase">
                {col.heading}
              </h2>
              {/*
                  No `space-y` here. The links already carry `min-h-11` for the touch
                  target, so an extra gap on top of it stacked to 81px rows and left
                  four columns sprawling down the page. The target height IS the
                  rhythm.
                */}
                <ul className="mt-2">
                {col.links.map(([href, label]) => (
                  <li key={href}>
                    <a
                      href={href}
                      /*
                        `link-sweep` draws the rule from the left on hover rather
                        than switching an underline on. `inline-flex` would stretch
                        the gradient across the whole 44px row box, so the sweep
                        sits on an inline span and the flex box stays the tap
                        target — the underline belongs to the word, the 44px
                        belongs to the thumb.
                      */
                      className="inline-flex min-h-11 items-center text-sm text-foreground-muted transition-colors duration-200 hover:text-foreground max-md:min-h-9 max-md:text-[13px]"
                    >
                      <span className="link-sweep">{label}</span>
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        {/*
          What we accept, shown rather than described.

          A payment row is the one piece of footer furniture that earns its place on a
          site taking no payment on-page: it answers "how would I even pay you" before
          the question becomes a reason to leave. Marks are decorative — the visible
          list beside them names each method, so a screen reader is not read four logo
          filenames.
        */}
        <div className="mt-10 flex flex-wrap items-center gap-x-6 gap-y-3 border-t border-border pt-6 max-md:mt-6 max-md:gap-y-2 max-md:pt-4">
          <p className="text-xs font-medium tracking-[0.2em] text-foreground-subtle uppercase">
            We accept
          </p>
          <ul className="flex flex-wrap items-center gap-4">
            {PAYMENT_METHODS.map((m) => (
              <li key={m} className="flex items-center gap-2">
                <PaymentMark method={m} className="h-5" />
                <span className="text-xs text-foreground-muted">{PAYMENT_LABELS[m]}</span>
              </li>
            ))}
          </ul>
        </div>

        {/*
          THE CLOSING STRIP.

          Four stacked blocks and 64px of reserved air became two lines.

          The vertical gap was `pb-16`, holding the credit clear of the fixed
          "Questions?" bubble in the bottom-right corner. Reserving space BELOW the
          row to dodge something beside it was the wrong axis: it pushed the credit
          up and left a band of empty footer under it. `md:pr-44` reserves the width
          the bubble actually occupies (it is `right-4` and about 160px wide), so the
          row keeps its own baseline and the dead space goes.

          The four legal facts run as one line separated by middots rather than as
          two sentences on two rows. Fine print is scanned, not read — a run of short
          clauses is faster to scan than prose, and it halves the height.
        */}
        <div className="mt-6 border-t border-border pt-5 max-md:mt-4 max-md:pt-4">
          <p className="text-[11px] leading-relaxed text-foreground-subtle">
            {FDA_DISCLAIMER}
          </p>

          <div className="mt-4 flex flex-col gap-x-8 gap-y-3 border-t border-border pt-4 md:flex-row md:items-center md:justify-between md:pr-44">
            {/*
              Separators are decorative and marked so. A screen reader announcing
              "middot" between every clause would make the shortest line on the page
              the most tedious one.
            */}
            <ul className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11px] text-foreground-subtle">
              {[
                `© ${COPYRIGHT_YEAR} ${BRAND.legalName}`,
                `${BRAND.minimumAge}+ only`,
                'United States only',
                'No international shipping',
                'No payment taken on this website',
              ].map((fact, i) => (
                <li key={fact} className="flex items-center gap-2.5">
                  {i > 0 && (
                    <span aria-hidden className="text-border-strong">
                      ·
                    </span>
                  )}
                  {fact}
                </li>
              ))}
            </ul>

            {/*
              House convention: developer credit, right-aligned on desktop and left on
              mobile, with a slow metallic sheen disabled under prefers-reduced-motion.

              The convention calls for ~30% opacity on "Developed by". At that value it
              measured 3.56:1 against the footer, below the 4.5:1 floor, so it uses the
              full subtle token instead — same muted, tracked, tiny treatment, but
              readable. Contrast wins over styling.

              `group` carries the convention's hover: the label lifts toward the
              foreground over 300ms rather than snapping, and the whole credit is one
              hover target so the label responds when the pointer is on the name.
            */}
            <p className="group flex shrink-0 items-baseline gap-2">
              <span className="text-[10px] font-medium tracking-[0.4em] text-foreground-subtle uppercase transition-colors duration-300 ease-[var(--ease-standard)] group-hover:text-foreground-muted motion-reduce:transition-none">
                Developed by
              </span>
              <a
                href={`mailto:${BRAND.developer.email}`}
                aria-label={BRAND.developer.ariaLabel}
                className="wice-sheen inline-flex min-h-11 items-center font-display text-lg tracking-wide"
              >
                {BRAND.developer.name}
              </a>
            </p>
          </div>
        </div>
      </div>
    </footer>
  )
}
