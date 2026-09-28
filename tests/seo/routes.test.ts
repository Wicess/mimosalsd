import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  absoluteUrl,
  FACET_PARAMS,
  indexPolicyFor,
  LINKING_RULES,
  ROUTES,
  url,
} from '@/lib/seo/routes'

describe('route manifest integrity', () => {
  it('every route id is unique', () => {
    const ids = Object.values(ROUTES).map((r) => r.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('every route pattern is unique — one intent, one URL', () => {
    const patterns = Object.values(ROUTES).map((r) => r.pattern)
    expect(new Set(patterns).size).toBe(patterns.length)
  })

  it('every pattern starts with a slash', () => {
    for (const r of Object.values(ROUTES)) expect(r.pattern.startsWith('/')).toBe(true)
  })

  it('never puts a noindex route in the sitemap', () => {
    for (const r of Object.values(ROUTES)) {
      if (r.indexPolicy !== 'INDEX') {
        expect(r.inSitemap, `${r.id} must not be in the sitemap`).toBe(false)
      }
    }
  })

  it('gives every sitemap route a non-zero priority', () => {
    for (const r of Object.values(ROUTES)) {
      if (r.inSitemap) expect(r.priority, r.id).toBeGreaterThan(0)
    }
  })

  it('keeps every transactional and private surface out of the index', () => {
    for (const id of ['cart', 'checkout', 'orderStatus', 'account', 'admin'] as const) {
      expect(ROUTES[id].indexPolicy, id).not.toBe('INDEX')
      expect(ROUTES[id].inSitemap, id).toBe(false)
    }
  })

  it('makes checkout, order and account nofollow — they can leak PII into the index', () => {
    for (const id of ['checkout', 'orderStatus', 'account', 'admin'] as const) {
      expect(ROUTES[id].indexPolicy, id).toBe('NOINDEX_NOFOLLOW')
    }
  })

  it('indexes the legality pages at high priority — they are the acquisition front door', () => {
    expect(ROUTES.legalityState.indexPolicy).toBe('INDEX')
    expect(ROUTES.legalityState.priority).toBeGreaterThanOrEqual(0.9)
  })
})

describe('url builders', () => {
  it('builds every canonical path', () => {
    expect(url.home()).toBe('/')
    expect(url.shop()).toBe('/shop')
    expect(url.category('amanita')).toBe('/shop/amanita')
    expect(url.product('mhrb-powder')).toBe('/product/mhrb-powder')
    expect(url.locationsHub()).toBe('/locations')
    expect(url.location('austin-tx')).toBe('/locations/austin-tx')
    expect(url.legalityHub()).toBe('/where-we-ship')
    expect(url.shopNearMe()).toBe('/shop-near-me')
    expect(url.legalityState('louisiana')).toBe('/where-we-ship/louisiana')
    expect(url.labResults()).toBe('/lab-results')
    expect(url.blog()).toBe('/blog')
    expect(url.blogPost('what-is-muscimol')).toBe('/blog/what-is-muscimol')
    expect(url.guide('amanita-explained')).toBe('/guides/amanita-explained')
    expect(url.about()).toBe('/about')
    expect(url.faq()).toBe('/faq')
    expect(url.contact()).toBe('/contact')
    expect(url.bulk()).toBe('/bulk')
    expect(url.cart()).toBe('/cart')
    expect(url.checkout()).toBe('/checkout')
    expect(url.orderStatus('tok_abc')).toBe('/order/tok_abc')
    expect(url.account()).toBe('/account')
    expect(url.policy('shipping')).toBe('/policies/shipping')
    expect(url.legalDisclaimer()).toBe('/legal-disclaimer')
  })

  it('lowercases batch codes so a QR scan resolves regardless of case', () => {
    expect(url.labBatch('AM-2026-0388')).toBe('/lab-results/am-2026-0388')
  })

  it('produces paths that match their declared route patterns', () => {
    const cases: Array<[string, string]> = [
      [url.category('x'), ROUTES.category.pattern],
      [url.product('x'), ROUTES.product.pattern],
      [url.legalityState('x'), ROUTES.legalityState.pattern],
      [url.location('x'), ROUTES.location.pattern],
      [url.labBatch('x'), ROUTES.labBatch.pattern],
      [url.guide('x'), ROUTES.guide.pattern],
    ]
    for (const [built, pattern] of cases) {
      expect(built.split('/').length).toBe(pattern.split('/').length)
    }
  })
})

describe('absoluteUrl', () => {
  afterEach(() => vi.unstubAllEnvs())

  it('resolves against the configured site origin', () => {
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://example.com')
    expect(absoluteUrl('/where-we-ship/texas')).toBe('https://example.com/where-we-ship/texas')
  })

  it('falls back to localhost when unset', () => {
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', '')
    expect(absoluteUrl('/')).toBe('http://localhost:3000/')
  })
})

describe('index policy', () => {
  it('indexes a clean canonical path', () => {
    expect(indexPolicyFor('/shop/amanita')).toBe('INDEX')
    expect(indexPolicyFor('/where-we-ship/louisiana')).toBe('INDEX')
  })

  it('keeps faceted URLs crawlable but out of the index', () => {
    for (const param of FACET_PARAMS) {
      const params = new URLSearchParams({ [param]: 'x' })
      expect(indexPolicyFor('/shop/amanita', params), param).toBe('NOINDEX_FOLLOW')
    }
  })

  it('does not treat a non-facet param as a facet', () => {
    expect(indexPolicyFor('/shop/amanita', new URLSearchParams({ utm_source: 'x' }))).toBe('INDEX')
  })

  it('honours the declared policy for private routes', () => {
    expect(indexPolicyFor('/checkout')).toBe('NOINDEX_NOFOLLOW')
    expect(indexPolicyFor('/cart')).toBe('NOINDEX_FOLLOW')
  })

  it('matches dynamic segments', () => {
    expect(indexPolicyFor('/order/tok_abc123')).toBe('NOINDEX_NOFOLLOW')
    expect(indexPolicyFor('/product/mhrb-powder')).toBe('INDEX')
  })

  it('defaults an unknown path to INDEX rather than hiding it by accident', () => {
    expect(indexPolicyFor('/some/new/page')).toBe('INDEX')
  })
})

describe('internal linking rules', () => {
  it('links every content type outward, so authority flows in a loop not a tree', () => {
    for (const [from, targets] of Object.entries(LINKING_RULES)) {
      expect(targets.length, from).toBeGreaterThan(0)
    }
  })

  it('links products to their COA batch — the trust signal competitors bury', () => {
    expect(LINKING_RULES.product).toContain('labBatch')
  })

  it('links state pages to shippable products, closing the research-to-buy loop', () => {
    expect(LINKING_RULES.legalityState).toContain('product')
  })

  it('links blog posts up to their pillar guide', () => {
    expect(LINKING_RULES.blogPost).toContain('guide')
  })
})
