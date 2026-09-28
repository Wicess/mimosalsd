import { beforeEach, describe, expect, it } from 'vitest'
import { routeExists } from '@/proxy'
import { resetStateRuleProvider } from '@/lib/compliance/state-rules'
import { installFixtureCatalog } from '../stubs/catalog'

beforeEach(() => {
  installFixtureCatalog()
  resetStateRuleProvider()
})

/**
 * Under Cache Components a PPR route flushes a 200 shell before it can decide the
 * resource does not exist, so notFound() produces a SOFT 404. Soft 404s waste crawl
 * budget and Google can flag them — and organic search is this site's only channel.
 * These tests guard the layer that turns them into real 404s.
 */
describe('existing resources resolve', () => {
  it.each([
    '/product/mhrb-powder',
    '/shop/amanita',
    '/shop/mimosa-hostilis',
    '/lab-results/am-2026-0388',
    '/lab-results/AM-2026-0388',
    '/legality/louisiana',
    '/legality/texas',
    '/blog/natural-dyeing-with-mimosa-hostilis',
    '/guides/what-is-mimosa-hostilis-root-bark',
  ])('%s exists', (path) => {
    expect(routeExists(path)).toBe(true)
  })
})

/*
  Batch codes are deliberately absent from the list below.

  Certificates live in the database now (catalog/merged.ts) and the edge cannot reach
  Neon, so the proxy lets every /lab-results/<code> through and the page answers for
  itself with notFound(). Checking the in-memory constant here would have 404'd every
  real certificate an operator published, because that constant was emptied when the
  sample batches were deleted. Failing open costs a soft 404 for a made-up code;
  failing closed costs a real one — the same trade posted product slugs already make.
*/
describe('an unknown batch code reaches the page rather than the proxy', () => {
  it('lets the code through, and the page decides', () => {
    expect(routeExists('/lab-results/xx-9999-0000')).toBe(true)
  })
})

describe('missing resources are refused', () => {
  it.each([
    '/product/nonexistent',
    '/shop/fake-category',
    '/legality/atlantis',
    '/blog/no-such-post',
    '/guides/no-such-guide',
    '/locations/atlantis',
  ])('%s does not exist', (path) => {
    expect(routeExists(path)).toBe(false)
  })

  it('refuses an unpublished location — it is not a real place yet', () => {
    // Publishing a page for a location without a real address and a claimed Google
    // Business Profile is the doorway pattern, and it is untrue.
    expect(routeExists('/locations/austin-tx')).toBe(false)
  })
})

describe('unmatched paths are left alone', () => {
  it.each(['/', '/shop', '/cart', '/checkout', '/about', '/legality', '/blog'])(
    '%s passes through',
    (path) => {
      expect(routeExists(path)).toBe(true)
    },
  )

  it('does not treat a blog category as a post slug', () => {
    expect(routeExists('/blog/category/legality')).toBe(true)
  })
})
