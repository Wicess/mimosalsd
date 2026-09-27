import { existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { ROUTES } from '@/lib/seo/routes'
import { POLICIES } from '@/lib/content/policies'

/**
 * The test that was missing.
 *
 * `routes.test.ts` checks the manifest is internally consistent — unique ids, no
 * noindex route in the sitemap, sane priorities — and it passed while ten declared,
 * indexable, sitemap-submitted routes had no page behind them at all. The sitemap
 * served ten 404s and the footer linked eight of them from all 110 pages.
 *
 * Internal consistency was never the property that mattered. This is: a route the
 * manifest promises to a crawler must resolve to something in the app directory.
 */

/**
 * Resolve a URL pattern against the App Router directory.
 *
 * Three App Router behaviours have to be honoured or this test lies:
 *
 *  - A concrete path may be served by a DYNAMIC segment. `/policies/terms` is
 *    rendered by `policies/[policy]/page.tsx`.
 *  - A ROUTE GROUP contributes no URL segment. `(site)/about/page.tsx` serves
 *    `/about`, so groups must be stepped through without consuming a segment.
 *  - A literal directory wins over a dynamic one at the same level, which is the
 *    order Next itself resolves in.
 *
 * The search backtracks, because a literal match at one level can still dead-end
 * further down while a dynamic sibling would have resolved.
 */
const APP_DIR = join(process.cwd(), 'src/app')

function childDirectories(dir: string): string[] {
  try {
    return readdirSync(dir, { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => e.name)
  } catch {
    return []
  }
}

function hasPageFile(dir: string): boolean {
  return (
    existsSync(join(dir, 'page.tsx')) ||
    existsSync(join(dir, 'page.ts')) ||
    existsSync(join(dir, 'route.ts'))
  )
}

const isRouteGroup = (name: string) => name.startsWith('(') && name.endsWith(')')
const isDynamic = (name: string) => name.startsWith('[') && name.endsWith(']')

function search(dir: string, segments: readonly string[]): boolean {
  if (segments.length === 0) {
    if (hasPageFile(dir)) return true
    // A route group can hold the page for the path that ends here — `(site)/page.tsx`
    // serves `/`.
    return childDirectories(dir)
      .filter(isRouteGroup)
      .some((g) => search(join(dir, g), segments))
  }

  const [head, ...rest] = segments
  if (head === undefined) return false
  const children = childDirectories(dir)

  if (children.includes(head) && search(join(dir, head), rest)) return true

  for (const child of children.filter(isDynamic)) {
    if (search(join(dir, child), rest)) return true
  }

  // Groups are transparent: step into them without consuming a segment.
  for (const child of children.filter(isRouteGroup)) {
    if (search(join(dir, child), segments)) return true
  }

  return false
}

function resolvesToPage(pattern: string): boolean {
  return search(APP_DIR, pattern.split('/').filter(Boolean))
}

describe('every declared route has a page behind it', () => {
  it.each(Object.values(ROUTES).map((r) => [r.id, r.pattern] as const))(
    'route %s (%s) resolves',
    (_id, pattern) => {
      expect(resolvesToPage(pattern)).toBe(true)
    },
  )

  it('never submits a URL to the sitemap that does not resolve', () => {
    const unresolved = Object.values(ROUTES)
      .filter((r) => r.inSitemap)
      .filter((r) => !resolvesToPage(r.pattern))
      .map((r) => r.pattern)

    expect(unresolved, 'sitemap URLs with no page').toEqual([])
  })

  it('never marks a route INDEX unless it resolves', () => {
    const unresolved = Object.values(ROUTES)
      .filter((r) => r.indexPolicy === 'INDEX')
      .filter((r) => !resolvesToPage(r.pattern))
      .map((r) => r.pattern)

    expect(unresolved, 'indexable routes with no page').toEqual([])
  })

  /**
   * The footer links these from every page on the site, so a dead one is not a single
   * broken link — it is 110 of them, and a crawl-budget leak on the whole domain.
   */
  it('resolves every policy the footer links to', () => {
    for (const policy of POLICIES) {
      expect(resolvesToPage(`/policies/${policy.slug}`), policy.slug).toBe(true)
    }
  })
})

describe('the resolver itself', () => {
  it('matches a concrete path served by a dynamic segment', () => {
    expect(resolvesToPage('/policies/shipping')).toBe(true)
    expect(resolvesToPage('/legality/texas')).toBe(true)
  })

  it('sees through route groups, which contribute no URL segment', () => {
    // These live under src/app/(site)/ but serve paths with no "(site)" in them.
    expect(resolvesToPage('/about')).toBe(true)
    expect(resolvesToPage('/')).toBe(true)
  })

  it('rejects a path with no page', () => {
    expect(resolvesToPage('/this-route-does-not-exist')).toBe(false)
    expect(resolvesToPage('/blog/category/legality')).toBe(false)
  })
})
