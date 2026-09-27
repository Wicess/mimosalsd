import type { AdminMessage } from '@/lib/chat/serialize'

/** One row of `/api/admin/chat/threads`. */
export interface InboxThread {
  readonly id: string
  readonly publicId: string | null
  readonly displayName: string
  readonly email: string | null
  readonly subject: string | null
  readonly isOpen: boolean
  readonly lastMessageAt: string
  readonly lastMessageText: string | null
  readonly lastSender: string | null
  readonly unread: number
  readonly online: boolean
  readonly typing: boolean
  readonly typingText: string | null
}

/** A message as the operator sees it: both ticks, plus lexicon flags on the customer's words. */
export interface InboxMessage extends AdminMessage {
  /** Lexicon terms a CUSTOMER message trips. Flagged, never blocked. */
  readonly flags?: readonly string[]
  /** Optimistic row not yet acknowledged by the server. */
  readonly pending?: boolean
  /** A local blob preview for an optimistic image. */
  readonly localPreview?: string
}

/** Receipt movement on the operator's own messages, from an incremental poll. */
export interface InboxReceipt {
  readonly id: string
  readonly body: string
  readonly deliveredAt: string | null
  readonly readAt: string | null
  readonly edited: boolean
  readonly deleted: boolean
}

export interface InboxOrder {
  readonly orderNumber: string
  readonly status: string
  readonly totalCents: number
  readonly createdAt: string
}

/** The customer, as far as the business knows them. */
export interface InboxProfile {
  readonly id: string
  readonly publicId: string | null
  readonly displayName: string
  readonly name: string | null
  readonly email: string | null
  readonly subject: string | null
  readonly isOpen: boolean
  readonly firstSeen: string
  readonly customerLastSeenAt: string | null
  readonly lastIp: string | null
  readonly blocked: boolean
  readonly online: boolean
  readonly typing: boolean
  readonly typingText: string | null
  readonly orders: readonly InboxOrder[]
}

export type InboxFilter = 'open' | 'all' | 'closed'
