import { beforeEach, describe, expect, it } from 'vitest'
import { isPostedSlug, resetPostedSlugCache } from '@/lib/catalog/posted-slugs'
import { postedProductCandidate } from '@/proxy'
import { FIXTURE_PRODUCTS, installFixtureCatalog } from '../stubs/catalog'

const ORIGIN = 'https://shop.test'

/** A fetcher that serves a fixed answer and counts how often it is asked. */
function endpoint(respond: () => Response | Promise<Response>) {
  const calls: string[] = []
  const fetcher = async (input: URL) => {
    calls.push(input.toString())
    return respond()
  }
  return { fetcher, calls }
}

const listing = (...slugs: string[]) => () => Response.json({ slugs })

beforeEach(() => {
  resetPostedSlugCache()
  // postedProductCandidate asks the catalogue whether a slug is authored.
  installFixtureCatalog()
})

describe('isPostedSlug', () => {
  it('asks the cached endpoint on the same origin, and answers from what it says', async () => {
    const { fetcher, calls } = endpoint(listing('posted-a'))

    expect(await isPostedSlug('posted-a', ORIGIN, { now: 0, fetcher })).toBe(true)
    expect(calls).toEqual([`${ORIGIN}/api/catalog/posted-slugs`])
  })

  it('answers a known slug from memory for a minute', async () => {
    const { fetcher, calls } = endpoint(listing('posted-a'))
    await isPostedSlug('posted-a', ORIGIN, { now: 0, fetcher })

    expect(await isPostedSlug('posted-a', ORIGIN, { now: 59_000, fetcher })).toBe(true)
    expect(calls).toHaveLength(1)

    await isPostedSlug('posted-a', ORIGIN, { now: 60_000, fetcher })
    expect(calls).toHaveLength(2)
  })

  it('rechecks an unknown slug after 10 seconds, so a new post is found quickly', async () => {
    let slugs = ['posted-a']
    const { fetcher, calls } = endpoint(() => Response.json({ slugs }))
    await isPostedSlug('posted-a', ORIGIN, { now: 0, fetcher })

    slugs = ['posted-a', 'posted-b'] // an operator posts a product
    expect(await isPostedSlug('posted-b', ORIGIN, { now: 5_000, fetcher })).toBe(false)
    expect(calls).toHaveLength(1)

    expect(await isPostedSlug('posted-b', ORIGIN, { now: 10_000, fetcher })).toBe(true)
    expect(calls).toHaveLength(2)
  })

  it('says it cannot tell when the endpoint fails and nothing is known', async () => {
    const { fetcher } = endpoint(() => new Response('down', { status: 503 }))
    expect(await isPostedSlug('anything', ORIGIN, { now: 0, fetcher })).toBe('unknown')
  })

  it('treats a network error the same way', async () => {
    const fetcher = async () => {
      throw new TypeError('fetch failed')
    }
    expect(await isPostedSlug('anything', ORIGIN, { now: 0, fetcher })).toBe('unknown')
  })

  it('does not retry on every request while the endpoint is down', async () => {
    const { fetcher, calls } = endpoint(() => new Response('down', { status: 503 }))
    await isPostedSlug('a', ORIGIN, { now: 0, fetcher })
    await isPostedSlug('b', ORIGIN, { now: 3_000, fetcher })
    await isPostedSlug('c', ORIGIN, { now: 9_999, fetcher })
    expect(calls).toHaveLength(1)

    await isPostedSlug('d', ORIGIN, { now: 10_000, fetcher })
    expect(calls).toHaveLength(2)
  })

  it('keeps answering from an old snapshot when a refresh fails', async () => {
    let up = true
    const { fetcher } = endpoint(() =>
      up ? Response.json({ slugs: ['posted-a'] }) : new Response('down', { status: 500 }),
    )
    await isPostedSlug('posted-a', ORIGIN, { now: 0, fetcher })

    up = false
    expect(await isPostedSlug('posted-a', ORIGIN, { now: 120_000, fetcher })).toBe(true)
    expect(await isPostedSlug('never-posted', ORIGIN, { now: 120_000, fetcher })).toBe(false)
  })

  it('ignores a body that is not a list of slugs', async () => {
    const { fetcher } = endpoint(() => Response.json({ slugs: null }))
    expect(await isPostedSlug('a', ORIGIN, { now: 0, fetcher })).toBe('unknown')
  })

  it('shares one request between concurrent lookups', async () => {
    let release!: () => void
    const gate = new Promise<void>((r) => (release = r))
    const { fetcher, calls } = endpoint(async () => {
      await gate
      return Response.json({ slugs: ['posted-a'] })
    })

    const lookups = [
      isPostedSlug('posted-a', ORIGIN, { now: 0, fetcher }),
      isPostedSlug('posted-b', ORIGIN, { now: 0, fetcher }),
      isPostedSlug('posted-a', ORIGIN, { now: 0, fetcher }),
    ]
    release()

    expect(await Promise.all(lookups)).toEqual([true, false, true])
    expect(calls).toHaveLength(1)
  })

  it('recovers after a lookup whose request could not even be built', async () => {
    // An origin that does not parse makes `new URL` throw before any request.
    expect(await isPostedSlug('a', 'not a url', { now: 0, fetcher: fetch })).toBe('unknown')
    const { fetcher, calls } = endpoint(listing('a'))
    expect(await isPostedSlug('a', ORIGIN, { now: 10_000, fetcher })).toBe(true)
    expect(calls).toHaveLength(1)
  })
})

describe('postedProductCandidate', () => {
  it('ignores authored products, which the in-memory catalogue already answers for', () => {
    expect(postedProductCandidate(`/product/${FIXTURE_PRODUCTS[0]!.slug}`)).toBeUndefined()
  })

  it('offers an unknown product slug for the posted lookup', () => {
    expect(postedProductCandidate('/product/something-new')).toBe('something-new')
  })

  it('never sends other paths to the network', () => {
    expect(postedProductCandidate('/shop/nonsense')).toBeUndefined()
    expect(postedProductCandidate('/blog/nonsense')).toBeUndefined()
    expect(postedProductCandidate('/product/')).toBeUndefined()
  })
})
