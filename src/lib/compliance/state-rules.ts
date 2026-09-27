import { STATE_RULE_SEED } from './state-rules.data'
import type { ProductLine, StateRule, UsJurisdictionCode } from './types'

/**
 * Rule resolution.
 *
 * Rules are DATA, not code. In production this resolves against the `state_rules`
 * table so counsel can block a jurisdiction in under a minute with no deploy. The
 * seed array is the fallback and the fixture the test suite pins against.
 *
 * The critical invariant of the whole system:
 *   the cart and /legality/[state] read the SAME rule.
 * Content and checkout behaviour must be incapable of drifting apart.
 */

export interface StateRuleProvider {
  getRule(stateCode: UsJurisdictionCode, productLine: ProductLine): StateRule | undefined
  getRulesForState(stateCode: UsJurisdictionCode): readonly StateRule[]
  getRulesForLine(productLine: ProductLine): readonly StateRule[]
  all(): readonly StateRule[]
}

const key = (s: UsJurisdictionCode, l: ProductLine) => `${s}:${l}`

export function createInMemoryProvider(rules: readonly StateRule[]): StateRuleProvider {
  const byKey = new Map(rules.map((r) => [key(r.stateCode, r.productLine), r]))
  return {
    getRule: (s, l) => byKey.get(key(s, l)),
    getRulesForState: (s) => rules.filter((r) => r.stateCode === s),
    getRulesForLine: (l) => rules.filter((r) => r.productLine === l),
    all: () => rules,
  }
}

let provider: StateRuleProvider = createInMemoryProvider(STATE_RULE_SEED)

/**
 * Swap in the database-backed provider at application boot, or a fixture in tests.
 * Keeping this a single mutable binding (rather than threading a provider through every
 * call site) is deliberate: it means no caller can accidentally consult a stale ruleset.
 */
export function setStateRuleProvider(next: StateRuleProvider): void {
  provider = next
}

export function resetStateRuleProvider(): void {
  provider = createInMemoryProvider(STATE_RULE_SEED)
}

export function getStateRule(
  stateCode: UsJurisdictionCode,
  productLine: ProductLine,
): StateRule | undefined {
  return provider.getRule(stateCode, productLine)
}

export function getRulesForState(stateCode: UsJurisdictionCode): readonly StateRule[] {
  return provider.getRulesForState(stateCode)
}

export function getRulesForLine(productLine: ProductLine): readonly StateRule[] {
  return provider.getRulesForLine(productLine)
}

export function getAllStateRules(): readonly StateRule[] {
  return provider.all()
}
