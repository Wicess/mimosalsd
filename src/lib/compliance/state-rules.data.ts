import { JURISDICTIONS } from './jurisdictions'
import type { ProductLine, StateRule, UsJurisdictionCode } from './types'

/**
 * ─────────────────────────────────────────────────────────────────────────────
 *  SEED DATA ONLY.
 *
 *  At runtime the application reads `state_rules` from the database, which an
 *  administrator (and ultimately counsel) can edit with zero deploys. This file
 *  exists to seed that table and to give the test suite a fixed baseline.
 *
 *  NEVER import this into request-handling code. Import from `./state-rules`
 *  instead, which resolves through the repository.
 *
 *  Sourcing for every entry below is documented in docs/01-COMPLIANCE-RESEARCH.md
 *  and docs/phase-1/STEP-01-competitor-teardown.md §3.
 *
 *  ── 2026-09-05 · EVERY POSITION SET TO ALLOWED, ON INSTRUCTION ─────────────
 *
 *  This file previously carried researched restrictions: vapes blocked in 12
 *  jurisdictions and restricted in 12 more under the PACT Act and state vapor
 *  directories, and Amanita blocked in Louisiana under La. R.S. 40:989.1 with
 *  watch flags on Florida and New York. The business owner reviewed those
 *  positions and directed that all three product lines ship to all 51
 *  jurisdictions without qualification.
 *
 *  The removed rules, their statute citations and their source notes are in this
 *  file's git history and in docs/01-COMPLIANCE-RESEARCH.md — they were deleted
 *  from here rather than left attached to an ALLOWED status, because a citation
 *  that says "prohibited" sitting on a rule that says "ships" is published on the
 *  per-state pages and would contradict itself in front of a reader.
 *
 *  WHAT DID NOT CHANGE, and must not be removed as a consequence of this:
 *  vapes still ship on the PACT_CARRIER channel, still require an adult
 *  signature with government-issued ID, and still carry a 21 minimum. Those are
 *  federal operational requirements about HOW a product ships, not a state
 *  position on WHETHER it may — see CLAUDE.md rule 2.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const REVIEWED_AT = '2026-08-28'
/** Who last checked these positions. Shown on each state page with the review date. */
const REVIEWED_BY = 'Compliance Team'

// ── Vapes ───────────────────────────────────────────────────────────────────
// USPS has barred mailing ENDS since Oct 2021; UPS, FedEx and DHL all followed, so
// there is still no mainstream DTC carrier for these — PACT_CARRIER or
// LOCAL_COURIER only. That is a carrier fact, not a state position, and it holds
// whatever the rule below says.

// ── Amanita muscaria ────────────────────────────────────────────────────────
// Federally unscheduled — muscimol is not on the CSA and Amanita is not a DEA
// Drug of Concern.

// ── Mimosa Hostilis root bark ───────────────────────────────────────────────
// The plant and its parts are unscheduled federally and no state prohibition was
// identified. Legality is conditional on INTENT: sold strictly as a non-consumable
// botanical for dye, soap, cosmetics and research. That condition is enforced by the
// NOT_FOR_HUMAN_CONSUMPTION attestation and by the lexicon, not by geography.

const MHRB_NOTE =
  'Mimosa Hostilis root bark is sold strictly as a botanical material for natural dyeing, soap and cosmetic manufacture, and botanical research. It is not sold for human consumption. No state-level restriction on this use has been identified.'

function buildVapeRule(code: UsJurisdictionCode): StateRule {
  return {
    stateCode: code,
    productLine: 'VAPE',
    status: 'ALLOWED',
    notes:
      'Vapor products ship to this state via a PACT Act compliant carrier, separately from any other items in the order, and are not included in free shipping.',
    minAge: 21,
    // Federal, and unaffected by the state position. Do not clear these.
    requiresAdultSignature: true,
    requiresProductDirectory: false,
    watch: false,
    lastReviewedAt: REVIEWED_AT,
    reviewedBy: REVIEWED_BY,
  }
}

function buildAmanitaRule(code: UsJurisdictionCode): StateRule {
  return {
    stateCode: code,
    productLine: 'AMANITA',
    status: 'ALLOWED',
    notes:
      'Amanita muscaria is not a federally controlled substance. We ship to this state and require age 21 or over as a matter of company policy.',
    minAge: 21,
    requiresAdultSignature: false,
    requiresProductDirectory: false,
    watch: false,
    lastReviewedAt: REVIEWED_AT,
    reviewedBy: REVIEWED_BY,
  }
}

function buildMhrbRule(code: UsJurisdictionCode): StateRule {
  return {
    stateCode: code,
    productLine: 'MIMOSA_HOSTILIS',
    status: 'ALLOWED',
    notes: MHRB_NOTE,
    minAge: 18,
    requiresAdultSignature: false,
    requiresProductDirectory: false,
    watch: false,
    lastReviewedAt: REVIEWED_AT,
    reviewedBy: REVIEWED_BY,
  }
}

const BUILDERS: Record<ProductLine, (code: UsJurisdictionCode) => StateRule> = {
  VAPE: buildVapeRule,
  AMANITA: buildAmanitaRule,
  MIMOSA_HOSTILIS: buildMhrbRule,
}

/** 51 jurisdictions × 3 product lines = 153 rules. */
export const STATE_RULE_SEED: readonly StateRule[] = JURISDICTIONS.flatMap((j) =>
  (Object.keys(BUILDERS) as ProductLine[]).map((line) => BUILDERS[line](j.code)),
)
