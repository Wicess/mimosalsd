import 'server-only'
import { cacheTag } from 'next/cache'
import {
  AUTHORS,
  getGuide,
  getPost,
  publishedGuides,
  publishedPosts,
  type Author,
  type Guide,
  type Post,
} from './content.data'
import { rowToGuide, rowToPost } from './posted-content'

/**
 * ─────────────────────────────────────────────────────────────────────────────
 *  POSTS AND GUIDES AS READERS SEE THEM: authored content, plus what an operator
 *  published from the admin panel.
 *
 *  ── Authored wins ──────────────────────────────────────────────────────────
 *  `content.data.ts` is the source of truth for everything it covers. A published
 *  row can only ADD a piece; it can never shadow an authored slug. The save action
 *  refuses a colliding slug up front, and the merge below keeps the authored piece
 *  if one ever slips through — so an operator cannot, by accident, replace a page
 *  that ranks with a different one at the same address.
 *
 *  ── Why failures are thrown INSIDE the cache and caught OUTSIDE it ─────────
 *  A value returned from a `use cache` function is kept. If the database blinked
 *  and the loader returned an empty list, that empty list would be served for the
 *  life of the cache entry, and every post written in the admin would 404 until
 *  someone happened to publish something. So the cached loader throws on a real
 *  failure — a thrown call is never cached — and the uncached wrapper catches it,
 *  degrades THIS request to authored content only, and the next request tries again.
 *
 *  The one failure that IS cached as empty is schema lag: the table or a column
 *  the query selects does not exist yet. That is a stable state until the migration
 *  runs, and the first publish after it invalidates the entry. Treating it as a crash
 *  is what took the admin order pages down on 2026-09-11.
 * ─────────────────────────────────────────────────────────────────────────────
 */

export const CONTENT_TAG = 'content'

const AUTHOR_SELECT = { select: { slug: true } } as const

async function cachedPostedPosts(): Promise<readonly Post[]> {
  'use cache'
  cacheTag(CONTENT_TAG)
  const { db } = await import('@/lib/db/client')
  try {
    const rows = await db.post.findMany({
      where: { isPublished: true },
      include: { author: AUTHOR_SELECT },
      orderBy: { publishedAt: 'desc' },
    })
    return rows.map(rowToPost)
  } catch (error) {
    const { isSchemaBehindError } = await import('@/lib/db/errors')
    if (isSchemaBehindError(error)) return []
    throw error
  }
}

async function cachedPostedGuides(): Promise<readonly Guide[]> {
  'use cache'
  cacheTag(CONTENT_TAG)
  const { db } = await import('@/lib/db/client')
  try {
    const rows = await db.guide.findMany({
      where: { isPublished: true },
      include: { author: AUTHOR_SELECT },
      orderBy: { publishedAt: 'desc' },
    })
    return rows.map(rowToGuide)
  } catch (error) {
    const { isSchemaBehindError } = await import('@/lib/db/errors')
    if (isSchemaBehindError(error)) return []
    throw error
  }
}

/** Uncached wrapper: a real failure costs this request its admin content, not the page. */
async function degradeToAuthored<T>(load: () => Promise<readonly T[]>, what: string) {
  try {
    return await load()
  } catch (error) {
    const { reportError } = await import('@/lib/observability/report-error')
    await reportError(error, {
      source: 'db',
      severity: 'WARN',
      context: { degraded: `${what} served without admin-published content` },
    })
    return [] as readonly T[]
  }
}

/** Authored first, then published rows whose slug the authored content does not use. */
function merge<T extends { slug: string }>(authored: readonly T[], posted: readonly T[]): T[] {
  const taken = new Set(authored.map((item) => item.slug))
  return [...authored, ...posted.filter((item) => !taken.has(item.slug))]
}

/** Every published post, authored ones first. */
export async function listAllPosts(): Promise<readonly Post[]> {
  return merge(publishedPosts(), await degradeToAuthored(cachedPostedPosts, 'posts'))
}

/** Every published guide, authored ones first. */
export async function listAllGuides(): Promise<readonly Guide[]> {
  return merge(publishedGuides(), await degradeToAuthored(cachedPostedGuides, 'guides'))
}

/**
 * One post. Authored content is consulted first and synchronously, so an authored
 * page never waits on — or fails with — the database.
 */
export async function getAnyPost(slug: string): Promise<Post | undefined> {
  const authored = getPost(slug)
  if (authored) return authored.isPublished ? authored : undefined
  const posted = await degradeToAuthored(cachedPostedPosts, 'posts')
  return posted.find((post) => post.slug === slug)
}

export async function getAnyGuide(slug: string): Promise<Guide | undefined> {
  const authored = getGuide(slug)
  if (authored) return authored.isPublished ? authored : undefined
  const posted = await degradeToAuthored(cachedPostedGuides, 'guides')
  return posted.find((guide) => guide.slug === slug)
}

/** The slugs the edge proxy must treat as real, from the admin-published rows only. */
export async function postedContentSlugs(): Promise<{ posts: string[]; guides: string[] }> {
  const [posts, guides] = await Promise.all([cachedPostedPosts(), cachedPostedGuides()])
  return { posts: posts.map((p) => p.slug), guides: guides.map((g) => g.slug) }
}

/** Authors, for attribution. The authored list is the only one there is today. */
export function listAuthors(): readonly Author[] {
  return AUTHORS
}
