'use server'

import { revalidatePath, updateTag } from 'next/cache'
import { requireArea } from '@/lib/admin/guard'
import { recordAdminAction } from '@/lib/admin/audit'
import { db } from '@/lib/db/client'
import { listMergedProducts } from '@/lib/catalog/merged'
import { AUTHORS, GUIDES, POSTS } from '@/lib/content/content.data'
import { CONTENT_TAG, listAllGuides, listAllPosts } from '@/lib/content/merged-content'
import {
  copyForScan,
  joinParagraphs,
  readContentForm,
  splitParagraphs,
  type ContentKind,
} from '@/lib/content/posted-content'
import { scanText } from '@/lib/compliance/lexicon'
import type { ProductLine } from '@/lib/compliance/types'
import { autoMeta } from '@/lib/seo/meta'
import { isHeroKey } from '@/lib/content/hero-image'
import { prepareProductPhoto } from '@/lib/storage/product-photo'
import { putObject } from '@/lib/storage/r2'
import { submitUrl } from '@/lib/seo/indexnow'
import { reportError } from '@/lib/observability/report-error'
import { url } from '@/lib/seo/routes'

/**
 * ─────────────────────────────────────────────────────────────────────────────
 *  WRITING POSTS AND GUIDES FROM THE ADMIN PANEL.
 *
 *  ── The lexicon is the only gate this copy will ever meet ──────────────────
 *  CI scans the repository and never sees the database (CLAUDE.md rule 4), so a
 *  health claim written here is caught here or published. Two deliberate choices:
 *
 *   · `honourDirectives: false`. A `compliance-allow` directive typed into the body
 *     would otherwise switch the gate off for the words it names.
 *   · EVERY product line. Product copy is scanned against its own line; a post can
 *     discuss anything. Scoping to its recommended products would let a root-bark
 *     post that recommends nothing use extraction language — the highest-exposure
 *     words on the site — so admin-written content is held to all of them.
 *
 *  ── Saved as a draft, published on purpose ─────────────────────────────────
 *  A save never publishes. Publishing is its own action, and it re-scans the saved
 *  copy: the lexicon may have gained a term since the draft was written, and a
 *  publish is the moment the words reach a reader.
 *
 *  ── Slugs are fixed once created ───────────────────────────────────────────
 *  A published URL is inbound links and ranking history. Changing it breaks both
 *  (Bing §20), so an edit keeps the slug the piece was created with.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const AREA = '/admin/content'
const ALL_LINES: readonly ProductLine[] = ['MIMOSA_HOSTILIS', 'AMANITA', 'VAPE']

export type ContentEditState = { error?: string; ok?: string; id?: string }

const fail = (error: string): ContentEditState => ({ error })

function kindOf(raw: FormDataEntryValue | null): ContentKind | null {
  return raw === 'post' || raw === 'guide' ? raw : null
}

function pathFor(kind: ContentKind, slug: string): string {
  return kind === 'post' ? url.blogPost(slug) : url.guide(slug)
}

/** Every slug a new piece may not take — authored ones are reserved, published or not. */
async function takenSlugs(excludeId?: string): Promise<Set<string>> {
  const [posts, guides] = await Promise.all([
    db.post.findMany({ select: { id: true, slug: true } }),
    db.guide.findMany({ select: { id: true, slug: true } }),
  ])
  return new Set([
    ...POSTS.map((p) => p.slug),
    ...GUIDES.map((g) => g.slug),
    ...[...posts, ...guides].filter((row) => row.id !== excludeId).map((row) => row.slug),
  ])
}

/**
 * Product slugs a piece may recommend — the same merged catalogue the editor offers,
 * so the form can only present a choice this action will accept.
 */
async function recommendableProducts(): Promise<Set<string>> {
  return new Set((await listMergedProducts()).map((p) => p.slug))
}

/**
 * The Author row a post's foreign key points at.
 *
 * `Post.authorId` references an `Author` ROW, and the house author exists only in
 * `content.data.ts`. Writing a post without this would fail the constraint — the
 * same shape of defect that refused every checkout order until 7f6d765. Create-only:
 * the authored record stays the source of truth, and the row is just an anchor.
 */
async function anchorAuthor(slug: string): Promise<string> {
  const authored = AUTHORS.find((a) => a.slug === slug)
  const row = await db.author.upsert({
    where: { slug },
    update: {},
    create: {
      slug,
      name: authored?.name ?? slug,
      title: authored?.title ?? null,
      bio: authored?.bio ?? null,
    },
    select: { id: true },
  })
  return row.id
}

function publish(kind: ContentKind, slug: string): void {
  updateTag(CONTENT_TAG)
  revalidatePath(pathFor(kind, slug))
  // The blog index lists posts and links guides; there is no separate guides index.
  revalidatePath(url.blog())
  revalidatePath('/sitemap.xml')
  revalidatePath('/llms.txt')
  revalidatePath(AREA)
}

/**
 * The article's own picture, uploaded to object storage.
 *
 * Three states, because an edit form has three: a new file replaces whatever is
 * there, the "remove" box clears it, and neither keeps the current key. The bytes go
 * through the same preparation as a product photograph — sniffed by content rather
 * than by filename, re-encoded, and capped — so an article cannot become a route for
 * uploading something that is not an image.
 */
async function uploadedHero(
  formData: FormData,
  current: string | null,
): Promise<{ key: string | null } | { error: string }> {
  if (formData.get('removeHeroImage') === 'on') return { key: null }
  const file = formData.get('heroImage')
  if (!(file instanceof File) || file.size === 0) return { key: current }

  const prepared = await prepareProductPhoto(new Uint8Array(await file.arrayBuffer()))
  if ('error' in prepared) return { error: `Article image: ${prepared.error}` }
  try {
    await putObject(prepared.key, prepared.bytes, 'image/jpeg')
  } catch {
    return { error: 'The article image could not be uploaded. Try again.' }
  }
  return { key: prepared.key }
}

export async function saveContent(
  _previous: ContentEditState,
  formData: FormData,
): Promise<ContentEditState> {
  const guard = await requireArea(AREA)
  if (!guard.ok) return fail(guard.error)

  const kind = kindOf(formData.get('kind'))
  if (!kind) return fail('Unknown content type.')
  const id = String(formData.get('id') ?? '').trim() || undefined

  const [products, guides, posts] = await Promise.all([
    recommendableProducts(),
    listAllGuides(),
    listAllPosts(),
  ])
  const read = readContentForm(formData, kind, {
    products,
    guides: new Set(guides.map((g) => g.slug)),
    posts: new Set(posts.map((p) => p.slug)),
    authors: new Set(AUTHORS.map((a) => a.slug)),
  })
  if (!read.ok) return fail(read.error)
  const input = read.value

  const existing = id
    ? kind === 'post'
      ? await db.post.findUnique({ where: { id } })
      : await db.guide.findUnique({ where: { id } })
    : null
  if (id && !existing) return fail('That piece no longer exists.')

  // Fixed once created: an edit keeps the original address.
  const slug = existing?.slug ?? input.slug
  if (!existing && (await takenSlugs()).has(slug)) {
    return fail(`The address /${kind === 'post' ? 'blog' : 'guides'}/${slug} is already taken. Change the title or set a different slug.`)
  }

  // Editorial: a guide may name a controlled substance to say we do not sell it (lexicon.ts).
  const scan = scanText(copyForScan(input), { productLines: ALL_LINES, honourDirectives: false, editorial: true })
  if (!scan.clean) {
    const terms = scan.blocking.map((m) => `“${m.term}” (${m.reason})`).join('; ')
    await recordAdminAction({
      entityType: kind === 'post' ? 'Post' : 'Guide',
      entityId: existing?.id ?? slug,
      action: 'PUBLISH_BLOCKED',
      actor: guard.identity,
      reason: `Lexicon refused the copy: ${terms}`,
    })
    return fail(`Blocked by the compliance lexicon: ${terms}. Reword and save again.`)
  }

  try {
    const authorId = await anchorAuthor(input.authorSlug)
    const body = joinParagraphs(input.body)
    /*
      Derived when the operator leaves them blank, rather than stored as null. Both
      fields stay editable: anything typed wins, and is sanitised the same way.
    */
    const meta = autoMeta({
      title: input.title,
      summary: input.summary,
      body,
      metaTitle: input.metaTitle,
      metaDesc: input.metaDesc,
    })
    const hero = await uploadedHero(formData, existing?.heroImageKey ?? null)
    if ('error' in hero) return fail(hero.error)

    const common = {
      title: input.title,
      summary: input.summary,
      body,
      authorId,
      recommendedProductSlugs: [...input.recommendedProductSlugs],
      metaTitle: meta.metaTitle,
      metaDesc: meta.metaDescription,
      heroImageKey: hero.key && isHeroKey(hero.key) ? hero.key : null,
    }

    const saved =
      kind === 'post'
        ? existing
          ? await db.post.update({
              where: { id: existing.id },
              data: { ...common, category: input.category ?? null, pillarSlug: input.pillarSlug ?? null, updatedAtContent: new Date() },
            })
          : await db.post.create({
              data: { ...common, slug, category: input.category ?? null, pillarSlug: input.pillarSlug ?? null },
            })
        : existing
          ? await db.guide.update({
              where: { id: existing.id },
              data: { ...common, clusterSlugs: [...input.clusterSlugs] },
            })
          : await db.guide.create({
              data: { ...common, slug, clusterSlugs: [...input.clusterSlugs] },
            })

    await recordAdminAction({
      entityType: kind === 'post' ? 'Post' : 'Guide',
      entityId: saved.id,
      action: existing ? 'UPDATE' : 'CREATE',
      actor: guard.identity,
      before: existing,
      after: saved,
      reason: existing ? `Edited ${pathFor(kind, slug)}` : `Drafted ${pathFor(kind, slug)}`,
    })

    // A live piece that changed has to reach readers and crawlers; a draft does not.
    if (saved.isPublished) {
      publish(kind, slug)
      await submitUrl(pathFor(kind, slug))
    } else {
      revalidatePath(AREA)
    }

    return {
      ok: saved.isPublished ? 'Saved. The live page has been updated.' : 'Saved as a draft. Publish it when it is ready.',
      id: saved.id,
    }
  } catch (error) {
    await reportError(error, { source: 'action', routePath: AREA, context: { stage: 'save-content', kind, slug } })
    return fail('Could not save. It has been logged.')
  }
}

/** Publish or unpublish a saved piece. Publishing re-scans what was saved. */
export async function setContentPublished(formData: FormData): Promise<void> {
  const guard = await requireArea(AREA)
  if (!guard.ok) return

  const kind = kindOf(formData.get('kind'))
  const id = String(formData.get('id') ?? '')
  const publishing = formData.get('publish') === 'true'
  if (!kind || !id) return

  const row =
    kind === 'post'
      ? await db.post.findUnique({ where: { id } })
      : await db.guide.findUnique({ where: { id } })
  if (!row) return

  if (publishing) {
    /*
      Re-scanned at the moment of publishing. The lexicon may have gained a term
      since this draft was saved, or the row may have been edited directly — and
      publishing is when the words reach a reader, so it is where the gate has to
      hold regardless of what it said last time.
    */
    const copy = [row.title, row.summary, ...splitParagraphs(row.body), row.metaTitle, row.metaDesc]
      .filter(Boolean)
      .join('\n')
    const scan = scanText(copy, { productLines: ALL_LINES, honourDirectives: false, editorial: true })
    if (!scan.clean) {
      await recordAdminAction({
        entityType: kind === 'post' ? 'Post' : 'Guide',
        entityId: id,
        action: 'PUBLISH_BLOCKED',
        actor: guard.identity,
        reason: `Publish refused — lexicon: ${scan.blocking.map((m) => m.term).join(', ')}`,
      })
      return
    }
  }

  const data = {
    isPublished: publishing,
    // The first publish date is the one readers and schema see. Unpublishing and
    // republishing does not reset it.
    ...(publishing && !row.publishedAt ? { publishedAt: new Date() } : {}),
  }
  if (kind === 'post') await db.post.update({ where: { id }, data })
  else await db.guide.update({ where: { id }, data })

  await recordAdminAction({
    entityType: kind === 'post' ? 'Post' : 'Guide',
    entityId: id,
    action: publishing ? 'PUBLISH' : 'UNPUBLISH',
    actor: guard.identity,
    reason: `${publishing ? 'Published' : 'Unpublished'} ${pathFor(kind, row.slug)}`,
  })

  publish(kind, row.slug)
  // Bing asks to be told about removals as well as additions (§4, §9).
  await submitUrl(pathFor(kind, row.slug))
}
