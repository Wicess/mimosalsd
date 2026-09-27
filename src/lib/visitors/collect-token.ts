import { createHmac, timingSafeEqual } from 'node:crypto'

/**
 * Proof that a batch of page views came from this deployment's own proxy.
 *
 * The collection endpoint writes to the database, so it cannot be open to the
 * internet: anyone could otherwise fill the table with invented visits. The token
 * derives from the session secret, as the blocklist's does, so there is no new
 * secret to configure or rotate.
 */
export const VISITS_PATH = '/api/visits/collect'
export const VISITS_TOKEN_HEADER = 'x-visits-token'

export function visitsToken(secret: string): string {
  return createHmac('sha256', secret).update('visits:v1').digest('base64url')
}

export function visitsTokenMatches(given: string | null, secret: string | undefined): boolean {
  if (!secret || secret.length < 32) return false
  const a = Buffer.from(given ?? '')
  const b = Buffer.from(visitsToken(secret))
  return a.length === b.length && timingSafeEqual(a, b)
}
