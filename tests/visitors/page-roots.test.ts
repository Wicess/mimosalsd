import { readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { isCountablePageView, PAGE_ROOTS } from '@/lib/visitors/page-view'

/**
 * ─────────────────────────────────────────────────────────────────────────────
 *  A LIST OF ROUTES THAT NOBODY HAS TO REMEMBER TO UPDATE.
 *
 *  Visits are counted in the proxy, which cannot ask the router whether a path
 *  exists. It rewrites unknown paths to a 404 only for the prefixes it narrows,
 *  so /wp-admin/install.php reached the counter and two vulnerability probes were
 *  filed as people reading a page on the first day of tracking.
 *
 *  PAGE_ROOTS fixes that, and would rot the moment somebody adds a route and does
 *  not think about this file — the new page would simply stop being counted, in
 *  silence. So the list is derived from src/app here and compared, and adding a
 *  route without telling it fails the suite.
 * ─────────────────────────────────────────────────────────────────────────────
 */
const APP = join(process.cwd(), 'src', 'app')

/** Does this directory, or anything under it, render a page? */
function servesAPage(directory: string): boolean {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (entry.isFile() && entry.name === 'page.tsx') return true
    if (entry.isDirectory() && servesAPage(join(directory, entry.name))) return true
  }
  return false
}

/** The first URL segment of every page route, seeing through (route groups). */
function routeRoots(directory: string): Set<string> {
  const roots = new Set<string>()
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name.startsWith('_')) continue
    const path = join(directory, entry.name)
    // A (group) is not part of the URL: its children are the real first segments.
    if (entry.name.startsWith('(')) {
      for (const root of routeRoots(path)) roots.add(root)
      continue
    }
    if (servesAPage(path)) roots.add(entry.name)
  }
  return roots
}

describe('PAGE_ROOTS', () => {
  it('is every route in src/app, less the admin, which is never counted', () => {
    const derived = routeRoots(APP)
    expect(derived.has('admin')).toBe(true) // the derivation works at all
    derived.delete('admin')
    expect([...PAGE_ROOTS].sort()).toEqual([...derived].sort())
  })

  it('counts a real page and refuses a path no route could serve', () => {
    const headers = new Headers()
    for (const path of ['/', '/shop/amanita', '/guides/x', '/order/abc']) {
      expect(isCountablePageView('GET', path, headers), path).toBe(true)
    }
    for (const path of ['/wp-admin/install.php', '/.env', '/xmlrpc.php', '/phpmyadmin', '/.git/config']) {
      expect(isCountablePageView('GET', path, headers), path).toBe(false)
    }
  })
})
