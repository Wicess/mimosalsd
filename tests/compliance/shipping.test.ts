import { beforeEach, describe, expect, it } from 'vitest'
import {
  FREE_SHIPPING_THRESHOLD_CENTS,
  canShipTo,
  effectiveMinAge,
  evaluateCart,
  freeShippingProgress,
} from '@/lib/compliance/shipping'
import {
  createInMemoryProvider,
  resetStateRuleProvider,
  setStateRuleProvider,
} from '@/lib/compliance/state-rules'
import type { EvaluableItem, UsJurisdictionCode } from '@/lib/compliance/types'

const ALL_JURISDICTIONS = [
  'AL','AK','AZ','AR','CA','CO','CT','DE','DC','FL','GA','HI','ID','IL','IN','IA','KS','KY',
  'LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH',
  'OK','OR','PA','RI','SC','SD','TN','TX','UT','VT','VA','WA','WV','WI','WY',
] as const satisfies readonly UsJurisdictionCode[]

const mhrb = (over: Partial<EvaluableItem> = {}): EvaluableItem => ({
  id: 'mhrb-1',
  name: 'Mimosa Hostilis Root Bark Powder 100g',
  productLine: 'MIMOSA_HOSTILIS',
  fulfillmentChannel: 'PARCEL',
  notForHumanConsumption: true,
  ageRestricted: false,
  unitPriceCents: 4500,
  quantity: 1,
  ...over,
})

const amanita = (over: Partial<EvaluableItem> = {}): EvaluableItem => ({
  id: 'amanita-1',
  name: 'Amanita Muscaria Gummies',
  productLine: 'AMANITA',
  fulfillmentChannel: 'PARCEL',
  notForHumanConsumption: false,
  ageRestricted: true,
  unitPriceCents: 3500,
  quantity: 1,
  ...over,
})

const vape = (over: Partial<EvaluableItem> = {}): EvaluableItem => ({
  id: 'vape-1',
  name: 'Disposable Vape',
  productLine: 'VAPE',
  fulfillmentChannel: 'PACT_CARRIER',
  notForHumanConsumption: false,
  ageRestricted: true,
  unitPriceCents: 2500,
  quantity: 1,
  ...over,
})

beforeEach(() => resetStateRuleProvider())

/**
 * The seed now ships every line to every jurisdiction, on the owner's
 * instruction (see the header of `state-rules.data.ts`).
 *
 * These tests therefore split in two, and the split is deliberate:
 *
 *  · POLICY — what the seed currently says. Rewritten to the new position, so a
 *    restriction reappearing in the data without a decision fails the build.
 *  · ENFORCEMENT — that a BLOCKED or RESTRICTED rule is still obeyed. Those run
 *    against an INJECTED provider rather than the seed, because the machinery
 *    has to keep working whatever the policy happens to be today. Deleting them
 *    alongside the data would leave nothing proving the cart can refuse a sale
 *    at all — and the next person to add a restriction would find out whether it
 *    worked in production.
 */
describe('canShipTo — the current policy', () => {
  it('ships every product line to every jurisdiction', () => {
    for (const line of ['AMANITA', 'MIMOSA_HOSTILIS', 'VAPE'] as const) {
      for (const s of ALL_JURISDICTIONS) {
        expect(canShipTo(s, line).allowed, `${s} / ${line}`).toBe(true)
      }
    }
  })

  it('leaves no rule flagged as restricted or under watch', () => {
    for (const line of ['AMANITA', 'MIMOSA_HOSTILIS', 'VAPE'] as const) {
      for (const s of ALL_JURISDICTIONS) {
        const d = canShipTo(s, line)
        expect(d.status, `${s} / ${line}`).toBe('ALLOWED')
        expect(d.rule.watch, `${s} / ${line}`).toBe(false)
      }
    }
  })

  it('keeps the federal vape requirements, which are not a state position', () => {
    // Adult signature, 21+ and the PACT carrier are about HOW a vape ships, not
    // whether a state permits it — CLAUDE.md rule 2. Opening every state must
    // not quietly clear them.
    for (const s of ALL_JURISDICTIONS) {
      const d = canShipTo(s, 'VAPE')
      expect(d.requiresAdultSignature, `${s}`).toBe(true)
      expect(d.minAge, `${s}`).toBe(21)
    }
  })

  it('carries no statute citation on an unrestricted line', () => {
    // A citation reading "prohibited" attached to a rule that ships is published
    // on the per-state page, where it contradicts itself in front of a reader.
    for (const s of ALL_JURISDICTIONS) {
      expect(canShipTo(s, 'AMANITA').rule.statuteCitation, `${s}`).toBeUndefined()
    }
  })
})

describe('canShipTo — enforcement still works when a rule says no', () => {
  const rule = (over: Partial<import('@/lib/compliance/types').StateRule>) => ({
    stateCode: 'LA' as const,
    productLine: 'AMANITA' as const,
    status: 'ALLOWED' as const,
    minAge: 21,
    requiresAdultSignature: false,
    requiresProductDirectory: false,
    watch: false,
    lastReviewedAt: '2026-08-28',
    reviewedBy: 'Test',
    ...over,
  })

  it('refuses a BLOCKED line and hands back the reason and the citation', () => {
    setStateRuleProvider(
      createInMemoryProvider([
        rule({
          status: 'BLOCKED',
          statuteCitation: 'La. R.S. 40:989.1',
          notes: 'Prohibited in Louisiana.',
        }),
      ]),
    )
    const d = canShipTo('LA', 'AMANITA')
    expect(d.allowed).toBe(false)
    expect(d.status).toBe('BLOCKED')
    expect(d.rule.statuteCitation).toContain('40:989.1')
    expect(d.reason.length).toBeGreaterThan(10)
  })

  it('gates a directory rule on the SKU being listed, and fails closed without the flag', () => {
    setStateRuleProvider(
      createInMemoryProvider([
        rule({
          productLine: 'VAPE',
          status: 'RESTRICTED',
          requiresProductDirectory: true,
          requiresAdultSignature: true,
          notes: 'Directory state.',
        }),
      ]),
    )
    expect(canShipTo('LA', 'VAPE', { onStateProductDirectory: true }).allowed).toBe(true)
    expect(canShipTo('LA', 'VAPE', { onStateProductDirectory: false }).allowed).toBe(false)
    // Absent flag must not be read as permission.
    expect(canShipTo('LA', 'VAPE').allowed).toBe(false)
  })
})

describe('canShipTo — Mimosa Hostilis', () => {
  it('ships to all 51 jurisdictions including Louisiana', () => {
    for (const s of ALL_JURISDICTIONS) {
      expect(canShipTo(s, 'MIMOSA_HOSTILIS').allowed, `${s} should allow MHRB`).toBe(true)
    }
  })
})

describe('canShipTo — vapes', () => {
  it('allows every state with adult signature required', () => {
    for (const s of ALL_JURISDICTIONS) {
      const d = canShipTo(s, 'VAPE')
      expect(d.allowed, `${s}`).toBe(true)
      expect(d.requiresAdultSignature).toBe(true)
      expect(d.minAge).toBe(21)
    }
  })

  it('covers every jurisdiction with a rule — no silent gaps', () => {
    for (const s of ALL_JURISDICTIONS) {
      expect(canShipTo(s, 'VAPE').rule.reviewedBy).not.toBe('SYSTEM_FAIL_CLOSED')
    }
  })
})

describe('evaluateCart', () => {
  it('splits a mixed cart into one shipment per fulfillment channel', () => {
    const r = evaluateCart([mhrb(), amanita(), vape()], 'TX')
    expect(r.canProceed).toBe(true)
    expect(r.shipmentGroups).toHaveLength(2)
    expect(r.shipmentGroups[0]?.channel).toBe('PARCEL')
    expect(r.shipmentGroups[0]?.items).toHaveLength(2)
    expect(r.shipmentGroups[1]?.channel).toBe('PACT_CARRIER')
    expect(r.requiresAdultSignature).toBe(true)
  })

  /*
    Against an INJECTED rule. The owner removed location enforcement from checkout
    (2026-09-19): a line BLOCKED in a state still goes through, and the state pages
    keep saying what the rule says. Nothing is refused and both lines group to ship.
  */
  it('lets every item through checkout even where a line is blocked', () => {
    setStateRuleProvider(
      createInMemoryProvider([
        {
          stateCode: 'LA',
          productLine: 'AMANITA',
          status: 'BLOCKED',
          statuteCitation: 'La. R.S. 40:989.1',
          notes: 'Prohibited in Louisiana.',
          minAge: 21,
          requiresAdultSignature: false,
          requiresProductDirectory: false,
          watch: false,
          lastReviewedAt: '2026-08-28',
          reviewedBy: 'Test',
        },
        {
          // The MHRB line needs its own rule. Without one the resolver fails
          // CLOSED and blocks it too — correct behaviour, but it would hide the
          // thing this test is actually checking: that ONE bad line blocks the
          // cart while the rest still groups for shipment.
          stateCode: 'LA',
          productLine: 'MIMOSA_HOSTILIS',
          status: 'ALLOWED',
          minAge: 18,
          requiresAdultSignature: false,
          requiresProductDirectory: false,
          watch: false,
          lastReviewedAt: '2026-08-28',
          reviewedBy: 'Test',
        },
      ]),
    )
    const r = evaluateCart([mhrb(), amanita()], 'LA')
    expect(r.canProceed).toBe(true)
    expect(r.blocked).toHaveLength(0)
    expect(r.shipmentGroups[0]?.items).toHaveLength(2)
  })

  it('surfaces restricted-but-shippable items separately from blocked ones', () => {
    setStateRuleProvider(
      createInMemoryProvider([
        {
          stateCode: 'FL',
          productLine: 'AMANITA',
          status: 'RESTRICTED',
          notes: 'Conditions apply.',
          minAge: 21,
          requiresAdultSignature: false,
          requiresProductDirectory: false,
          watch: true,
          lastReviewedAt: '2026-08-28',
          reviewedBy: 'Test',
        },
      ]),
    )
    const r = evaluateCart([amanita()], 'FL')
    expect(r.canProceed).toBe(true)
    expect(r.blocked).toHaveLength(0)
    expect(r.restricted).toHaveLength(1)
  })

  it('proceeds everywhere under the current seed', () => {
    for (const s of ['LA', 'CA', 'FL', 'NY'] as const) {
      expect(evaluateCart([mhrb(), amanita()], s).canProceed, s).toBe(true)
    }
  })

  it('requires the not-for-human-consumption attestation when MHRB is present', () => {
    expect(evaluateCart([mhrb()], 'TX').requiredAttestations).toContain('NOT_FOR_HUMAN_CONSUMPTION')
    expect(evaluateCart([amanita()], 'TX').requiredAttestations).not.toContain('NOT_FOR_HUMAN_CONSUMPTION')
  })

  it('requires age verification only when an age-restricted item is present', () => {
    expect(evaluateCart([mhrb()], 'TX').requiresAgeVerification).toBe(false)
    expect(evaluateCart([amanita()], 'TX').requiresAgeVerification).toBe(true)
  })

  it('always requires the payment-method acknowledgement', () => {
    expect(evaluateCart([mhrb()], 'TX').requiredAttestations).toContain('PAYMENT_METHOD_ACKNOWLEDGED')
  })

  it('cannot proceed with an empty cart', () => {
    expect(evaluateCart([], 'TX').canProceed).toBe(false)
  })

  it('does not require adult signature for an MHRB-only cart', () => {
    expect(evaluateCart([mhrb()], 'TX').requiresAdultSignature).toBe(false)
  })
})

describe('freeShippingProgress', () => {
  it('qualifies on parcel subtotal at the threshold', () => {
    const r = evaluateCart([mhrb({ unitPriceCents: FREE_SHIPPING_THRESHOLD_CENTS })], 'TX')
    const p = freeShippingProgress(r.shipmentGroups)
    expect(p.qualified).toBe(true)
    expect(p.remainingCents).toBe(0)
    expect(p.hasExcludedItems).toBe(false)
  })

  it('excludes vape subtotal — the promise cannot be honoured on a PACT carrier', () => {
    const r = evaluateCart([mhrb({ unitPriceCents: 6000 }), vape({ unitPriceCents: 9000 })], 'TX')
    const p = freeShippingProgress(r.shipmentGroups)
    expect(p.eligibleSubtotalCents).toBe(6000) // not 15000
    expect(p.qualified).toBe(false)
    expect(p.remainingCents).toBe(4000)
    expect(p.hasExcludedItems).toBe(true)
  })

  it('reports progress for the bar', () => {
    const r = evaluateCart([mhrb({ unitPriceCents: 5000 })], 'TX')
    expect(freeShippingProgress(r.shipmentGroups).progress).toBeCloseTo(0.5)
  })

  it('multiplies by quantity using integer cents', () => {
    const r = evaluateCart([mhrb({ unitPriceCents: 4500, quantity: 3 })], 'TX')
    const p = freeShippingProgress(r.shipmentGroups)
    expect(p.eligibleSubtotalCents).toBe(13500)
    expect(p.qualified).toBe(true)
  })

  it('never qualifies a vape-only cart', () => {
    const r = evaluateCart([vape({ unitPriceCents: 50000 })], 'TX')
    const p = freeShippingProgress(r.shipmentGroups)
    expect(p.eligibleSubtotalCents).toBe(0)
    expect(p.qualified).toBe(false)
    expect(p.hasExcludedItems).toBe(true)
  })
})

/**
 * CLAUDE.md: "Company policy. Individual state rules may raise this, never lower it."
 * That rule lived only in a comment. One rule row carries minAge 18 (Mimosa Hostilis
 * is not federally age-restricted), and the legality pages rendered it raw — so
 * /legality/texas published "Minimum age: 18" for a product the 21+ age gate and the
 * checkout attestation both refuse to sell. A claim the business does not honour, on
 * the pages most likely to be cited.
 */
describe('the company age floor is never lowered by a state rule', () => {
  it('raises a statutory minimum below company policy up to it', () => {
    expect(effectiveMinAge(18)).toBe(21)
    expect(effectiveMinAge(0)).toBe(21)
  })

  it('leaves a stricter state minimum alone', () => {
    expect(effectiveMinAge(25)).toBe(25)
  })

  it('is a no-op when the rule already matches policy', () => {
    expect(effectiveMinAge(21)).toBe(21)
  })

  it('reports the raised age on a shipping decision, not the raw statute', () => {
    const decision = canShipTo('TX', 'MIMOSA_HOSTILIS')
    expect(decision.minAge).toBeGreaterThanOrEqual(21)
  })
})
