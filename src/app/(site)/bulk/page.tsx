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
  title: 'Wholesale Mimosa Hostilis Root Bark, Bulk Pricing by the lb',
  description: 'Wholesale Mimosa hostilis root bark in powder, shredded and whole cuts, by the pound or the case. Request a bulk quote. Ships from California, across the US and abroad.',
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
          title="Bulk and wholesale orders"
          summary="Send the details below and a member of our team prices the order by hand, usually within one business day. We quote single large orders and repeat supply alike."
        />
      </PageSection>

      <PageSection tone="sunken">
        <section>
          <h2 className="font-display text-2xl text-foreground">
            Larger orders, same rules
          </h2>
          <ul className="mt-4 space-y-2">
            {[
              'Testing: each batch in a bulk order is lab tested like any other, and a certified copy of its report is available on request by batch code.',
              `Age: buyers must still be ${BRAND.minimumAge} or older, verified the same way as on a single order.`,
              'Vapor products: they go by the specialist age-restricted carrier whatever the quantity, and free shipping never applies to them, however large the order.',
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
          <h2 className="font-display text-3xl text-foreground">Request a bulk quote</h2>
          <p className="mt-2 max-w-[68ch] leading-relaxed text-pretty text-foreground-muted">
            A complete quote needs four answers: the product, the quantity, the
            destination and whether the order will repeat. When the form has all four,
            our first reply can usually carry a firm price with actual shipping
            included, not a ballpark.
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
            Prefer your own mail app? Write to{' '}
            <a
              href={`mailto:${email}`}
              /* `min-h-11` — an inline mailto is a 20px-tall tap target on a phone. */
              className="inline-flex min-h-11 items-center font-medium text-primary underline underline-offset-4"
            >
              {email}
            </a>
            .
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
