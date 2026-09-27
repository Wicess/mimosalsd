import type { Metadata } from 'next'
import { FAQ_CATEGORIES, FAQ_ITEMS } from '@/lib/content/faq'
import { withCompanyEmail } from '@/lib/site/company-email.server'
import { FaqList } from '@/components/content/faq-list'
import { FdaDisclaimer } from '@/components/compliance/fda-disclaimer'
import { url } from '@/lib/seo/routes'
import { breadcrumbList, faqPage, jsonLdScript } from '@/lib/seo/structured-data'
import { sectionId } from '@/components/content/policy-prose'
import { pageMetadata } from '@/lib/seo/meta'
import { PageHeader } from '@/components/layout/page-header'
import { PageSection } from '@/components/layout/page-section'

export const metadata: Metadata = pageMetadata({
  title: 'Frequently Asked Questions',
  description: 'Straight answers on how ordering and payment work, what ships to your state, why vapor products travel separately, and what our lab panels actually cover.',
  path: url.faq(),
})

export default async function FaqPage() {
  // Answers carry the company-email token; fill it before rendering OR marking up.
  const items = await withCompanyEmail(FAQ_ITEMS)
  /*
    Built from the SAME array the page renders below, so the markup can never
    describe an answer a visitor cannot read — the rule that the product page's
    removed `aggregateRating` broke.
  */
  const jsonLd = [
    faqPage(items.map((i) => ({ question: i.question, answer: i.answer }))),
    breadcrumbList([{ name: 'FAQ', path: url.faq() }]),
  ]

  return (
    <main>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdScript(jsonLd) }}
      />

      <PageSection first>
        {/*
          Reading column plus a sticky category rail — the same shape as the policy
          pages. An FAQ is the page people arrive at mid-scroll from a search result,
          so keeping the categories in view is worth more than a wider paragraph.
        */}
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_19rem] lg:gap-14">
          <div className="min-w-0">
        <PageHeader
          className="mb-10"
          title="Frequently asked questions"
          summary="The questions we are actually asked, answered directly."
        />

        {FAQ_CATEGORIES.map((category) => (
          <section key={category} className="mt-12">
            <h2
              id={sectionId(category)}
              className="scroll-mt-24 font-display text-2xl text-foreground"
            >
              {category}
            </h2>

            {/*
              Dropdowns, closed by default.

              Twenty answers open at once is a wall nobody scrolls, and the category rail
              beside this exists precisely because people arrive looking for one question.
              Native `<details>`, so every answer is still in the HTML for a crawler and
              the disclosure works with JavaScript off.
            */}
            <FaqList
              className="mt-4"
              items={items.filter((i) => i.category === category)}
              idFor={sectionId}
            />
          </section>
        ))}

          </div>
          <aside className="lg:sticky lg:top-24 lg:self-start">
            <nav aria-label="Question categories" className="rounded-lg border border-border bg-surface-sunken p-5">
              <h2 className="text-xs font-medium tracking-[0.2em] text-foreground-subtle uppercase">
                Categories
              </h2>
              <ul className="mt-3 grid gap-1 sm:grid-cols-2 lg:grid-cols-1">
                {FAQ_CATEGORIES.map((c) => (
                  <li key={c}>
                    <a
                      href={`#${sectionId(c)}`}
                      className="inline-flex min-h-11 items-center text-sm leading-snug text-foreground-muted underline-offset-4 hover:text-foreground hover:underline"
                    >
                      {c}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          </aside>
        </div>
      </PageSection>

      <PageSection tone="sunken">
        <nav aria-label="Related pages">
          <h2 className="text-xs font-medium tracking-[0.2em] text-foreground-subtle uppercase">
            Still looking
          </h2>
          <ul className="mt-3 flex flex-wrap gap-x-6 gap-y-2">
            {[
              [url.legalityHub(), 'Legality by state'],
              [url.shopNearMe(), 'What ships to you'],
              [url.labResults(), 'Lab results'],
              [url.policy('shipping'), 'Shipping policy'],
              [url.policy('returns'), 'Returns and refunds'],
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
