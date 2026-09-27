import 'server-only'
import { db } from '@/lib/db/client'
import { linkSecret, verifyUnsubscribeToken } from './unsubscribe'

/**
 * The one place an unsubscribe happens, for the page's button and the one-click
 * endpoint alike. Soft, like the admin's: `isActive` goes false and the time is
 * kept, so the record shows when someone opted out if anyone ever asks.
 */
export type UnsubscribeOutcome = 'done' | 'already' | 'invalid'

export async function unsubscribeWithToken(subscriberId: string, token: string): Promise<UnsubscribeOutcome> {
  const secret = linkSecret()
  if (!secret || !verifyUnsubscribeToken(subscriberId, token, secret)) return 'invalid'
  const { count } = await db.newsletterSubscriber.updateMany({
    where: { id: subscriberId, isActive: true },
    data: { isActive: false, unsubscribedAt: new Date() },
  })
  if (count > 0) return 'done'
  const exists = await db.newsletterSubscriber.count({ where: { id: subscriberId } })
  return exists > 0 ? 'already' : 'invalid'
}

/** Who a valid link belongs to, masked — enough to recognise, not to harvest. */
export async function subscriberForLink(
  subscriberId: string,
  token: string,
): Promise<{ masked: string; active: boolean } | null> {
  const secret = linkSecret()
  if (!secret || !verifyUnsubscribeToken(subscriberId, token, secret)) return null
  const row = await db.newsletterSubscriber.findUnique({
    where: { id: subscriberId },
    select: { email: true, isActive: true },
  })
  return row ? { masked: maskEmail(row.email), active: row.isActive } : null
}

/** "jane.doe@example.com" → "j•••e@example.com". */
export function maskEmail(email: string): string {
  const [local = '', domain = ''] = email.split('@')
  const shown = local.length <= 2 ? `${local[0] ?? ''}•••` : `${local[0]}•••${local.at(-1)}`
  return domain ? `${shown}@${domain}` : shown
}
