import { heroSrc, isHeroKey } from '@/lib/content/hero-image'
import { notFound } from 'next/navigation'
import { db } from '@/lib/db/client'
import { AdminPage } from '@/components/admin/shell'
import { ContentEditor } from '@/components/admin/content-editor'
import { contentEditorOptions } from '@/lib/content/editor-options'

export const metadata = { title: 'Edit piece' }

export default async function EditContentPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ kind?: string }>
}) {
  const [{ id }, { kind: raw }] = await Promise.all([params, searchParams])
  const kind = raw === 'guide' ? 'guide' : 'post'

  const include = { author: { select: { slug: true } } } as const
  const row =
    kind === 'post'
      ? await db.post.findUnique({ where: { id }, include })
      : await db.guide.findUnique({ where: { id }, include })
  if (!row) notFound()

  const options = await contentEditorOptions()

  return (
    <AdminPage
      title={row.title}
      description={
        row.isPublished
          ? 'Live. Saving updates the page readers see and tells search engines it changed.'
          : 'Draft. Nobody can see this until it is published from the list.'
      }
    >
      <div className="max-w-3xl">
        <ContentEditor
          kind={kind}
          options={options}
          initial={{
            id: row.id,
            slug: row.slug,
            title: row.title,
            summary: row.summary,
            body: row.body,
            category: 'category' in row ? (row.category ?? null) : null,
            authorSlug: row.author?.slug ?? 'editorial-team',
            recommendedProductSlugs: row.recommendedProductSlugs,
            pillarSlug: 'pillarSlug' in row ? (row.pillarSlug ?? null) : null,
            heroImageKey: row.heroImageKey ?? null,
            heroImageUrl: row.heroImageKey && isHeroKey(row.heroImageKey) ? (heroSrc(row.heroImageKey) ?? null) : null,
            clusterSlugs: 'clusterSlugs' in row ? row.clusterSlugs : [],
            metaTitle: row.metaTitle,
            metaDesc: row.metaDesc,
          }}
        />
      </div>
    </AdminPage>
  )
}
