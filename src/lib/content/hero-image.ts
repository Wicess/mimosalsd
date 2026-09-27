import { sanitizeMeta } from '@/lib/seo/meta'

/**
 * ─────────────────────────────────────────────────────────────────────────────
 *  THE PICTURE AT THE TOP OF AN ARTICLE (owner, 2026-09-17).
 *
 *  `Post.heroImageKey` and `Guide.heroImageKey` have been in the schema since the
 *  content models were added, and nothing read them. Every article's main picture
 *  came from `postImages()`, which picks one of the site's own product photographs
 *  by matching a regular expression against the title — so a post about dyeing wool
 *  got a photograph of root bark, which is honest but is not an illustration of the
 *  article, and two posts on the same topic got the same picture.
 *
 *  The owner generates an image per article and wants it uploaded and set. This is
 *  the piece that was missing: a stored key, its alt text, and a fallback so an
 *  article without one still renders a picture rather than a gap.
 *
 *  ── WHY THE ALT TEXT IS DERIVED, NOT TYPED ─────────────────────────────────
 *
 *  Alt text is an optional field, and optional fields get left blank. Bing's
 *  guidelines put images and alt text under "reinforce text, never replace it", and
 *  an empty alt on the largest element of the page is both an accessibility failure
 *  (WCAG 2.2 AA is a CI budget here) and a wasted signal. Deriving it from the title
 *  gives every article a true, specific description without depending on anyone
 *  remembering; anything typed still wins.
 * ─────────────────────────────────────────────────────────────────────────────
 */

/**
 * Alt text for an article's main picture.
 *
 * The title, cleaned of the punctuation a screen reader would announce, framed as
 * what the picture is. It never claims to describe the photograph's contents, which
 * nothing here knows — it identifies the image by the article it illustrates, which
 * is true, useful to a screen-reader user, and useful to an image crawler.
 */
export function heroAlt(title: string, typed?: string | null): string {
  const given = typed?.trim()
  if (given) return sanitizeMeta(given)
  const clean = sanitizeMeta(title).replace(/[?!.]+$/u, '')
  return `Illustration for the article ${clean}`
}

/** The public URL for a stored hero key, or undefined when there is no CDN host. */
export function heroSrc(key: string): string | undefined {
  const host = (process.env.NEXT_PUBLIC_R2_PUBLIC_HOST || process.env.R2_PUBLIC_HOST)
    ?.replace(/^https?:\/\//, '')
    .replace(/\/$/, '')
  return host ? `https://${host}/${key}` : undefined
}

/**
 * Is this a key this site wrote?
 *
 * The key is stored as a plain string on the row, so it is worth checking before it
 * is interpolated into a URL: a value that walked out of the bucket prefix, or that
 * carries a scheme or a traversal, is not rendered.
 */
export function isHeroKey(key: string): boolean {
  return /^[a-z0-9][a-z0-9/_-]*\.(?:jpg|jpeg|png|webp|avif)$/i.test(key) && !key.includes('..')
}
