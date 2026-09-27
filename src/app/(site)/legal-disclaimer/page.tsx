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
  title: 'Legal Disclaimer',
  description: 'We make no health, medical or therapeutic claims. Mimosa Hostilis root bark is a botanical material and is not food. Nothing here is legal or medical advice.',
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
        summary="We make no health, medical or therapeutic claims about anything we sell. Mimosa Hostilis root bark is a raw botanical material and is not food. Nothing on this website is legal or medical advice, and the legal position of these products changes — we publish the statute and the review date so you can check ours."
        lastReviewedAt={REVIEWED}
        sections={[
          {
            heading: 'Food and Drug Administration',
            body: [
              FDA_DISCLAIMER,
              'Nothing we publish is intended to describe an effect on the body, and no statement on this site should be read as one. If you have a question about your health, ask a qualified professional rather than a retailer.',
            ],
          },
          {
            heading: 'Mimosa Hostilis root bark',
            body: [
              NOT_FOR_HUMAN_CONSUMPTION,
              'We sell it to natural dyers, soap and cosmetic makers, and researchers. At checkout you confirm that this is what you are buying it for, and that confirmation is recorded with your order.',
            ],
          },
          {
            heading: 'Amanita muscaria',
            body: [
              'Amanita muscaria contains naturally occurring muscimol and ibotenic acid. Neither is listed under the federal Controlled Substances Act, which is the basis on which these products are lawfully sold in the United States.',
              'In December 2024 the Food and Drug Administration stated that Amanita muscaria is not authorised for use in conventional food. Edible formats therefore sit in a regulatory grey area rather than having been affirmatively cleared, and we say so rather than implying otherwise.',
              'State positions are separate from the federal one, and they move. We publish the current position for every state with the statute we rely on and the date we last reviewed it, and the cart checks your delivery address against those same records before it accepts an order.',
            ],
          },
          {
            heading: 'Vapor products',
            body: [
              'Vapor products are regulated federally under the PACT Act. They ship via a registered specialist carrier and are reported to state authorities monthly as the law requires.',
            ],
          },
          {
            heading: 'This is not legal advice',
            body: [
              'We publish, for every state and every product line, the position we rely on, the statute behind it, and the date we last reviewed it. That is our reasoning, made checkable — it is not advice about your circumstances, and it does not create a professional relationship.',
              'The law in this category moves, sometimes quickly, and a page can be current on the day it was reviewed and out of date a month later. You are responsible for the rules that apply where you are. If you need certainty, speak to a lawyer in your state.',
            ],
          },
          {
            heading: 'Accuracy and corrections',
            body: [
              'Every batch is lab tested before it is offered for sale, the botanical line by an independent third-party laboratory, and a certified copy of the report is issued to verified buyers who ask for it, against the batch code on the package, so our claims about a product can be checked against the report rather than taken on trust.',
              `If you believe something on this site is wrong — a statute we have misread, a review date that has gone stale, a laboratory report that does not match — tell us at ${email}. We would rather be corrected than cited incorrectly.`,
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
          <h2 className="font-display text-2xl text-foreground">Image credits</h2>
          <p className="mt-3 leading-relaxed text-foreground-muted">
            Product photography of our own stock is not published yet. Until it is, the
            images on our product pages are openly licensed samples that show the kind
            of material only — they are labelled as samples wherever they appear, and
            they are not photographs of the goods we ship. They are listed here with
            their authors and licences, as those licences require.
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
