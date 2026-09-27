import { customerVisibleReceipt } from './rules'

/**
 * What crosses the wire for one message — and it differs by who is looking.
 *
 * A single function per audience, so the rule that a customer only ever sees ONE
 * tick cannot be bypassed by a route that forgot to strip `readAt`. The customer
 * shape has no `readAt` field at all: it is not hidden, it is absent.
 *
 * Attachments are never a URL here. The key is private; the client asks for it by
 * message id and gets a short-lived signed link.
 */

export interface StoredMessage {
  readonly id: string
  readonly fromCustomer: boolean
  readonly isSystem: boolean
  readonly body: string
  readonly authorName: string | null
  readonly createdAt: Date
  readonly deliveredAt: Date | null
  readonly readAt: Date | null
  readonly attachmentKey: string | null
  readonly attachmentType: string | null
  readonly attachmentName: string | null
  readonly editedAt: Date | null
  readonly deletedAt: Date | null
}

export interface CustomerMessage {
  readonly id: string
  readonly sender: 'CUSTOMER' | 'ADMIN' | 'SYSTEM'
  readonly body: string
  readonly createdAt: string
  readonly receipt: 'sent' | 'delivered'
  readonly attachment: { readonly type: string; readonly name: string } | null
  readonly edited: boolean
  readonly deleted: boolean
}

export interface AdminMessage extends Omit<CustomerMessage, 'receipt'> {
  readonly authorName: string | null
  readonly deliveredAt: string | null
  /** Operator-only. The second tick. */
  readonly readAt: string | null
}

function sender(m: StoredMessage): 'CUSTOMER' | 'ADMIN' | 'SYSTEM' {
  if (m.isSystem) return 'SYSTEM'
  return m.fromCustomer ? 'CUSTOMER' : 'ADMIN'
}

function attachment(m: StoredMessage) {
  return m.attachmentKey && m.attachmentType
    ? { type: m.attachmentType, name: m.attachmentName ?? 'attachment' }
    : null
}

export function forCustomer(m: StoredMessage): CustomerMessage {
  const deleted = Boolean(m.deletedAt)
  return {
    id: m.id,
    sender: sender(m),
    // A removed message stays in the timeline as "removed", never vanishes.
    body: deleted ? '' : m.body,
    createdAt: m.createdAt.toISOString(),
    receipt: customerVisibleReceipt(m),
    attachment: deleted ? null : attachment(m),
    edited: Boolean(m.editedAt),
    deleted,
  }
}

export function forAdmin(m: StoredMessage): AdminMessage {
  const deleted = Boolean(m.deletedAt)
  return {
    id: m.id,
    sender: sender(m),
    body: deleted ? '' : m.body,
    createdAt: m.createdAt.toISOString(),
    attachment: deleted ? null : attachment(m),
    edited: Boolean(m.editedAt),
    deleted,
    authorName: m.authorName,
    deliveredAt: m.deliveredAt?.toISOString() ?? null,
    readAt: m.readAt?.toISOString() ?? null,
  }
}
