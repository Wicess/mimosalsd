import 'server-only'
import { cookies } from 'next/headers'
import { db } from '@/lib/db/client'
import { isSchemaBehindError } from '@/lib/db/errors'
import { ATTRIBUTION_COOKIE, parseAttribution } from './attribution'

/**
 * Who, if anyone, should be credited with the order being placed right now.
 *
 * Reads the cookie a tracking link left behind, checks it is still inside the
 * window, and resolves the link to its promoter. A link that has since been
 * deleted credits nobody; a link with no promoter still records which link the
 * order followed, which is what the tracking-links page counts.
 *
 * Never throws: an order must not fail because attribution could not be worked
 * out. Schema lag is caught too, so a deploy that lands before migration 0013
 * takes orders as usual, simply without credit.
 */
export interface OrderCredit {
  readonly linkSlug: string
  readonly promoterId: string | null
  readonly at: string
}

export async function creditForOrder(now: Date): Promise<OrderCredit | null> {
  try {
    const raw = (await cookies()).get(ATTRIBUTION_COOKIE)?.value
    const click = parseAttribution(raw, now)
    if (!click) return null

    const link = await db.trackingLink.findUnique({
      where: { slug: click.slug },
      select: { slug: true, promoterId: true },
    })
    if (!link) return null
    return { linkSlug: link.slug, promoterId: link.promoterId, at: click.at.toISOString() }
  } catch (error) {
    if (isSchemaBehindError(error)) return null
    // Any other failure is still not worth losing an order over.
    return null
  }
}
