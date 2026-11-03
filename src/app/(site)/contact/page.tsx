import type { Metadata } from 'next'
import { Suspense } from 'react'
import { ContactForm } from '@/components/marketing/contact-form'
import type { ContactTopic } from '@/lib/mail/templates'
import { FdaDisclaimer } from '@/components/compliance/fda-disclaimer'
import { PageSection } from '@/components/layout/page-section'
import { PostalAddress } from '@/components/layout/postal-address'
import { BRAND } from '@/lib/brand'
import { getCompanyEmail } from '@/lib/site/company-email.server'
import { absoluteUrl, url } from '@/lib/seo/routes'
import { breadcrumbList, jsonLdScript, organization } from '@/lib/seo/structured-data'
import { pageMetadata } from '@/lib/seo/meta'
import { PageHeader } from '@/components/layout/page-header'

export const metadata: Metadata = pageMetadata({
  title: 'Contact: Orders, Bulk Root Bark Quotes and Lab Reports',
  description: `Write to ${BRAND.name} by form, email or phone about an order, a bulk quote, a lab report or a privacy request, and see which details get you a fast answer.`,
  path: url.contact(),
})

const REVIEWED = '2026-08-28'

/**
 * The form and the addresses, together.
 *
 * There WAS no form here, on the reasoning that a second intake path creates a
 * queue nobody watches. That reasoning still holds — and is exactly why the form
 * feeds `SupportThread`, the same model the chat writes to and the admin inbox
 * reads, rather than a new table. One queue, two doors into it.
 *
 * The address stays. Some people will always rather use their own mail client,
 * and taking that away to force a form is a worse experience for them, not a
 * better one. It is ONE address — the business has a single mailbox (see
 * lib/site/company-email.ts) — and the three channels below are what to write
 * about, not where to write.
 */
const CHANNELS = [
  {
    heading: 'An order you already placed',
    body: 'Put your Order ID in the message; you will find it in the subject of your confirmation email. Having it up front means we can open the order straight away.',
    action: { label: 'Look up an order', href: url.account() },
  },
  {
    heading: 'Everything else',
    body: 'Write about products, lab reports, shipping, returns or privacy requests here. For whether something can ship to your state, the state pages are quicker than waiting for us.',
    action: { label: 'Check what ships to you', href: url.shopNearMe() },
  },
  {
    heading: 'Wholesale and volume',
    body: 'Resellers, standing supply and volume pricing all start with three facts: which product line, how much, and the state it ships to. Send those and we reply with a quote.',
    action: { label: 'Bulk purchasing', href: url.bulk() },
  },
] as const

const TOPICS = ['order', 'bulk', 'general'] as const

function isTopic(value: unknown): value is ContactTopic {
  return typeof value === 'string' && (TOPICS as readonly string[]).includes(value)
}

/** Reads `?topic=` so /bulk can land a wholesale enquiry on the right inbox. */
async function PreselectedForm({
  topic,
}: {
  topic: Promise<{ topic?: string | string[] }>
}) {
  const params = await topic
  const raw = Array.isArray(params.topic) ? params.topic[0] : params.topic
  return <ContactForm defaultTopic={isTopic(raw) ? raw : 'general'} />
}

export default async function ContactPage({
  searchParams,
}: {
  searchParams: Promise<{ topic?: string | string[] }>
}) {
  const email = await getCompanyEmail()
  const jsonLd = [
    {
      '@context': 'https://schema.org',
      '@type': 'ContactPage',
      name: `Contact ${BRAND.name}`,
      url: absoluteUrl(url.contact()),
      lastReviewed: REVIEWED,
      mainEntity: organization(email),
    },
    breadcrumbList([{ name: 'Contact', path: url.contact() }]),
  ]

  return (
    <main>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdScript(jsonLd) }}
      />

      {/*
        Centred and alone. The summary said "email reaches a person, we reply within
        one business day" — which the channel cards immediately below say again, each
        with the address and the actual turnaround. One of the two was redundant, and
        it was the one that made the reader take a sentence on trust before showing
        them the thing itself.
      */}
      <PageSection first>
        <PageHeader align="center" title="Contact us" />
      </PageSection>

      {/*
        TWO COLUMNS, and the split is by JOB rather than by weight.

        Left is the thing you came to do. Right is what you need in order to
        decide whether to do it here or somewhere else.

        The column is capped at 40rem for one reason: a form field is only as
        usable as it is scannable, and on a 1920px display the full-width version
        of this page gave the name field 830px and the message box 1670px. A
        1670px-wide textarea is not generous, it is a field whose start and end
        cannot be held in one look. Capping the column fixes every field at once
        without a single width on a single input.

        The remainder goes to the aside rather than to empty gutters — at 1920 it
        is wide enough that the channels run two-up, so the page still occupies
        the screen it was given.
      */}
      <PageSection tone="sunken">
        <div className="grid items-start gap-10 xl:grid-cols-[minmax(0,40rem)_minmax(0,1fr)] xl:gap-14">
        {/*
          Isolated behind Suspense because it reads `?topic=` — one searchParam
          read in the page body would opt this whole route out of prerendering,
          and this is a page an answer engine should be able to read from a
          static shell.
        */}
        <Suspense
          fallback={<div className="h-[34rem] rounded-xl border border-border bg-surface" />}
        >
          <PreselectedForm topic={searchParams} />
        </Suspense>

        <aside>
          <h2 className="font-display text-2xl text-balance text-foreground">
            Or reach us directly
          </h2>
          <p className="mt-2 max-w-[62ch] leading-relaxed text-pretty text-foreground-muted">
            A single email address and a single phone number cover orders, product
            questions and bulk inquiries alike. Naming the topic in your subject line
            helps us route it.
          </p>
          {/*
            Both on their own line and both a real link — `mailto:` and `tel:` — so a
            phone opens the dialler with one tap instead of making someone select and
            copy a number. `min-h-11` keeps each inside the 44px touch target.
          */}
          <p className="mt-4">
            <a
              href={`mailto:${email}`}
              className="inline-flex min-h-11 items-center font-display text-xl break-all text-primary underline underline-offset-4"
            >
              {email}
            </a>
          </p>
          <p className="mt-1">
            <a
              href={`tel:${BRAND.phoneE164}`}
              className="inline-flex min-h-11 items-center font-display text-xl text-primary underline underline-offset-4"
            >
              {BRAND.phone}
            </a>
          </p>
          <PostalAddress className="mt-2 text-foreground-muted" />

          {/*
            A ruled list, not three bordered cards.

            Boxing each channel gave the aside the same visual weight as the form
            beside it, so the page read as two competing offers rather than one
            action with a reference panel next to it. Rules separate them for a
            fraction of the ink — the same idiom the trust rail on the home page
            uses.
          */}
          {/*
            Three across when there is room, not two — three items in two columns
            always strands the third beside an empty cell.
          */}
          <ul className="mt-6 divide-y divide-border border-y border-border min-[1500px]:grid min-[1500px]:grid-cols-3 min-[1500px]:gap-x-8 min-[1500px]:divide-y-0">
            {CHANNELS.map((c) => (
              <li key={c.heading} className="py-5">
                <h3 className="font-display text-lg text-foreground">{c.heading}</h3>
                <p className="mt-1.5 max-w-[62ch] text-sm leading-relaxed text-pretty text-foreground-muted">
                  {c.body}
                </p>
                <p className="mt-2 flex flex-wrap items-center gap-x-6">
                  <a
                    href={c.action.href}
                    className="inline-flex min-h-11 items-center text-sm text-foreground-muted underline underline-offset-4 transition-colors hover:text-foreground"
                  >
                    {c.action.label}
                  </a>
                </p>
              </li>
            ))}
          </ul>

          <section className="mt-8 rounded-xl border border-border bg-surface p-5">
            <h2 className="font-display text-lg text-foreground">
              Outside what we can answer
            </h2>
            <p className="mt-2 max-w-[68ch] text-sm leading-relaxed text-pretty text-foreground-muted">
              Whether you may possess or use a product where you live is a legal
              question, and we are not able to give legal advice; medical advice is
              off the table entirely. Each state page instead names the statute behind
              our position and when we last reviewed it, so you can judge our reading
              for yourself.
            </p>
            <p className="mt-3">
              <a
                href={url.legalityHub()}
                className="inline-flex min-h-11 items-center text-sm text-primary underline underline-offset-4"
              >
                Legality by state
              </a>
            </p>
          </section>
        </aside>
        </div>

        <FdaDisclaimer className="mt-12" />
      </PageSection>
    </main>
  )
}
