import type { Metadata } from 'next'
import { catalog } from '@/lib/catalog/repository'
import { FdaDisclaimer } from '@/components/compliance/fda-disclaimer'
import { PageSection } from '@/components/layout/page-section'
import { BRAND } from '@/lib/brand'
import { getCompanyEmail } from '@/lib/site/company-email.server'
import { absoluteUrl, url } from '@/lib/seo/routes'
import { breadcrumbList, jsonLdScript, organizationRef } from '@/lib/seo/structured-data'
import { pageMetadata } from '@/lib/seo/meta'
import { PageHeader } from '@/components/layout/page-header'
import { BulkQuoteForm } from '@/components/marketing/bulk-quote-form'
import { JURISDICTIONS } from '@/lib/compliance/jurisdictions'

export const metadata: Metadata = pageMetadata({
  title: 'Bulk & Wholesale Purchasing',
  description: 'Bulk and wholesale quotes, priced individually by a person, for one-off volumes and standing supply. Same third-party lab testing and the same per-state rules as a single unit.',
  path: url.bulk(),
})

const REVIEWED = '2026-08-28'

export default async function BulkPage() {
  const email = await getCompanyEmail()
  /*
    The categories come from the catalogue, not a hand-kept list, so the form can
    never offer a line the shop has dropped. It asks for categories only: the owner
    prices a bulk order per line, so the category is the fact a quote needs.
  */
  const quoteCategories = catalog.listCategories().map((c) => ({
    slug: c.slug,
    name: c.name,
  }))
  const quoteStates = JURISDICTIONS.map((j) => ({ code: j.code, name: j.name }))

  const jsonLd = [
    {
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      name: 'Bulk and wholesale purchasing',
      url: absoluteUrl(url.bulk()),
      lastReviewed: REVIEWED,
      publisher: organizationRef(),
    },
    breadcrumbList([{ name: 'Bulk purchase', path: url.bulk() }]),
  ]

  return (
    <main>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdScript(jsonLd) }}
      />

      <PageSection first>
        <PageHeader
          title="Buying in volume"
          summary="Tell us what you need and a person prices it for you, usually within one business day. One-off volumes and standing supply are both welcome."
        />
      </PageSection>

      <PageSection tone="sunken">
        <section>
          <h2 className="font-display text-2xl text-foreground">
            What does not change at volume
          </h2>
          <ul className="mt-4 space-y-2">
            {[
              'Every batch is still lab tested, and a certified copy of the report is still issued on request against its batch code.',
              `Age verification is unchanged: ${BRAND.minimumAge} and over.`,
              'Vapor products still travel on the specialist age-restricted carrier and are still never eligible for free shipping, at any order value.',
            ].map((item) => (
              <li
                key={item}
                className="border-l-2 border-border-data pl-4 leading-relaxed text-foreground-muted"
              >
                {item}
              </li>
            ))}
          </ul>
        </section>
      </PageSection>

      <PageSection>
        <section id="quote" className="scroll-mt-24">
          <h2 className="font-display text-3xl text-foreground">Ask for a quote</h2>
          <p className="mt-2 max-w-[68ch] leading-relaxed text-pretty text-foreground-muted">
            Tell us what you need, how much of it, where it is going and how often it
            repeats. With those four things we can usually quote on the first reply,
            including a shipping figure rather than an estimate.
          </p>

          {/*
            The form, not a mailto.

            A wholesale enquiry needs four specific facts and an email gets three of
            them at best — every one missing is a round trip before a price exists.
            The address stays underneath for anyone who would rather use their own
            mail client; taking it away to force a form is worse for them, not better.
          */}
          <div className="mt-8">
            <BulkQuoteForm categories={quoteCategories} states={quoteStates} />
          </div>

          <p className="mt-4 text-sm text-foreground-muted">
            Or email{' '}
            <a
              href={`mailto:${email}`}
              /* `min-h-11` — an inline mailto is a 20px-tall tap target on a phone. */
              className="inline-flex min-h-11 items-center font-medium text-primary underline underline-offset-4"
            >
              {email}
            </a>{' '}
            directly.
          </p>
        </section>
      </PageSection>

      <PageSection tone="sunken">
        <nav aria-label="Related pages">
          <ul className="mt-3 flex flex-wrap gap-x-6 gap-y-2">
            {[
              [url.shop(), 'All products'],
              [url.legalityHub(), 'Legality by state'],
              [url.policy('shipping'), 'Shipping policy'],
              [url.contact(), 'Contact us'],
            ].map(([href, label]) => (
              <li key={href}>
                <a
                  href={href}
                  className="inline-flex min-h-11 items-center text-sm text-primary underline underline-offset-4"
                >
                  {label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
        <FdaDisclaimer className="mt-12" />
      </PageSection>
    </main>
  )
}
