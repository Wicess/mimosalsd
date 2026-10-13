/**
 * Apply hand-written meta titles and descriptions to published articles.
 *
 *   npx tsx scripts/apply-article-meta.ts scripts/content/article-meta-2026-10-12.json [--apply]
 *
 * Without --apply it only checks: every slug exists and is published, every title
 * is 30 to 60 characters and every description 120 to 160 AFTER the same sanitising
 * the page applies (lib/seo/meta.ts), none is a duplicate, and all pass the
 * banned-terms scan. With --apply it writes them, with an audit entry per article.
 * Deploy afterwards: cached pages only pick up a direct database write on a deploy.
 */
import { readFileSync } from 'node:fs'
import { PrismaClient } from '@prisma/client'
import { scanText } from '../src/lib/compliance/lexicon'
import { clampDescription, sanitizeMeta } from '../src/lib/seo/meta'

const db = new PrismaClient()
const [file, flag] = process.argv.slice(2)
const APPLY = flag === '--apply'

async function main() {
  if (!file) throw new Error('Give the JSON file of { slug: [metaTitle, metaDesc] }.')
  const wanted = JSON.parse(readFileSync(file, 'utf8')) as Record<string, [string, string]>
  const posts = await db.post.findMany({ where: { slug: { in: Object.keys(wanted) } } })
  const bySlug = new Map(posts.map((post) => [post.slug, post]))
  const problems: string[] = []
  const seen = new Set<string>()

  for (const [slug, [title, desc]] of Object.entries(wanted)) {
    const post = bySlug.get(slug)
    if (!post) problems.push(`${slug}: no such article`)
    else if (!post.isPublished) problems.push(`${slug}: not published`)
    const cleanTitle = sanitizeMeta(title)
    const cleanDesc = clampDescription(sanitizeMeta(desc))
    if (cleanTitle.length < 30 || cleanTitle.length > 60) problems.push(`${slug}: title is ${cleanTitle.length} characters`)
    if (cleanDesc.length < 120 || cleanDesc.length > 160) problems.push(`${slug}: description is ${cleanDesc.length} characters`)
    if (cleanDesc !== sanitizeMeta(desc)) problems.push(`${slug}: description would be cut to "${cleanDesc.slice(-40)}"`)
    for (const text of [cleanTitle, cleanDesc]) {
      if (seen.has(text)) problems.push(`${slug}: duplicate "${text.slice(0, 40)}"`)
      seen.add(text)
    }
    if (!scanText(`${title}\n${desc}`).clean) problems.push(`${slug}: fails the banned-terms scan`)
  }

  if (problems.length > 0) {
    console.log(problems.join('\n'))
    throw new Error(`${problems.length} problem(s); nothing written.`)
  }
  console.log(`${Object.keys(wanted).length} articles checked, all clean.`)
  if (!APPLY) return

  for (const [slug, [metaTitle, metaDesc]] of Object.entries(wanted)) {
    const post = bySlug.get(slug)!
    await db.$transaction([
      db.post.update({ where: { id: post.id }, data: { metaTitle, metaDesc } }),
      db.complianceAuditLog.create({
        data: {
          entityType: 'Post',
          entityId: post.id,
          action: 'UPDATE',
          before: { metaTitle: post.metaTitle, metaDesc: post.metaDesc },
          after: { metaTitle, metaDesc },
          actorId: 'script',
          actorEmail: 'script@mimosalsd',
          reason: `Search title and description rewritten by hand (${file})`,
        },
      }),
    ])
  }
  console.log(`Written: ${Object.keys(wanted).length}.`)
}

main()
  .catch((error) => {
    console.error(error.message)
    process.exitCode = 1
  })
  .finally(() => db.$disconnect())
