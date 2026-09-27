import { createSlugSnapshot, stringArray, type Fetcher } from '@/lib/cache/slug-snapshot'

/**
 * Is this a post or guide published from the admin panel? The proxy's answer.
 *
 * The same snapshot the proxy uses for posted products (lib/cache/slug-snapshot.ts),
 * pointed at the content endpoint. Authored posts and guides never reach this: the
 * proxy checks the in-memory authored lists first and only asks here about a slug
 * they do not know — so an authored page pays nothing for it.
 *
 * Posts and guides live at different addresses (/blog/… and /guides/…), so each key
 * carries its kind. A post and a guide with the same slug are two different pages.
 *
 * No `server-only` import: src/proxy.ts loads this module.
 */

export const POSTED_CONTENT_SLUGS_PATH = '/api/content/posted-slugs'

export type PostedContentKind = 'post' | 'guide'

const content = createSlugSnapshot({
  path: POSTED_CONTENT_SLUGS_PATH,
  read: (body) => {
    const shaped = body as { posts?: unknown; guides?: unknown } | null
    const posts = stringArray(shaped?.posts)
    const guides = stringArray(shaped?.guides)
    if (!posts || !guides) return null
    return new Set([...posts.map((s) => `post:${s}`), ...guides.map((s) => `guide:${s}`)])
  },
})

export async function isPostedContent(
  kind: PostedContentKind,
  slug: string,
  origin: string,
  options: { now?: number; fetcher?: Fetcher } = {},
): Promise<boolean | 'unknown'> {
  return content.has(`${kind}:${slug}`, origin, options)
}

/** Tests only. */
export function resetPostedContentCache(): void {
  content.reset()
}
