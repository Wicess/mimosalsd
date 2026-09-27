import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getPolicy, POLICIES } from '@/lib/content/policies'
import { withCompanyEmail } from '@/lib/site/company-email.server'
import { FdaDisclaimer } from '@/components/compliance/fda-disclaimer'
import { PageSection } from '@/components/layout/page-section'
import { PolicyProse } from '@/components/content/policy-prose'
import { absoluteUrl, url } from '@/lib/seo/routes'
import { breadcrumbList, jsonLdScript, organizationRef } from '@/lib/seo/structured-data'
import { pageMetadata } from '@/lib/seo/meta'

export function generateStaticParams() {
  return POLICIES.map((p) => ({ policy: p.slug }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ policy: string }>
}): Promise<Metadata> {
  const { policy: slug } = await params
  const policy = getPolicy(slug)
  if (!policy) return {}
  return pageMetadata({
    title: policy.metaTitle,
    description: policy.metaDescription,
    path: url.policy(policy.slug),
  })
}

export default async function PolicyPage({
  params,
}: {
  params: Promise<{ policy: string }>
}) {
  const { policy: slug } = await params
  // Policy text carries the company-email token; fill it before anything renders.
  const policy = await withCompanyEmail(getPolicy(slug))
  if (!policy) notFound()

  const path = url.policy(policy.slug)

  /*
    `WebPage`, not `Article`. These are standing terms rather than editorial writing,
    and `lastReviewed` is the field that actually matters here — a buyer and an answer
    engine both want to know how current a policy is, not who wrote it.
  */
  const jsonLd = [
    {
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      name: policy.title,
      description: policy.metaDescription,
      url: absoluteUrl(path),
      lastReviewed: policy.lastReviewedAt,
      datePublished: policy.lastReviewedAt,
      dateModified: policy.lastReviewedAt,
      publisher: organizationRef(),
      isPartOf: { '@id': absoluteUrl('/#website') },
    },
    breadcrumbList([
      { name: 'Policies', path },
      { name: policy.title, path },
    ]),
  ]

  return (
    <main>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdScript(jsonLd) }}
      />

      <PageSection first>
        <PolicyProse
        title={policy.title}
        summary={policy.summary}
        lastReviewedAt={policy.lastReviewedAt}
        sections={policy.sections}
        related={POLICIES.filter((p) => p.slug !== policy.slug).map((p) => ({
          label: p.title,
          href: url.policy(p.slug),
        }))}
      />

      </PageSection>

      <PageSection tone="sunken">
        <FdaDisclaimer className="mt-12" />
      </PageSection>
    </main>
  )
}
