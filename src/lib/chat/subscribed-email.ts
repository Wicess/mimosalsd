import 'server-only'
import { db } from '@/lib/db/client'

/**
 * The email this browser joined the list with, when it is still on it.
 *
 * Owner, 2026-11-03: a visitor who has already subscribed is not asked for their
 * email again in the chat. The sign-up records `SUBSCRIBED` against the visitor
 * cookie with the address as its detail (actions/newsletter.ts), so the chat can
 * reuse it: the email field is hidden, and the first message attaches this address
 * to the conversation exactly as a typed one would.
 *
 * Only an address that is still an active subscriber counts. One that unsubscribed
 * is asked for again, rather than having a conversation quietly bound to an address
 * its owner has since asked us to stop writing to.
 *
 * Never throws: on any failure the chat simply asks for the email, as it always has.
 */
export async function subscribedEmail(visitor: string | null): Promise<string | null> {
  if (!visitor) return null
  try {
    const signup = await db.visitorActivity.findFirst({
      where: { visitorId: visitor, kind: 'SUBSCRIBED', detail: { not: null } },
      orderBy: { createdAt: 'desc' },
      select: { detail: true },
    })
    const email = signup?.detail?.trim().toLowerCase()
    if (!email) return null
    const subscriber = await db.newsletterSubscriber.findUnique({
      where: { email },
      select: { isActive: true },
    })
    return subscriber?.isActive ? email : null
  } catch {
    return null
  }
}
