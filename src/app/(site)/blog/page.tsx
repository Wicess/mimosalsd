import type { Metadata } from 'next'
import Image from 'next/image'
import { postCardImage } from '@/lib/content/post-images'
import { pageMetadata } from '@/lib/seo/meta'
import { listAllGuides, listAllPosts } from '@/lib/content/merged-content'
import { url } from '@/lib/seo/routes'
import { Badge } from '@/components/ui/badge'
import { FdaDisclaimer } from '@/components/compliance/fda-disclaimer'
import { PageSection } from '@/components/layout/page-section'
import { collectionPage, jsonLdScript } from '@/lib/seo/structured-data'
import { PageHeader } from '@/components/layout/page-header'
import { groupPostsIntoSections } from '@/lib/content/sections'

export const metadata: Metadata = pageMetadata({
  title: 'Natural Dyeing Guides, Mimosa Hostilis and Root Bark',
  description: 'How to dye wool, silk, cotton and leather with Mimosa hostilis and sassafras root bark: how much bark per pound, mordants, iron, pH and soap color.',
  path: '/blog',
})

export default async function BlogPage() {
  // Merged, so an article published from the admin panel is listed here too — the
  // index is how both readers and crawlers find a piece nothing else links to yet.
  const [guides, posts] = await Promise.all([listAllGuides(), listAllPosts()])
  const sections = groupPostsIntoSections(posts)

  return (
    <main>
      {/* Pillars first, then cluster posts — the same order the page renders them in. */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLdScript(
            collectionPage({
              name: 'Guides & blogs',
              description:
                'Cited writing on botanical dyeing, Amanita muscaria, certificates of analysis, and state-by-state shipping.',
              path: url.blog(),
              items: [
                ...guides.map((g) => ({ name: g.title, path: url.guide(g.slug) })),
                ...posts.map((p) => ({ name: p.title, path: url.blogPost(p.slug) })),
              ],
            }),
          ),
        }}
      />

      <PageSection first>
        <PageHeader
          className="mb-10"
          title="Guides & blogs"
          summary="We publish what we can verify, and cite what we rely on."
        />

        <section>
          <h2 className="font-display text-2xl text-foreground">Start here</h2>
          <ul className="mt-4 grid gap-4 lg:grid-cols-2">
            {guides.map((g) => (
              <li key={g.slug} className="rounded-lg border border-border bg-surface p-5">
                <a href={url.guide(g.slug)}>
                  <h3 className="font-display text-xl text-foreground">{g.title}</h3>
                  {/* Answer-first summary shown on the card — useful before the click. */}
                  <p className="mt-2 leading-relaxed text-foreground-muted">{g.summary}</p>
                </a>
                <p className="mt-3 text-sm text-foreground-subtle">
                  {g.clusterSlugs.length} related blog
                  {g.clusterSlugs.length === 1 ? '' : 's'}
                </p>
              </li>
            ))}
          </ul>
        </section>
      </PageSection>

      <PageSection tone="sunken">
        {/*
          Sectioned rather than one grid. At fifty-seven articles a flat list makes a
          reader scan device hardware to reach a mordanting ratio, and tells a crawler
          nothing about what this site covers. Sections come from Post.category, so
          there is one place a topic lives — see lib/content/sections.ts.
        */}
        <nav aria-label="Article sections" className="mb-10">
          <ul className="flex flex-wrap gap-2">
            {sections.map((s) => (
              <li key={s.slug}>
                <a
                  href={`#${s.slug}`}
                  className="inline-flex min-h-11 items-center rounded-full border border-border bg-surface px-4 text-sm text-foreground-muted transition-colors hover:border-foreground-subtle hover:text-foreground"
                >
                  {s.title}
                  <span className="ml-2 text-foreground-subtle">{s.posts.length}</span>
                </a>
              </li>
            ))}
          </ul>
        </nav>

        {sections.map((s) => (
          <section key={s.slug} id={s.slug} className="mb-14 scroll-mt-24 last:mb-0">
            <h2 className="font-display text-2xl text-foreground">{s.title}</h2>
            {s.intro ? (
              <p className="mt-1 max-w-prose leading-relaxed text-foreground-muted">{s.intro}</p>
            ) : null}
            <ul className="mt-5 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
              {s.posts.map((p) => {
                // The article's own image where it has one; the topic-matched
                // product photograph otherwise, so no card renders a gap.
                const { src, alt } = postCardImage(p)
                return (
                  <li key={p.slug}>
                    <a href={url.blogPost(p.slug)} className="group block h-full overflow-hidden rounded-lg border border-border bg-surface">
                      <div className="relative aspect-[16/10] bg-surface-sunken">
                        <Image
                          src={src}
                          alt={alt}
                          fill
                          sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
                          className="object-cover transition-transform duration-300 group-hover:scale-[1.02] motion-reduce:transition-none"
                        />
                      </div>
                      <div className="p-4">
                        <Badge tone="neutral">{s.title}</Badge>
                        <h3 className="mt-2 font-medium text-foreground group-hover:underline group-hover:underline-offset-4">{p.title}</h3>
                        <p className="mt-1 line-clamp-3 text-sm leading-relaxed text-foreground-muted">{p.summary}</p>
                      </div>
                    </a>
                  </li>
                )
              })}
            </ul>
          </section>
        ))}
        <FdaDisclaimer className="mt-12" />
      </PageSection>
    </main>
  )
}
