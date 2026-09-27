import { beforeEach, describe, expect, it, vi } from 'vitest'

const postFindMany = vi.fn()
const guideFindMany = vi.fn()
const reportError = vi.fn()

vi.mock('next/cache', () => ({ cacheTag: vi.fn() }))
vi.mock('@/lib/db/client', () => ({
  db: { post: { findMany: postFindMany }, guide: { findMany: guideFindMany } },
}))
vi.mock('@/lib/observability/report-error', () => ({ reportError }))

const { getAnyPost, listAllPosts, postedContentSlugs } = await import(
  '@/lib/content/merged-content'
)
const { POSTS, publishedPosts } = await import('@/lib/content/content.data')

function row(slug: string, overrides: Record<string, unknown> = {}) {
  return {
    slug,
    title: `Title ${slug}`,
    summary: 'Summary.',
    body: 'Body.',
    category: 'education',
    recommendedProductSlugs: [],
    pillarSlug: null,
    isPublished: true,
    publishedAt: new Date('2026-09-01T00:00:00Z'),
    updatedAt: new Date('2026-09-01T00:00:00Z'),
    author: { slug: 'editorial-team' },
    ...overrides,
  }
}

beforeEach(() => {
  postFindMany.mockReset()
  guideFindMany.mockReset()
  reportError.mockReset()
  guideFindMany.mockResolvedValue([])
})

describe('the merge', () => {
  it('adds admin-published posts after the authored ones', async () => {
    postFindMany.mockResolvedValue([row('from-the-admin')])
    const all = await listAllPosts()
    expect(all.slice(0, publishedPosts().length).map((p) => p.slug)).toEqual(
      publishedPosts().map((p) => p.slug),
    )
    expect(all.at(-1)?.slug).toBe('from-the-admin')
  })

  /*
    Authored wins. An operator must not be able to replace a page that ranks with a
    different one at the same address, even if the save action's check was bypassed.
  */
  it('never lets a published row shadow an authored slug', async () => {
    const authored = POSTS[0]!
    postFindMany.mockResolvedValue([row(authored.slug, { title: 'IMPOSTOR' })])
    const found = await getAnyPost(authored.slug)
    expect(found?.title).toBe(authored.title)
    const all = await listAllPosts()
    expect(all.filter((p) => p.slug === authored.slug)).toHaveLength(1)
  })

  it('serves an authored post without touching the database at all', async () => {
    await getAnyPost(POSTS[0]!.slug)
    expect(postFindMany).not.toHaveBeenCalled()
  })

  it('finds a post that exists only in the database', async () => {
    postFindMany.mockResolvedValue([row('only-in-db')])
    expect((await getAnyPost('only-in-db'))?.title).toBe('Title only-in-db')
  })
})

describe('when the database fails', () => {
  /*
    A real failure costs THIS request its admin content, not the page: the authored
    posts still render. And it is reported, so it is not silent.
  */
  it('degrades to authored content and reports it', async () => {
    postFindMany.mockRejectedValue(Object.assign(new Error('connection reset'), { code: 'P1001' }))
    const all = await listAllPosts()
    expect(all.map((p) => p.slug)).toEqual(publishedPosts().map((p) => p.slug))
    expect(reportError).toHaveBeenCalledOnce()
  })

  /*
    Schema lag — the migration has not run yet — is an expected state during a
    deploy, not an incident. It is treated as "nothing published yet" and NOT reported,
    or it would page the operator on every render until someone ran the migration.
  */
  it('treats a missing column as nothing published yet, without reporting it', async () => {
    postFindMany.mockRejectedValue(Object.assign(new Error('column does not exist'), { code: 'P2022' }))
    const all = await listAllPosts()
    expect(all.map((p) => p.slug)).toEqual(publishedPosts().map((p) => p.slug))
    expect(reportError).not.toHaveBeenCalled()
  })

  /*
    The proxy's endpoint must NOT degrade. If it returned an empty list on failure,
    the proxy would believe nothing was published and 404 every admin page. It has to
    throw, so the endpoint answers 503 and the proxy keeps its last good snapshot.
  */
  it('lets the proxy endpoint see a real failure instead of an empty list', async () => {
    postFindMany.mockRejectedValue(Object.assign(new Error('connection reset'), { code: 'P1001' }))
    await expect(postedContentSlugs()).rejects.toThrow()
  })
})
