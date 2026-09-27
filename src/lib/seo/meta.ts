import type { Metadata } from 'next'
import { absoluteUrl } from './routes'

/**
 * Meta description hygiene.
 *
 * Content `summary` fields are deliberately 40–60 words: they are the answer-first
 * block an answer engine lifts, and shortening them would weaken the thing this site
 * competes on. But the SAME string was being handed to `description`, where Google
 * truncates around 155–160 characters — so the half of the answer that made the page
 * worth clicking was being cut off in the SERP.
 *
 * These are two different jobs. The page keeps the long summary; the meta tag gets a
 * clamped version, trimmed on a word boundary so it never ends mid-word.
 */

/** Upper bound before Google truncates. Conservative on purpose. */
export const MAX_DESCRIPTION_LENGTH = 160

/** Below this a description is too thin to earn a click. */
export const MIN_DESCRIPTION_LENGTH = 70

/**
 * ─────────────────────────────────────────────────────────────────────────────
 *  NO SYMBOLS IN A TITLE OR A DESCRIPTION (owner, 2026-09-17).
 *
 *  The generated meta used to read `Muha Meds Juice Man | $24 | MIMOSALSD`. Three
 *  problems in one string: the pipes are decoration a search engine gives no weight
 *  to, the brand suffix spends characters this site already decided not to spend
 *  (see the title comment in app/layout.tsx), and the price is a fact that changes
 *  without anything re-reading the copy that states it.
 *
 *  That last one is the reason prices are stripped rather than merely reformatted.
 *  A stored `$24` is true on the day it is written and silently false afterwards —
 *  the single failure mode the search guidelines warn about hardest. The live price
 *  is on the page and in the Product JSON-LD, both of which are read from the
 *  catalogue at render time, so nothing is lost by keeping it out of a frozen string.
 *
 *  Separators become commas, `&` becomes "and", and decorative marks are dropped.
 *  Ordinary sentence punctuation stays: a full stop, a comma, an apostrophe and a
 *  hyphen inside a word are how English is written, not symbols bolted onto a title.
 * ─────────────────────────────────────────────────────────────────────────────
 */

/** ` | `, ` — `, ` · ` and friends: structural separators, which become commas. */
const SEPARATORS = /\s*[|•·‧–—]+\s*/gu
/** Decorative or markup characters that carry no meaning in a SERP. */
const DECORATIVE = /[<>{}[\]()"*_#~^`\\@©®™°¦§¶†‡…]/gu
/** Any currency amount, with or without decimals and thousands separators. */
const PRICE = /[$£€¥]\s?\d[\d,]*(?:\.\d+)?/gu

/**
 * A title or description with the symbols taken out.
 *
 * Idempotent, so it is safe to run over a value that has already been through it —
 * which matters because it is applied both where copy is written and again in
 * `pageMetadata`, so an operator typing a meta title by hand in the admin panel gets
 * the same treatment as a generated one.
 */
export function sanitizeMeta(text: string): string {
  return text
    .normalize('NFKC')
    .replace(PRICE, '')
    // "21+" is the site's most common age string, and "+" is a symbol.
    .replace(/\b(\d{1,3})\s*\+/g, '$1 and over')
    .replace(/\s*&\s*/g, ' and ')
    .replace(SEPARATORS, ', ')
    .replace(DECORATIVE, '')
    // Curly quotes to a plain apostrophe, so "Dante's" survives but the glyph does not.
    .replace(/[\u2018\u2019\u201B]/g, "'")
    .replace(/[\u201C\u201D]/g, '')
    // A colon or semicolon is a separator here too, but only between words.
    .replace(/\s*[;:]\s*/g, ', ')
    .replace(/\s+/g, ' ')
    // Collapse the gaps the removals leave: doubled commas, a comma against a stop.
    .replace(/\s*,\s*(?=,)/g, '')
    .replace(/,\s*([.!?])/g, '$1')
    .replace(/\s+([.,!?])/g, '$1')
    .replace(/^[\s,.;:-]+/, '')
    .replace(/[\s,;:-]+$/u, '')
    .trim()
}

/**
 * Clamp to `max` characters, preferring a sentence boundary to a word boundary.
 *
 * Ends on a full stop. An ellipsis used to be appended to a truncated description;
 * it is a symbol, and a trailing `…` in a SERP snippet duplicates the one the engine
 * adds itself, so the text now simply ends on its last whole word.
 *
 * A word boundary alone was not enough. Put a full stop after the last whole word
 * and the product descriptions ended "Sold by the unit to." and "Lab tested by." —
 * sentences that stop in the middle and say nothing. So the cut goes back to the last
 * complete sentence that fits, and only falls back to a word boundary when that
 * sentence would leave a description too thin to earn a click.
 */
export function clampDescription(
  text: string,
  max: number = MAX_DESCRIPTION_LENGTH,
): string {
  const normalised = text.replace(/\s+/g, ' ').trim()
  if (normalised.length <= max) return normalised

  const slice = normalised.slice(0, max)
  // One character past the limit, so a sentence ending exactly on it still counts as ended.
  const sentences = [...normalised.slice(0, max + 1).matchAll(/[.!?](?=\s)/g)]
  const lastSentence = sentences.at(-1)
  if (lastSentence?.index !== undefined && lastSentence.index + 1 >= MIN_DESCRIPTION_LENGTH) {
    return normalised.slice(0, lastSentence.index + 1)
  }

  /*
    Next best is the end of a clause. A short first sentence followed by a long second
    one used to fall through to the word boundary and end "…a pale tint that is often
    the prettiest on." Cutting at the last comma instead gives "…roughly half to
    two-thirds the depth." — shorter, and a thing a person would actually write.
  */
  const clauses = [...slice.matchAll(/[,;:](?=\s)/g)]
  const lastClause = clauses.at(-1)
  if (lastClause?.index !== undefined && lastClause.index >= MIN_DESCRIPTION_LENGTH) {
    return `${slice.slice(0, lastClause.index).replace(/\s+(?:and|or|but|with|the|a|an)$/i, '')}.`
  }

  const lastSpace = slice.lastIndexOf(' ')
  const cut = (lastSpace > 0 ? slice.slice(0, lastSpace) : slice).replace(
    /[\s,;:—–-]+$/u,
    '',
  )

  return /[.!?]$/.test(cut) ? cut : `${cut}.`
}

/**
 * A meta title and description derived from the content itself.
 *
 * Both fields are optional in the admin form, and an optional field is a field that
 * gets left blank. A post saved with both empty used to store two nulls, and the
 * search guidelines are blunt about what that costs: "missing, duplicate, or overly
 * short title tags and meta descriptions may reduce indexing reliability, ranking,
 * and eligibility for grounding results."
 *
 * So they are derived at save time rather than left null, and STORED — not resolved
 * at render — so that what will appear in the SERP is visible in the admin panel,
 * editable, and the same string every time it is read.
 *
 * The description prefers the summary, which is already written as the answer-first
 * block an answer engine lifts. It falls back to the opening of the body, because a
 * first paragraph is the next most likely thing to answer the query.
 */
export function autoMeta(args: {
  readonly title: string
  readonly summary?: string | null
  readonly body?: string | null
  readonly metaTitle?: string | null
  readonly metaDesc?: string | null
}): { readonly metaTitle: string; readonly metaDescription: string } {
  const typedTitle = args.metaTitle?.trim()
  const typedDesc = args.metaDesc?.trim()

  const title = sanitizeMeta(typedTitle || args.title)
  const source = typedDesc || args.summary?.trim() || args.body?.trim() || args.title
  return {
    metaTitle: title.length > MAX_TITLE_LENGTH ? clampTitleText(title) : title,
    metaDescription: clampDescription(sanitizeMeta(source)),
  }
}

/** Upper bound before Google truncates a title link. */
export const MAX_TITLE_LENGTH = 60

/** Clamp a title on a word boundary. Kept here so `autoMeta` has no catalogue import. */
function clampTitleText(title: string, max: number = MAX_TITLE_LENGTH): string {
  const clean = sanitizeMeta(title)
  if (clean.length <= max) return clean
  const cut = clean.slice(0, max + 1)
  const lastBreak = cut.lastIndexOf(' ')
  return (lastBreak > 20 ? cut.slice(0, lastBreak) : clean.slice(0, max)).replace(/[\s,;:-]+$/u, '')
}

/**
 * Per-page metadata, including social cards.
 *
 * Next does NOT derive `openGraph.title` from a page's `title`. A parent
 * `openGraph` block is inherited verbatim by every descendant route, so declaring one
 * in the root layout gave all 150 pages the same share card — a product link and a
 * state legality link both previewed as the generic site tagline, which is close to
 * useless for the forum-and-group-chat sharing this business actually depends on.
 *
 * So every page builds its own. One call sets the title, the clamped description, the
 * canonical, and the matching Open Graph and Twitter cards, which also makes it
 * impossible for the canonical and the `og:url` to drift apart.
 */
export function pageMetadata(args: {
  readonly title: string
  readonly description: string
  /** Site-relative canonical path. */
  readonly path: string
  /** `article` for editorial content, `website` for everything else. */
  readonly type?: 'website' | 'article'
  readonly publishedTime?: string
  readonly modifiedTime?: string
  /**
   * The share card image. An article with its own hero passes it here; everything
   * else falls back to the site card generated by app/opengraph-image.tsx.
   */
  readonly image?: { readonly url: string; readonly alt: string }
}): Metadata {
  /*
    Sanitised HERE, not only where copy is written: this is the one function every
    route's metadata passes through, so a meta title typed by hand in the admin panel
    is cleaned by the same rule as a generated one, and no future page can bypass it.
  */
  const title = sanitizeMeta(args.title)
  const description = clampDescription(sanitizeMeta(args.description))
  const type = args.type ?? 'website'

  /*
    ── WHY THE IMAGE IS SET EXPLICITLY (2026-09-17) ───────────────────────────

    `app/opengraph-image.tsx` generates a site share card, and Next attaches it to
    routes by file convention. But a route that declares its own `openGraph` object
    REPLACES the inherited one — and this function declares one on every page it
    touches, which silently dropped the image from all of them.

    The symptom was invisible in the markup and obvious in the wild: article pages
    carried `twitter:card = summary_large_image` and no image at all, so a link
    pasted into a forum or a group chat rendered a large empty card. The home page
    looked fine because it does not route through here, which is exactly why nobody
    caught it. On a site whose only acquisition channel is organic and whose links
    get pasted by hand, that is a real cost.

    So the card is now always supplied: the article's own hero where it has one,
    otherwise the generated site card.
  */
  const image = args.image ?? {
    url: absoluteUrl('/opengraph-image'),
    alt: title,
  }

  return {
    title,
    description,
    alternates: { canonical: args.path },
    openGraph: {
      title,
      description,
      url: args.path,
      type,
      images: [{ url: image.url, alt: image.alt }],
      ...(type === 'article' && args.publishedTime
        ? { publishedTime: args.publishedTime, modifiedTime: args.modifiedTime }
        : {}),
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [{ url: image.url, alt: image.alt }],
    },
  }
}
