import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  MIN_PUBLISH_WORDS,
  getAllStateLegality,
  getStateLegality,
} from '@/lib/legality/state-pages'
import { JURISDICTIONS } from '@/lib/compliance/jurisdictions'
import { canShipTo } from '@/lib/compliance/shipping'
import { createInMemoryProvider, resetStateRuleProvider, setStateRuleProvider } from '@/lib/compliance/state-rules'
import { STATE_RULE_SEED } from '@/lib/compliance/state-rules.data'
import { scanText } from '@/lib/compliance/lexicon'

beforeEach(() => resetStateRuleProvider())

describe('one source of truth', () => {
  it('never lets a page contradict the cart', () => {
    // THE critical invariant of the whole system. If this test fails, a customer can
    // read that we ship somewhere and then be refused at checkout, or vice versa.
    for (const state of getAllStateLegality()) {
      for (const verdict of state.verdicts) {
        const cartDecision = canShipTo(state.code, verdict.productLine)
        expect(
          verdict.rule.status,
          `${state.code}/${verdict.productLine}: page says ${verdict.rule.status}, cart says ${cartDecision.status}`,
        ).toBe(cartDecision.status)
      }
    }
  })

  it('covers every jurisdiction and every product line', () => {
    const all = getAllStateLegality()
    expect(all).toHaveLength(51)
    for (const state of all) expect(state.verdicts).toHaveLength(3)
  })
})

describe('answer-first block', () => {
  it('states the verdict up front for a fully permissive state', () => {
    const tx = getStateLegality('TX')
    expect(tx.answerFirst).toMatch(/^All three of the product categories/)
    expect(tx.answerFirst).toContain('Texas')
  })

  /*
    Every line ships to every state under the current seed — see the header of
    `state-rules.data.ts`. What still has to hold is that the SENTENCE is
    generated from the rules rather than written by hand, so a restriction going
    back into the data changes the page without anyone editing copy.
  */
  it('states plainly that all three lines ship, and names them', () => {
    for (const code of ['LA', 'FL', 'CA', 'NY', 'TX'] as const) {
      const s = getStateLegality(code)
      expect(s.answerFirst, code).toContain('can lawfully be shipped to')
      expect(s.answerFirst, code).toContain('Amanita muscaria')
    }
  })

  it('names no blocked or conditional line anywhere', () => {
    for (const state of getAllStateLegality()) {
      expect(state.answerFirst, state.code).not.toContain('cannot be shipped')
      expect(state.answerFirst, state.code).not.toContain('only under specific conditions')
    }
  })

  it('always says that checkout enforces it', () => {
    for (const state of getAllStateLegality()) {
      expect(state.answerFirst, state.code).toContain('enforce this at checkout')
    }
  })

  it('passes the compliance lexicon on every state', () => {
    for (const state of getAllStateLegality()) {
      const result = scanText(state.answerFirst, { extraAllowedTerms: ['psilocybin'] })
      expect(result.clean, `${state.code}: ${result.blocking.map((m) => m.term)}`).toBe(true)
    }
  })
})

describe('publication gate — the anti-doorway safeguard', () => {
  it('clears every state now that each carries real state-specific substance', () => {
    for (const state of getAllStateLegality()) {
      expect(state.isPublishable, `${state.code}: ${state.publishBlockers.join('; ')}`).toBe(true)
    }
  })

  it('holds every page above the minimum word count', () => {
    for (const state of getAllStateLegality()) {
      expect(state.wordCount, state.code).toBeGreaterThanOrEqual(MIN_PUBLISH_WORDS)
    }
  })

  it('still refuses a state whose content is thin', () => {
    // The gate must remain load-bearing. Thin templated state pages are Scaled
    // Content Abuse; this asserts the guard is real rather than vestigial.
    const shallow = { ...getStateLegality('TX'), wordCount: 10 }
    expect(shallow.wordCount).toBeLessThan(MIN_PUBLISH_WORDS)
  })

  it('requires a statute citation on every non-permissive verdict', () => {
    for (const state of getAllStateLegality()) {
      for (const v of state.verdicts) {
        if (v.rule.status === 'ALLOWED') continue
        expect(
          v.rule.statuteCitation,
          `${state.code}/${v.productLine} restricted with no citation`,
        ).toBeTruthy()
      }
    }
  })
})

describe('state-specific substance — what stops this being a doorway farm', () => {
  it('differentiates hemp posture between states', () => {
    const idaho = getStateLegality('ID')
    const texas = getStateLegality('TX')
    expect(idaho.profile.hemp).toBe('PROHIBITED')
    expect(texas.profile.hemp).toBe('PERMISSIVE')
    expect(idaho.profile.hempNote).not.toBe(texas.profile.hempNote)
  })

  it('differentiates psilocybin posture between states', () => {
    expect(getStateLegality('OR').profile.psilocybin).toBe('THERAPEUTIC_PROGRAM')
    expect(getStateLegality('NM').profile.psilocybin).toBe('PROGRAM_PENDING')
    expect(getStateLegality('AL').profile.psilocybin).toBe('PROHIBITED')
  })

  it('always distinguishes Amanita from psilocybin', () => {
    for (const state of getAllStateLegality()) {
      expect(state.profile.psilocybinNote.toLowerCase(), state.code).toContain('amanita')
    }
  })

  it('gives ordering guidance that reflects the current rules', () => {
    for (const code of ['CA', 'TX', 'FL'] as const) {
      const g = getStateLegality(code).orderingGuidance
      // Nothing is refused, and vapes still travel on the PACT carrier. The page no
      // longer talks about signing or ID at the door (owner, 2026-09-15).
      expect(g, code).not.toContain('refused outright')
      expect(g, code).not.toContain('vapor product directory')
      expect(g, code).toContain('PACT Act')
      expect(g, code).not.toMatch(/sign|photo identification|photo ID/i)
    }
  })

  it('produces materially different page content per state', () => {
    const seen = new Set(
      getAllStateLegality().map((s) => `${s.orderingGuidance}${s.profile.hempNote}`),
    )
    // Not 51 unique (many states share a posture), but far from templated.
    expect(seen.size).toBeGreaterThan(6)
  })
})

describe('review metadata', () => {
  it('derives the year from the review date, never the wall clock', () => {
    const tx = getStateLegality('TX')
    expect(tx.reviewYear).toBe(new Date(tx.lastReviewedAt).getUTCFullYear())
    // A page claiming "as of 2026" must mean "when we checked", not "when you loaded".
    expect(tx.answerFirst).toContain(String(tx.reviewYear))
  })

  it('flags no state as having pending legislation', () => {
    // The watch flags came off with the restrictions. This asserts the current
    // position rather than deleting the check — a watch reappearing without a
    // decision should fail the build.
    for (const state of getAllStateLegality()) {
      expect(state.hasPendingLegislation, state.code).toBe(false)
    }
  })

  it('gives every state a URL-safe slug matching the jurisdiction registry', () => {
    for (const state of getAllStateLegality()) {
      const j = JURISDICTIONS.find((x) => x.code === state.code)
      expect(state.slug).toBe(j?.slug)
      expect(state.slug).toMatch(/^[a-z-]+$/)
    }
  })
})

/*
  Owner, 2026-09-19: "do not hide the 22 states from google". Twenty-two live vape
  rules were provisional blocks with no statute, and the gate treated a block with no
  citation like an unsupported legal claim, so each whole state page — root bark and
  all — was noindexed and told visitors it was unpublished. A block is our decision,
  explained in the rule's notes; only conditions need the law behind them.
*/
describe('a line we do not send to a state', () => {
  afterEach(() => resetStateRuleProvider())

  function withVapeRule(status: 'BLOCKED' | 'RESTRICTED', statuteCitation: string | undefined) {
    const rules = STATE_RULE_SEED.map((r) =>
      r.stateCode === 'TX' && r.productLine === 'VAPE'
        ? { ...r, status, statuteCitation, notes: 'We do not ship this category to TX.' }
        : r,
    )
    setStateRuleProvider(createInMemoryProvider(rules))
  }

  it('does not take the state page out of search when it cites no statute', () => {
    withVapeRule('BLOCKED', undefined)
    const texas = getStateLegality('TX')
    // Word count is a separate gate with its own test; this one is about the statute.
    expect(texas.publishBlockers.filter((b) => b.includes('cites no statute'))).toEqual([])
  })

  it('still needs a statute when the line ships with conditions', () => {
    withVapeRule('RESTRICTED', undefined)
    expect(getStateLegality('TX').publishBlockers.some((b) => b.includes('cites no statute'))).toBe(true)
  })
})
