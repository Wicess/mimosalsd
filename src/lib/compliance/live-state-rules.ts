import 'server-only'
import { createInMemoryProvider, setStateRuleProvider } from './state-rules'

/**
 * ─────────────────────────────────────────────────────────────────────────────
 *  THE STOREFRONT READS THE LIVE STATE RULES, through this.
 *
 *  The rule accessors in state-rules.ts are synchronous, and they answer from a
 *  module-level provider that starts as the seed. The live rules used to be
 *  swapped in from instrumentation.ts at boot. But instrumentation is compiled
 *  as its own bundle with its own copy of state-rules.ts, so the swap never
 *  reached the app: the cart, checkout and every state page answered from the
 *  seed. An admin edit reloaded the rules only in the one instance that handled
 *  the save. On 2026-09-11 the seed and the table disagreed on 75 of 153 rules,
 *  27 of them on whether a product may ship at all.
 *
 *  So every request path that decides or displays eligibility calls this first,
 *  in its own bundle: the catalogue, the cart, checkout and the state pages. It
 *  reads the cached rules (STATE_RULES_TAG, invalidated by the admin save) and
 *  installs them, so what the admin says is what the cart enforces, everywhere.
 *
 *  If the rules cannot be loaded, the current provider stays: the last live
 *  rules this instance saw, or the seed. That is reported, never silent. Checkout
 *  cannot place an order without the database in any case, so a customer is
 *  never sold to on seed data while the live rules are unreachable.
 * ─────────────────────────────────────────────────────────────────────────────
 */
export async function ensureLiveStateRules(): Promise<void> {
  if (!process.env.DATABASE_URL) return
  try {
    const { loadStateRulesCached } = await import('./prisma-state-rules')
    const rules = await loadStateRulesCached()
    if (rules.length === 0) {
      throw new Error('state_rules is empty; keeping the current rules rather than running with none')
    }
    setStateRuleProvider(createInMemoryProvider(rules))
  } catch (error) {
    const { reportError } = await import('@/lib/observability/report-error')
    await reportError(error, {
      source: 'db',
      severity: 'WARN',
      context: { degraded: 'state rules could not be loaded; current rules kept' },
    })
  }
}
