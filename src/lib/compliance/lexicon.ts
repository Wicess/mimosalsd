import type { ProductLine } from './types'

/**
 * ─────────────────────────────────────────────────────────────────────────────
 *  THE BANNED-TERMS LEXICON
 *
 *  This is the highest-value piece of code in the project. It is the mechanism that
 *  keeps two separate legal exposures closed:
 *
 *   1. Mimosa Hostilis is lawful to sell ONLY as a non-consumable botanical. Any
 *      language implying ingestion, preparation or extraction moves the product from
 *      "botanical dye material" to something else entirely.
 *
 *   2. Amanita muscaria is federally unscheduled, but the FDA has broad authority over
 *      unapproved new drugs. A single health claim — even one as soft as "promotes
 *      sleep" — can reclassify the product. This is precisely how the FDA proceeded
 *      against CBD, kratom and delta-8 sellers.
 *
 *  Enforced in four places:
 *    · CI, over all content files          (scripts/compliance-scan.ts)
 *    · the admin editor, blocking publish  (Step 18)
 *    · the review-moderation queue         (Step 18)
 *    · AI-assisted drafts                  (no exception)
 *
 *  ESCAPE HATCH — read this before adding one.
 *  Some blocked words appear legitimately in legal quotation. The /legality pages must
 *  be able to quote the FDA's own December 2024 language about Amanita "extracts", and
 *  the Louisiana statute concerns "human consumption". Rather than weaken the rules, an
 *  author marks the specific span:
 *
 *      <!-- compliance-allow: extract, consumption -- quoting FDA statement -->
 *
 *  The directive must name each term and must carry a reason after `--`. It applies to
 *  the whole file. Unjustified or unparseable directives are themselves a CI failure,
 *  so the hatch cannot quietly become the norm.
 * ─────────────────────────────────────────────────────────────────────────────
 */

export type Severity = 'BLOCK' | 'WARN'

export interface LexiconEntry {
  /** Matched case-insensitively, on word boundaries. */
  readonly term: string
  readonly severity: Severity
  /** Shown to the author. Must explain the risk, not just say "banned". */
  readonly reason: string
  /**
   * Undefined = applies sitewide. Otherwise only on surfaces for these product lines.
   */
  readonly scope?: readonly ProductLine[]
  /** Suggested compliant alternative, where one exists. */
  readonly suggestion?: string
  /**
   * May be written ABOUT, in copy that also says plainly we do not sell it.
   *
   * Only the controlled-substance names carry this. Naming one on a product or a
   * category is an offer to sell it; naming one in a guide that says "we do not sell
   * LSD" is the opposite, and the site could not say even that while the name was
   * blocked everywhere. On an editorial surface with the disclaimer present, these
   * drop to a warning the author still sees; everywhere else they block, as before.
   */
  readonly writableAboutWhenDisclaimed?: boolean
}

const MHRB: readonly ProductLine[] = ['MIMOSA_HOSTILIS']

/**
 * Tier 1 — Mimosa Hostilis. Consumption and extraction language.
 * Note the deliberate omission of the compound name itself from any marketing surface:
 * the best-run competitor in this space never mentions it at all, and neither do we.
 */
const MHRB_TERMS: readonly LexiconEntry[] = [
  { term: 'DMT', severity: 'BLOCK', scope: MHRB, reason: 'Names a Schedule I substance in connection with a product we sell as a botanical dye material.' },
  { term: 'N,N-DMT', severity: 'BLOCK', scope: MHRB, reason: 'Names a Schedule I substance.' },
  { term: 'dimethyltryptamine', severity: 'BLOCK', scope: MHRB, reason: 'Names a Schedule I substance.' },
  { term: 'ayahuasca', severity: 'BLOCK', scope: MHRB, reason: 'Implies a consumption preparation.' },
  { term: 'changa', severity: 'BLOCK', scope: MHRB, reason: 'Implies a consumption preparation.' },
  { term: 'extraction', severity: 'BLOCK', scope: MHRB, reason: 'Extraction of the naturally occurring alkaloid is a federal felony. No page may reference it.' },
  { term: 'extract', severity: 'BLOCK', scope: MHRB, reason: 'Implies alkaloid extraction.', suggestion: 'Describe the dye or soap-making process instead.' },
  { term: 'extracting', severity: 'BLOCK', scope: MHRB, reason: 'Implies alkaloid extraction.' },
  { term: 'tek', severity: 'BLOCK', scope: MHRB, reason: 'Community shorthand for an extraction procedure.' },
  { term: 'brew', severity: 'BLOCK', scope: MHRB, reason: 'Implies preparation for consumption.' },
  { term: 'brewing', severity: 'BLOCK', scope: MHRB, reason: 'Implies preparation for consumption.' },
  { term: 'tea', severity: 'BLOCK', scope: MHRB, reason: 'Implies preparation for consumption.', suggestion: 'If describing a dye bath, say "dye bath".' },
  { term: 'steep', severity: 'WARN', scope: MHRB, reason: 'Ambiguous — acceptable for a dye bath, not for a beverage. Rephrase to make the dye context explicit.' },
  { term: 'yield', severity: 'BLOCK', scope: MHRB, reason: 'Community shorthand for extraction output.', suggestion: 'For dye strength, say "color depth" or "pigment strength".' },
  { term: 'ingest', severity: 'BLOCK', scope: MHRB, reason: 'This product is not for human consumption.' },
  { term: 'ingestion', severity: 'BLOCK', scope: MHRB, reason: 'This product is not for human consumption.' },
  { term: 'consume', severity: 'BLOCK', scope: MHRB, reason: 'This product is not for human consumption.' },
  { term: 'consumption', severity: 'BLOCK', scope: MHRB, reason: 'This product is not for human consumption.' },
  { term: 'edible', severity: 'BLOCK', scope: MHRB, reason: 'This product is not for human consumption.' },
  { term: 'trip', severity: 'BLOCK', scope: MHRB, reason: 'Implies psychoactive use.' },
  { term: 'psychoactive', severity: 'BLOCK', scope: MHRB, reason: 'Implies psychoactive use of a product sold as a dye material.' },
  { term: 'entheogen', severity: 'BLOCK', scope: MHRB, reason: 'Implies ritual consumption.' },
  { term: 'entheogenic', severity: 'BLOCK', scope: MHRB, reason: 'Implies ritual consumption.' },
]

/**
 * Tier 2 — sitewide health, medical and therapeutic claims. These apply to marketing
 * copy, blog posts, product descriptions AND customer reviews. A review saying a
 * product "cured my anxiety" creates the same FDA exposure as an advertisement.
 */
const HEALTH_CLAIM_TERMS: readonly LexiconEntry[] = [
  { term: 'cure', severity: 'BLOCK', reason: 'Disease claim. Renders the product an unapproved new drug under FDA authority.' },
  { term: 'cures', severity: 'BLOCK', reason: 'Disease claim.' },
  { term: 'treat', severity: 'BLOCK', reason: 'Disease claim.' },
  { term: 'treats', severity: 'BLOCK', reason: 'Disease claim.' },
  { term: 'treatment', severity: 'BLOCK', reason: 'Disease claim.' },
  { term: 'heal', severity: 'BLOCK', reason: 'Disease claim.' },
  { term: 'heals', severity: 'BLOCK', reason: 'Disease claim.' },
  { term: 'healing', severity: 'BLOCK', reason: 'Disease claim.' },
  { term: 'prevent', severity: 'BLOCK', reason: 'Disease claim.' },
  { term: 'prevents', severity: 'BLOCK', reason: 'Disease claim.' },
  { term: 'remedy', severity: 'BLOCK', reason: 'Disease claim.' },
  { term: 'therapeutic', severity: 'BLOCK', reason: 'Drug claim.' },
  { term: 'therapy', severity: 'BLOCK', reason: 'Drug claim.' },
  { term: 'medicine', severity: 'BLOCK', reason: 'Drug claim.' },
  { term: 'medicinal', severity: 'BLOCK', reason: 'Drug claim.' },
  { term: 'prescription', severity: 'BLOCK', reason: 'Drug claim.' },
  { term: 'clinically proven', severity: 'BLOCK', reason: 'Unsubstantiated efficacy claim.' },
  { term: 'FDA approved', severity: 'BLOCK', reason: 'False. The FDA has not authorised these products, and it stated in December 2024 that Amanita muscaria is not authorised for use in conventional food.' },
  { term: 'FDA-approved', severity: 'BLOCK', reason: 'False — see FDA approved.' },
  // Named conditions — the highest-risk category of all.
  { term: 'anxiety', severity: 'BLOCK', reason: 'Names a medical condition.' },
  { term: 'depression', severity: 'BLOCK', reason: 'Names a medical condition.' },
  { term: 'depressed', severity: 'BLOCK', reason: 'Names a medical condition.' },
  { term: 'PTSD', severity: 'BLOCK', reason: 'Names a medical condition.' },
  { term: 'insomnia', severity: 'BLOCK', reason: 'Names a medical condition.' },
  { term: 'ADHD', severity: 'BLOCK', reason: 'Names a medical condition.' },
  { term: 'addiction', severity: 'BLOCK', reason: 'Names a medical condition.' },
  { term: 'chronic pain', severity: 'BLOCK', reason: 'Names a medical condition.' },
  { term: 'inflammation', severity: 'BLOCK', reason: 'Names a medical condition.' },
  { term: 'cancer', severity: 'BLOCK', reason: 'Names a medical condition.' },
  // Soft-benefit claims. These read as harmless and are exactly what regulators cite.
  { term: 'promotes sleep', severity: 'BLOCK', reason: 'A structure/function claim of precisely the kind the FDA has treated as evidence of drug intent.' },
  { term: 'relieves', severity: 'BLOCK', reason: 'Implied therapeutic benefit.' },
  { term: 'reduces stress', severity: 'BLOCK', reason: 'Implied therapeutic benefit.' },
  { term: 'boosts immunity', severity: 'BLOCK', reason: 'Implied therapeutic benefit.' },
  { term: 'health benefits', severity: 'BLOCK', reason: 'Implied therapeutic benefit.' },
  { term: 'beneficial effects', severity: 'BLOCK', reason: 'Implied therapeutic benefit. A market leader uses this phrasing verbatim; we do not.' },
  { term: 'euphoria', severity: 'BLOCK', reason: 'Effect claim that invites both FDA and state scrutiny.' },
  { term: 'euphoric', severity: 'BLOCK', reason: 'Effect claim.' },
  // "high" on its own was tried and removed: it fires on "high tannin content",
  // "price: low to high" and "high quality", so it cried wolf constantly. A rule that
  // is routinely overridden is worse than no rule — it manufactures false confidence.
  // These target the actual risky phrasings instead.
  { term: 'get you high', severity: 'BLOCK', reason: 'Effect claim.' },
  { term: 'gets you high', severity: 'BLOCK', reason: 'Effect claim.' },
  { term: 'get high', severity: 'BLOCK', reason: 'Effect claim.' },
  { term: 'feel high', severity: 'BLOCK', reason: 'Effect claim.' },
  { term: 'microdose', severity: 'BLOCK', reason: 'Dosing guidance for an unapproved product.' },
  { term: 'microdosing', severity: 'BLOCK', reason: 'Dosing guidance for an unapproved product.' },
  { term: 'dosage', severity: 'WARN', reason: 'Acceptable only when restating a manufacturer serving size, never as a recommendation.' },
  { term: 'magic mushroom', severity: 'BLOCK', reason: 'Conflates our lawful Amanita products with psilocybin, which is a Schedule I substance.' },
  { term: 'psilocybin', severity: 'BLOCK', reason: 'A Schedule I substance we do not sell. Permitted only in explicitly comparative educational content, via an allow directive.' },
  { term: 'psilocin', severity: 'BLOCK', reason: 'A Schedule I substance we do not sell.' },
  { term: 'shrooms', severity: 'WARN', reason: 'Slang that conflates our products with psilocybin. Prefer "Amanita muscaria".' },
]

/**
 * Tier 3 — Controlled substances, sitewide.
 *
 * Nothing sold here is, contains or substitutes for a controlled substance, and
 * copy that names one on a product, a category or a review reads as an offer to
 * sell it. This tier exists because products can now be posted from the admin
 * panel, where CI never looks: the form's scan is the only gate that copy meets.
 *
 * `DMT` is here as well as in the MHRB tier. That tier only runs on root-bark
 * surfaces, and the name has no business on any other surface either.
 */
const CONTROLLED_SUBSTANCE_REASON =
  'Names a substance controlled under the federal Controlled Substances Act (21 U.S.C. § 812). Nothing sold here is, contains or substitutes for one, and copy that suggests otherwise reads as an offer to sell it.'

const CONTROLLED_SUBSTANCE_TERMS: readonly LexiconEntry[] = [
  'LSD',
  'lysergic',
  'acid tab',
  'acid tabs',
  'MDMA',
  'mescaline',
  'peyote',
  'ketamine',
  'psilocybe',
  'magic mushrooms',
  'DMT',
  'dimethyltryptamine',
].map((term) => ({
  term,
  severity: 'BLOCK' as const,
  reason: CONTROLLED_SUBSTANCE_REASON,
  writableAboutWhenDisclaimed: true,
}))

export const LEXICON: readonly LexiconEntry[] = [
  ...MHRB_TERMS,
  ...HEALTH_CLAIM_TERMS,
  ...CONTROLLED_SUBSTANCE_TERMS,
]

export interface LexiconMatch {
  readonly term: string
  readonly severity: Severity
  readonly reason: string
  readonly suggestion?: string
  /** 0-based character offset in the scanned text. */
  readonly index: number
  /** 1-based line number. */
  readonly line: number
  /** The surrounding text, for the author to locate it. */
  readonly excerpt: string
}

export interface ScanOptions {
  /**
   * Which product lines this surface concerns. Line-scoped terms are only enforced
   * for lines listed here. Sitewide terms always apply. Omit for a sitewide surface.
   */
  readonly productLines?: readonly ProductLine[]
  /** Include WARN matches. Default true. */
  readonly includeWarnings?: boolean
  /**
   * Additional allowed terms, for callers that scan a TRANSFORMED copy of a file.
   * The CI scanner strips comments from code before matching, which would also strip
   * the `compliance-allow` directives — so it parses them from the raw source and
   * passes them through here.
   */
  readonly extraAllowedTerms?: readonly string[]
  /**
   * Whether `compliance-allow` directives inside the text are obeyed. Default true.
   *
   * Pass false for anything an operator types into the admin panel. In the
   * repository a directive is reviewable in the diff; in a form field it is a
   * switch that turns the gate off, typed by the person the gate exists to check.
   */
  readonly honourDirectives?: boolean
  /**
   * An editorial surface: a guide, a blog post or an FAQ answer — copy that informs
   * rather than sells. Never pass this for a product, a category, a bulk enquiry, a
   * notification, a review or a chat reply.
   *
   * On such a surface, a controlled substance may be written ABOUT when the copy also
   * carries one of NOT_SOLD_DISCLAIMERS. The match becomes a warning rather than a
   * block, so the author still sees it and so does the moderation queue.
   */
  readonly editorial?: boolean
}

/**
 * Saying plainly that we do not sell the thing being written about.
 *
 * One of these has to appear in an editorial page for a controlled substance to be
 * named in it. It is deliberately an explicit sentence rather than a checkbox: the
 * disclaimer is what makes the mention lawful to publish, so it has to be in the copy
 * the reader sees, not in a setting.
 */
export const NOT_SOLD_DISCLAIMERS: readonly string[] = [
  'we do not sell',
  'we don’t sell',
  "we don't sell",
  'is not sold here',
  'are not sold here',
  'not sold on this site',
  'we do not stock',
  'we do not supply',
]

export function hasNotSoldDisclaimer(text: string): boolean {
  const flat = text.toLowerCase().replace(/\s+/g, ' ')
  return NOT_SOLD_DISCLAIMERS.some((phrase) => flat.includes(phrase.toLowerCase()))
}

export interface ScanResult {
  readonly matches: readonly LexiconMatch[]
  readonly blocking: readonly LexiconMatch[]
  readonly warnings: readonly LexiconMatch[]
  /** True when nothing blocks publication. */
  readonly clean: boolean
  readonly allowedTerms: readonly string[]
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Phrases that are REQUIRED compliance language, or standard neutral product copy, and
 * must never be flagged.
 *
 * Without this, the scanner flags our own mandated disclaimer — "not sold for human
 * consumption" trips the `consumption` rule — and authors quickly learn to override it.
 * A compliance check that is routinely overridden is worse than none, because it
 * manufactures false confidence. These are masked before matching, preserving character
 * offsets so line numbers stay accurate.
 */
export const SAFE_PHRASES: readonly string[] = [
  'not for human consumption',
  'not sold for human consumption',
  'not intended for human consumption',
  'unlawful when intended for human consumption',
  'illegal when intended for human consumption',
  'prohibited for human consumption',
  'is not food',
  'not intended to diagnose, mitigate, or prevent any disease',
  // Disclaiming a claim is the opposite of making one. Canonical wording, reused.
  'make no health, medical or therapeutic claims',
  'makes no health, medical or therapeutic claims',
  'no therapeutic claims',
  'no medical or therapeutic claims',
]

function maskSafePhrases(text: string): string {
  let masked = text
  for (const phrase of SAFE_PHRASES) {
    const pattern = new RegExp(`\\b${escapeRegExp(phrase).replace(/\s+/g, '\\s+')}\\b`, 'gi')
    // Replace with same-length filler so indices and line numbers are unchanged.
    masked = masked.replace(pattern, (m) => '\u0000'.repeat(m.length))
  }
  return masked
}

const ALLOW_DIRECTIVE = /compliance-allow:\s*([^-\n]+?)\s*--\s*(.+?)(?:\s*-->|\n|$)/gi

/**
 * Parse `<!-- compliance-allow: term, term -- reason -->` directives.
 * A directive without a reason is ignored, so an author cannot silence a rule by
 * accident — they have to say why in writing, and that reason is reviewable in the diff.
 */
export function parseAllowDirectives(text: string): string[] {
  const allowed: string[] = []
  for (const match of text.matchAll(ALLOW_DIRECTIVE)) {
    const terms = match[1]
    const reason = match[2]
    if (!terms || !reason || reason.trim().length < 3) continue
    for (const term of terms.split(',')) {
      const t = term.trim().toLowerCase()
      if (t) allowed.push(t)
    }
  }
  return allowed
}

/**
 * Word-boundary matching matters more than it looks. Without it, "heal" matches
 * "health", "cure" matches "secure", and "high" matches "highlight" — the scanner
 * would cry wolf constantly and authors would learn to ignore it. A compliance check
 * that is routinely overridden is worse than none, because it manufactures false
 * confidence.
 */
function buildMatcher(term: string): RegExp {
  return new RegExp(`\\b${escapeRegExp(term).replace(/\s+/g, '\\s+')}\\b`, 'gi')
}

export function scanText(text: string, options: ScanOptions = {}): ScanResult {
  const {
    productLines,
    includeWarnings = true,
    extraAllowedTerms = [],
    honourDirectives = true,
    editorial = false,
  } = options
  // Written about, not offered: only on an editorial surface, and only when the copy
  // says we do not sell it.
  const writableAbout = editorial && hasNotSoldDisclaimer(text)
  const allowed = new Set([
    ...(honourDirectives ? parseAllowDirectives(text) : []),
    ...extraAllowedTerms.map((t) => t.toLowerCase()),
  ])
  const matches: LexiconMatch[] = []
  // Match against the masked copy; report excerpts from the original so the author
  // sees their real text.
  const haystack = maskSafePhrases(text)

  // Precompute line starts once rather than per match.
  const lineStarts: number[] = [0]
  for (let i = 0; i < text.length; i++) {
    if (text[i] === '\n') lineStarts.push(i + 1)
  }
  const lineFor = (index: number): number => {
    let lo = 0
    let hi = lineStarts.length - 1
    while (lo < hi) {
      const mid = Math.ceil((lo + hi) / 2)
      if ((lineStarts[mid] ?? 0) <= index) lo = mid
      else hi = mid - 1
    }
    return lo + 1
  }

  for (const entry of LEXICON) {
    if (allowed.has(entry.term.toLowerCase())) continue
    if (entry.scope && !entry.scope.some((l) => productLines?.includes(l))) continue
    if (!includeWarnings && entry.severity === 'WARN') continue

    for (const m of haystack.matchAll(buildMatcher(entry.term))) {
      const index = m.index ?? 0
      const severity: Severity =
        writableAbout && entry.writableAboutWhenDisclaimed ? 'WARN' : entry.severity
      if (!includeWarnings && severity === 'WARN') continue
      matches.push({
        term: entry.term,
        severity,
        reason: entry.reason,
        ...(entry.suggestion ? { suggestion: entry.suggestion } : {}),
        index,
        line: lineFor(index),
        excerpt: text.slice(Math.max(0, index - 40), index + entry.term.length + 40).replace(/\s+/g, ' ').trim(),
      })
    }
  }

  matches.sort((a, b) => a.index - b.index)
  const blocking = matches.filter((m) => m.severity === 'BLOCK')
  return {
    matches,
    blocking,
    warnings: matches.filter((m) => m.severity === 'WARN'),
    clean: blocking.length === 0,
    allowedTerms: [...allowed],
  }
}

/** Convenience wrapper for the review-moderation queue (Step 18). */
export function scanReview(body: string): ScanResult {
  /*
    NEVER honour directives here. This scans what CUSTOMERS write — reviews, contact
    messages, chat — which is the least trusted text on the site. With directives
    honoured, a customer who types `compliance-allow: cure -- x` into a review
    suppresses the very flag the moderation queue depends on, and a health claim
    reaches the approve button unmarked (CLAUDE.md rule 5). Ignoring directives can
    only ever produce MORE flags, never fewer, so no caller can be broken by it.
  */
  return scanText(body, { includeWarnings: true, honourDirectives: false })
}

/** Human-readable report used by CI and by the admin editor. */
export function formatScanResult(result: ScanResult, label = 'content'): string {
  if (result.matches.length === 0) return `✓ ${label}: clean`
  const lines = result.matches.map(
    (m) =>
      `  ${m.severity === 'BLOCK' ? '✗' : '⚠'} line ${m.line}  "${m.term}" — ${m.reason}` +
      (m.suggestion ? `\n      → ${m.suggestion}` : '') +
      `\n      …${m.excerpt}…`,
  )
  return `${result.clean ? '⚠' : '✗'} ${label}: ${result.blocking.length} blocking, ${result.warnings.length} warning\n${lines.join('\n')}`
}
