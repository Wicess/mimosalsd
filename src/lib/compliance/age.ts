import { z } from 'zod'

/**
 * Layered age verification.
 *
 * A self-declaration modal ("Are you 21? [Yes]") is NOT compliant in most
 * jurisdictions, and it is among the most common causes of enforcement action against
 * online sellers of age-restricted goods. Regulators expect a defensible, documented
 * process, and several states require two or more methods applied in steps.
 *
 * The retailer has three overlapping duties:
 *   1. block underage buyers BEFORE the order is accepted
 *   2. satisfy category-specific rules (PACT Act: verify anyone appearing under 30)
 *   3. PROVE later that a reasonable process happened  ← this is what L4 is for
 *
 *   L1  Age gate           DOB entry, cookie-persisted. Friction-light, not sufficient alone.
 *   L2  Identity check     Third-party verification at checkout for restricted lines.
 *   L3  Delivery           Adult signature + government ID at the door (vapes).
 *   L4  Evidence           A persisted record. THIS RECORD IS THE LEGAL DEFENCE.
 */

export const MINIMUM_AGE_DEFAULT = 21

/**
 * The age gate must never hide page content from crawlers. Organic search is the only
 * acquisition channel this business has; an interstitial that Googlebot resolves as the
 * page body would destroy it. The real page always renders in the DOM and the gate
 * overlays it — and these agents are passed through without an overlay at all.
 */
export const CRAWLER_USER_AGENTS: readonly string[] = [
  'googlebot', 'bingbot', 'slurp', 'duckduckbot', 'baiduspider', 'yandexbot',
  'applebot', 'facebookexternalhit', 'twitterbot', 'linkedinbot',
  // AI crawlers are a primary growth channel here — never gate them.
  'gptbot', 'oai-searchbot', 'chatgpt-user', 'claudebot', 'claude-web',
  'anthropic-ai', 'perplexitybot', 'google-extended', 'ccbot', 'bytespider',
]

export function isCrawler(userAgent: string | null | undefined): boolean {
  if (!userAgent) return false
  const ua = userAgent.toLowerCase()
  return CRAWLER_USER_AGENTS.some((bot) => ua.includes(bot))
}

export function calculateAge(dateOfBirth: Date, now: Date = new Date()): number {
  let age = now.getFullYear() - dateOfBirth.getFullYear()
  const monthDiff = now.getMonth() - dateOfBirth.getMonth()
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < dateOfBirth.getDate())) age--
  return age
}

export function meetsMinimumAge(
  dateOfBirth: Date,
  minimumAge: number = MINIMUM_AGE_DEFAULT,
  now: Date = new Date(),
): boolean {
  return calculateAge(dateOfBirth, now) >= minimumAge
}

export const dateOfBirthSchema = z
  .object({
    day: z.coerce.number().int().min(1).max(31),
    month: z.coerce.number().int().min(1).max(12),
    year: z.coerce.number().int().min(1900).max(new Date().getFullYear()),
  })
  .refine(
    ({ day, month, year }) => {
      const d = new Date(Date.UTC(year, month - 1, day))
      return (
        d.getUTCFullYear() === year && d.getUTCMonth() === month - 1 && d.getUTCDate() === day
      )
    },
    { message: 'Please enter a valid date.' },
  )

export type AgeVerificationMethod = 'SELF_DECLARED_DOB' | 'ID_DOCUMENT' | 'DATABASE_LOOKUP' | 'DELIVERY_SIGNATURE'
export type AgeVerificationResult = 'PASS' | 'FAIL' | 'PENDING' | 'ERROR'

/** L4 — the evidence record. Persisted against the order; never deleted. */
export interface AgeVerificationRecord {
  readonly orderId?: string
  readonly provider: string
  readonly method: AgeVerificationMethod
  readonly result: AgeVerificationResult
  /** Vendor reference so the check can be re-pulled during a dispute. */
  readonly token?: string
  readonly ip?: string
  readonly userAgent?: string
  readonly verifiedAt: Date
}

export interface AgeVerifyRequest {
  readonly firstName: string
  readonly lastName: string
  readonly dateOfBirth: Date
  readonly addressLine1: string
  readonly city: string
  readonly stateCode: string
  readonly postalCode: string
  readonly minimumAge: number
  readonly ip?: string
  readonly userAgent?: string
}

/**
 * Vendor-agnostic by design. AgeChecker, BlueCheck, Persona and Token of Trust all fit
 * this shape, and the business should be able to switch on price or coverage without
 * touching checkout.
 */
export interface AgeVerifier {
  readonly name: string
  verify(request: AgeVerifyRequest): Promise<AgeVerificationRecord>
}

/**
 * Development stub. Applies the DOB arithmetic only — no identity check.
 *
 * It refuses to run outside development precisely because a silent fallback to a
 * self-declaration check in production is the exact failure mode regulators penalise.
 */
export class StubAgeVerifier implements AgeVerifier {
  readonly name = 'stub'

  async verify(request: AgeVerifyRequest): Promise<AgeVerificationRecord> {
    if (process.env.NODE_ENV === 'production') {
      throw new Error(
        'StubAgeVerifier must never run in production. Configure AGE_VERIFY_PROVIDER with a real vendor.',
      )
    }
    const pass = meetsMinimumAge(request.dateOfBirth, request.minimumAge)
    return {
      provider: this.name,
      method: 'SELF_DECLARED_DOB',
      result: pass ? 'PASS' : 'FAIL',
      ...(request.ip ? { ip: request.ip } : {}),
      ...(request.userAgent ? { userAgent: request.userAgent } : {}),
      verifiedAt: new Date(),
    }
  }
}

export function createAgeVerifier(provider = process.env.AGE_VERIFY_PROVIDER): AgeVerifier {
  switch (provider) {
    case 'stub':
    case undefined:
      return new StubAgeVerifier()
    default:
      // Vendor adapters land here in Step 12. Fail loudly rather than silently
      // downgrading to the stub.
      throw new Error(`Unknown age verification provider: "${provider}"`)
  }
}
