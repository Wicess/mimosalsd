#!/usr/bin/env tsx
/**
 * Apply a product-copy file to PostedProduct rows.
 *
 *   npx tsx scripts/rewrite-products.ts scripts/content/products-2026-09-28.json            dry run
 *   npx tsx scripts/rewrite-products.ts scripts/content/products-2026-09-28.json --apply    write
 *
 * Each entry names the row by `oldSlug` and may give it a new `slug`. The script keeps
 * what the copy does not own — variants, prices, photographs, batch codes, flags — and
 * replaces the words: name, summary, body, specs, SEO, the write-up, the FAQs and the
 * photographs' alt text.
 *
 * All-or-nothing, like publish-posts.ts. Every document must pass postedDocumentSchema
 * (a row that fails it is silently dropped from the shop) and the compliance lexicon
 * for its product line before anything is written, and the old rows are backed up to
 * a file first. A renamed slug is a new row plus the old one removed, in one
 * transaction, with a matching permanent redirect in next.config.ts.
 */
import 'dotenv/config'
import { readFileSync, writeFileSync } from 'node:fs'
import { db } from '../src/lib/db/client'
import { postedDocumentSchema, type PostedDocument } from '../src/lib/catalog/posted-product'
import { CATEGORIES } from '../src/lib/catalog/catalog.data'
import { scanText, formatScanResult } from '../src/lib/compliance/lexicon'

interface Entry {
  oldSlug: string
  slug: string
  name: string
  shortDescription: string
  seo: { metaTitle: string; metaDescription: string; keywords: string[] }
  specs: [string, string][]
  images: string[]
  sections: { heading: string; paragraphs: string[] }[]
  advantages: string[]
  faqs: { question: string; answer: string }[]
  sources: { label: string; url: string }[]
}

/** Plain-text body: headings and paragraphs, markdown links reduced to their text. */
function flatten(e: Entry): string {
  const strip = (s: string) => s.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
  return e.sections.map((s) => [s.heading, ...s.paragraphs.map(strip)].join('\n\n')).join('\n\n')
}

async function main() {
  const file = process.argv[2]
  const apply = process.argv.includes('--apply')
  if (!file) throw new Error('usage: rewrite-products.ts <file.json> [--apply]')
  const { products } = JSON.parse(readFileSync(file, 'utf8')) as { products: Entry[] }

  const planned: { entry: Entry; row: Awaited<ReturnType<typeof db.postedProduct.findUnique>>; doc: PostedDocument }[] = []
  let failed = 0

  for (const e of products) {
    const row = await db.postedProduct.findUnique({ where: { slug: e.oldSlug } })
    if (!row) {
      console.error(`✗ ${e.oldSlug}: no such product`)
      failed++
      continue
    }
    if (e.slug !== e.oldSlug && (await db.postedProduct.findUnique({ where: { slug: e.slug } }))) {
      console.error(`✗ ${e.oldSlug}: the new slug ${e.slug} is already taken`)
      failed++
      continue
    }
    const old = row.document as unknown as PostedDocument
    if (e.images.length !== old.images.length) {
      console.error(`✗ ${e.oldSlug}: ${e.images.length} alt texts for ${old.images.length} photographs`)
      failed++
      continue
    }

    const candidate = {
      ...old,
      name: e.name,
      shortDescription: e.shortDescription,
      description: flatten(e),
      specs: e.specs,
      seo: e.seo,
      content: { sections: e.sections, advantages: e.advantages, faqs: e.faqs, sources: e.sources },
      images: old.images.map((img, i) => ({ ...img, alt: e.images[i]! })),
      writer: 'claude' as const,
      writtenAt: new Date().toISOString(),
    }
    const parsed = postedDocumentSchema.safeParse(candidate)
    if (!parsed.success) {
      console.error(`✗ ${e.oldSlug}: schema\n${parsed.error.issues.map((i) => `    ${i.path.join('.')}: ${i.message}`).join('\n')}`)
      failed++
      continue
    }

    const line = CATEGORIES.find((c) => c.slug === row.categorySlug)?.productLine
    const text = [
      e.name, e.shortDescription, e.seo.metaTitle, e.seo.metaDescription, ...e.seo.keywords,
      ...e.specs.flat(), ...e.images, flatten(e), ...e.advantages, ...e.faqs.flatMap((f) => [f.question, f.answer]),
    ].join('\n')
    const scan = scanText(text, line ? { productLines: [line] } : {})
    if (!scan.clean) {
      console.error(formatScanResult(scan, e.oldSlug))
      failed++
      continue
    }

    const t = e.seo.metaTitle.length
    const d = e.seo.metaDescription.length
    console.log(`✓ ${e.oldSlug}${e.slug !== e.oldSlug ? ` → ${e.slug}` : ''}  (title ${t}, description ${d}, ${flatten(e).split(/\s+/).length} words, ${e.faqs.length} FAQs)`)
    if (t > 60) console.warn(`  ! meta title over 60 characters`)
    if (d > 155) console.warn(`  ! meta description over 155 characters`)
    planned.push({ entry: e, row, doc: parsed.data })
  }

  if (failed > 0) {
    console.error(`\n${failed} failed. Nothing written.`)
    process.exit(1)
  }
  if (!apply) {
    console.log('\nDry run. Re-run with --apply to write.')
    process.exit(0)
  }

  const backup = file.replace(/\.json$/, '.backup.json')
  writeFileSync(backup, JSON.stringify(planned.map((p) => p.row), null, 2))
  console.log(`\nOld rows backed up to ${backup}`)

  await db.$transaction(async (tx) => {
    for (const { entry, row, doc } of planned) {
      const data = { document: doc as object, updatedBy: 'copy-rewrite-2026-09-28' }
      if (entry.slug === entry.oldSlug) {
        await tx.postedProduct.update({ where: { slug: entry.oldSlug }, data })
      } else {
        await tx.postedProduct.create({
          data: {
            slug: entry.slug,
            categorySlug: row!.categorySlug,
            isActive: row!.isActive,
            createdAt: row!.createdAt,
            createdBy: row!.createdBy,
            ...data,
          },
        })
        await tx.postedProduct.delete({ where: { slug: entry.oldSlug } })
      }
      await tx.complianceAuditLog.create({
        data: {
          entityType: 'PostedProduct',
          entityId: entry.slug,
          action: 'UPDATE',
          before: { slug: entry.oldSlug, name: (row!.document as { name: string }).name },
          after: { slug: entry.slug, name: doc.name },
          actorEmail: 'copy-rewrite-2026-09-28',
          reason: 'Product copy rewritten in this site’s own words; lexicon-checked before saving.',
        },
      })
    }
  }, { timeout: 120_000 })
  console.log(`Written: ${planned.length} product(s).`)
  process.exit(0)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
