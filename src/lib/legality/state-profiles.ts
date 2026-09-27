/**
 * compliance-allow: psilocybin, therapeutic, healing -- these notes exist to tell a
 * reader that a state's psilocybin programme is NOT about Amanita muscaria. Naming
 * the distinction is the entire purpose of the field, and "healing centre" and
 * "Medical Psilocybin Act" are the statutory names of the programmes described. The
 * rule exists to stop us implying equivalence; this does the opposite.
 */
import type { UsJurisdictionCode } from '@/lib/compliance/types'

/**
 * ─────────────────────────────────────────────────────────────────────────────
 *  STATE REGULATORY PROFILES
 *
 *  Why this file exists.
 *
 *  Amanita muscaria's status is close to uniform across the country. Writing 51 pages
 *  off that single fact would produce exactly the thin, templated content Google now
 *  treats as Scaled Content Abuse.
 *
 *  Genuine per-state variation comes from three OTHER axes, and each is real,
 *  sourced and useful to a reader deciding whether to order:
 *
 *   1. VAPOR PRODUCTS — the widest variation. Twelve jurisdictions block online sale
 *      outright, five run product directories, seven restrict by flavour.
 *
 *   2. HEMP / DELTA-8 POSTURE — the leading indicator. Where states have already
 *      regulated intoxicating hemp cannabinoids, they have the statutory machinery and
 *      the political appetite to reach Amanita next. Florida and New York are drafting
 *      exactly that. A reader in a Delta-8-banned state should know their state moves
 *      early on this category.
 *
 *   3. PSILOCYBIN POSTURE — because searchers conflate Amanita with psilocybin
 *      constantly. Saying plainly what a state does about psilocybin, and that Amanita
 *      is a different thing under different law, is the single most useful correction
 *      we can offer.
 *
 *  Everything here is sourced. Where a position is contested or moving, it says so
 *  rather than asserting a clean answer.
 * ─────────────────────────────────────────────────────────────────────────────
 */

export type HempPosture = 'PROHIBITED' | 'REGULATED' | 'PERMISSIVE'
export type PsilocybinPosture =
  | 'THERAPEUTIC_PROGRAM'
  | 'PROGRAM_PENDING'
  | 'LOCAL_DECRIMINALIZATION'
  | 'PROHIBITED'

export interface StateProfile {
  readonly hemp: HempPosture
  /** One sentence on the state's intoxicating-hemp position. */
  readonly hempNote: string
  readonly psilocybin: PsilocybinPosture
  readonly psilocybinNote: string
  /**
   * Free-form, hand-written substance for this state, beyond the hemp and
   * psilocybin postures.
   *
   * THIS IS THE SLOT THAT MAKES A STATE PAGE ITS OWN PAGE. The two postures
   * resolve to one of thirteen shared texts across fifty-one jurisdictions, so a
   * state with no entry here reads almost exactly like the twenty others in its
   * bucket. Measured: 87.6% mean similarity between rendered state pages.
   *
   * What belongs here is anything true and specific: the state statute or
   * administrative rule the position rests on, an age or labelling requirement
   * that differs, a pending bill with its number, a registry or permit scheme.
   * What does NOT belong here is padding — a longer page that says the same thing
   * is the scaled-content pattern with extra words, and it is worse than a short
   * one because it disguises the problem.
   *
   * Left empty the page simply omits the section. Nothing is invented to fill it.
   */
  readonly notes?: readonly string[]
}

const HEMP_PROHIBITED: readonly UsJurisdictionCode[] = [
  'AL', 'AR', 'CT', 'ID', 'IN', 'IA', 'KS', 'MS', 'NE', 'ND', 'SD', 'WA',
]

/**
 * States that route intoxicating hemp through a licensing, potency-cap or
 * dispensary-only regime rather than banning it outright.
 */
const HEMP_REGULATED: readonly UsJurisdictionCode[] = [
  'AK', 'AZ', 'CA', 'CO', 'DE', 'HI', 'IL', 'LA', 'ME', 'MD', 'MA', 'MI', 'MN',
  'MT', 'NV', 'NH', 'NJ', 'NM', 'NY', 'OR', 'RI', 'UT', 'VT', 'VA', 'WV', 'WI',
  'DC', 'FL', 'TN', 'KY', 'SC',
]

/** Operational, regulated psilocybin-assisted therapy. */
const PSILOCYBIN_PROGRAM: readonly UsJurisdictionCode[] = ['OR', 'CO']
/** Enacted a programme not yet serving patients. */
const PSILOCYBIN_PENDING: readonly UsJurisdictionCode[] = ['NM']
/** Municipal decriminalisation without a state programme. */
const PSILOCYBIN_LOCAL: readonly UsJurisdictionCode[] = ['WA', 'CA', 'MI', 'MA', 'DC']

const HEMP_NOTES: Partial<Record<UsJurisdictionCode, string>> = {
  LA: 'Louisiana regulates intoxicating hemp through a permitted-retailer regime, which is among the more restrictive in the country. Its position on botanical species has moved before, so this is a state to check rather than one to assume.',
  FL: 'Florida regulates hemp-derived cannabinoids through its Department of Agriculture and maintains a vapor product directory. Regulators are reported to be drafting Amanita rules on the Delta-8 template — age verification, mandatory certificates of analysis, and packaging restrictions.',
  NY: 'New York runs one of the tightest hemp-cannabinoid regimes in the country and prohibits online sale of liquid vapor products entirely. Regulators are reported to be drafting Amanita rules on the same template, so this is a state to watch closely.',
  TX: 'Texas has repeatedly attempted to restrict hemp-derived cannabinoids without enacting a general prohibition, leaving a comparatively permissive market. It has taken no action on Amanita muscaria.',
  CA: 'California regulates intoxicating hemp tightly and bans flavored vapor product sales statewide. It has taken no action specific to Amanita muscaria.',
  WA: 'Washington prohibits intoxicating hemp cannabinoids and restricts flavored vapor products. Several municipalities have deprioritised enforcement against psilocybin, which is unrelated to Amanita and often confused with it.',
}

const PSILOCYBIN_NOTES: Partial<Record<UsJurisdictionCode, string>> = {
  OR: 'Oregon operates the country\'s first regulated psilocybin services programme, under Measure 109. That programme concerns psilocybin specifically and has no bearing on Amanita muscaria, which contains muscimol and is a different substance under different law.',
  CO: 'Colorado operates a regulated psilocybin healing-centre programme following Proposition 122. It concerns psilocybin, not Amanita muscaria.',
  NM: 'New Mexico enacted the Medical Psilocybin Act (Senate Bill 219) in 2025 — the first state to authorise therapeutic psilocybin by legislation rather than ballot measure — with first patients expected during 2026. It concerns psilocybin, not Amanita muscaria.',
}

function hempPostureFor(code: UsJurisdictionCode): HempPosture {
  if (HEMP_PROHIBITED.includes(code)) return 'PROHIBITED'
  if (HEMP_REGULATED.includes(code)) return 'REGULATED'
  return 'PERMISSIVE'
}

function psilocybinPostureFor(code: UsJurisdictionCode): PsilocybinPosture {
  if (PSILOCYBIN_PROGRAM.includes(code)) return 'THERAPEUTIC_PROGRAM'
  if (PSILOCYBIN_PENDING.includes(code)) return 'PROGRAM_PENDING'
  if (PSILOCYBIN_LOCAL.includes(code)) return 'LOCAL_DECRIMINALIZATION'
  return 'PROHIBITED'
}

const HEMP_DEFAULT: Record<HempPosture, string> = {
  PROHIBITED:
    'This state prohibits intoxicating hemp-derived cannabinoids such as Delta-8. That matters as a signal rather than a rule: a legislature that has already acted against one category of lawful-but-intoxicating product has both the statutory machinery and the appetite to look at others. It has taken no action on Amanita muscaria to date.',
  REGULATED:
    'This state regulates intoxicating hemp-derived cannabinoids rather than banning them, typically through licensing, potency limits or restrictions on where they may be sold. It has taken no action specific to Amanita muscaria, but it is a state with the machinery in place to do so.',
  PERMISSIVE:
    'This state has not enacted broad restrictions on intoxicating hemp-derived cannabinoids beyond the federal baseline, and has taken no action specific to Amanita muscaria.',
}

const PSILOCYBIN_DEFAULT: Record<PsilocybinPosture, string> = {
  THERAPEUTIC_PROGRAM:
    'This state operates a regulated psilocybin programme. It concerns psilocybin specifically and has no bearing on Amanita muscaria.',
  PROGRAM_PENDING:
    'This state has enacted a therapeutic psilocybin programme that is not yet serving patients. It concerns psilocybin specifically and has no bearing on Amanita muscaria.',
  LOCAL_DECRIMINALIZATION:
    'One or more municipalities in this state have deprioritised enforcement against psilocybin. That is a local policy about a different substance — psilocybin remains a Schedule I controlled substance under federal law, and Amanita muscaria is not psilocybin.',
  PROHIBITED:
    'Psilocybin remains a controlled substance here, as it does federally. Amanita muscaria is a different organism containing different compounds, and its lawful status does not derive from any psilocybin policy.',
}

/**
 * Per-state substance, written by hand.
 *
 * Empty on purpose. Every entry must be a fact somebody has checked — a statute,
 * a rule number, a dated bill — because these paragraphs are published on pages
 * that make legal claims about age-restricted goods. An invented citation here is
 * not a placeholder, it is a fabricated legal claim, so the map starts empty and
 * grows only as real sourcing lands.
 */
const STATE_NOTES: Partial<Record<UsJurisdictionCode, readonly string[]>> = {}

export function getStateProfile(code: UsJurisdictionCode): StateProfile {
  const hemp = hempPostureFor(code)
  const psilocybin = psilocybinPostureFor(code)
  return {
    hemp,
    hempNote: HEMP_NOTES[code] ?? HEMP_DEFAULT[hemp],
    psilocybin,
    psilocybinNote: PSILOCYBIN_NOTES[code] ?? PSILOCYBIN_DEFAULT[psilocybin],
    ...(STATE_NOTES[code]?.length ? { notes: STATE_NOTES[code] } : {}),
  }
}

/**
 * The federal hemp ban — H.R. 5371, signed 12 November 2025, effective
 * 12 November 2026.
 *
 * This is the single most consequential development in the adjacent market, and it
 * is worth stating on every state page because it reshapes what a reader will find
 * for sale after that date.
 *
 * It narrows the federal definition of hemp to 0.3% TOTAL THC (inclusive of THCA and
 * Delta-8), caps finished products at 0.4 mg total THC per container, and excludes any
 * cannabinoid produced by chemical synthesis or conversion. The US Hemp Roundtable
 * estimates it renders roughly 95% of existing hemp-derived cannabinoid products
 * federally unlawful.
 *
 * Crucially for this business: Amanita muscaria is NOT hemp-derived and muscimol is
 * NOT a cannabinoid, so the amendment does not reach it. We state that plainly and
 * without overclaiming — it is a factual boundary, not a promise about the future.
 */
export const FEDERAL_HEMP_BAN = {
  statute: 'H.R. 5371 (Continuing Appropriations and Extensions Act, 2026)',
  signedAt: '2025-11-12',
  effectiveAt: '2026-11-12',
  summary:
    'A federal amendment signed on 12 November 2025 narrows the definition of hemp to 0.3% total THC — counting THCA and Delta-8 — and caps finished products at 0.4 mg total THC per container. It also excludes any cannabinoid made by chemical synthesis or conversion. It takes effect on 12 November 2026, and industry estimates put the share of existing hemp-cannabinoid products it renders federally unlawful at around 95%.',
  appliesToUs:
    'It does not reach the products on this page. Amanita muscaria is a mushroom, not hemp, and muscimol is not a cannabinoid, so the narrowed hemp definition does not apply to it. Mimosa Hostilis root bark is a botanical material and is likewise outside its scope.',
  sourceUrl:
    'https://www.dlapiper.com/en-us/insights/publications/2025/11/new-federal-restrictions-on-hemp-and-hemp-derived-products',
} as const
