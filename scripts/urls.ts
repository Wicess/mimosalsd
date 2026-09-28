#!/usr/bin/env tsx
/**
 * Regenerate URL.md — the list of every indexable URL on the site.
 *
 *   npm run urls                 rewrite URL.md from the current data
 *   npm run urls -- --check      also request each URL and report anything not 200
 *   npm run urls -- --base https://www.mimosalsd.com   check against another host
 *   npm run urls -- --dry        print the summary, write nothing
 *
 * The file exists because Google has no IndexNow equivalent: new pages go in by hand
 * through Search Console's URL Inspection, ten or so a day. So the list has to say
 * which URLs are NEW since it was last written, not just what exists — that diff is
 * the part that gets used, and it is why this is generated rather than hand-kept.
 *
 * It reads `scripts/lib/site-urls.ts`, the same collector `indexnow.ts --all` uses, so
 * the file and the submissions cannot disagree about what the site contains.
 */
import 'dotenv/config'
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { PrismaClient } from '@prisma/client'
import { BRAND } from '../src/lib/brand'
import { byGroup, collectUrls, GROUP_PRIORITY, type SiteUrl } from './lib/site-urls'

const FILE = 'URL.md'

function baseUrl(args: string[]): string {
  const i = args.indexOf('--base')
  const explicit = i >= 0 ? args[i + 1] : undefined
  const fromEnv = process.env.NEXT_PUBLIC_SITE_URL
  const base = explicit ?? (fromEnv && !fromEnv.includes('localhost') ? fromEnv : `https://www.${BRAND.domain}`)
  return base.replace(/\/$/, '')
}

/** The absolute URLs already in the committed file, so a rewrite can report the diff. */
function previousUrls(): Set<string> {
  if (!existsSync(FILE)) return new Set()
  const found = readFileSync(FILE, 'utf8').match(/^https?:\/\/\S+$/gm) ?? []
  return new Set(found)
}

function previousDate(): string | undefined {
  if (!existsSync(FILE)) return undefined
  return readFileSync(FILE, 'utf8').match(/generated ([0-9]{4}-[0-9]{2}-[0-9]{2})/)?.[1]
}

async function check(urls: string[], concurrency = 6): Promise<Map<string, number | string>> {
  const bad = new Map<string, number | string>()
  const queue = [...urls]
  const worker = async () => {
    for (let next = queue.shift(); next; next = queue.shift()) {
      try {
        const res = await fetch(next, { redirect: 'manual' })
        if (res.status !== 200) bad.set(next, res.status)
      } catch (error) {
        bad.set(next, (error as Error).message.slice(0, 60))
      }
    }
  }
  await Promise.all(Array.from({ length: concurrency }, worker))
  return bad
}

function render(entries: SiteUrl[], base: string, today: string, added: string[], removed: string[], since?: string): string {
  // Built exactly as `absoluteUrl()` builds it, so the file and the canonical tags
  // agree character for character — including the home page's trailing slash.
  const abs = (path: string) => new URL(path, base).toString()
  const groups = byGroup(entries)
  const lines: string[] = []

  lines.push(`# URL — every indexable page on ${BRAND.name}`)
  lines.push('')
  lines.push(`**${entries.length} URLs**, generated ${today} from this repository's own data.`)
  lines.push(`Regenerate with \`npm run urls\`. Paste any block below into Bing Webmaster Tools,`)
  lines.push('Google Search Console or a crawler.')
  lines.push('')
  lines.push('Only indexable pages are listed. Cart, checkout, account, order status and admin all')
  lines.push('carry `noindex` and are deliberately absent — submitting a noindex URL contradicts its')
  lines.push('own robots tag and costs trust in the whole file. State pages without a reviewed')
  lines.push('statute and categories with no products are absent for the same reason.')
  lines.push('')
  lines.push('---')
  lines.push('')

  if (added.length > 0 || removed.length > 0) {
    lines.push(`## Changed since ${since ?? 'the last generation'}`)
    lines.push('')
    if (added.length > 0) {
      lines.push(`**New — ${added.length}.** These are the ones to put through Search Console by hand:`)
      lines.push('URL Inspection → paste → Request Indexing. Roughly ten a day per property, so work');
      lines.push('down the list and pick up where you stopped.')
      lines.push('')
      lines.push('```')
      lines.push(...added)
      lines.push('```')
      lines.push('')
      lines.push('For Bing and the other IndexNow engines, submit the same set with')
      lines.push('`npm run indexnow -- --url <path>` per URL, or `npm run indexnow -- --all` after a')
      lines.push('launch or a domain move.')
      lines.push('')
    }
    if (removed.length > 0) {
      lines.push(`**Gone — ${removed.length}.** No longer indexable. Do not resubmit these; if one was`)
      lines.push('indexed before, let it 404 or 410 rather than redirecting it somewhere irrelevant.')
      lines.push('')
      lines.push('```')
      lines.push(...removed)
      lines.push('```')
      lines.push('')
    }
    lines.push('---')
    lines.push('')
  }

  lines.push('## Every URL, by section')
  lines.push('')
  for (const [group, groupEntries] of groups) {
    lines.push(`### ${group} — ${groupEntries.length} (sitemap priority ${GROUP_PRIORITY[group]})`)
    lines.push('')
    lines.push('```')
    for (const entry of groupEntries) lines.push(abs(entry.path))
    lines.push('```')
    lines.push('')
  }

  lines.push('---')
  lines.push('')
  lines.push('## Where the dates come from')
  lines.push('')
  lines.push('Pages that carry a real date are listed with it in the sitemap: policies use their')
  lines.push('reviewed date, articles and guides their last content edit, state pages their statute')
  lines.push('review, lab batches their test date. Nothing is stamped with today just to look fresh —')
  lines.push('an invented `lastmod` is ignored once and distrusted afterwards.')
  lines.push('')
  const dated = entries.filter((e) => e.lastmod).length
  lines.push(`${dated} of ${entries.length} URLs carry a real date.`)
  lines.push('')
  return lines.join('\n')
}

async function main() {
  const args = process.argv.slice(2)
  const base = baseUrl(args)
  const today = new Date().toISOString().slice(0, 10)
  const db = new PrismaClient()
  try {
    const entries = await collectUrls(db)
    const absolute = entries.map((e) => new URL(e.path, base).toString())
    const before = previousUrls()
    const added = absolute.filter((u) => !before.has(u))
    const removed = [...before].filter((u) => !absolute.includes(u))

    console.log(`${entries.length} indexable URLs at ${base}`)
    for (const [group, groupEntries] of byGroup(entries)) console.log(`  ${group.padEnd(16)} ${groupEntries.length}`)
    if (before.size > 0) console.log(`  new since last run: ${added.length}, gone: ${removed.length}`)

    if (args.includes('--check')) {
      console.log('checking every URL…')
      const bad = await check(absolute)
      if (bad.size === 0) console.log('  all 200')
      else for (const [u, status] of bad) console.log(`  ${status}  ${u}`)
    }

    if (args.includes('--dry')) {
      console.log('--dry: URL.md not written')
      return
    }
    writeFileSync(FILE, render(entries, base, today, added, removed, previousDate()))
    console.log(`wrote ${FILE}`)
  } finally {
    await db.$disconnect()
  }
}

void main()
