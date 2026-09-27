#!/usr/bin/env tsx
/**
 * Publish articles from a JSON batch file.
 *
 *   npx tsx scripts/publish-posts.ts <batch.json> [--apply]
 *
 * Every piece is checked against the compliance lexicon before it is written, its meta
 * title and description are derived the same way the admin panel derives them, and its
 * internal links are checked against what exists. A batch that fails any of those is
 * refused rather than half-published.
 */
import 'dotenv/config'
import { readFileSync } from 'node:fs'
import { PrismaClient } from '@prisma/client'
import { scanText } from '../src/lib/compliance/lexicon'
import { autoMeta } from '../src/lib/seo/meta'
import { isInternalPath } from '../src/components/content/rich-text'
import { parseTable } from '../src/lib/content/table'
import { splitParagraphs } from '../src/lib/content/posted-content'

interface Article {
  slug: string
  title: string
  category: string
  hero?: string
  summary: string
  body: string[]
  products?: string[]
}

const AUTHOR = { slug: 'editorial-team', name: 'Editorial desk', title: 'Written and checked in house' }
const LINK = /\[([^\]\n]+)\]\(([^)\s]+)\)/g

async function main() {
  const file = process.argv[2]
  if (!file) {
    console.error('usage: tsx scripts/publish-posts.ts <batch.json> [--apply]')
    process.exitCode = 1
    return
  }
  const apply = process.argv.includes('--apply')
  const batch: Article[] = JSON.parse(readFileSync(file, 'utf8'))
  const db = new PrismaClient()

  const productSlugs = new Set((await db.postedProduct.findMany({ select: { slug: true } })).map((p) => p.slug))
  const existing = new Set((await db.post.findMany({ select: { slug: true } })).map((p) => p.slug))
  const batchSlugs = new Set(batch.map((a) => a.slug))
  let failed = 0

  for (const a of batch) {
    const problems: string[] = []
    for (const block of a.body) if (block.startsWith('|') && !parseTable(block)) problems.push('malformed table')
    if (splitParagraphs(a.body.join('\n\n')).length !== a.body.length) problems.push('a block would not survive splitting')
    const words = a.summary.trim().split(/\s+/).length
    if (words < 35 || words > 75) problems.push(`summary is ${words} words, aim 40-60`)
    for (const match of a.body.join('\n').matchAll(LINK)) {
      const target = match[2]
      if (!target) continue
      if (!isInternalPath(target)) { problems.push(`link not allowed: ${target}`); continue }
      const blog = target.match(/^\/blog\/(.+)$/)
      if (blog && !batchSlugs.has(blog[1]!) && !existing.has(blog[1]!)) problems.push(`dead link: ${target}`)
      const product = target.match(/^\/product\/(.+)$/)
      if (product && !productSlugs.has(product[1]!)) problems.push(`no such product: ${target}`)
    }
    for (const slug of a.products ?? []) if (!productSlugs.has(slug)) problems.push(`no such product to recommend: ${slug}`)
    const meta = autoMeta({ title: a.title, summary: a.summary })
    const scan = scanText([a.title, a.summary, ...a.body, meta.metaTitle, meta.metaDescription].join('\n'), {
      productLines: ['MIMOSA_HOSTILIS', 'AMANITA', 'VAPE'], honourDirectives: false, editorial: true,
    })
    if (!scan.clean) problems.push(`lexicon: ${scan.blocking.map((m) => m.term).join(', ')}`)

    if (problems.length) { failed++; console.log(`REFUSED ${a.slug}\n   ${problems.join('\n   ')}`); continue }
    console.log(`ok      ${a.slug}  (${a.body.join(' ').split(/\s+/).length} words)  ${meta.metaTitle}`)

    if (apply) {
      const author = await db.author.upsert({ where: { slug: AUTHOR.slug }, create: AUTHOR, update: {} })
      const now = new Date()
      const data = {
        title: a.title, summary: a.summary, body: a.body.join('\n\n'), category: a.category,
        heroImageKey: a.hero ?? null, metaTitle: meta.metaTitle, metaDesc: meta.metaDescription,
        recommendedProductSlugs: a.products ?? [], authorId: author.id, isPublished: true, updatedAtContent: now,
      }
      await db.post.upsert({ where: { slug: a.slug }, create: { slug: a.slug, publishedAt: now, ...data }, update: data })
    }
  }
  console.log(apply ? `\napplied ${batch.length - failed}/${batch.length}` : `\ndry run: ${batch.length - failed}/${batch.length} would publish`)
  await db.$disconnect()
}
main()
