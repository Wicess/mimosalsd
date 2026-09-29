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
  title: `About Us, Mimosa Hostilis Root Bark Supplier Since ${BRAND.track.foundedYear}`,
  description: `A California supplier of Mimosa hostilis root bark for natural dyeing since ${BRAND.track.foundedYear}. Meet owner Dr ${BRAND.proprietor.name} and the team behind every order.`,
  path: url.about(),
})

const REVIEWED = '2026-09-28'

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
          summary={`${BRAND.name} has supplied Mimosa hostilis root bark and disposables to customers across the United States since ${BRAND.track.foundedYear}. This page covers who runs the business, what it sells, and how an order goes from request to doorstep.`}
          lastReviewedAt={REVIEWED}
          sections={[
            /*
              Every fact here is the client's own (2026-09-28): the owner, his
              qualifications and experience, the founding year and the customer count
              all read from BRAND, so this page and the schema cannot disagree. The
              client also mentioned international orders; they are left out because
              this site serves the United States only.
            */
            {
              heading: 'A new website, not a new business',
              body: [
                `${BRAND.name} has been trading since ${BRAND.track.foundedYear}, and ${BRAND.track.customers.toLocaleString('en-US')} customers across the United States have ordered from us in that time. The website is the new part: it is how the business now takes orders.`,
                `We operate from ${BRAND.location.region} and ship to every state.`,
              ],
            },
            {
              heading: 'Who runs it',
              body: [
                `Dr ${BRAND.proprietor.name} owns ${BRAND.name} and runs it as CEO. He holds a PhD in business and chemical engineering, specialising in fumes, and has more than thirty years of experience in the industry, across more than ten businesses.`,
                'He is the person the rest of the team answers to, and the one who decides what the business sells.',
              ],
            },
            {
              heading: 'What we sell',
              body: [
                'Root bark comes first. Mimosa hostilis and sassafras root bark, sold by weight as raw material for natural dyeing, soap making and craft, in powder, shredded and stripped cuts.',
                `Disposables sit alongside it: ready-to-use disposable vapor products for adults aged ${BRAND.minimumAge} and over. Each product page lists what the device contains, its flavour and its size, so you know exactly what you are ordering.`,
              ],
            },
            {
              heading: 'How an order works',
              body: [
                'You place your order and a person confirms it against the address it is going to. Payment details then arrive in your order chat on this site, and by email, for the method you chose.',
                'Once payment is confirmed, the order is weighed, packed and handed to the carrier, and the tracking number follows. Disposables travel as a separate parcel from root bark.',
              ],
            },
            {
              heading: 'Talk to a person',
              body: [
                `Email ${email} or call ${BRAND.phone}. Questions about an order, a cut of bark or a bulk quantity all come to the same people you can see below.`,
              ],
            },
          ]}
          relatedHeading="Shop"
          related={[
            { label: 'Mimosa hostilis root bark', href: url.category('mimosa-hostilis') },
            { label: 'Disposables', href: url.category('disposable-vapes') },
            { label: 'Wholesale and bulk pricing', href: url.bulk() },
          ]}
        />
      </PageSection>

      {/*
        The people: the owner, then the team, after what the business sells and how
        an order works.
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
