import { randomInt } from 'node:crypto'

/**
 * Live chat — the pure rules.
 *
 * Ported from WHAM's `lib/chat.ts`, split so that everything that decides what a
 * customer sees can be tested without a database, a cookie or a clock.
 */

export type ChatSender = 'CUSTOMER' | 'ADMIN'

/** Longest message accepted. Generous for chat, bounded for the database. */
export const MAX_BODY = 4000

/**
 * How recently an operator must have touched the inbox to count as online.
 *
 * WHAM's figure. The inbox heartbeats inside this window while it is open, so a
 * closed tab reads as away within a minute rather than advertising a reply that is
 * not coming.
 */
export const ONLINE_WINDOW_MS = 45_000

/** A typing indicator older than this is stale — they stopped, or closed the tab. */
export const TYPING_WINDOW_MS = 6_000

/**
 * Crockford-ish alphabet: no I, L, O, U, 0 or 1, so a handle survives being read
 * aloud down a phone line or retyped from a screenshot.
 */
const ID_ALPHABET = '23456789ABCDEFGHJKMNPQRSTVWXYZ'

/**
 * A short, quotable handle — "SG-7K3M9".
 *
 * Every thread gets one, anonymous visitors included: without it an unidentified
 * visitor is unaddressable, and there is no way to refer to them in an alert or in
 * conversation.
 *
 * `randomInt` rather than WHAM's `Math.random()`. The handle is not a credential —
 * the thread is found by cookie, never by this — but a predictable sequence of
 * handles would let one visitor guess how busy the inbox is.
 */
export function newPublicId(): string {
  let out = ''
  for (let i = 0; i < 5; i++) out += ID_ALPHABET[randomInt(ID_ALPHABET.length)]
  return `SG-${out}`
}

/**
 * The name the operator sees in the inbox.
 *
 * Best available identity wins, degrading to the handle rather than to "A visitor":
 * an anonymous person still needs a stable name the operator can use. An email's
 * local part is title-cased, because "james.okafor" reads as a stranger and
 * "James Okafor" reads as a customer.
 */
export function deriveDisplayName(input: {
  readonly name?: string | null
  readonly email?: string | null
  readonly publicId?: string | null
}): string {
  const given = (input.name ?? '').trim()
  if (given) return given.slice(0, 80)

  const email = (input.email ?? '').trim().toLowerCase()
  if (email.includes('@')) {
    const local = email.split('@')[0] ?? ''
    const words = local
      .replace(/[._\-+]+/g, ' ')
      .replace(/\d+/g, ' ')
      .trim()
      .split(/\s+/)
      .filter((w) => w.length > 1)
    if (words.length > 0) {
      return words
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ')
        .slice(0, 80)
    }
    if (local) return local.slice(0, 80)
  }

  return input.publicId ?? 'Visitor'
}

/**
 * Normalise a message body. `null` means there is nothing to send.
 *
 * Control characters are stripped — they have no place in a chat message and can
 * corrupt the ntfy header an alert carries.
 */
export function cleanBody(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const body = raw
    .replace(/\r\n?/g, '\n')
    // Everything below U+0020 except newline and tab.
    .replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, '')
    .trim()
  if (!body) return null
  return body.slice(0, MAX_BODY)
}

export function isRecent(at: Date | string | null | undefined, windowMs: number): boolean {
  if (!at) return false
  const time = typeof at === 'string' ? Date.parse(at) : at.getTime()
  return Number.isFinite(time) && Date.now() - time < windowMs
}

/**
 * What a CUSTOMER may see of a message's delivery state.
 *
 * One tick only — "we have it". WHAM's rule, and the reasoning holds: telling a
 * buyer the exact moment the shop READ their message and did not reply creates
 * pressure the shop cannot always answer. The operator sees both ticks, because
 * knowing whether a customer has actually seen a quote is operationally useful.
 */
export function customerVisibleReceipt(message: {
  readonly deliveredAt: Date | null
}): 'sent' | 'delivered' {
  return message.deliveredAt ? 'delivered' : 'sent'
}

/** The line shown in the inbox list and in an alert. */
export function previewLine(body: string, attachmentType?: string | null): string {
  const text = body.trim()
  if (text) return text.slice(0, 300)
  if (attachmentType === 'application/pdf') return 'PDF attached'
  if (attachmentType) return 'Photo attached'
  return ''
}
