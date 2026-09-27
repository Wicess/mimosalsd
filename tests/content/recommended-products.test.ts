import { describe, expect, it } from 'vitest'
import { GUIDES, POSTS } from '@/lib/content/content.data'

/*
  ── WHY THIS TEST EXISTS ────────────────────────────────────────────────────

  Every authored post and guide recommended the sample products — mhrb-powder,
  mhrb-shredded, amanita-gummies-mixed-berry, disposable-vape-classic and the rest —
  which were deleted from catalog.data.ts on 2026-09-15.

  `RecommendedProducts` filters a slug it cannot resolve and returns null when none
  survive. So nothing broke, nothing 404'd and nothing logged: the strip simply
  stopped rendering, and the blog-to-revenue loop CLAUDE.md rule 13 describes was
  dead on all ten live pieces for two days before anyone looked.

  A silent failure needs a loud test. This one pins the recommendations to slugs that
  exist today. When the catalogue changes, this list changes with it — which is the
  point: the edit that removes a product also fails this test, instead of quietly
  emptying a strip on every article that recommended it.
*/

/** Products that exist right now. Update alongside the catalogue, never around it. */
const REAL_PRODUCT_SLUGS = new Set([
  'powdered-mimosa-hostils-root',
  'mimosa-roots-stripped',
  'mimosa-treee-bark',
  'sassafras-root-bark',
])

const authored = [
  ...POSTS.map((p) => ({ kind: 'post', slug: p.slug, recommends: p.recommendedProductSlugs })),
  ...GUIDES.map((g) => ({ kind: 'guide', slug: g.slug, recommends: g.recommendedProductSlugs })),
]

describe('authored content recommends products that exist', () => {
  it('has content to check', () => {
    expect(authored.length).toBeGreaterThan(0)
  })

  it.each(authored)('$kind $slug recommends only real products', ({ slug, recommends }) => {
    for (const recommended of recommends) {
      expect(REAL_PRODUCT_SLUGS.has(recommended), `${slug} recommends "${recommended}", which no longer exists`).toBe(true)
    }
  })

  it('never recommends a deleted sample product', () => {
    // The exact slugs that were live and resolving to nothing.
    const deleted = ['mhrb-powder', 'mhrb-shredded', 'amanita-capsules', 'amanita-gummies-citrus', 'amanita-gummies-mixed-berry', 'disposable-vape-classic', 'disposable-vape-menthol']
    const offenders = authored.flatMap((a) => a.recommends.filter((s) => deleted.includes(s)).map((s) => `${a.slug} -> ${s}`))
    expect(offenders).toEqual([])
  })

  it('never repeats a recommendation within one piece', () => {
    for (const a of authored) {
      expect(new Set(a.recommends).size, a.slug).toBe(a.recommends.length)
    }
  })

  /*
    The amanita and vapor pieces recommend nothing on purpose: those categories are on
    hold pending the laboratory figures (the owner's 20-30% THCa is 58-88x the federal
    hemp limit), and an irrelevant recommendation is worse than an empty block. This
    asserts the hold is deliberate rather than another silent gap.
  */
  it('leaves the held categories empty rather than mis-pointed', () => {
    const held = ['amanita-muscaria-explained', 'what-is-muscimol', 'is-amanita-muscaria-legal-in-the-united-states', 'what-the-pact-act-means-for-buyers']
    for (const slug of held) {
      const piece = authored.find((a) => a.slug === slug)
      if (!piece) continue
      expect(piece.recommends, slug).toEqual([])
    }
  })
})
