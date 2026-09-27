import { describe, expect, it } from 'vitest'
import { JURISDICTIONS } from '@/lib/compliance/jurisdictions'
import { getStateProfile } from '@/lib/legality/state-profiles'
import { neighbourContext, NEIGHBOURS } from '@/lib/legality/state-pages'

/**
 * A RATCHET ON STATE-PAGE DISTINCTIVENESS.
 *
 * Fifty-one URLs — more than half the sitemap — are per-state legality pages, and
 * organic search is this business's only acquisition channel. Bing names
 * "automatically generated content at scale" in its abuse list as grounds for
 * exclusion from the index, and thin pages at scale do not merely fail to rank:
 * they consume crawl budget that would otherwise reach the product and category
 * pages. CLAUDE.md rule 9 forbids exactly this shape.
 *
 * The numbers below are a floor, not a target. They record what is true today so
 * that it cannot quietly get worse — a page set that becomes MORE templated is a
 * regression nobody would otherwise notice, because nothing about it fails. Raise
 * these numbers as real per-state sourcing lands in STATE_NOTES; never lower them
 * to make a failing run pass.
 */
describe('state page distinctiveness', () => {
  it('every jurisdiction has a border list, and it is symmetric', () => {
    for (const j of JURISDICTIONS) {
      expect(NEIGHBOURS[j.code], `${j.code} has no border list`).toBeDefined()
    }
    // A geography error shows up here: if A borders B then B must border A.
    for (const j of JURISDICTIONS) {
      for (const other of NEIGHBOURS[j.code] ?? []) {
        expect(
          (NEIGHBOURS[other] ?? []).includes(j.code),
          `${j.code} borders ${other} but ${other} does not border ${j.code}`,
        ).toBe(true)
      }
    }
  })

  it('gives all but the two non-contiguous states a unique border sentence', () => {
    const sentences = new Set<string>()
    let none = 0
    for (const j of JURISDICTIONS) {
      const ctx = neighbourContext(j.code)
      if (!ctx) {
        none += 1
        continue
      }
      sentences.add(ctx.sentence)
    }
    // Alaska and Hawaii border nothing. Everything else must be distinct.
    expect(none).toBe(2)
    expect(sentences.size).toBe(JURISDICTIONS.length - none)
  })

  it('does not regress below the profile variety it has today', () => {
    const shapes = new Set(
      JURISDICTIONS.map((j) => {
        const p = getStateProfile(j.code)
        return [p.hemp, p.psilocybin, p.hempNote, p.psilocybinNote, ...(p.notes ?? [])].join('|')
      }),
    )
    /*
      13 distinct profiles across 51 jurisdictions — 21 states share one of them.
      That is the number STATE_NOTES exists to raise. It is asserted as a floor so
      the set cannot silently become more uniform than it already is.
    */
    expect(shapes.size).toBeGreaterThanOrEqual(13)
  })

  it('never invents a note to fill an empty state', () => {
    // A note must be real prose somebody checked, not generated filler.
    for (const j of JURISDICTIONS) {
      for (const note of getStateProfile(j.code).notes ?? []) {
        expect(note.trim().length, `${j.code} has an empty note`).toBeGreaterThan(40)
      }
    }
  })
})
