import { connection } from 'next/server'
import { postedContentSlugs } from '@/lib/content/merged-content'

/**
 * The slugs of posts and guides published from the admin panel, for the proxy.
 *
 * Served from the data cache (the loaders behind `postedContentSlugs` are tagged
 * CONTENT_TAG), so the proxy's periodic refresh costs a request, never a query, and
 * publishing or unpublishing invalidates it.
 *
 * A real failure is NOT cached — the loaders throw on it — so it becomes a 503 here,
 * and the proxy keeps the answer it already had instead of 404ing every admin page.
 */
export async function GET(): Promise<Response> {
  // Request-time, so the build never needs the database for this.
  await connection()
  const headers = { 'cache-control': 'no-store' }
  try {
    return Response.json(await postedContentSlugs(), { headers })
  } catch {
    return Response.json({ posts: null, guides: null }, { status: 503, headers })
  }
}
