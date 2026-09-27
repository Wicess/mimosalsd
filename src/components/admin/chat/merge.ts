import type { InboxMessage, InboxReceipt } from './types'

/**
 * Fold a poll into the conversation on screen.
 *
 * New rows merge by id. Receipts move on rows already held — an incremental query
 * never returns those — and also carry corrections, so an edit or removal made in
 * another operator's tab lands here. A removed message vanishes, as in WHAM.
 */
export function mergeMessages(
  prev: readonly InboxMessage[],
  incoming: readonly InboxMessage[],
  receipts: readonly InboxReceipt[],
  replace: boolean,
): InboxMessage[] {
  let base: InboxMessage[]
  if (replace) {
    base = incoming.filter((m) => !m.deleted)
  } else if (incoming.length > 0) {
    const byId = new Map(prev.map((m) => [m.id, m]))
    for (const m of incoming) byId.set(m.id, { ...byId.get(m.id), ...m })
    // The poll can echo a reply before its own POST returns; drop the optimistic twin.
    const echoed = new Set(incoming.filter((m) => m.sender === 'ADMIN').map((m) => m.body))
    base = [...byId.values()]
      .filter((m) => !m.deleted && !(m.pending && !m.attachment && echoed.has(m.body)))
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  } else {
    base = prev as InboxMessage[]
  }
  if (receipts.length === 0) return base

  const byId = new Map(receipts.map((r) => [r.id, r]))
  let changed = base !== prev
  const next: InboxMessage[] = []
  for (const m of base) {
    const r = byId.get(m.id)
    if (!r) {
      next.push(m)
      continue
    }
    if (r.deleted) {
      changed = true
      continue
    }
    if (m.deliveredAt === r.deliveredAt && m.readAt === r.readAt && m.body === r.body && m.edited === r.edited) {
      next.push(m)
      continue
    }
    changed = true
    next.push({ ...m, deliveredAt: r.deliveredAt, readAt: r.readAt, body: r.body, edited: r.edited })
  }
  return changed ? next : (prev as InboxMessage[])
}
