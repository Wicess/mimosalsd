import { beforeEach, describe, expect, it } from 'vitest'
import {
  getJurisdiction,
  getJurisdictionBySlug,
  jurisdictionName,
  JURISDICTIONS,
} from '@/lib/compliance/jurisdictions'
import {
  createInMemoryProvider,
  getAllStateRules,
  getRulesForLine,
  getRulesForState,
  getStateRule,
  resetStateRuleProvider,
  setStateRuleProvider,
} from '@/lib/compliance/state-rules'
import { STATE_RULE_SEED } from '@/lib/compliance/state-rules.data'
import { PRODUCT_LINES } from '@/lib/compliance/types'
import {
  disclaimersFor,
  FDA_DISCLAIMER,
  NOT_FOR_HUMAN_CONSUMPTION,
  INTENDED_USE_ATTESTATION,
  AGE_ATTESTATION,
  PAYMENT_ATTESTATION,
  PAYMENT_SECURITY_STATEMENT,
} from '@/lib/compliance/disclaimers'
import { createAgeVerifier, StubAgeVerifier } from '@/lib/compliance/age'
import { formatScanResult, scanText } from '@/lib/compliance/lexicon'

beforeEach(() => resetStateRuleProvider())

describe('jurisdiction registry', () => {
  it('covers 50 states plus DC', () => {
    expect(JURISDICTIONS).toHaveLength(51)
    expect(JURISDICTIONS.filter((j) => j.isState)).toHaveLength(50)
  })

  it('has unique codes and unique slugs', () => {
    expect(new Set(JURISDICTIONS.map((j) => j.code)).size).toBe(51)
    expect(new Set(JURISDICTIONS.map((j) => j.slug)).size).toBe(51)
  })

  it('looks up by code, case-insensitively', () => {
    expect(getJurisdiction('la')?.name).toBe('Louisiana')
    expect(getJurisdiction('LA')?.name).toBe('Louisiana')
  })

  it('looks up by URL slug, case-insensitively', () => {
    expect(getJurisdictionBySlug('new-york')?.code).toBe('NY')
    expect(getJurisdictionBySlug('New-York')?.code).toBe('NY')
  })

  it('returns undefined for an unknown jurisdiction rather than throwing', () => {
    expect(getJurisdiction('ZZ')).toBeUndefined()
    expect(getJurisdictionBySlug('atlantis')).toBeUndefined()
  })

  it('resolves display names, falling back to the code', () => {
    expect(jurisdictionName('TX')).toBe('Texas')
    // @ts-expect-error deliberately invalid code — must not throw
    expect(jurisdictionName('ZZ')).toBe('ZZ')
  })

  it('slugs are URL-safe', () => {
    for (const j of JURISDICTIONS) {
      expect(j.slug).toMatch(/^[a-z-]+$/)
    }
  })
})

describe('state rule provider', () => {
  it('seeds every jurisdiction x product line combination', () => {
    expect(STATE_RULE_SEED).toHaveLength(51 * 3)
    expect(getAllStateRules()).toHaveLength(153)
  })

  it('returns all three lines for a state', () => {
    const rules = getRulesForState('LA')
    expect(rules).toHaveLength(3)
    expect(rules.map((r) => r.productLine).sort()).toEqual(
      [...PRODUCT_LINES].sort(),
    )
  })

  it('returns all jurisdictions for a line', () => {
    expect(getRulesForLine('AMANITA')).toHaveLength(51)
  })

  it('requires a citation and notes on every non-ALLOWED rule', () => {
    for (const rule of STATE_RULE_SEED) {
      if (rule.status === 'ALLOWED') continue
      expect(rule.statuteCitation, `${rule.stateCode}/${rule.productLine}`).toBeTruthy()
      expect(rule.notes, `${rule.stateCode}/${rule.productLine}`).toBeTruthy()
    }
  })

  it('requires an explanatory note on every rule, allowed or not', () => {
    for (const rule of STATE_RULE_SEED) {
      expect(rule.notes?.length ?? 0).toBeGreaterThan(20)
    }
  })

  it('sets minimum age 21 on every age-restricted line', () => {
    for (const rule of STATE_RULE_SEED) {
      if (rule.productLine === 'MIMOSA_HOSTILIS') continue
      expect(rule.minAge).toBe(21)
    }
  })

  it('requires adult signature on every vape rule', () => {
    for (const rule of getRulesForLine('VAPE')) {
      expect(rule.requiresAdultSignature).toBe(true)
    }
  })

  it('can be swapped for a fixture and reset', () => {
    setStateRuleProvider(createInMemoryProvider([]))
    expect(getAllStateRules()).toHaveLength(0)
    expect(getStateRule('TX', 'AMANITA')).toBeUndefined()
    resetStateRuleProvider()
    expect(getAllStateRules()).toHaveLength(153)
  })
})

describe('disclaimers', () => {
  it('always includes the FDA statement', () => {
    expect(disclaimersFor(['AMANITA'])).toContain(FDA_DISCLAIMER)
    expect(disclaimersFor([])).toContain(FDA_DISCLAIMER)
  })

  it('leads with not-for-human-consumption when MHRB is present', () => {
    expect(disclaimersFor(['MIMOSA_HOSTILIS'])[0]).toBe(NOT_FOR_HUMAN_CONSUMPTION)
  })

  it('adds no delivery-signature notice for vapes (owner, 2026-09-15)', () => {
    expect(disclaimersFor(['VAPE'])).toEqual([FDA_DISCLAIMER])
    expect(disclaimersFor(['VAPE']).join(' ')).not.toMatch(/signature|photo id/i)
  })

  it('handles a mixed cart', () => {
    const d = disclaimersFor(['MIMOSA_HOSTILIS', 'VAPE'])
    expect(d[0]).toBe(NOT_FOR_HUMAN_CONSUMPTION)
    expect(d).toContain(FDA_DISCLAIMER)
    expect(d).toHaveLength(2)
  })

  it('every disclaimer passes its own lexicon', () => {
    for (const text of [
      FDA_DISCLAIMER,
      NOT_FOR_HUMAN_CONSUMPTION,
      INTENDED_USE_ATTESTATION,
      AGE_ATTESTATION,
      PAYMENT_ATTESTATION,
      PAYMENT_SECURITY_STATEMENT,
    ]) {
      expect(scanText(text, { productLines: ['MIMOSA_HOSTILIS'] }).clean, text).toBe(true)
    }
  })
})

describe('age verifier factory', () => {
  it('returns the stub when configured for it', () => {
    expect(createAgeVerifier('stub')).toBeInstanceOf(StubAgeVerifier)
  })

  it('returns the stub when unset', () => {
    expect(createAgeVerifier(undefined)).toBeInstanceOf(StubAgeVerifier)
  })

  it('throws on an unknown provider rather than silently downgrading', () => {
    expect(() => createAgeVerifier('acme-verify')).toThrow(/Unknown age verification provider/)
  })
})

describe('scan reporting', () => {
  it('reports clean content', () => {
    expect(formatScanResult(scanText('Packed in the United States.'), 'copy')).toContain('clean')
  })

  it('reports blocking matches with the reason', () => {
    const out = formatScanResult(scanText('This will cure you.'), 'copy')
    expect(out).toContain('1 blocking')
    expect(out).toContain('Disease claim')
    expect(out).toContain('✗')
  })

  it('includes the suggested alternative when one exists', () => {
    const out = formatScanResult(
      scanText('Excellent yield.', { productLines: ['MIMOSA_HOSTILIS'] }),
      'copy',
    )
    expect(out).toContain('color depth')
  })

  it('marks a warning-only result as non-blocking', () => {
    const out = formatScanResult(scanText('Serving dosage on the label.'), 'copy')
    expect(out).toContain('⚠')
    expect(out).toContain('0 blocking')
  })
})
