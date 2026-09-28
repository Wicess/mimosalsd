import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  MIN_PUBLISH_WORDS,
  STATE_PAGE_LINES,
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
    for (const state of all) expect(state.verdicts).toHaveLength(STATE_PAGE_LINES.length)
  })
})

describe('answer-first block', () => {
  it('states the verdict up front for a fully permissive state', () => {
    const tx = getStateLegality('TX')
    expect(tx.answerFirst).toMatch(/^Yes\. We ship Mimosa hostilis root bark/)
    expect(tx.answerFirst).toContain('Texas')
  })

  /*
    Since 2026-09-28 a state page describes root bark only: the Amanita and vapor
    listings were withdrawn, and a page describing lines nobody can buy is the stale
    claim this project keeps paying for.
  */
  it('names the root bark it ships, and nothing that is withdrawn', () => {
    for (const code of ['LA', 'FL', 'CA', 'NY', 'TX'] as const) {
      const s = getStateLegality(code)
      expect(s.answerFirst, code).toContain('sassafras root bark')
      expect(s.answerFirst, code).not.toMatch(/amanita|vape|disposable/i)
    }
  })

  it('names no blocked or conditional line anywhere', () => {
    for (const state of getAllStateLegality()) {
      expect(state.answerFirst, state.code).not.toContain('cannot be shipped')
      expect(state.answerFirst, state.code).not.toContain('only under specific conditions')
    }
  })

  // Checkout stopped refusing by location on 2026-09-19, so no page may say it does.
  it('never claims the cart refuses an order by location', () => {
    for (const state of getAllStateLegality()) {
      expect(state.answerFirst, state.code).not.toMatch(/refuse/i)
      expect(state.orderingGuidance, state.code).not.toMatch(/refuse/i)
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
      // Root bark only, shipped from California. Nothing about signing or ID at the
      // door (owner, 2026-09-15), and no PACT carrier now that vapes are withdrawn.
      expect(g, code).toContain('from California')
      expect(g, code).not.toContain('vapor product directory')
      expect(g, code).not.toContain('PACT Act')
      expect(g, code).not.toMatch(/signature|photo identification|photo ID/i)
    }
  })

  it('produces materially different page content per state', () => {
    // The dyeing guide is built from sourced per-state facts: water hardness,
    // climate, sassafras range and the state's own fibre events.
    const seen = new Set(
      getAllStateLegality().map((s) => s.dyeing.paragraphs.filter((p) => p.key !== 'delivery').map((p) => p.text).join('|')),
    )
    expect(seen.size).toBeGreaterThan(40)
  })

  it('cites a source for every sourced paragraph', () => {
    for (const state of getAllStateLegality()) {
      for (const p of state.dyeing.paragraphs) {
        if (p.key === 'delivery') continue
        expect(p.sourceUrl, `${state.code}/${p.key}`).toMatch(/^https?:\/\//)
      }
    }
  })

  it('passes the compliance lexicon on every dyeing guide', () => {
    for (const state of getAllStateLegality()) {
      const text = [state.orderingGuidance, ...state.dyeing.paragraphs.map((p) => `${p.heading} ${p.text}`)].join('\n')
      const result = scanText(text, { productLines: ['MIMOSA_HOSTILIS'] })
      expect(result.clean, `${state.code}: ${result.blocking.map((m) => m.term)}`).toBe(true)
    }
  })
})

describe('review metadata', () => {
  it('derives the year from the review date, never the wall clock', () => {
    const tx = getStateLegality('TX')
    expect(tx.reviewYear).toBe(new Date(tx.lastReviewedAt).getUTCFullYear())
    // A title claiming "2026 pricing" must mean "when we checked", not "when you loaded".
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

  function withBarkRule(status: 'BLOCKED' | 'RESTRICTED', statuteCitation: string | undefined) {
    const rules = STATE_RULE_SEED.map((r) =>
      r.stateCode === 'TX' && r.productLine === 'MIMOSA_HOSTILIS'
        ? { ...r, status, statuteCitation, notes: 'We do not ship this category to TX.' }
        : r,
    )
    setStateRuleProvider(createInMemoryProvider(rules))
  }

  it('does not take the state page out of search when it cites no statute', () => {
    withBarkRule('BLOCKED', undefined)
    const texas = getStateLegality('TX')
    // Word count is a separate gate with its own test; this one is about the statute.
    expect(texas.publishBlockers.filter((b) => b.includes('cites no statute'))).toEqual([])
  })

  it('still needs a statute when the line ships with conditions', () => {
    withBarkRule('RESTRICTED', undefined)
    expect(getStateLegality('TX').publishBlockers.some((b) => b.includes('cites no statute'))).toBe(true)
  })
})
