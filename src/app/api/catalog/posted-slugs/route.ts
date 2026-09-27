import { cacheTag } from 'next/cache'
import { connection } from 'next/server'
import { CATALOG_TAG } from '@/lib/catalog/merged'

/**
 * The slugs of every live posted product, for the proxy's 404 gate.
 *
 * The proxy cannot use the data cache, so it reads this instead of the database.
 * The list is cached under the catalogue tag, which means the database is queried
 * when an operator posts or edits a product and at no other time. A proxy lookup
 * per visit would have kept Neon awake for as long as anyone browsed a posted
 * product, and Neon bills by the minute it is awake.
 */
async function livePostedSlugs(): Promise<readonly string[]> {
  'use cache'
  cacheTag(CATALOG_TAG)

  const { db } = await import('@/lib/db/client')
  try {
    const rows = await db.postedProduct.findMany({
      where: { isActive: true },
      select: { slug: true },
    })
    return rows.map((row) => row.slug)
  } catch (error) {
    // Migration 0010 not applied yet: nothing is posted, and the first post
    // invalidates this. Anything else is thrown, so it is never cached and the
    // proxy keeps the answer it already had.
    const { isMissingTableError } = await import('@/lib/db/errors')
    if (isMissingTableError(error)) return []
    throw error
  }
}

export async function GET(): Promise<Response> {
  // Request-time, so the build never needs the database for this.
  await connection()
  const headers = { 'cache-control': 'no-store' }
  try {
    return Response.json({ slugs: await livePostedSlugs() }, { headers })
  } catch {
    return Response.json({ slugs: null }, { status: 503, headers })
  }
}
