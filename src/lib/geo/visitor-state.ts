import { cookies, headers } from 'next/headers'
import { getJurisdiction } from '@/lib/compliance/jurisdictions'
import type { UsJurisdictionCode } from '@/lib/compliance/types'

export const STATE_COOKIE = 'ship-state'

/**
 * Resolve the visitor's jurisdiction.
 *
 * Order matters: an explicit choice always beats a geo guess. IP geolocation is
 * frequently wrong — VPNs, mobile carrier egress, corporate proxies — and being told
 * "we can't ship to Louisiana" when you live in Texas is a lost sale plus a support
 * ticket. So the cookie wins, and the UI always exposes a way to change it.
 *
 * Returns undefined rather than defaulting to a state. Guessing wrong here means
 * either showing someone products we cannot send them, or hiding products we can.
 */
export async function getVisitorState(): Promise<UsJurisdictionCode | undefined> {
  const chosen = (await cookies()).get(STATE_COOKIE)?.value
  if (chosen) {
    const jurisdiction = getJurisdiction(chosen)
    if (jurisdiction) return jurisdiction.code
  }

  // Vercel edge geolocation. Absent locally and in most CI environments.
  const region = (await headers()).get('x-vercel-ip-country-region')
  const country = (await headers()).get('x-vercel-ip-country')
  if (country === 'US' && region) {
    return getJurisdiction(region)?.code
  }

  return undefined
}
