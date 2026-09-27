import { describe, expect, it } from 'vitest'
import {
  applyCategoryOverride,
  applyCategoryOverrides,
  type CategoryOverrideRecord,
} from '@/lib/catalog/category-overrides'
import { CATEGORIES } from '@/lib/catalog/catalog.data'
import type { Category } from '@/lib/catalog/types'

const EMPTY: Omit<CategoryOverrideRecord, 'slug'> = {
  intro: null,
  detail: null,
  metaTitle: null,
  metaDesc: null,
  aboutHeading: null,
  aboutLede: null,
}

const withAbout = CATEGORIES.find((c) => c.about)!
const withoutAbout = CATEGORIES.find((c) => !c.about)!

function override(
  slug: string,
  fields: Partial<Omit<CategoryOverrideRecord, 'slug'>>,
): CategoryOverrideRecord {
  return { slug, ...EMPTY, ...fields }
}

describe('applyCategoryOverride', () => {
  it('returns the authored category untouched when there is no override', () => {
    expect(applyCategoryOverride(withAbout, undefined)).toBe(withAbout)
  })

  it('replaces only the fields that were overridden', () => {
    const result = applyCategoryOverride(
      withAbout,
      override(withAbout.slug, { intro: 'A new intro.' }),
    )
    expect(result.intro).toBe('A new intro.')
    // Everything else inherits.
    expect(result.metaTitle).toBe(withAbout.metaTitle)
    expect(result.metaDesc).toBe(withAbout.metaDesc)
    expect(result.about?.lede).toBe(withAbout.about?.lede)
  })

  /*
    NULL MEANS INHERIT — the whole contract. And an operator clearing a box sends a
    blank string, not a null, so blank has to mean inherit too. If it did not, an
    empty submission would blank a page that ranks.
  */
  it('treats a blank or whitespace-only override as inherit', () => {
    const result = applyCategoryOverride(
      withAbout,
      override(withAbout.slug, { intro: '   ', metaTitle: '' }),
    )
    expect(result.intro).toBe(withAbout.intro)
    expect(result.metaTitle).toBe(withAbout.metaTitle)
  })

  it('trims an override rather than storing its surrounding whitespace', () => {
    const result = applyCategoryOverride(
      withAbout,
      override(withAbout.slug, { intro: '  Trimmed.  ' }),
    )
    expect(result.intro).toBe('Trimmed.')
  })

  it('edits the About heading and lede without touching its blocks or facts', () => {
    const result = applyCategoryOverride(
      withAbout,
      override(withAbout.slug, { aboutHeading: 'New heading', aboutLede: 'New lede.' }),
    )
    expect(result.about?.heading).toBe('New heading')
    expect(result.about?.lede).toBe('New lede.')
    // The structured parts are authored-only and must survive the merge intact.
    expect(result.about?.blocks).toEqual(withAbout.about?.blocks)
    expect(result.about?.facts).toEqual(withAbout.about?.facts)
  })

  /*
    An About override on a category with no authored About block has nowhere to
    go. Half-building one would render a heading over nothing, so it is ignored —
    and the admin action refuses the input rather than accepting it silently.
  */
  it('never invents an About block where none was authored', () => {
    const result = applyCategoryOverride(
      withoutAbout,
      override(withoutAbout.slug, { aboutLede: 'Orphaned lede.' }),
    )
    expect(result.about).toBeUndefined()
  })

  it('overrides the fallback detail paragraph on a category without an About block', () => {
    const result = applyCategoryOverride(
      withoutAbout,
      override(withoutAbout.slug, { detail: 'Rewritten detail.' }),
    )
    expect(result.detail).toBe('Rewritten detail.')
  })

  /*
    The overlay contract: an override CHANGES a category, it can never add or
    remove one. `src/proxy.ts` depends on the authored slug set to return real 404s.
  */
  it('never changes the slug, name, product line or sort order', () => {
    const result = applyCategoryOverride(
      withAbout,
      override(withAbout.slug, { intro: 'x', metaTitle: 'y', aboutLede: 'z' }),
    )
    expect(result.slug).toBe(withAbout.slug)
    expect(result.name).toBe(withAbout.name)
    expect(result.productLine).toBe(withAbout.productLine)
    expect(result.sortOrder).toBe(withAbout.sortOrder)
  })

  it('does not mutate the authored category', () => {
    const snapshot = structuredClone(withAbout)
    applyCategoryOverride(withAbout, override(withAbout.slug, { intro: 'Changed.' }))
    expect(withAbout).toEqual(snapshot)
  })
})

describe('applyCategoryOverrides', () => {
  it('returns the same array when there are no overrides at all', () => {
    expect(applyCategoryOverrides(CATEGORIES, new Map())).toBe(CATEGORIES)
  })

  it('applies each override to its own category and leaves the rest alone', () => {
    const overrides = new Map([
      [withAbout.slug, override(withAbout.slug, { intro: 'Only this one.' })],
    ])
    const result = applyCategoryOverrides(CATEGORIES, overrides)

    const edited = result.find((c) => c.slug === withAbout.slug)!
    expect(edited.intro).toBe('Only this one.')

    for (const category of result.filter((c) => c.slug !== withAbout.slug)) {
      const authored = CATEGORIES.find((c) => c.slug === category.slug) as Category
      expect(category.intro).toBe(authored.intro)
    }
  })

  it('keeps the authored order and the authored count', () => {
    const overrides = new Map(
      CATEGORIES.map((c) => [c.slug, override(c.slug, { intro: `${c.slug}!` })] as const),
    )
    const result = applyCategoryOverrides(CATEGORIES, overrides)
    expect(result.map((c) => c.slug)).toEqual(CATEGORIES.map((c) => c.slug))
  })

  it('ignores an override for a slug that does not exist in the catalogue', () => {
    // A stale row for a category that was since removed from the authored file must
    // not resurrect it — the slug set is the authored file's decision alone.
    const overrides = new Map([['no-such-category', override('no-such-category', { intro: 'x' })]])
    const result = applyCategoryOverrides(CATEGORIES, overrides)
    expect(result).toHaveLength(CATEGORIES.length)
    expect(result.some((c) => c.slug === 'no-such-category')).toBe(false)
  })
})
