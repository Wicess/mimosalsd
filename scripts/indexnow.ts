#!/usr/bin/env tsx
/**
 * IndexNow submission CLI.
 *
 *   npm run indexnow -- --url /legality/texas        one URL (preferred; streaming)
 *   npm run indexnow -- --changed                    URLs whose content changed today
 *   npm run indexnow -- --all                        every canonical URL (rare)
 *   npm run indexnow -- --key                        print/generate a key
 *
 * Bing asks for STREAMING submissions rather than batches: one URL as it changes,
 * which is faster to reflect and lighter on both ends. `--all` exists for the first
 * submission after launch and for a domain move, and should not become a cron job —
 * resubmitting an unchanged sitemap daily is exactly the crawl waste §21 warns about.
 */
import 'dotenv/config'
import { randomBytes } from 'node:crypto'
import { createRequire } from 'node:module'
import { ROUTES, url } from '../src/lib/seo/routes'
import { catalog } from '../src/lib/catalog/repository'
import { getAllStateLegality } from '../src/lib/legality/state-pages'
import { publishedGuides, publishedPosts } from '../src/lib/content/content.data'
import { POLICIES } from '../src/lib/content/policies'
import { collectUrls } from './lib/site-urls'

/*
 * `src/lib/seo/indexnow` guards itself with `server-only`, which is what stops it
 * being pulled into a client bundle along with the key it reads. That package throws
 * outside a React server context, and this CLI is about as server-side as code gets —
 * so neutralise the module here rather than dropping the guard from the library,
 * where it is doing real work. Loaded dynamically because ESM imports are hoisted
 * above this line.
 */
async function loadIndexNow() {
  const require_ = createRequire(import.meta.url)
  require_.cache[require_.resolve('server-only')] = {
    exports: {},
  } as unknown as NodeJS.Module
  return import('../src/lib/seo/indexnow')
}

/**
 * Every canonical URL, INCLUDING the articles and products posted from the admin panel.
 *
 * The authored-only list below was the whole of `--all` until 2026-09-27, which meant a
 * site whose blog lives in the database could resubmit its entire sitemap and leave
 * every article out of it. Falls back to the authored list if the database is
 * unreachable — a partial submission beats a failed one.
 */
async function allUrls(): Promise<string[]> {
  try {
    return (await collectUrls()).map((u) => u.path)
  } catch (error) {
    console.warn(`database unreachable (${(error as Error).message.slice(0, 60)}) — submitting authored content only`)
    return authoredUrls()
  }
}

/** The authored files alone: no database, so it cannot fail. */
function authoredUrls(): string[] {
  const paths = [
    ...Object.values(ROUTES)
      .filter((r) => r.inSitemap && !r.pattern.includes('['))
      .map((r) => r.pattern),
    ...catalog.listCategories().map((c) => url.category(c.slug)),
    ...catalog.listProducts().map((p) => url.product(p.slug)),
    ...catalog.listBatches().map((b) => url.labBatch(b.batchCode)),
    ...getAllStateLegality().filter((s) => s.isPublishable).map((s) => url.legalityState(s.slug)),
    ...publishedPosts().map((p) => url.blogPost(p.slug)),
    ...publishedGuides().map((g) => url.guide(g.slug)),
    ...POLICIES.map((p) => url.policy(p.slug)),
  ]
  return [...new Set(paths)]
}

/** Database rows whose content was edited today, added to the authored list below. */
async function postedChangedToday(): Promise<string[]> {
  const today = new Date().toISOString().slice(0, 10)
  try {
    return (await collectUrls()).filter((u) => u.lastmod === today).map((u) => u.path)
  } catch {
    return []
  }
}

/** URLs carrying a real date that changed today — the honest definition of "changed". */
function changedToday(): string[] {
  const today = new Date().toISOString().slice(0, 10)
  const out: string[] = []
  for (const s of getAllStateLegality()) {
    if (s.isPublishable && s.lastReviewedAt.slice(0, 10) === today) {
      out.push(url.legalityState(s.slug))
    }
  }
  for (const p of publishedPosts()) {
    if (p.updatedAt.slice(0, 10) === today) out.push(url.blogPost(p.slug))
  }
  for (const g of publishedGuides()) {
    if (g.updatedAt.slice(0, 10) === today) out.push(url.guide(g.slug))
  }
  for (const b of catalog.listBatches()) {
    if (b.testedAt.slice(0, 10) === today) out.push(url.labBatch(b.batchCode))
  }
  return [...new Set(out)]
}

async function main() {
  const { submitUrl, submitUrls, indexNowKey, isValidKey } = await loadIndexNow()
  const args = process.argv.slice(2)
  const flag = (name: string) => args.includes(name)
  const value = (name: string) => {
    const i = args.indexOf(name)
    return i >= 0 ? args[i + 1] : undefined
  }

  if (flag('--key')) {
    const existing = indexNowKey()
    if (existing) {
      console.log(`INDEXNOW_KEY is set and ${isValidKey(existing) ? 'valid' : 'INVALID (needs 8–128 hex chars)'}`)
      console.log('  key file is served at /indexnow-key.txt')
    } else {
      console.log('INDEXNOW_KEY is not set. Add this to .env:\n')
      console.log(`  INDEXNOW_KEY=${randomBytes(16).toString('hex')}\n`)
      console.log('The key file route serves it automatically once set.')
    }
    return
  }

  const single = value('--url')
  const paths = single
    ? [single]
    : flag('--all')
      ? await allUrls()
      : [...new Set([...changedToday(), ...(await postedChangedToday())])]

  if (paths.length === 0) {
    console.log('Nothing to submit — no content carries today as its change date.')
    console.log('Use --url <path> for a specific URL, or --all for a full resubmit.')
    return
  }

  console.log(`Submitting ${paths.length} URL(s) to IndexNow…`)
  const result = paths.length === 1
    ? await submitUrl(paths[0]!)
    : await submitUrls(paths)

  if (result.ok) {
    console.log(`✓ accepted (HTTP ${result.status}) — ${result.submitted} URL(s)`)
  } else {
    console.error(`✗ ${result.reason}${result.status ? ` (HTTP ${result.status})` : ''}`)
    process.exitCode = 1
  }
}

void main()
