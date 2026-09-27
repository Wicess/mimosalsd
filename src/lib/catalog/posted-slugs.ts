import { createSlugSnapshot, stringArray, type Fetcher } from '@/lib/cache/slug-snapshot'

/**
 * ─────────────────────────────────────────────────────────────────────────────
 *  IS THIS A POSTED PRODUCT? — the proxy's answer, kept in memory.
 *
 *  Authored products are checked against the in-memory catalogue. A product
 *  posted from the admin panel exists only in the database, and the proxy has to
 *  know about it before rendering: otherwise the only way to turn away a slug
 *  that exists nowhere is a `notFound()` after the page shell has streamed, which
 *  is a soft 404 (see the header of src/proxy.ts).
 *
 *  The list comes from /api/catalog/posted-slugs, which is served from the data
 *  cache, so a refresh here costs a request and never a database query.
 *
 *  ── How fresh ──────────────────────────────────────────────────────────────
 *  A snapshot answers for 60 seconds. A slug NOT in it is rechecked once the
 *  snapshot is 10 seconds old, so a product posted a moment ago stops returning
 *  404 almost at once, while a stream of made-up slugs costs at most one refresh
 *  per 10 seconds per instance.
 *
 *  ── When it cannot tell ────────────────────────────────────────────────────
 *  It says so ('unknown'), and the proxy lets the request through to the page,
 *  which answers for itself. Failing open costs, at worst, a soft 404 for a slug
 *  that exists nowhere. Failing closed would 404 a real product.
 * ─────────────────────────────────────────────────────────────────────────────
 */

export const POSTED_SLUGS_PATH = '/api/catalog/posted-slugs'

/*
  The snapshot logic itself now lives in lib/cache/slug-snapshot.ts, shared with
  admin-published posts and guides. Behaviour is unchanged: this module keeps its
  public API, and tests/catalog/posted-slugs.test.ts runs against it as before.
*/
const products = createSlugSnapshot({
  path: POSTED_SLUGS_PATH,
  read: (body) => {
    const slugs = stringArray((body as { slugs?: unknown } | null)?.slugs)
    return slugs ? new Set(slugs) : null
  },
})

export async function isPostedSlug(
  slug: string,
  origin: string,
  options: { now?: number; fetcher?: Fetcher } = {},
): Promise<boolean | 'unknown'> {
  return products.has(slug, origin, options)
}

/** Tests only. */
export function resetPostedSlugCache(): void {
  products.reset()
}
