import 'server-only'
import { cacheTag } from 'next/cache'
import { db } from '@/lib/db/client'
import { createInMemoryProvider, type StateRuleProvider } from './state-rules'
import type { ProductLine, RuleStatus, StateRule, UsJurisdictionCode } from './types'

/**
 * Database-backed state rules.
 *
 * This is what makes the core promise real: an operator can block a jurisdiction in
 * the admin and the cart refuses it immediately, with no deploy.
 *
 * The rules are loaded ONCE into an in-memory snapshot rather than queried per
 * request. `canShipTo()` runs on every cart line, every product card and every
 * legality page — a database round-trip there would be thousands of queries per page
 * view. The admin calls `refreshStateRules()` after an edit, so the snapshot is never
 * meaningfully stale.
 */
export async function loadStateRules(): Promise<StateRule[]> {
  const rows = await db.stateRule.findMany()
  return rows.map((r) => ({
    stateCode: r.stateCode as UsJurisdictionCode,
    productLine: r.productLine as ProductLine,
    status: r.status as RuleStatus,
    ...(r.statuteCitation ? { statuteCitation: r.statuteCitation } : {}),
    ...(r.statuteUrl ? { statuteUrl: r.statuteUrl } : {}),
    ...(r.notes ? { notes: r.notes } : {}),
    minAge: r.minAge,
    requiresAdultSignature: r.requiresAdultSignature,
    requiresProductDirectory: r.requiresProductDirectory,
    watch: r.watch,
    lastReviewedAt: r.lastReviewedAt.toISOString().slice(0, 10),
    reviewedBy: r.reviewedBy,
    ...(r.effectiveFrom ? { effectiveFrom: r.effectiveFrom.toISOString().slice(0, 10) } : {}),
  }))
}

/**
 * Cache tag for the live rules. The admin's save action invalidates it, which is
 * what makes an edit reach every server instance and every cached page that
 * read the rules, not just the instance that handled the save.
 */
export const STATE_RULES_TAG = 'state-rules'

/**
 * The live rules, served from the data cache until an admin edit invalidates
 * them, so browsing does not wake the database. A failure is thrown, and a
 * thrown result is never cached: the next request tries again.
 */
export async function loadStateRulesCached(): Promise<StateRule[]> {
  'use cache'
  cacheTag(STATE_RULES_TAG)
  return loadStateRules()
}

export async function createPrismaStateRuleProvider(): Promise<StateRuleProvider> {
  const rules = await loadStateRules()
  if (rules.length === 0) {
    throw new Error('state_rules table is empty — refusing to run with no compliance data')
  }
  return createInMemoryProvider(rules)
}
