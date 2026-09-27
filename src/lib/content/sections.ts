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
      'What the material is, how the forms differ, and how to buy and store it. Start here if you have not used root bark before.',
  },
  {
    slug: 'dyeing',
    title: 'Dyeing technique',
    intro:
      'Ratios, mordants, temperature and the modifiers that move a colour. Written to be repeatable rather than inspirational.',
  },
  {
    slug: 'devices',
    title: 'Devices and hardware',
    intro:
      'What a cartridge is, what a coil does, and why most faults are cold oil or a blocked airway rather than a broken device.',
  },
  {
    slug: 'cannabinoids',
    title: 'Cannabinoids and concentrates',
    intro:
      'The chemistry and the process words: what THCA is, how the four production methods differ, and what a label term does and does not mean.',
  },
  {
    slug: 'testing',
    title: 'Testing and certificates',
    intro:
      'How material is measured, what a full panel covers, and how to read a record against the batch code in your hand.',
  },
  {
    slug: 'education',
    title: 'Background',
    intro:
      'Longer explanations of the compounds and categories this site deals in, for readers who want the whole picture rather than a procedure.',
  },
  {
    slug: 'legality',
    title: 'Legal position',
    intro:
      'Where the law is settled, where it is not, and what this site will and will not assert. Every position carries the date it was reviewed.',
  },
  {
    slug: 'ordering',
    title: 'Ordering and delivery',
    intro:
      'How an order is checked, packed and carried, and what to do when something arrives wrong.',
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
