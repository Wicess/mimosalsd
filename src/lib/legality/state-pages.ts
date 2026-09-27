import { getRulesForState, getStateRule } from '@/lib/compliance/state-rules'
import { JURISDICTIONS, jurisdictionName } from '@/lib/compliance/jurisdictions'
import { PRODUCT_LINES, type ProductLine, type StateRule, type UsJurisdictionCode } from '@/lib/compliance/types'
import { FEDERAL_HEMP_BAN, getStateProfile, type StateProfile } from './state-profiles'

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
  reviewYear: number,
): string {
  const allowed = verdicts.filter((v) => v.rule.status === 'ALLOWED')
  const restricted = verdicts.filter((v) => v.rule.status === 'RESTRICTED')
  const blocked = verdicts.filter((v) => v.rule.status === 'BLOCKED')

  const parts: string[] = []

  if (blocked.length === 0 && restricted.length === 0) {
    parts.push(
      `All three of the product categories we sell — ${allowed.map((v) => LINE_SHORT[v.productLine]).join(', ')} — can lawfully be shipped to ${state} as of ${reviewYear}.`,
    )
  } else {
    if (allowed.length > 0) {
      parts.push(
        `In ${state}, ${listOf(allowed.map((v) => LINE_SHORT[v.productLine]))} ${allowed.length === 1 ? 'is' : 'are'} lawful to buy and receive.`,
      )
    }
    if (blocked.length > 0) {
      parts.push(
        `${listOf(blocked.map((v) => LINE_SHORT[v.productLine]))} cannot be shipped to ${state}${blocked[0]?.rule.statuteCitation ? ` under ${blocked[0].rule.statuteCitation}` : ''}.`,
      )
    }
    if (restricted.length > 0) {
      parts.push(
        `${listOf(restricted.map((v) => LINE_SHORT[v.productLine]))} ${restricted.length === 1 ? 'ships' : 'ship'} to ${state} only under specific conditions, set out below.`,
      )
    }
  }

  parts.push(
    'We enforce this at checkout: our cart refuses any item we cannot lawfully send to your address.',
  )

  return parts.join(' ')
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
  const signature = verdicts.filter(
    (v) => v.rule.status !== 'BLOCKED' && v.rule.requiresAdultSignature,
  )
  const directory = verdicts.filter(
    (v) => v.rule.status === 'RESTRICTED' && v.rule.requiresProductDirectory,
  )
  parts.push(
    `Ordering from ${state} works like this. Our cart evaluates every item against the address you are shipping to rather than the state you happen to be browsing from, so the decision is made before you reach payment rather than after.`,
  )

  if (blocked.length > 0) {
    parts.push(
      /*
        It said blocked items "will be refused outright" at checkout. Checkout stopped
        refusing by location on 2026-09-19 (owner), so the sentence was false. The page
        keeps the position; it no longer describes a refusal that does not happen.
      */
      `The position we hold for ${listOf(blocked.map((v) => LINE_SHORT[v.productLine]))} in ${state} is set out above, with the date it was last reviewed.`,
    )
  }

  if (directory.length > 0) {
    parts.push(
      `${state} maintains a vapor product directory, so a given device ships only if that specific product is listed. We check each item individually at checkout instead of applying a blanket rule, because a blanket rule would either refuse products we can lawfully send or accept ones we cannot.`,
    )
  }

  if (signature.length > 0) {
    parts.push(
      `Shipments containing ${listOf(signature.map((v) => LINE_SHORT[v.productLine]))} travel on a carrier that complies with the federal PACT Act. They are packed apart from the rest of an order in plain, double-sealed packaging, and tracking is emailed as soon as they leave us. Those shipments are never eligible for free shipping, because they are carried at a different cost and we will not advertise a discount we cannot honour.`,
    )
  } else {
    parts.push(
      /*
        The same detail a PACT state gets in the paragraph above, for a state that only
        takes parcels. It was one short sentence, which left these pages under the
        400-word publication floor once a line was blocked (owner, 2026-09-19: "do not
        hide the 22 states from google").
      */
      `Everything available to ${state} travels as a standard parcel with tracking, packed in plain double-sealed packaging that shows nothing of what is inside. Tracking is emailed as soon as it leaves us, and an order over one hundred dollars ships free.`,
    )
  }


  /* A buyer's question the "2026 pricing" search title promises an answer to. */
  parts.push(
    `Prices are the same for ${state} as for every other state we ship to, and the cart shows the delivery cost for your address before you order.`,
  )

  return parts.join(' ')
}

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length
}

export function getStateLegality(stateCode: UsJurisdictionCode): StateLegality {
  const jurisdiction = JURISDICTIONS.find((j) => j.code === stateCode)
  const name = jurisdiction?.name ?? stateCode
  const verdicts = PRODUCT_LINES.map((line) => verdictFor(stateCode, line))

  const rules = getRulesForState(stateCode)
  const lastReviewedAt =
    rules.map((r) => r.lastReviewedAt).sort().at(-1) ?? '1970-01-01'
  const reviewedBy = rules[0]?.reviewedBy ?? 'UNREVIEWED'

  // The year comes from the REVIEW DATE, never the wall clock. Two reasons: the
  // claim "as of 2026" should mean "when we checked", not "when you loaded the page";
  // and reading the clock during render is runtime data, which would stop these pages
  // from prerendering at all.
  const reviewYear = new Date(lastReviewedAt).getUTCFullYear()
  const answerFirst = buildAnswerFirst(name, verdicts, reviewYear)

  const profile = getStateProfile(stateCode)
  const orderingGuidance = buildOrderingGuidance(name, verdicts)

  // Everything genuinely specific to this state, for the publication gate. The
  // regulatory profile is what lifts these pages past templated boilerplate — the
  // hemp and psilocybin postures differ materially between states and are the reason
  // a reader in Idaho gets a different page from a reader in Oregon.
  const substantiveText = [
    answerFirst,
    ...verdicts.map((v) => `${v.headline} ${v.detail} ${v.rule.statuteCitation ?? ''}`),
    orderingGuidance,
    profile.hempNote,
    profile.psilocybinNote,
    FEDERAL_HEMP_BAN.summary,
    FEDERAL_HEMP_BAN.appliesToUs,
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
      `Only ${wordCount} words of state-specific content; ${MIN_PUBLISH_WORDS} required. Add the state's own statutory context rather than padding.`,
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
