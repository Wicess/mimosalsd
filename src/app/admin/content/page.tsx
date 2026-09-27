/*
 * compliance-allow: psilocybin -- this page SCANS content for that term. Naming it in
 * the allow-list passed to the scanner is unavoidable, and it is the opposite of
 * asserting it about a product.
 */
import { publishedGuides, publishedPosts, GUIDES, POSTS } from '@/lib/content/content.data'
import { scanText } from '@/lib/compliance/lexicon'
import { AdminPage, Cell, DataTable, EmptyState, Row, StatCard } from '@/components/admin/shell'
import { InlineAction } from '@/components/admin/forms'
import { ButtonLink } from '@/components/ui/button'
import { setContentPublished } from '@/app/actions/admin-content'
import { db } from '@/lib/db/client'
import { splitParagraphs } from '@/lib/content/posted-content'
import { Badge } from '@/components/ui/badge'
import { url } from '@/lib/seo/routes'

/**
 * Pieces written in this panel — drafts and live alike.
 *
 * Scanned with `honourDirectives: false`, unlike the authored table below. A
 * directive in a repository file was reviewed in a diff; one typed into the editor
 * was not, and this badge has to show what the gate will actually do on publish.
 */
async function WrittenHere() {
  const include = { author: { select: { slug: true } } } as const
  const [posts, guides] = await Promise.all([
    db.post.findMany({ include, orderBy: { updatedAt: 'desc' } }).catch(() => []),
    db.guide.findMany({ include, orderBy: { updatedAt: 'desc' } }).catch(() => []),
  ])
  const rows = [
    ...guides.map((g) => ({ ...g, kind: 'guide' as const, href: url.guide(g.slug) })),
    ...posts.map((p) => ({ ...p, kind: 'post' as const, href: url.blogPost(p.slug) })),
  ]

  if (rows.length === 0) {
    return (
      <EmptyState
        title="Nothing written here yet"
        hint="Blogs and guides written in this panel are saved as drafts, checked against the compliance lexicon, and go live only when you publish them."
      />
    )
  }

  return (
    <DataTable headers={['Title', 'Type', 'Lexicon', 'Status', '']}>
      {rows.map((row) => {
        const scan = scanText(
          [row.title, row.summary, ...splitParagraphs(row.body), row.metaTitle, row.metaDesc]
            .filter(Boolean)
            .join('\n'),
          { productLines: ['MIMOSA_HOSTILIS', 'AMANITA', 'VAPE'], honourDirectives: false, editorial: true },
        )
        return (
          <Row key={`${row.kind}-${row.id}`}>
            <Cell>
              <a
                href={`/admin/content/${row.id}?kind=${row.kind}`}
                className="font-medium text-foreground underline underline-offset-4"
              >
                {row.title}
              </a>
              <span className="mt-0.5 block text-xs text-foreground-subtle">
                {row.isPublished ? (
                  <a href={row.href} className="underline underline-offset-4">
                    {row.href}
                  </a>
                ) : (
                  row.href
                )}
              </span>
            </Cell>
            <Cell>
              <Badge tone={row.kind === 'guide' ? 'accent' : 'neutral'}>
                {row.kind === 'guide' ? 'Guide' : 'Blog'}
              </Badge>
            </Cell>
            <Cell>
              {scan.clean ? (
                <Badge tone="success">clean</Badge>
              ) : (
                <Badge tone="danger">{scan.blocking.map((m) => m.term).join(', ')}</Badge>
              )}
            </Cell>
            <Cell>
              <Badge tone={row.isPublished ? 'success' : 'warning'}>
                {row.isPublished ? 'live' : 'draft'}
              </Badge>
            </Cell>
            <Cell>
              <InlineAction
                action={setContentPublished}
                label={row.isPublished ? 'Unpublish' : 'Publish'}
                fields={{ kind: row.kind, id: row.id, publish: row.isPublished ? 'false' : 'true' }}
                {...(row.isPublished
                  ? { confirm: 'Unpublish this page? It will stop being reachable, and search engines will be told it is gone.' }
                  : {})}
              />
            </Cell>
          </Row>
        )
      })}
    </DataTable>
  )
}

async function Content() {
  const items = [
    ...GUIDES.map((g) => ({ ...g, kind: 'Guide' as const, href: url.guide(g.slug) })),
    ...POSTS.map((p) => ({ ...p, kind: 'Blog' as const, href: url.blogPost(p.slug) })),
  ]

  return (
    <>
      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Guides" value={publishedGuides().length} hint="pillar content" />
        <StatCard label="Blogs" value={publishedPosts().length} hint="cluster content" />
        <StatCard label="Drafts" value={items.filter((i) => !i.isPublished).length} />
        <StatCard
          label="Answer-first"
          value={`${items.filter((i) => i.summary.split(/\s+/).length >= 30).length}/${items.length}`}
          hint="summaries long enough to be extractable"
        />
      </div>

      <DataTable headers={['Title', 'Type', 'Summary words', 'Recommends', 'Lexicon', 'Status']}>
        {items.map((item) => {
          const scan = scanText(`${item.title} ${item.summary} ${item.body.join(' ')}`, {
            extraAllowedTerms: ['psilocybin'],
            editorial: true,
          })
          const words = item.summary.split(/\s+/).filter(Boolean).length
          return (
            <Row key={item.slug}>
              <Cell>
                <a href={item.href} className="font-medium text-foreground underline underline-offset-4">
                  {item.title}
                </a>
                <span className="mt-0.5 block text-xs text-foreground-subtle">
                  updated {item.updatedAt}
                </span>
              </Cell>
              <Cell>
                <Badge tone={item.kind === 'Guide' ? 'accent' : 'neutral'}>{item.kind}</Badge>
              </Cell>
              {/*
                40–60 words is the answer-first target: long enough for an answer engine
                to lift and answer the question, short enough to stay an answer.
              */}
              <Cell className="tabular text-foreground">
                <span className={words < 30 || words > 80 ? 'text-warning-fg' : ''}>{words}</span>
              </Cell>
              <Cell className="tabular text-xs text-foreground-muted">
                {item.recommendedProductSlugs.length}
              </Cell>
              <Cell>
                {scan.clean ? (
                  <Badge tone="success">clean</Badge>
                ) : (
                  <Badge tone="danger">{scan.blocking.map((m) => m.term).join(', ')}</Badge>
                )}
              </Cell>
              <Cell>
                <Badge tone={item.isPublished ? 'success' : 'warning'}>
                  {item.isPublished ? 'published' : 'draft'}
                </Badge>
              </Cell>
            </Row>
          )
        })}
      </DataTable>
    </>
  )
}

export default function AdminContentPage() {
  return (
    <AdminPage
      title="Guides & blogs"
      actions={
        <>
          <ButtonLink href="/admin/content/new?kind=post" variant="primary" size="sm">
            New blog
          </ButtonLink>
          <ButtonLink href="/admin/content/new?kind=guide" variant="secondary" size="sm">
            New guide
          </ButtonLink>
        </>
      }
      description="Every piece is scanned against the compliance lexicon here, before publish. Blogs are informative first and convert through contextual product recommendation — never hype, never a health claim."
    >
      <h2 className="font-display mb-3 text-lg text-foreground">Written in this panel</h2>
      <div className="mb-10">
        <WrittenHere />
      </div>

      <h2 className="font-display mb-3 text-lg text-foreground">Authored in the repository</h2>
      <p className="mb-4 max-w-2xl text-sm text-foreground-muted">
        These live in the codebase and change with a deploy. They are the source of truth
        for their own addresses — nothing written above can take one over.
      </p>
      <Content />
    </AdminPage>
  )
}
