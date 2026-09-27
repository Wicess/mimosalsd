import { beforeEach, describe, expect, it } from 'vitest'
import { isPostedContent, resetPostedContentCache } from '@/lib/content/posted-content-slugs'
import { postedContentCandidate } from '@/proxy'
import { GUIDES, POSTS } from '@/lib/content/content.data'
import { isMissingColumnError, isMissingTableError, isSchemaBehindError } from '@/lib/db/errors'

const ORIGIN = 'https://example.com'

function endpoint(body: unknown, status = 200) {
  let calls = 0
  const fetcher = async () => {
    calls++
    return new Response(JSON.stringify(body), { status })
  }
  return { fetcher, calls: () => calls }
}

beforeEach(() => resetPostedContentCache())

describe('which paths the proxy asks about', () => {
  /*
    Authored pages must never reach the network. If they did, every blog post and
    guide on the site would wait on an HTTP round trip before rendering.
  */
  it('never asks about an authored post or guide', () => {
    expect(postedContentCandidate(`/blog/${POSTS[0]!.slug}`)).toBeUndefined()
    expect(postedContentCandidate(`/guides/${GUIDES[0]!.slug}`)).toBeUndefined()
  })

  it('asks about an unknown blog slug, as a post', () => {
    expect(postedContentCandidate('/blog/written-in-the-admin')).toEqual({
      kind: 'post',
      slug: 'written-in-the-admin',
    })
  })

  it('asks about an unknown guide slug, as a guide', () => {
    expect(postedContentCandidate('/guides/a-new-pillar')).toEqual({
      kind: 'guide',
      slug: 'a-new-pillar',
    })
  })

  it('leaves blog category pages and other sections alone', () => {
    expect(postedContentCandidate('/blog/category/legality')).toBeUndefined()
    expect(postedContentCandidate('/product/anything')).toBeUndefined()
    expect(postedContentCandidate('/blog')).toBeUndefined()
  })
})

describe('isPostedContent', () => {
  it('finds a published post and a published guide', async () => {
    const { fetcher } = endpoint({ posts: ['a-post'], guides: ['a-guide'] })
    expect(await isPostedContent('post', 'a-post', ORIGIN, { now: 0, fetcher })).toBe(true)
    expect(await isPostedContent('guide', 'a-guide', ORIGIN, { now: 0, fetcher })).toBe(true)
  })

  /*
    /blog/x and /guides/x are different pages. A published POST called "x" must not
    make /guides/x resolve — it would render a guide page for something that is not
    a guide, and the guide route would 404 inside it as a soft 404.
  */
  it('keeps posts and guides apart even when they share a slug', async () => {
    const { fetcher } = endpoint({ posts: ['shared'], guides: [] })
    expect(await isPostedContent('post', 'shared', ORIGIN, { now: 0, fetcher })).toBe(true)
    expect(await isPostedContent('guide', 'shared', ORIGIN, { now: 0, fetcher })).toBe(false)
  })

  it('says it cannot tell when the endpoint fails, so the proxy fails open', async () => {
    const { fetcher } = endpoint({ posts: null, guides: null }, 503)
    expect(await isPostedContent('post', 'x', ORIGIN, { now: 0, fetcher })).toBe('unknown')
  })

  it('treats a body without both lists as a failure, not as "nothing published"', async () => {
    // "Nothing is published" would 404 every admin page; "cannot tell" lets them through.
    const { fetcher } = endpoint({ posts: ['a'] })
    expect(await isPostedContent('post', 'a', ORIGIN, { now: 0, fetcher })).toBe('unknown')
  })

  it('shares the snapshot timing: one fetch answers for the fresh window', async () => {
    const { fetcher, calls } = endpoint({ posts: ['a'], guides: [] })
    await isPostedContent('post', 'a', ORIGIN, { now: 0, fetcher })
    await isPostedContent('post', 'a', ORIGIN, { now: 30_000, fetcher })
    expect(calls()).toBe(1)
  })
})

/*
  The column check exists because a missing COLUMN (P2022) took the admin order
  pages down on 2026-09-11, and the existing helper only recognised a missing TABLE.
*/
describe('schema lag detection', () => {
  it('recognises a missing column and a missing table as the same kind of lag', () => {
    expect(isMissingColumnError({ code: 'P2022' })).toBe(true)
    expect(isMissingTableError({ code: 'P2021' })).toBe(true)
    expect(isSchemaBehindError({ code: 'P2022' })).toBe(true)
    expect(isSchemaBehindError({ code: 'P2021' })).toBe(true)
  })

  it('does not mistake a real failure for schema lag', () => {
    expect(isSchemaBehindError({ code: 'P1001' })).toBe(false) // cannot reach the database
    expect(isSchemaBehindError(new Error('boom'))).toBe(false)
    expect(isSchemaBehindError(null)).toBe(false)
  })
})
