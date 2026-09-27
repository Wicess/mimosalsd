import type { Post } from './content.data'

/**
 * ─────────────────────────────────────────────────────────────────────────────
 *  THE BLOG, IN SECTIONS (owner, 2026-09-17).
 *
 *  The index rendered every article in one undifferentiated grid. That was fine at
 *  six articles and is not fine at fifty-seven: a reader looking for how to mordant
 *  wool has to scan past device hardware and certificate reading to find it, and a
 *  crawler is given no signal about what the site is actually about.
 *
 *  Sections are derived from `Post.category` rather than from a second field, so
 *  there is one place a piece's topic lives and no way for two to disagree. A
 *  category with no section defined still renders, under a title-cased heading at
 *  the end — a new category should appear on the page the day it is used, not the
 *  day somebody remembers to add it here.
 *
 *  Order is deliberate and not alphabetical: the material this site sells comes
 *  first, technique next, then the categories that explain what is in a product,
 *  then the practical questions somebody asks with a full cart.
 * ─────────────────────────────────────────────────────────────────────────────
 */

export interface BlogSection {
  /** Matches `Post.category`. */
  readonly slug: string
  readonly title: string
  /** One line under the heading. Real description, not a keyword line. */
  readonly intro: string
}

export const BLOG_SECTIONS: readonly BlogSection[] = [
  {
    slug: 'botanical',
    title: 'The botanical range',
    intro:
      'The trees, the three cuts, what tannin does, and how to buy and keep a pound so it is still worth using next year.',
  },
  {
    slug: 'dyeing',
    title: 'Dyeing technique',
    intro:
      'Fifteen articles of working numbers: what to weigh, how hot to hold it, and which single variable to change next. Repeatable, not inspirational.',
  },
  {
    slug: 'devices',
    title: 'Devices and hardware',
    intro:
      'Threads, coils, blinking lights and blocked airways — how the hardware works, and how to tell a fault from a cold device.',
  },
  {
    slug: 'cannabinoids',
    title: 'Cannabinoids and concentrates',
    intro:
      'The words on the box, explained: acid forms, terpenes, the four process names, and where the arithmetic on a total figure hides.',
  },
  {
    slug: 'testing',
    title: 'Testing and certificates',
    intro:
      'Batch code first, then the date, then the accreditation scope, then the panels. How to settle a certificate in two minutes.',
  },
  {
    slug: 'education',
    title: 'Background',
    intro:
      'Longer background pieces, for when you want the whole picture rather than the next step in a procedure.',
  },
  {
    slug: 'legality',
    title: 'Legal position',
    intro:
      'What we will and will not assert about the law, and the date each position was last read. Where it is unsettled, we say so.',
  },
  {
    slug: 'ordering',
    title: 'Ordering and delivery',
    intro:
      'What happens between your order and your doorstep, and what to do if a parcel arrives short or damaged.',
  },
]

/** Title case for a category nobody has written a section for yet. */
function fallbackTitle(category: string): string {
  return category
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

export interface GroupedSection extends BlogSection {
  readonly posts: readonly Post[]
}

/**
 * Posts grouped into sections, in the order above, with unknown categories appended.
 *
 * Empty sections are dropped: a heading with nothing under it tells a reader that
 * something is missing rather than that a topic exists.
 */
export function groupPostsIntoSections(posts: readonly Post[]): readonly GroupedSection[] {
  const byCategory = new Map<string, Post[]>()
  for (const post of posts) {
    const key = post.category || 'other'
    const list = byCategory.get(key)
    if (list) list.push(post)
    else byCategory.set(key, [post])
  }

  const known = BLOG_SECTIONS.map((section) => ({
    ...section,
    posts: byCategory.get(section.slug) ?? [],
  })).filter((section) => section.posts.length > 0)

  const claimed = new Set(BLOG_SECTIONS.map((s) => s.slug))
  const extra = [...byCategory.entries()]
    .filter(([category]) => !claimed.has(category))
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([category, list]) => ({
      slug: category,
      title: fallbackTitle(category),
      intro: '',
      posts: list,
    }))

  return [...known, ...extra]
}
