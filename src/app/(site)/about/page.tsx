import type { Metadata } from 'next'
import { FdaDisclaimer } from '@/components/compliance/fda-disclaimer'
import { PageSection } from '@/components/layout/page-section'
import { PolicyProse } from '@/components/content/policy-prose'
import { Proprietor } from '@/components/marketing/proprietor'
import { TeamSlats } from '@/components/marketing/team-slats'
import { BRAND } from '@/lib/brand'
import { absoluteUrl, url } from '@/lib/seo/routes'
import {
  breadcrumbList,
  jsonLdScript,
  organization,
} from '@/lib/seo/structured-data'
import { pageMetadata } from '@/lib/seo/meta'
import { getCompanyEmail } from '@/lib/site/company-email.server'

export const metadata: Metadata = pageMetadata({
  title: 'About Us',
  description: `${BRAND.name} is a US distributor of disposable vapes: nicotine, THCA and THC disposables, lab-tested by batch. Meet our founder, ${BRAND.proprietor.name}, and the team behind every order.`,
  path: url.about(),
})

const REVIEWED = '2026-08-28'

export default async function AboutPage() {
  const email = await getCompanyEmail()
  /*
    The About page is where a search engine and an answer engine resolve "who is this
    business?". Emitting the full Organization node here as well as on the home page
    is deliberate: this is the page most likely to be cited as the source for a claim
    about the company itself.
  */
  const jsonLd = [
    {
      '@context': 'https://schema.org',
      '@type': 'AboutPage',
      name: `About ${BRAND.name}`,
      url: absoluteUrl(url.about()),
      lastReviewed: REVIEWED,
      mainEntity: organization(email),
    },
    breadcrumbList([{ name: 'About', path: url.about() }]),
  ]

  return (
    <main>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdScript(jsonLd) }}
      />

      <PageSection first>
        <PolicyProse
          title={`About ${BRAND.name}`}
          summary={`${BRAND.legalName} sells Mimosa hostilis and sassafras root bark as raw botanical material for natural dyeing, soap making and craft, to customers in the United States. This page covers what we sell, how an order is handled from request to delivery, and how to reach a person about one.`}
          lastReviewedAt={REVIEWED}
          sections={[
            /*
              The founder and the track record, as the owner supplied them on
              2026-09-11 — see BRAND.proprietor and BRAND.track. Phrased as "more
              than" so the figures stay true as they grow.
            */
            {
              heading: 'Who we are',
              body: [
                `${BRAND.name} was founded by ${BRAND.proprietor.name}, a ${BRAND.proprietor.title}. John holds a PhD, and his research has focused on psychedelic compounds.`,
                `The business has been running for more than ${BRAND.track.yearsInBusiness} years and has served more than ${BRAND.track.customers.toLocaleString('en-US')} customers across the United States. It still works the way a laboratory does: test first, and show the evidence behind what we say.`,
              ],
            },
            /*
              DISPOSABLES (owner, 2026-09-15): "we are a distributor of disposable
              products". What the business is built around comes straight after who
              runs it. Wording rules from the same day: 21+ stays; nothing about
              signatures or ID at the door, nothing about state restrictions. Testing
              is "lab-tested by batch", with certificates on request, never
              "third-party" or "published" (the owner describes it as second-party).
            */
            {
              heading: 'A distributor of disposable vapes',
              body: [
                `${BRAND.name} is built around disposables. We distribute ready-to-use disposable vapor products to adult customers and to retailers across the United States, and they are the largest part of what we sell.`,
                'We carry two families. Nicotine disposables, and hemp-derived cannabinoid disposables, including THCA and THC. Every product page states exactly what that device contains, its flavour and its size, so you always know what you are ordering.',
              ],
            },
            {
              heading: 'Tested by batch, before it is offered',
              body: [
                'Every batch of disposables is lab-tested before we offer it for sale, and the results are kept against the batch code printed on the package.',
                'Verified buyers and licensed retailers can ask us for a certified copy of the report for the batch they received. Send the batch code through the contact page and we will send the certificate.',
              ],
            },
            {
              heading: 'By the unit, or by the case',
              body: [
                'Each disposable has one price per unit, and your total is that price times the number you order. There are no pack sizes to compare.',
                'Retailers, vape shops and resellers can buy from us in volume. The bulk page takes your quantities, and a person replies with wholesale pricing.',
              ],
            },
            {
              heading: 'How disposables reach you',
              body: [
                'Disposables are governed by the federal PACT Act. The postal service does not carry vapor products, and the major parcel carriers decline them, so every order of disposables travels with a specialist carrier that complies with the Act, separately from anything else in the order.',
                `Every disposable is for adults aged ${BRAND.minimumAge} and over, and no payment is taken on this site: you place an order request, we verify it, and we contact you with how to pay.`,
              ],
            },
          ]}
          relatedHeading="Disposables"
          related={[
            { label: 'Shop disposables', href: url.category('disposable-vapes') },
            { label: 'Wholesale and bulk pricing', href: url.bulk() },
            { label: 'What the PACT Act means for buyers', href: url.blogPost('what-the-pact-act-means-for-buyers') },
          ]}
        />
      </PageSection>

      {/*
        The people (owner's request, 2026-09-13): the founder, then the team, after
        what the business distributes. How state rules and lab testing work, and how
        payment works in detail, live on their own pages, linked below.
      */}
      <Proprietor linkToAbout={false} />

      <PageSection tone="sunken">
        <TeamSlats />
        <nav aria-label="Read next" className="mt-12 border-t border-border pt-6">
          <h2 className="text-xs font-medium tracking-[0.2em] text-foreground-subtle uppercase">Read next</h2>
          <ul className="mt-3 flex flex-wrap gap-x-6 gap-y-1">
            {[
              { label: 'Legality by state', href: url.legalityHub() },
              { label: 'Lab results', href: url.labResults() },
              { label: 'Frequently asked questions', href: url.faq() },
              { label: 'Contact us', href: url.contact() },
            ].map((link) => (
              <li key={link.href}>
                <a href={link.href} className="inline-flex min-h-11 items-center text-sm text-primary underline underline-offset-4">
                  {link.label}
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
