import type { Metadata } from 'next'
import { FdaDisclaimer } from '@/components/compliance/fda-disclaimer'
import { PageSection } from '@/components/layout/page-section'
import { PolicyProse } from '@/components/content/policy-prose'
import {
  FDA_DISCLAIMER,
  NOT_FOR_HUMAN_CONSUMPTION,
} from '@/lib/compliance/disclaimers'
import { getCompanyEmail } from '@/lib/site/company-email.server'
import { imageCredits, IS_PLACEHOLDER } from '@/lib/catalog/sample-images'
import { absoluteUrl, url } from '@/lib/seo/routes'
import { breadcrumbList, jsonLdScript, organizationRef } from '@/lib/seo/structured-data'
import { pageMetadata } from '@/lib/seo/meta'

export const metadata: Metadata = pageMetadata({
  title: 'Legal Disclaimer: Health Claims, Legal Positions and Testing',
  description: 'No product here comes with a health claim. Root bark is a craft and research material, not food. Our state legal positions show our reasoning; they are not legal advice.',
  path: url.legalDisclaimer(),
})

const REVIEWED = '2026-08-28'

export default async function LegalDisclaimerPage() {
  const email = await getCompanyEmail()
  const jsonLd = [
    {
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      name: 'Legal disclaimer',
      url: absoluteUrl(url.legalDisclaimer()),
      lastReviewed: REVIEWED,
      publisher: organizationRef(),
    },
    breadcrumbList([{ name: 'Legal disclaimer', path: url.legalDisclaimer() }]),
  ]

  return (
    <main>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdScript(jsonLd) }}
      />

      <PageSection first>
        <PolicyProse
        title="Legal disclaimer"
        summary="Three limits apply to everything on this site. It makes no health, medical or therapeutic claims about any product. Mimosa hostilis root bark is sold as a raw botanical for craft and research work, and it is not food. And none of it is legal or medical advice: the rules for these products shift, which is why every legal position we state comes with its statute and the date we last checked it."
        lastReviewedAt={REVIEWED}
        sections={[
          {
            heading: 'Our legal pages explain our position; they are not advice',
            body: [
              'The state and product pages set out the position we act on, not advice about your situation. For each state and each product line you can see the statute we rely on and the day we last reviewed it, so our reading can be tested instead of trusted. That reading is not tailored to you, and publishing it does not make us your advisers or form a professional relationship of any kind.',
              'Rules in this category can change between one review and the next, so a page that was accurate on its review date may be stale within weeks. Following the law where you live is your responsibility. For a firm answer, consult a licensed attorney in your state.',
            ],
          },
          {
            heading: 'Health claims and the FDA',
            body: [
              'No product page, guide or post here describes what a product does to the body, and none of our wording should be read that way.',
              FDA_DISCLAIMER,
              'Questions about your health belong with a qualified professional, not with a shop.',
            ],
          },
          {
            heading: 'What root bark is sold for',
            body: [
              'Mimosa hostilis root bark is sold for natural dyeing, for soap and cosmetic making, and for research.',
              NOT_FOR_HUMAN_CONSUMPTION,
              'Checkout asks you to confirm your intended use, and we store that confirmation alongside the order.',
            ],
          },
          {
            heading: 'Amanita muscaria: federal and state status',
            body: [
              'Amanita muscaria can be sold lawfully in the United States because its naturally occurring compounds, muscimol and ibotenic acid, are not listed under the federal Controlled Substances Act.',
              'That is not the same as regulatory approval. In December 2024 the Food and Drug Administration said Amanita muscaria is not authorized for use in conventional food, which leaves food-style formats in a gray area instead of cleared, and we would rather tell you that than suggest otherwise.',
              'Each state can take its own view, and those views change. Our state pages give the current position with its statute and last review date, and the cart reads those same records to check your delivery address before it will take an order.',
            ],
          },
          {
            heading: 'Vapor products and the PACT Act',
            body: [
              'Vapor products fall under the federal PACT Act. We send them through a registered specialist carrier and file the monthly reports with state authorities that the law requires.',
            ],
          },
          {
            heading: 'Testing, and how to check what we say',
            body: [
              'Each batch is tested before we list it for sale; for the botanical line, that testing is done by an independent third-party laboratory. Verified buyers can ask for a certified copy of the report for the batch code printed on their package, so anything we say about a product can be compared with the report itself instead of accepted on our word.',
              `Email ${email} if anything here looks wrong: a statute we have read incorrectly, a review date that has lapsed, or a lab report that does not match its batch. We want to fix a mistake before anyone repeats it.`,
            ],
          },
        ]}
        related={[
          { label: 'Legality by state', href: url.legalityHub() },
          { label: 'Lab results', href: url.labResults() },
          { label: 'Terms of service', href: url.policy('terms') },
          { label: 'Purchase policy', href: url.policy('purchase') },
        ]}
        relatedHeading="Related"
      />

      {/*
        Attribution is a LICENCE CONDITION for the CC BY and CC BY-SA samples, not a
        courtesy — so it renders wherever those files are in use, and disappears on its
        own the moment IS_PLACEHOLDER is turned off.
      */}
      {IS_PLACEHOLDER && (
        <section className="mt-12 border-t border-border pt-8">
          <h2 className="font-display text-2xl text-foreground">Credits for sample images</h2>
          <p className="mt-3 leading-relaxed text-foreground-muted">
            Photographs of our own stock have not been published yet. Until they are,
            product pages use openly licensed sample images that illustrate the type of
            material and nothing more. Each one is marked as a sample where it appears,
            none of them shows the goods we actually ship, and their licenses require
            us to credit them, which we do below.
          </p>
          <ul className="mt-5 space-y-3">
            {imageCredits().map((credit) => (
              <li
                key={credit.source}
                className="border-l-2 border-border-data pl-4 text-sm leading-relaxed text-foreground-muted"
              >
                <a
                  href={credit.source}
                  rel="noopener noreferrer"
                  className="text-primary underline underline-offset-4"
                >
                  {credit.title}
                </a>
                {' by '}
                <span className="text-foreground">{credit.author}</span>
                {', licensed '}
                <a
                  href={credit.licenseUrl}
                  rel="noopener noreferrer license"
                  className="text-primary underline underline-offset-4"
                >
                  {credit.license}
                </a>
                . Sourced from Wikimedia Commons.
              </li>
            ))}
          </ul>
        </section>
      )}

      </PageSection>

      <PageSection tone="sunken">
        <FdaDisclaimer className="mt-12" />
      </PageSection>
    </main>
  )
}
