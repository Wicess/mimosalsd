import type { Metadata } from 'next'
import { AnswerFirst } from '@/components/content/answer-first'
import { notFound } from 'next/navigation'
import { Suspense } from 'react'
import { getAuthor, publishedGuides } from '@/lib/content/content.data'
import { getAnyGuide, getAnyPost, listAllPosts } from '@/lib/content/merged-content'
import { RecommendedProducts } from '@/components/marketing/recommended-products'
import { FdaDisclaimer } from '@/components/compliance/fda-disclaimer'
import { PageSection } from '@/components/layout/page-section'
import { BRAND } from '@/lib/brand'
import { absoluteUrl, url } from '@/lib/seo/routes'
import { breadcrumbList, jsonLdScript } from '@/lib/seo/structured-data'
import { pageMetadata } from '@/lib/seo/meta'

/**
 * Pillar guides.
 *
 * Long-form and comprehensive because LLMs preferentially cite that shape of content,
 * and because these are the pages most likely to be someone's first contact with us.
 */
export async function generateStaticParams() {
  return publishedGuides().map((g) => ({ slug: g.slug }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const guide = await getAnyGuide(slug)
  if (!guide) return {}
  // See the blog post route: long summary on the page, clamped summary in the tag.
  return pageMetadata({
    title: guide.metaTitle ?? guide.title,
    description: guide.metaDesc ?? guide.summary,
    path: url.guide(slug),
    type: 'article',
    publishedTime: guide.publishedAt,
    modifiedTime: guide.updatedAt,
  })
}

async function GuideBody({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const guide = await getAnyGuide(slug)
  if (!guide) notFound()

  const author = getAuthor(guide.authorSlug)
  // Merged, and unpublished or missing cluster posts dropped — a guide linking down to
  // a draft would be linking its readers to a 404.
  /*
    The cluster is the hand-written list PLUS every published post that names this
    guide as its pillar.

    clusterSlugs alone was one-directional: a post could point up at a pillar and the
    pillar would never point back, so fifty-one articles named this guide and none of
    them appeared on it. Computing the other half means the loop closes the moment a
    post is published, rather than when somebody remembers to edit an array in code.
    Authored order is preserved first; the rest follow, newest first.
  */
  const named = (await Promise.all(guide.clusterSlugs.map((s) => getAnyPost(s)))).filter(
    (p): p is NonNullable<typeof p> => Boolean(p),
  )
  const namedSlugs = new Set(named.map((p) => p.slug))
  const pointingHere = (await listAllPosts())
    .filter((p) => p.pillarSlug === guide.slug && !namedSlugs.has(p.slug))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  const cluster = [...named, ...pointingHere]

  const jsonLd = [
    {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: guide.title,
    description: guide.summary,
    datePublished: guide.publishedAt,
    dateModified: guide.updatedAt,
    author: author
      ? { '@type': 'Person', name: author.name, jobTitle: author.title }
      : { '@type': 'Organization', name: BRAND.name },
    publisher: { '@type': 'Organization', name: BRAND.name },
    mainEntityOfPage: absoluteUrl(url.guide(slug)),
    },
    breadcrumbList([
      { name: 'Guides & blogs', path: url.blog() },
      { name: guide.title, path: url.guide(slug) },
    ]),
  ]

  return (
    <>
      <PageSection first>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdScript(jsonLd) }} />

      <nav aria-label="Breadcrumb" className="text-sm text-foreground-muted">
        <a href={url.blog()} className="inline-flex min-h-11 items-center underline underline-offset-4">Guides & blogs</a>
        <span aria-hidden> / </span>
        <span className="text-foreground">{guide.title}</span>
      </nav>

      <h1 className="mt-4 font-display text-4xl text-foreground">{guide.title}</h1>

      <AnswerFirst>
        {guide.summary}
      </AnswerFirst>

      <p className="mt-4 text-sm text-foreground-muted">
        {author && (
          <>
            {author.name} · {author.title} ·{' '}
          </>
        )}
        Updated{' '}
        <time dateTime={guide.updatedAt}>
          {new Date(guide.updatedAt).toLocaleDateString('en-US', {
            year: 'numeric', month: 'long', day: 'numeric',
          })}
        </time>
      </p>

      <div className="mt-8 space-y-5">
        {guide.body.map((para, i) => (
          <p key={i} className="text-base leading-relaxed text-foreground">
            {para}
          </p>
        ))}
      </div>

      {/* Links DOWN to its cluster. The other half of the loop. */}
      {cluster.length > 0 && (
        <section className="mt-10">
          <h2 className="font-display text-2xl text-foreground">Read next</h2>
          <ul className="mt-4 space-y-3">
            {cluster.map((p) => (
              <li key={p.slug} className="rounded-lg border border-border bg-surface p-4">
                <a href={url.blogPost(p.slug)}>
                  <h3 className="font-medium text-foreground">{p.title}</h3>
                  <p className="mt-1 text-sm text-foreground-muted">{p.summary}</p>
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}

      </PageSection>

      <PageSection tone="sunken">
      <RecommendedProducts slugs={guide.recommendedProductSlugs} />

      {author && (
        <section className="mt-10 rounded-lg border border-border bg-surface-sunken p-5">
          <h2 className="font-display text-lg text-foreground">{author.name}</h2>
          <p className="text-sm text-foreground-subtle">{author.title}</p>
          <p className="mt-2 text-sm leading-relaxed text-foreground-muted">{author.bio}</p>
        </section>
      )}

      <FdaDisclaimer className="mt-10" />
      </PageSection>
    </>
  )
}

export default function GuidePage({ params }: { params: Promise<{ slug: string }> }) {
  return (
    <main>
      <Suspense fallback={<div className="shell py-12"><div className="min-h-[70vh] animate-pulse rounded-lg bg-surface-sunken" aria-hidden /></div>}>
        <GuideBody params={params} />
      </Suspense>
    </main>
  )
}
