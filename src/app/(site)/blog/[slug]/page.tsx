import type { Metadata } from 'next'
import Image from 'next/image'
import { AnswerFirst } from '@/components/content/answer-first'
import { notFound } from 'next/navigation'
import { Suspense } from 'react'
import { getAuthor, publishedPosts } from '@/lib/content/content.data'
import { getAnyGuide, getAnyPost, listAllPosts } from '@/lib/content/merged-content'
import { postCardImage, postImages, relatedPosts } from '@/lib/content/post-images'
import { imageSrc } from '@/lib/catalog/sample-images'
import { heroAlt, heroSrc, isHeroKey } from '@/lib/content/hero-image'
import { RecommendedProducts } from '@/components/marketing/recommended-products'
import { RichText, citationsIn } from '@/components/content/rich-text'
import { parseTable } from '@/lib/content/table'
import { FdaDisclaimer } from '@/components/compliance/fda-disclaimer'
import { PageSection } from '@/components/layout/page-section'
import { BRAND } from '@/lib/brand'
import { absoluteUrl, url } from '@/lib/seo/routes'
import { breadcrumbList, jsonLdScript } from '@/lib/seo/structured-data'
import { pageMetadata } from '@/lib/seo/meta'

export async function generateStaticParams() {
  return publishedPosts().map((p) => ({ slug: p.slug }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  // Merged: an article published from the admin panel resolves here too.
  // `generateStaticParams` above stays on the authored list — those are prerendered,
  // and an admin-published slug renders on demand.
  const post = await getAnyPost(slug)
  if (!post) return {}
  // The on-page summary stays long — it is the answer-first extraction block. Only
  // the meta tag is clamped, so the SERP snippet never truncates mid-sentence.
  /*
    The article's own hero becomes its share card where it has one. Without this the
    card falls back to the generic site image, which is correct but identical across
    every article — and a link pasted into a forum is one of the few distribution
    routes this business actually has.
  */
  const heroKey = post.heroImageKey && isHeroKey(post.heroImageKey) ? heroSrc(post.heroImageKey) : undefined

  return pageMetadata({
    title: post.metaTitle ?? post.title,
    description: post.metaDesc ?? post.summary,
    path: url.blogPost(slug),
    type: 'article',
    publishedTime: post.publishedAt,
    modifiedTime: post.updatedAt,
    ...(heroKey ? { image: { url: heroKey, alt: heroAlt(post.title) } } : {}),
  })
}

/**
 * One block of a blog body. A block starting with "## " is a subheading; a block
 * whose every line starts with "- " is a bulleted list; anything else is a
 * paragraph. The same plain-text convention works for posts written in the admin,
 * where blocks are separated by a blank line.
 *
 * A block written as a pipe table renders as a table (see lib/content/table.ts). It
 * scrolls sideways inside its own box at 375px rather than widening the page, and the
 * box takes focus so a keyboard user can scroll it too.
 */
function BodyBlock({ block }: { block: string }) {
  if (block.startsWith('## ')) {
    return <h2 className="pt-4 font-display text-2xl text-foreground max-md:text-xl">{block.slice(3)}</h2>
  }
  const table = parseTable(block)
  if (table) {
    return (
      <div
        role="region"
        aria-label={`Table: ${table.header.join(', ')}`}
        tabIndex={0}
        className="overflow-x-auto rounded-lg border border-border focus-visible:outline-2 focus-visible:outline-offset-2"
      >
        <table className="w-full min-w-[32rem] border-collapse text-left text-sm leading-relaxed">
          <thead className="bg-surface">
            <tr>
              {table.header.map((cell, i) => (
                <th key={i} scope="col" className="border-b border-border px-4 py-3 font-semibold text-foreground">
                  <RichText text={cell} />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {table.rows.map((row, r) => (
              <tr key={r} className="border-b border-border last:border-b-0">
                {row.map((cell, c) =>
                  c === 0 ? (
                    <th key={c} scope="row" className="px-4 py-3 align-top font-medium text-foreground">
                      <RichText text={cell} />
                    </th>
                  ) : (
                    <td key={c} className="px-4 py-3 align-top text-foreground-muted">
                      <RichText text={cell} />
                    </td>
                  ),
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }
  const lines = block.split('\n').map((line) => line.trim()).filter(Boolean)
  if (lines.length > 0 && lines.every((line) => line.startsWith('- '))) {
    return (
      <ul className="list-disc space-y-2 pl-5 text-base leading-relaxed text-foreground marker:text-foreground-subtle">
        {lines.map((line, i) => (
          <li key={i}>
            <RichText text={line.slice(2)} />
          </li>
        ))}
      </ul>
    )
  }
  return (
    <p className="text-base leading-relaxed text-foreground">
      <RichText text={block} />
    </p>
  )
}

async function PostBody({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const post = await getAnyPost(slug)
  if (!post) notFound()

  const author = getAuthor(post.authorSlug)
  // Merged, so an article can link up to a guide that was itself published here.
  const pillar = post.pillarSlug ? await getAnyGuide(post.pillarSlug) : undefined
  const images = postImages(post)
  const related = relatedPosts(post, await listAllPosts())
  /*
    The inside image goes in front of the first subheading in the second half of the
    post, so it never splits a heading from its text. A post without subheadings gets
    it halfway through, after a paragraph.
  */
  const middle = Math.floor(post.body.length / 2)
  const nextHeading = post.body.findIndex((block, i) => i >= middle && block.startsWith('## '))
  const imageBefore = Math.min(post.body.length, nextHeading > 0 ? nextHeading : Math.max(1, middle))

  /*
    The article's own image when one was uploaded, else the topic-matched product
    photograph postImages() picks. The same resolved value feeds the markup, the
    Article JSON-LD and the share card, so the three cannot disagree about which
    picture this article has.
  */
  const uploadedHero = post.heroImageKey && isHeroKey(post.heroImageKey) ? heroSrc(post.heroImageKey) : undefined
  const hero = uploadedHero
    ? { src: uploadedHero, alt: heroAlt(post.title) }
    : { src: imageSrc(images.main), alt: images.main.alt }

  const jsonLd = [
    {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: post.title,
    description: post.summary,
    image: hero.src.startsWith('http') ? hero.src : absoluteUrl(hero.src),
    datePublished: post.publishedAt,
    dateModified: post.updatedAt,
    author: author
      ? { '@type': 'Person', name: author.name, jobTitle: author.title }
      : { '@type': 'Organization', name: BRAND.name },
    publisher: { '@type': 'Organization', name: BRAND.name },
    mainEntityOfPage: absoluteUrl(url.blogPost(slug)),
    // The primary sources the body links to, so the claim and its source travel together.
    ...(citationsIn(post.body).length > 0 ? { citation: citationsIn(post.body) } : {}),
    },
    breadcrumbList([
      { name: 'Guides & blogs', path: url.blog() },
      { name: post.title, path: url.blogPost(slug) },
    ]),
  ]

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdScript(jsonLd) }} />

      <PageSection first>

      <nav aria-label="Breadcrumb" className="text-sm text-foreground-muted">
        <a href={url.blog()} className="inline-flex min-h-11 items-center underline underline-offset-4">Guides & blogs</a>
        <span aria-hidden> / </span>
        <span className="text-foreground">{post.title}</span>
      </nav>

      <h1 className="mt-4 font-display text-4xl text-foreground max-md:text-3xl">{post.title}</h1>

      {/* The main image. */}
      <div className="relative mt-6 aspect-[16/9] overflow-hidden rounded-xl bg-surface-sunken">
        <Image
          src={hero.src}
          alt={hero.alt}
          fill
          priority
          sizes="(max-width: 768px) 100vw, 896px"
          className="object-cover"
        />
      </div>

      {/* Answer-first. The block an answer engine lifts. */}
      <AnswerFirst>
        {post.summary}
      </AnswerFirst>

      <p className="mt-4 text-sm text-foreground-muted">
        {author && (
          <>
            {author.name} · {author.title} ·{' '}
          </>
        )}
        Updated{' '}
        <time dateTime={post.updatedAt}>
          {new Date(post.updatedAt).toLocaleDateString('en-US', {
            year: 'numeric', month: 'long', day: 'numeric',
          })}
        </time>
      </p>

      <div className="mt-8 space-y-5">
        {post.body.map((block, i) => (
          <div key={i} className="space-y-5">
            {i === imageBefore ? (
              <figure className="my-8">
                <div className="relative aspect-[4/3] overflow-hidden rounded-xl bg-surface-sunken md:aspect-[16/9]">
                  <Image
                    src={imageSrc(images.inline)}
                    alt={images.inline.alt}
                    fill
                    sizes="(max-width: 768px) 100vw, 896px"
                    className="object-cover"
                  />
                </div>
              </figure>
            ) : null}
            <BodyBlock block={block} />
            {i === post.body.length - 1 && imageBefore === post.body.length ? (
              <figure className="my-8">
                <div className="relative aspect-[4/3] overflow-hidden rounded-xl bg-surface-sunken md:aspect-[16/9]">
                  <Image src={imageSrc(images.inline)} alt={images.inline.alt} fill sizes="(max-width: 768px) 100vw, 896px" className="object-cover" />
                </div>
              </figure>
            ) : null}
          </div>
        ))}
      </div>

      {/* Links UP to its pillar. Authority flows in a loop, not a tree. */}
      {pillar && (
        <p className="mt-8 rounded-lg border border-border bg-surface-sunken p-4 text-sm">
          Part of our guide:{' '}
          <a href={url.guide(pillar.slug)} className="text-primary underline underline-offset-4">
            {pillar.title}
          </a>
        </p>
      )}

      <RecommendedProducts slugs={post.recommendedProductSlugs} />

      </PageSection>

      {related.length > 0 ? (
        <PageSection tone="sunken">
          <h2 className="font-display text-2xl text-foreground">More blogs</h2>
          <ul className="mt-5 grid gap-5 md:grid-cols-3">
            {related.map((other) => {
              // The article's own picture, not the topic photograph three of these used to share.
              const cover = postCardImage(other)
              return (
                <li key={other.slug}>
                  <a href={url.blogPost(other.slug)} className="group block overflow-hidden rounded-lg border border-border bg-surface">
                    <div className="relative aspect-[16/10] bg-surface-sunken">
                      <Image
                        src={cover.src}
                        alt={cover.alt}
                        fill
                        sizes="(max-width: 768px) 100vw, 33vw"
                        className="object-cover transition-transform duration-300 group-hover:scale-[1.02] motion-reduce:transition-none"
                      />
                    </div>
                    <div className="p-4">
                      <h3 className="font-medium text-foreground group-hover:underline group-hover:underline-offset-4">{other.title}</h3>
                      <p className="mt-1 line-clamp-3 text-sm leading-relaxed text-foreground-muted">{other.summary}</p>
                    </div>
                  </a>
                </li>
              )
            })}
          </ul>
        </PageSection>
      ) : null}

      <PageSection tone="sunken">
      <FdaDisclaimer className="mt-10" />
      </PageSection>
    </>
  )
}

export default function BlogPostPage({ params }: { params: Promise<{ slug: string }> }) {
  return (
    <main>
      <Suspense fallback={<div className="shell py-12"><div className="min-h-[70vh] animate-pulse rounded-lg bg-surface-sunken" aria-hidden /></div>}>
        <PostBody params={params} />
      </Suspense>
    </main>
  )
}
