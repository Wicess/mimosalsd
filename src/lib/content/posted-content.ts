import type { Guide, Post } from './content.data'

/**
 * ─────────────────────────────────────────────────────────────────────────────
 *  POSTS AND GUIDES WRITTEN IN THE ADMIN — pure, so the rules can be tested.
 *
 *  The authored content in `content.data.ts` stays the source of truth for what it
 *  covers. What this module governs is the second source: rows in the `Post` and
 *  `Guide` tables, written by an operator, converted here into exactly the shape
 *  the authored content already has — so every page renders one kind of thing and
 *  none of them has to know where a piece came from.
 *
 *  Everything an operator can get wrong is refused here with a sentence saying what
 *  to change, rather than discovered later as a broken page or a thin one.
 * ─────────────────────────────────────────────────────────────────────────────
 */

export type ContentKind = 'post' | 'guide'

/**
 * Post categories. The set the authored posts already use — a category an operator
 * invents is a category page with one post in it, and a URL taxonomy that grew by
 * accident is the hardest thing on a site to take back.
 *
 * The blog's sections (lib/content/sections.ts) come first, in their order. This list
 * held only the five older categories after the blog was sectioned, so the editor's
 * dropdown had no entry for "dyeing" or "testing": opening one of those articles
 * showed the first option instead, and saving it quietly re-filed the article under
 * "education". The older three stay valid for the rows that still carry them.
 */
export const POST_CATEGORIES = [
  'botanical',
  'dyeing',
  'devices',
  'cannabinoids',
  'testing',
  'education',
  'legality',
  'ordering',
  'quality',
  'shipping',
  'guides',
] as const
export type PostCategory = (typeof POST_CATEGORIES)[number]

export const LIMITS = {
  /** The answer-first block. 40–60 is the target the authored posts hold to. */
  summaryWords: { min: 30, max: 80, target: '40–60' },
  /** A floor against publishing a one-liner, not a word-count target. */
  bodyWords: 50,
  title: { min: 10, max: 120 },
  slug: { min: 3, max: 80 },
  metaTitle: 70,
  metaDesc: 165,
} as const

export interface ContentFormInput {
  readonly kind: ContentKind
  readonly slug: string
  readonly title: string
  readonly summary: string
  readonly body: readonly string[]
  /** Posts only. */
  readonly category?: PostCategory
  readonly authorSlug: string
  readonly recommendedProductSlugs: readonly string[]
  /** Posts only — the guide this post links up to. */
  readonly pillarSlug?: string
  /** Guides only — the posts this guide links down to. */
  readonly clusterSlugs: readonly string[]
  readonly metaTitle?: string
  readonly metaDesc?: string
}

export type Result<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: string }

/** What the form's references must resolve against. Passed in, so this stays pure. */
export interface KnownSlugs {
  readonly products: ReadonlySet<string>
  readonly guides: ReadonlySet<string>
  readonly posts: ReadonlySet<string>
  readonly authors: ReadonlySet<string>
}

/**
 * A URL slug from a title.
 *
 * Accented letters are TRANSLITERATED, never dropped: "Muscimol für Anfänger" must
 * become `muscimol-fur-anfanger`, not `muscimol-f-r-anf-nger` — a slug with holes in
 * it is a broken entity name in the one place a search engine reads it verbatim.
 * NFKD splits "ü" into "u" plus a combining mark, and `\p{M}` removes the mark.
 */
export function slugify(text: string): string {
  return text
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, LIMITS.slug.max)
    .replace(/-+$/g, '')
}

/** A line that belongs to a table or a bulleted list rather than to running prose. */
const STRUCTURED_LINE = /^(\||- )/

/**
 * Paragraphs, split on blank lines — the shape the authored `body` already uses.
 *
 * A soft-wrapped paragraph is joined into one line. A block whose every line is a
 * table row or a list item keeps its line breaks, because for those the break IS the
 * structure: collapsing it turned a pipe table into one long line of pipes on the
 * page, and a three-item list typed in the admin into a single bullet.
 */
export function splitParagraphs(text: string): string[] {
  return text
    .replace(/\r\n?/g, '\n')
    .split(/\n\s*\n/)
    .map((paragraph) => {
      const lines = paragraph
        .split('\n')
        .map((line) => line.replace(/\s+/g, ' ').trim())
        .filter(Boolean)
      const structured = lines.length > 1 && lines.every((line) => STRUCTURED_LINE.test(line))
      return lines.join(structured ? '\n' : ' ')
    })
    .filter(Boolean)
}

export function joinParagraphs(body: readonly string[]): string {
  return body.join('\n\n')
}

export function countWords(text: string): number {
  const trimmed = text.trim()
  return trimmed ? trimmed.split(/\s+/).length : 0
}

function field(formData: FormData, name: string): string {
  return String(formData.get(name) ?? '').trim()
}

/**
 * Read and validate the editor form.
 *
 * Every reference — author, recommended products, pillar, clusters — is checked
 * against what actually exists. A recommendation pointing at a product slug that is
 * not in the catalogue renders as nothing; a pillar link to a guide that does not
 * exist renders as a 404. Both are refused here instead.
 */
export function readContentForm(
  formData: FormData,
  kind: ContentKind,
  known: KnownSlugs,
): Result<ContentFormInput> {
  const fail = (error: string) => ({ ok: false as const, error })

  const title = field(formData, 'title')
  if (title.length < LIMITS.title.min || title.length > LIMITS.title.max) {
    return fail(`The title should be ${LIMITS.title.min} to ${LIMITS.title.max} characters.`)
  }

  const slug = slugify(field(formData, 'slug') || title)
  if (slug.length < LIMITS.slug.min) {
    return fail('The URL slug needs at least a few letters or numbers.')
  }

  const summary = field(formData, 'summary').replace(/\s+/g, ' ')
  const summaryWords = countWords(summary)
  if (summaryWords < LIMITS.summaryWords.min || summaryWords > LIMITS.summaryWords.max) {
    return fail(
      `The summary is ${summaryWords} words. Aim for ${LIMITS.summaryWords.target}: it is the passage an answer engine lifts, so it has to answer the question on its own, in the first sentence.`,
    )
  }

  const body = splitParagraphs(field(formData, 'body'))
  const bodyWords = countWords(body.join(' '))
  if (body.length === 0 || bodyWords < LIMITS.bodyWords) {
    return fail(
      `The body is ${bodyWords} words. Write at least ${LIMITS.bodyWords} — separate paragraphs with a blank line.`,
    )
  }

  const authorSlug = field(formData, 'authorSlug')
  if (!known.authors.has(authorSlug)) return fail('Choose an author.')

  const recommendedProductSlugs = [
    ...new Set(formData.getAll('recommendedProductSlugs').map(String).filter(Boolean)),
  ]
  const unknownProduct = recommendedProductSlugs.find((s) => !known.products.has(s))
  if (unknownProduct) return fail(`There is no product "${unknownProduct}" to recommend.`)

  let category: PostCategory | undefined
  let pillarSlug: string | undefined
  let clusterSlugs: string[] = []

  if (kind === 'post') {
    const raw = field(formData, 'category')
    if (!POST_CATEGORIES.includes(raw as PostCategory)) return fail('Choose a category.')
    category = raw as PostCategory

    const pillar = field(formData, 'pillarSlug')
    if (pillar) {
      if (!known.guides.has(pillar)) return fail(`There is no guide "${pillar}" to link up to.`)
      pillarSlug = pillar
    }
  } else {
    clusterSlugs = [...new Set(formData.getAll('clusterSlugs').map(String).filter(Boolean))]
    const unknownPost = clusterSlugs.find((s) => !known.posts.has(s))
    if (unknownPost) return fail(`There is no post "${unknownPost}" to link down to.`)
  }

  const metaTitle = field(formData, 'metaTitle')
  if (metaTitle.length > LIMITS.metaTitle) {
    return fail(`The meta title is ${metaTitle.length} characters. Keep it under ${LIMITS.metaTitle}.`)
  }
  const metaDesc = field(formData, 'metaDesc')
  if (metaDesc.length > LIMITS.metaDesc) {
    return fail(`The meta description is ${metaDesc.length} characters. Keep it under ${LIMITS.metaDesc}.`)
  }

  return {
    ok: true,
    value: {
      kind,
      slug,
      title,
      summary,
      body,
      ...(category ? { category } : {}),
      authorSlug,
      recommendedProductSlugs,
      ...(pillarSlug ? { pillarSlug } : {}),
      clusterSlugs,
      ...(metaTitle ? { metaTitle } : {}),
      ...(metaDesc ? { metaDesc } : {}),
    },
  }
}

/** Everything a reader will see, for the compliance lexicon. */
export function copyForScan(input: ContentFormInput): string {
  return [input.title, input.summary, ...input.body, input.metaTitle, input.metaDesc]
    .filter(Boolean)
    .join('\n')
}

/** The columns a saved row carries — only what the conversion below reads. */
export interface ContentRow {
  readonly slug: string
  readonly title: string
  readonly summary: string
  readonly body: string
  readonly category?: string | null
  readonly recommendedProductSlugs: readonly string[]
  readonly pillarSlug?: string | null
  readonly clusterSlugs?: readonly string[] | null
  readonly isPublished: boolean
  readonly publishedAt: Date | null
  readonly updatedAt: Date
  readonly author: { readonly slug: string } | null
  readonly metaTitle?: string | null
  readonly metaDesc?: string | null
  readonly heroImageKey?: string | null
}

/** The optional search-result overrides, present only when the editor set them. */
function metaOf(row: ContentRow) {
  return {
    ...(row.metaTitle ? { metaTitle: row.metaTitle } : {}),
    ...(row.metaDesc ? { metaDesc: row.metaDesc } : {}),
  }
}

/** The fallback author when a row has none — the same attribution the authored posts use. */
export const DEFAULT_AUTHOR_SLUG = 'editorial-team'

function iso(date: Date | null, fallback: Date): string {
  return (date ?? fallback).toISOString().slice(0, 10)
}

/** A saved post, in the authored `Post` shape. */
export function rowToPost(row: ContentRow): Post {
  return {
    slug: row.slug,
    title: row.title,
    summary: row.summary,
    body: splitParagraphs(row.body),
    category: row.category ?? 'education',
    authorSlug: row.author?.slug ?? DEFAULT_AUTHOR_SLUG,
    publishedAt: iso(row.publishedAt, row.updatedAt),
    updatedAt: iso(row.updatedAt, row.updatedAt),
    ...(row.pillarSlug ? { pillarSlug: row.pillarSlug } : {}),
    recommendedProductSlugs: [...row.recommendedProductSlugs],
    isPublished: row.isPublished,
    ...(row.heroImageKey ? { heroImageKey: row.heroImageKey } : {}),
    ...metaOf(row),
  }
}

/** A saved guide, in the authored `Guide` shape. */
export function rowToGuide(row: ContentRow): Guide {
  return {
    slug: row.slug,
    title: row.title,
    summary: row.summary,
    body: splitParagraphs(row.body),
    authorSlug: row.author?.slug ?? DEFAULT_AUTHOR_SLUG,
    publishedAt: iso(row.publishedAt, row.updatedAt),
    updatedAt: iso(row.updatedAt, row.updatedAt),
    recommendedProductSlugs: [...row.recommendedProductSlugs],
    clusterSlugs: [...(row.clusterSlugs ?? [])],
    isPublished: row.isPublished,
    ...(row.heroImageKey ? { heroImageKey: row.heroImageKey } : {}),
    ...metaOf(row),
  }
}
