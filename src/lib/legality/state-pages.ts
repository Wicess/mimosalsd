import { getRulesForState, getStateRule } from '@/lib/compliance/state-rules'
import { JURISDICTIONS, jurisdictionName } from '@/lib/compliance/jurisdictions'
import type { ProductLine, StateRule, UsJurisdictionCode } from '@/lib/compliance/types'
import { getStateProfile, type StateProfile } from './state-profiles'
import { buildDyeingGuide, type StateDyeingGuide } from './state-dyeing'
import { cityDelivery, cityQuestions } from './state-cities'

/**
 * ─────────────────────────────────────────────────────────────────────────────
 *  THE LEGALITY ENGINE
 *
 *  Why this exists in this shape:
 *
 *  Google reads "near me" as a proximity trigger and substitutes the searcher's
 *  location, so optimising for the literal phrase does not pay. Worse, Google's spam
 *  policy now names Scaled Content Abuse and Doorway Abuse — thin templated
 *  city pages are a liability in 2026, not an asset.
 *
 *  But this business has a differentiator almost nobody exploits properly: the law is
 *  GENUINELY different in every state. So these pages are substantive by construction,
 *  not by padding.
 *
 *  The critical invariant: the prose here and the cart's shipping decision read the
 *  SAME `state_rules` row. Content and checkout behaviour cannot drift apart, because
 *  there is only one copy of the truth.
 *
 *  PUBLICATION GATE: a page does not publish until it has a reviewed statute and
 *  enough genuinely state-specific substance. Twelve excellent pages beat fifty
 *  mediocre ones, and fifty mediocre ones are the thing Google penalises.
 * ─────────────────────────────────────────────────────────────────────────────
 */

/** Minimum genuinely state-specific words before a page may be indexed. */
export const MIN_PUBLISH_WORDS = 400

/**
 * The product lines a state page describes (owner instruction, 2026-09-28).
 *
 * Every Amanita and vapor listing was hidden that day, so a state page describing
 * those lines would be describing products nobody can buy — and the hemp, PACT and
 * psilocybin context that came with them. Add a line back here when its category
 * has live products again.
 */
export const STATE_PAGE_LINES: readonly ProductLine[] = ['MIMOSA_HOSTILIS']

export const LINE_LABEL: Record<ProductLine, string> = {
  MIMOSA_HOSTILIS: 'Mimosa Hostilis root bark',
  AMANITA: 'Amanita muscaria',
  VAPE: 'Disposable vapes',
}

export const LINE_SHORT: Record<ProductLine, string> = {
  MIMOSA_HOSTILIS: 'Mimosa Hostilis',
  AMANITA: 'Amanita muscaria',
  VAPE: 'Vapes',
}

export interface LineVerdict {
  readonly productLine: ProductLine
  readonly rule: StateRule
  readonly headline: string
  readonly detail: string
}

export interface StateLegality {
  readonly code: UsJurisdictionCode
  readonly name: string
  readonly slug: string
  readonly verdicts: readonly LineVerdict[]
  /** The answer-first paragraph. First thing a reader and an AI extractor sees. */
  readonly answerFirst: string
  /** Practical, state-specific ordering guidance. */
  readonly orderingGuidance: string
  readonly lastReviewedAt: string
  readonly reviewedBy: string
  readonly reviewYear: number
  readonly hasPendingLegislation: boolean
  readonly isPublishable: boolean
  readonly publishBlockers: readonly string[]
  readonly wordCount: number
  /** State-specific regulatory context — the substance that makes this page real. */
  readonly profile: StateProfile
  /** Dyeing with root bark in this state: water, storage, sassafras, the local fibre community. */
  readonly dyeing: StateDyeingGuide
  /** Delivery to the state's cities, and buyer questions phrased the way people search. */
  readonly cities: {
    readonly delivery: string
    readonly questions: readonly { readonly question: string; readonly answer: string }[]
  }
}

function verdictFor(stateCode: UsJurisdictionCode, productLine: ProductLine): LineVerdict {
  const rule = getStateRule(stateCode, productLine)
  const state = jurisdictionName(stateCode)

  if (!rule) {
    return {
      productLine,
      rule: {
        stateCode,
        productLine,
        status: 'BLOCKED',
        minAge: 21,
        requiresAdultSignature: true,
        requiresProductDirectory: false,
        watch: true,
        lastReviewedAt: '1970-01-01',
        reviewedBy: 'SYSTEM_FAIL_CLOSED',
      },
      headline: `We have no verified legal review on file for ${state}`,
      detail: `Until counsel has reviewed this product for ${state}, we do not ship it there.`,
    }
  }

  const headline =
    rule.status === 'BLOCKED'
      ? `Not available in ${state}`
      : rule.status === 'RESTRICTED'
        ? `Available in ${state} with conditions`
        : `Available in ${state}`

  return { productLine, rule, headline, detail: rule.notes ?? '' }
}

/**
 * The answer-first block: the verdict in the first two or three sentences.
 *
 * This is the single highest-leverage AEO technique available — an answer engine
 * extracting this paragraph should be able to answer "is X legal in Y" correctly and
 * completely, with our attribution, without reading further.
 */
function buildAnswerFirst(
  state: string,
  verdicts: readonly LineVerdict[],
): string {
  /*
    Rewritten 2026-09-28. It said "all three of the product categories we sell" and
    "our cart refuses any item we cannot lawfully send", and neither is true now: two
    categories are withdrawn, and checkout stopped refusing by location on 2026-09-19.
  */
  const blocked = verdicts.filter((v) => v.rule.status === 'BLOCKED')
  if (blocked.length === verdicts.length) {
    return `We do not currently ship root bark to ${state}. The position we hold is set out below, with the date it was last reviewed.`
  }
  return `Yes. We ship Mimosa hostilis root bark, in powder, shredded and whole cuts, and sassafras root bark to ${state}, from California, with tracking. Every cut is sold by the pound, from a quarter pound to a full pound, and no payment is taken until a person has checked the order.`
}

function listOf(items: readonly string[]): string {
  if (items.length === 0) return ''
  if (items.length === 1) return items[0]!
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`
}

/**
 * What ordering actually looks like from this state.
 *
 * This is the section that varies most, because vapor rules vary most: a reader in
 * Texas can order everything, a reader in California can order two of three lines, a
 * reader in Florida can order a vape only if the specific SKU is on the state
 * directory. Saying that plainly is more useful than any amount of general legal
 * background, and it is what stops these pages reading as templated.
 */
function buildOrderingGuidance(
  state: string,
  verdicts: readonly LineVerdict[],
): string {
  const parts: string[] = []
  const blocked = verdicts.filter((v) => v.rule.status === 'BLOCKED')

  parts.push(
    `Ordering from ${state} takes three steps. Choose a cut and a size and send an order request with your ${state} delivery address; nothing is charged. A person checks the stock and the address and emails you payment details for the method you chose. Once the payment arrives, the bark is weighed, packed in a nitrogen-flushed, smell-proof bag and shipped from California, and the tracking number follows.`,
  )

  if (blocked.length > 0) {
    parts.push(
      `The position we hold for ${listOf(blocked.map((v) => LINE_SHORT[v.productLine]))} in ${state} is set out above, with the date it was last reviewed.`,
    )
  }

  parts.push(
    `Root bark travels to ${state} as a standard parcel with tracking, packed in a double-sealed, smell-proof bag flushed with nitrogen so it arrives fresh. Parcel orders over one hundred dollars ship free, and the cart shows the delivery cost for your address before you send the request. Prices are the same in ${state} as in every other state we ship to.`,
  )

  return parts.join(' ')
}

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length
}

export function getStateLegality(stateCode: UsJurisdictionCode): StateLegality {
  const jurisdiction = JURISDICTIONS.find((j) => j.code === stateCode)
  const name = jurisdiction?.name ?? stateCode
  const verdicts = STATE_PAGE_LINES.map((line) => verdictFor(stateCode, line))

  const rules = getRulesForState(stateCode).filter((r) => STATE_PAGE_LINES.includes(r.productLine))
  const lastReviewedAt =
    rules.map((r) => r.lastReviewedAt).sort().at(-1) ?? '1970-01-01'
  const reviewedBy = rules[0]?.reviewedBy ?? 'UNREVIEWED'

  // The year comes from the REVIEW DATE, never the wall clock. Two reasons: the
  // claim "as of 2026" should mean "when we checked", not "when you loaded the page";
  // and reading the clock during render is runtime data, which would stop these pages
  // from prerendering at all.
  const reviewYear = new Date(lastReviewedAt).getUTCFullYear()
  const answerFirst = buildAnswerFirst(name, verdicts)

  const profile = getStateProfile(stateCode)
  const orderingGuidance = buildOrderingGuidance(name, verdicts)
  const cities = { delivery: cityDelivery(stateCode, name), questions: cityQuestions(stateCode, name) }
  const dyeing = buildDyeingGuide(stateCode, name, (NEIGHBOURS[stateCode] ?? []).map(jurisdictionName))

  // Everything genuinely specific to this state, for the publication gate. Since
  // 2026-09-28 that is the dyeing guide — water hardness, climate, whether sassafras
  // grows there and the state's own fibre community, each from a cited source — in
  // place of the hemp and psilocybin postures of the withdrawn lines.
  const substantiveText = [
    answerFirst,
    ...verdicts.map((v) => `${v.headline} ${v.detail} ${v.rule.statuteCitation ?? ''}`),
    orderingGuidance,
    cities.delivery,
    ...dyeing.paragraphs.map((p) => `${p.heading} ${p.text}`),
    ...dyeing.events.map((e) => `${e.name}, ${e.place}${e.month ? `, usually in ${e.month}` : ''}`),
  ].join(' ')
  const wordCount = countWords(substantiveText)

  const publishBlockers: string[] = []
  if (reviewedBy === 'UNREVIEWED') {
    publishBlockers.push('No editorial review recorded against the state rules.')
  }
  if (verdicts.some((v) => v.rule.reviewedBy === 'SYSTEM_FAIL_CLOSED')) {
    publishBlockers.push('One or more product lines has no reviewed rule for this state.')
  }
  if (wordCount < MIN_PUBLISH_WORDS) {
    publishBlockers.push(
      `Only ${wordCount} words of state-specific content; ${MIN_PUBLISH_WORDS} required. Add the state's own sourced facts rather than padding.`,
    )
  }
  /*
    Only CONDITIONS need a statute. A line we simply do not send to a state is our own
    decision, stated on the page in the rule's notes, not a claim about the law.

    Owner, 2026-09-19: "do not hide the 22 states from google". Twenty-two state pages
    were noindexed because their vape rule was a provisional block with no statute —
    one line's block took the whole page out of search, root bark and all, and left
    every visitor a notice saying the page was unpublished.
  */
  for (const v of verdicts) {
    if (v.rule.status === 'RESTRICTED' && !v.rule.statuteCitation) {
      publishBlockers.push(
        `${LINE_LABEL[v.productLine]} is restricted here but cites no statute.`,
      )
    }
  }

  return {
    code: stateCode,
    name,
    slug: jurisdiction?.slug ?? stateCode.toLowerCase(),
    verdicts,
    answerFirst,
    orderingGuidance,
    lastReviewedAt,
    reviewedBy,
    reviewYear,
    profile,
    dyeing,
    cities,
    hasPendingLegislation: verdicts.some((v) => v.rule.watch),
    isPublishable: publishBlockers.length === 0,
    publishBlockers,
    wordCount,
  }
}

export function getAllStateLegality(): readonly StateLegality[] {
  return JURISDICTIONS.map((j) => getStateLegality(j.code))
}

/** Neighbouring states, for genuine cross-linking rather than a link farm. */
/**
 * What is true next door — derived, never asserted.
 *
 * "Is it legal in the state next door?" is the question these pages reliably
 * produce, and until now the answer was a rail of links: real, but it made every
 * page's prose identical apart from its own name. This composes a sentence from
 * facts the application already holds — which states border this one, and how
 * their intoxicating-hemp posture compares — so the paragraph differs per state
 * because the country does, not because a template was fed a different noun.
 *
 * It states nothing that is not computed from `NEIGHBOURS` and `getStateProfile`.
 * Nothing here is a legal claim about the neighbour beyond the posture already
 * published on that neighbour's own page.
 */
export interface NeighbourContext {
  readonly codes: readonly UsJurisdictionCode[]
  readonly names: readonly string[]
  readonly sentence: string
}

export function neighbourContext(code: UsJurisdictionCode): NeighbourContext | null {
  const codes = NEIGHBOURS[code] ?? []
  if (codes.length === 0) return null

  const self = getStateProfile(code)
  const names = codes.map((c) => jurisdictionName(c))
  const differing = codes.filter((c) => getStateProfile(c).hemp !== self.hemp)

  const list =
    names.length === 1
      ? names[0]!
      : `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`

  const opening = `${jurisdictionName(code)} borders ${names.length} ${
    names.length === 1 ? 'jurisdiction' : 'jurisdictions'
  }: ${list}.`

  /*
    The comparison is the point. A reader checking one state is usually deciding
    where to have an order sent, and "the rules next door are the same" is a more
    useful answer than a list of names they have to click through one at a time.
  */
  const self_ = jurisdictionName(code)
  const differingNames = differing.map((c) => jurisdictionName(c))
  const only = names.length === 1

  /*
    "Takes a different position", never "treats differently". The compliance
    lexicon blocks `treat` sitewide as a disease claim, and it is right to: this
    is a botanicals storefront, and a sentence containing "treats" is one search
    snippet away from reading as a medical claim regardless of the regulatory
    sense intended here. The escape hatch exists for quoting statutes verbatim,
    not for a word with an ordinary synonym.

    Singular and plural are handled separately rather than with a bolted-on "(s)".
    Maine borders exactly one jurisdiction, and "All of them take the same
    position" about a single neighbour is the kind of sentence that tells a reader
    the page was generated — on a page whose entire job is to be trusted on a
    question of law.
  */
  const comparison =
    differing.length === 0
      ? only
        ? ` ${names[0]} takes the same position on intoxicating hemp as ${self_} does.`
        : ` All of them take the same position on intoxicating hemp as ${self_} does.`
      : differing.length === names.length
        ? only
          ? ` ${names[0]} takes a different position on intoxicating hemp from ${self_}.`
          : ` Every one of them takes a different position on intoxicating hemp from ${self_}.`
        : differing.length === 1
          ? ` One of them, ${differingNames[0]}, takes a different position on intoxicating hemp from ${self_}.`
          : ` ${differing.length} of them — ${differingNames.join(', ')} — take a different position on intoxicating hemp from ${self_}.`

  return { codes, names, sentence: opening + comparison }
}

export const NEIGHBOURS: Record<UsJurisdictionCode, readonly UsJurisdictionCode[]> = {
  AL: ['FL', 'GA', 'TN', 'MS'],
  AK: [],
  AZ: ['CA', 'NV', 'UT', 'CO', 'NM'],
  AR: ['MO', 'TN', 'MS', 'LA', 'TX', 'OK'],
  CA: ['OR', 'NV', 'AZ'],
  CO: ['WY', 'NE', 'KS', 'OK', 'NM', 'UT', 'AZ'],
  CT: ['NY', 'MA', 'RI'],
  DE: ['MD', 'PA', 'NJ'],
  DC: ['MD', 'VA'],
  FL: ['GA', 'AL'],
  GA: ['FL', 'AL', 'TN', 'NC', 'SC'],
  HI: [],
  ID: ['WA', 'OR', 'NV', 'UT', 'WY', 'MT'],
  IL: ['WI', 'IA', 'MO', 'KY', 'IN'],
  IN: ['MI', 'OH', 'KY', 'IL'],
  IA: ['MN', 'WI', 'IL', 'MO', 'NE', 'SD'],
  KS: ['NE', 'MO', 'OK', 'CO'],
  KY: ['IN', 'OH', 'WV', 'VA', 'TN', 'MO', 'IL'],
  LA: ['TX', 'AR', 'MS'],
  ME: ['NH'],
  MD: ['VA', 'WV', 'PA', 'DE', 'DC'],
  MA: ['RI', 'CT', 'NY', 'VT', 'NH'],
  MI: ['OH', 'IN', 'WI'],
  MN: ['WI', 'IA', 'SD', 'ND'],
  MS: ['LA', 'AR', 'TN', 'AL'],
  MO: ['IA', 'IL', 'KY', 'TN', 'AR', 'OK', 'KS', 'NE'],
  MT: ['ND', 'SD', 'WY', 'ID'],
  NE: ['SD', 'IA', 'MO', 'KS', 'CO', 'WY'],
  NV: ['OR', 'ID', 'UT', 'AZ', 'CA'],
  NH: ['ME', 'MA', 'VT'],
  NJ: ['NY', 'PA', 'DE'],
  NM: ['CO', 'OK', 'TX', 'AZ', 'UT'],
  NY: ['NJ', 'PA', 'CT', 'VT', 'MA'],
  NC: ['VA', 'TN', 'GA', 'SC'],
  ND: ['MN', 'SD', 'MT'],
  OH: ['PA', 'WV', 'KY', 'IN', 'MI'],
  OK: ['KS', 'MO', 'AR', 'TX', 'NM', 'CO'],
  OR: ['WA', 'ID', 'NV', 'CA'],
  PA: ['NY', 'NJ', 'DE', 'MD', 'WV', 'OH'],
  RI: ['CT', 'MA'],
  SC: ['NC', 'GA'],
  SD: ['ND', 'MN', 'IA', 'NE', 'WY', 'MT'],
  TN: ['KY', 'VA', 'NC', 'GA', 'AL', 'MS', 'AR', 'MO'],
  TX: ['NM', 'OK', 'AR', 'LA'],
  UT: ['ID', 'WY', 'CO', 'NM', 'AZ', 'NV'],
  VT: ['NY', 'MA', 'NH'],
  VA: ['MD', 'DC', 'NC', 'TN', 'KY', 'WV'],
  WA: ['ID', 'OR'],
  WV: ['PA', 'MD', 'VA', 'KY', 'OH'],
  WI: ['MI', 'MN', 'IA', 'IL'],
  WY: ['MT', 'SD', 'NE', 'CO', 'UT', 'ID'],
}
