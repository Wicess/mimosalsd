import { createHmac, timingSafeEqual } from 'node:crypto'
import { absoluteUrl } from '@/lib/seo/routes'

/**
 * ─────────────────────────────────────────────────────────────────────────────
 *  UNSUBSCRIBE LINKS — signed, addressed by subscriber id.
 *
 *  Every blast carries two: a page with a button, for people, and a one-click
 *  endpoint for mail clients (RFC 8058), which Gmail and Yahoo require of bulk
 *  senders. The page asks before it acts because link scanners — Outlook's Safe
 *  Links and the like — open every URL in a message, and a GET that unsubscribed
 *  would quietly unsubscribe everyone behind one. The one-click endpoint takes
 *  POST only, which scanners do not send.
 *
 *  ── Why signed, and why by id ──────────────────────────────────────────────
 *  The token is an HMAC of the subscriber's id, so nobody can unsubscribe someone
 *  else by guessing, and the id keeps email addresses out of URLs and request logs.
 *  The key derives from ADMIN_SESSION_SECRET, so there is nothing new to configure.
 *  The cost: rotating that secret breaks unsubscribe links in mail already sent.
 *  The page then tells the reader to write in, and every blast replies to the
 *  support inbox, so the request still reaches a person.
 * ─────────────────────────────────────────────────────────────────────────────
 */

export function unsubscribeToken(subscriberId: string, secret: string): string {
  return createHmac('sha256', secret).update(`unsubscribe:v1:${subscriberId}`).digest('base64url')
}

export function verifyUnsubscribeToken(subscriberId: string, token: string, secret: string): boolean {
  if (!subscriberId || !token || secret.length < 32) return false
  const expected = Buffer.from(unsubscribeToken(subscriberId, secret))
  const given = Buffer.from(token)
  return given.length === expected.length && timingSafeEqual(given, expected)
}

/** The secret, or null when the admin — and so every signing key — is not configured. */
export function linkSecret(): string | null {
  const secret = process.env.ADMIN_SESSION_SECRET
  return secret && secret.length >= 32 ? secret : null
}

export interface UnsubscribeLinks {
  /** For people: shows a confirmation button. */
  readonly page: string
  /** For mail clients: POST, RFC 8058 one-click. */
  readonly oneClick: string
}

export function unsubscribeLinks(subscriberId: string, secret: string): UnsubscribeLinks {
  const query = new URLSearchParams({ s: subscriberId, t: unsubscribeToken(subscriberId, secret) })
  return {
    page: absoluteUrl(`/unsubscribe?${query}`),
    oneClick: absoluteUrl(`/api/newsletter/unsubscribe?${query}`),
  }
}
