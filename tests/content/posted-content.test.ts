import { describe, expect, it } from 'vitest'
import {
  copyForScan,
  countWords,
  DEFAULT_AUTHOR_SLUG,
  POST_CATEGORIES,
  readContentForm,
  rowToGuide,
  rowToPost,
  slugify,
  splitParagraphs,
  type KnownSlugs,
} from '@/lib/content/posted-content'
import { BLOG_SECTIONS } from '@/lib/content/sections'

const KNOWN: KnownSlugs = {
  products: new Set(['amanita-capsules', 'mhrb-powder']),
  guides: new Set(['amanita-muscaria-explained']),
  posts: new Set(['what-is-muscimol']),
  authors: new Set(['editorial-team']),
}

const words = (n: number) => Array.from({ length: n }, (_, i) => `word${i}`).join(' ')

function form(fields: Record<string, string | string[]>): FormData {
  const data = new FormData()
  for (const [key, value] of Object.entries(fields)) {
    for (const v of Array.isArray(value) ? value : [value]) data.append(key, v)
  }
  return data
}

const VALID_POST = {
  title: 'How lab reports are read',
  summary: words(45),
  body: `${words(40)}\n\n${words(30)}`,
  category: 'quality',
  authorSlug: 'editorial-team',
}

describe('slugify', () => {
  it('makes a lowercase hyphenated slug', () => {
    expect(slugify('How Lab Reports Are Read')).toBe('how-lab-reports-are-read')
  })

  /*
    Transliterated, never dropped. A slug with holes in it is a broken entity name in
    the one place a search engine reads it verbatim.
  */
  it('transliterates accented letters instead of dropping them', () => {
    expect(slugify('Muscimol für Anfänger')).toBe('muscimol-fur-anfanger')
    expect(slugify('Café señorita')).toBe('cafe-senorita')
  })

  it('spells out an ampersand rather than losing it', () => {
    expect(slugify('Dyes & Mordants')).toBe('dyes-and-mordants')
  })

  it('collapses punctuation and trims hyphens from both ends', () => {
    expect(slugify('  --What?! Is... This--  ')).toBe('what-is-this')
  })

  it('caps the length without leaving a trailing hyphen', () => {
    const slug = slugify(`${'a'.repeat(79)} b`)
    expect(slug.length).toBeLessThanOrEqual(80)
    expect(slug.endsWith('-')).toBe(false)
  })
})

describe('splitParagraphs', () => {
  it('splits on blank lines, the shape the authored body already uses', () => {
    expect(splitParagraphs('One.\n\nTwo.\n\n\nThree.')).toEqual(['One.', 'Two.', 'Three.'])
  })

  it('treats Windows line endings the same', () => {
    expect(splitParagraphs('One.\r\n\r\nTwo.')).toEqual(['One.', 'Two.'])
  })

  it('joins a paragraph hard-wrapped across lines back into one', () => {
    expect(splitParagraphs('A line\nthat wraps.')).toEqual(['A line that wraps.'])
  })

  it('drops empty paragraphs', () => {
    expect(splitParagraphs('\n\n  \n\nOnly.\n\n')).toEqual(['Only.'])
  })

  it('keeps the rows of a table on their own lines', () => {
    // Collapsing them rendered a comparison table as one long line of pipes.
    const table = '| A | B |\n| --- | --- |\n| 1 | 2 |'
    expect(splitParagraphs(`Intro.\n\n${table}\n\nAfter.`)).toEqual(['Intro.', table, 'After.'])
  })

  it('keeps the items of a list on their own lines', () => {
    expect(splitParagraphs('- one\n-   two\n- three')).toEqual(['- one\n- two\n- three'])
  })

  it('still joins a wrapped paragraph that merely starts with a dash-free line', () => {
    expect(splitParagraphs('- one item\nthen prose that wraps.')).toEqual(['- one item then prose that wraps.'])
  })
})

describe('the categories an article can be filed under', () => {
  it('offers every blog section, so editing an article never re-files it', () => {
    for (const section of BLOG_SECTIONS) {
      expect(POST_CATEGORIES as readonly string[], section.slug).toContain(section.slug)
    }
  })
})

describe('countWords', () => {
  it('counts words and treats blank text as zero', () => {
    expect(countWords('one two  three')).toBe(3)
    expect(countWords('   ')).toBe(0)
  })
})

describe('readContentForm — a post', () => {
  it('accepts a complete post and derives the slug from the title', () => {
    const result = readContentForm(form(VALID_POST), 'post', KNOWN)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value.slug).toBe('how-lab-reports-are-read')
      expect(result.value.body).toHaveLength(2)
      expect(result.value.category).toBe('quality')
    }
  })

  it('uses an explicit slug when one is given, still normalised', () => {
    const result = readContentForm(form({ ...VALID_POST, slug: 'Reading A COA' }), 'post', KNOWN)
    expect(result.ok && result.value.slug).toBe('reading-a-coa')
  })

  it('refuses a summary outside the answer-first range, naming the target', () => {
    const result = readContentForm(form({ ...VALID_POST, summary: words(10) }), 'post', KNOWN)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toContain('40–60')
  })

  it('refuses a body too thin to publish', () => {
    expect(readContentForm(form({ ...VALID_POST, body: words(12) }), 'post', KNOWN).ok).toBe(false)
  })

  it('requires a known author', () => {
    expect(readContentForm(form({ ...VALID_POST, authorSlug: 'nobody' }), 'post', KNOWN).ok).toBe(false)
  })

  it('requires a category from the fixed set', () => {
    expect(readContentForm(form({ ...VALID_POST, category: '' }), 'post', KNOWN).ok).toBe(false)
    expect(readContentForm(form({ ...VALID_POST, category: 'invented' }), 'post', KNOWN).ok).toBe(false)
  })

  /*
    A recommendation for a product that is not in the catalogue renders as nothing;
    a pillar link to a guide that does not exist renders as a 404. Both refused.
  */
  it('refuses a recommendation for a product that does not exist', () => {
    const result = readContentForm(
      form({ ...VALID_POST, recommendedProductSlugs: ['amanita-capsules', 'ghost-product'] }),
      'post',
      KNOWN,
    )
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toContain('ghost-product')
  })

  it('refuses a pillar link to a guide that does not exist', () => {
    expect(readContentForm(form({ ...VALID_POST, pillarSlug: 'no-such-guide' }), 'post', KNOWN).ok).toBe(false)
  })

  it('accepts a real pillar and de-duplicates recommendations', () => {
    const result = readContentForm(
      form({
        ...VALID_POST,
        pillarSlug: 'amanita-muscaria-explained',
        recommendedProductSlugs: ['mhrb-powder', 'mhrb-powder'],
      }),
      'post',
      KNOWN,
    )
    expect(result.ok && result.value.pillarSlug).toBe('amanita-muscaria-explained')
    expect(result.ok && result.value.recommendedProductSlugs).toEqual(['mhrb-powder'])
  })

  it('enforces the meta title and description limits', () => {
    expect(readContentForm(form({ ...VALID_POST, metaTitle: 'x'.repeat(71) }), 'post', KNOWN).ok).toBe(false)
    expect(readContentForm(form({ ...VALID_POST, metaDesc: 'x'.repeat(166) }), 'post', KNOWN).ok).toBe(false)
  })
})

describe('readContentForm — a guide', () => {
  const VALID_GUIDE = { ...VALID_POST, category: '' }

  it('accepts a guide without a category', () => {
    expect(readContentForm(form(VALID_GUIDE), 'guide', KNOWN).ok).toBe(true)
  })

  it('refuses a cluster link to a post that does not exist', () => {
    expect(readContentForm(form({ ...VALID_GUIDE, clusterSlugs: ['nope'] }), 'guide', KNOWN).ok).toBe(false)
  })

  it('keeps real cluster links', () => {
    const result = readContentForm(form({ ...VALID_GUIDE, clusterSlugs: ['what-is-muscimol'] }), 'guide', KNOWN)
    expect(result.ok && result.value.clusterSlugs).toEqual(['what-is-muscimol'])
  })
})

describe('copyForScan', () => {
  it('includes every piece of copy a reader will see', () => {
    const result = readContentForm(form({ ...VALID_POST, metaTitle: 'Meta T', metaDesc: 'Meta D' }), 'post', KNOWN)
    if (!result.ok) throw new Error(result.error)
    const copy = copyForScan(result.value)
    for (const part of ['How lab reports are read', 'Meta T', 'Meta D', 'word0']) {
      expect(copy).toContain(part)
    }
  })
})

describe('row conversion', () => {
  const row = {
    slug: 'a-post',
    title: 'A post',
    summary: 'Summary.',
    body: 'First.\n\nSecond.',
    category: 'legality',
    recommendedProductSlugs: ['mhrb-powder'],
    pillarSlug: 'amanita-muscaria-explained',
    clusterSlugs: ['what-is-muscimol'],
    isPublished: true,
    publishedAt: new Date('2026-09-01T10:00:00Z'),
    updatedAt: new Date('2026-09-05T10:00:00Z'),
    author: { slug: 'editorial-team' },
  }

  it('converts a post row into the authored shape', () => {
    expect(rowToPost(row)).toEqual({
      slug: 'a-post',
      title: 'A post',
      summary: 'Summary.',
      body: ['First.', 'Second.'],
      category: 'legality',
      authorSlug: 'editorial-team',
      publishedAt: '2026-09-01',
      updatedAt: '2026-09-05',
      pillarSlug: 'amanita-muscaria-explained',
      recommendedProductSlugs: ['mhrb-powder'],
      isPublished: true,
    })
  })

  it('converts a guide row, keeping cluster links', () => {
    const guide = rowToGuide(row)
    expect(guide.clusterSlugs).toEqual(['what-is-muscimol'])
    expect('pillarSlug' in guide).toBe(false)
  })

  it('falls back to the house author and to the update date when unpublished', () => {
    const post = rowToPost({ ...row, author: null, publishedAt: null, pillarSlug: null })
    expect(post.authorSlug).toBe(DEFAULT_AUTHOR_SLUG)
    expect(post.publishedAt).toBe('2026-09-05')
    expect('pillarSlug' in post).toBe(false)
  })

  it('gives a guide with no cluster column an empty list, not undefined', () => {
    expect(rowToGuide({ ...row, clusterSlugs: null }).clusterSlugs).toEqual([])
  })
})
