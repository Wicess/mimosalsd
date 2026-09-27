/**
 * ─────────────────────────────────────────────────────────────────────────────
 *  CARTS, REBUILT FROM WHAT HAPPENED TO THEM (owner, 2026-09-14).
 *
 *  A cart lives in the customer's own cookie, so the admin cannot read it. What the
 *  admin has is every change to it (lib/cart/track.ts): added, quantity changed,
 *  removed, checkout opened, order placed, refused for the state. Replayed in order,
 *  per visitor, those give each cart's contents and value, and where it ended:
 *
 *    ordered    an order was placed from it
 *    checkout   checkout is open, within the last hour
 *    active     items in it, touched within the last hour
 *    abandoned  items in it, untouched for an hour or more, no order
 *    emptied    everything was taken back out
 *
 *  Pure, so the replay is tested without a database.
 * ─────────────────────────────────────────────────────────────────────────────
 */

export const ABANDONED_AFTER_MS = 60 * 60 * 1000

export interface CartEventRow {
  readonly visitorId: string | null
  readonly type: string
  readonly productSlug: string | null
  readonly productName: string | null
  readonly variantId: string | null
  readonly variantName: string | null
  readonly quantity: number
  /** The cart's subtotal right after this change. */
  readonly cartValueCents: number
  readonly cartItems: number
  /** The event's own value: the line added, or the order's total. */
  readonly valueCents: number
  readonly linkSlug: string | null
  readonly stateCode: string | null
  readonly reason: string | null
  readonly createdAt: Date
}

export type CartStatus = 'ordered' | 'checkout' | 'active' | 'abandoned' | 'emptied'

export interface CartLine {
  readonly slug: string
  readonly name: string
  readonly variant: string | null
  readonly quantity: number
}

export interface CartSession {
  readonly visitorId: string
  readonly lines: readonly CartLine[]
  readonly items: number
  /** What is in it now, or what was ordered. */
  readonly valueCents: number
  readonly status: CartStatus
  readonly startedAt: Date
  readonly lastAt: Date
  /** The tracking link the visitor had followed, if any. */
  readonly linkSlug: string | null
  readonly checkoutOpened: boolean
}

/** Every cart, newest activity first. Events without a visitor cannot be joined into one. */
export function cartSessions(rows: readonly CartEventRow[], now: Date): CartSession[] {
  const byVisitor = new Map<string, CartEventRow[]>()
  for (const row of rows) {
    if (!row.visitorId) continue
    const list = byVisitor.get(row.visitorId)
    if (list) list.push(row)
    else byVisitor.set(row.visitorId, [row])
  }

  const sessions: CartSession[] = []
  for (const [visitorId, list] of byVisitor) {
    const sorted = [...list].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
    let lines = new Map<string, { slug: string; name: string; variant: string | null; quantity: number }>()
    let started: Date | null = null
    let last: CartEventRow | null = null
    let link: string | null = null
    let checkout = false

    const close = (status: CartStatus, valueCents: number, lineList: CartLine[]) => {
      if (!started || !last) return
      sessions.push({
        visitorId,
        lines: lineList,
        items: lineList.reduce((sum, line) => sum + line.quantity, 0),
        valueCents,
        status,
        startedAt: started,
        lastAt: last.createdAt,
        linkSlug: link,
        checkoutOpened: checkout,
      })
    }

    for (const row of sorted) {
      if (row.type === 'BLOCKED_BY_STATE') continue
      if (!started && row.type !== 'ORDER_PLACED') started = row.createdAt
      last = row
      link = row.linkSlug ?? link
      const key = `${row.productSlug}|${row.variantId}`
      if (row.type === 'ADDED' && row.productSlug) {
        const current = lines.get(key)
        lines.set(key, {
          slug: row.productSlug,
          name: row.productName ?? row.productSlug,
          variant: row.variantName,
          quantity: (current?.quantity ?? 0) + Math.max(1, row.quantity),
        })
      } else if (row.type === 'UPDATED' && row.productSlug) {
        if (row.quantity > 0) {
          const current = lines.get(key)
          lines.set(key, {
            slug: row.productSlug,
            name: row.productName ?? current?.name ?? row.productSlug,
            variant: row.variantName ?? current?.variant ?? null,
            quantity: row.quantity,
          })
        } else lines.delete(key)
      } else if (row.type === 'REMOVED' && row.productSlug) {
        lines.delete(key)
      } else if (row.type === 'CHECKOUT_STARTED') {
        checkout = true
      } else if (row.type === 'ORDER_PLACED') {
        started ??= row.createdAt
        close('ordered', row.valueCents, [...lines.values()])
        lines = new Map()
        started = null
        last = null
        checkout = false
      }
    }

    if (started && last) {
      const current = [...lines.values()]
      const items = current.reduce((sum, line) => sum + line.quantity, 0)
      const idle = now.getTime() - last.createdAt.getTime()
      const status: CartStatus =
        items === 0 ? 'emptied' : idle >= ABANDONED_AFTER_MS ? 'abandoned' : last.type === 'CHECKOUT_STARTED' ? 'checkout' : 'active'
      close(status, items === 0 ? 0 : last.cartValueCents, current)
    }
  }
  return sessions.sort((a, b) => b.lastAt.getTime() - a.lastAt.getTime())
}

export interface CartFunnel {
  readonly carts: number
  readonly checkouts: number
  readonly orders: number
  readonly abandoned: number
  readonly abandonedValueCents: number
  readonly open: number
  readonly openValueCents: number
}

export function cartFunnel(sessions: readonly CartSession[]): CartFunnel {
  const withItems = sessions.filter((s) => s.status !== 'emptied' || s.checkoutOpened)
  const abandoned = sessions.filter((s) => s.status === 'abandoned')
  const open = sessions.filter((s) => s.status === 'active' || s.status === 'checkout')
  return {
    carts: withItems.length,
    checkouts: sessions.filter((s) => s.checkoutOpened || s.status === 'ordered').length,
    orders: sessions.filter((s) => s.status === 'ordered').length,
    abandoned: abandoned.length,
    abandonedValueCents: abandoned.reduce((sum, s) => sum + s.valueCents, 0),
    open: open.length,
    openValueCents: open.reduce((sum, s) => sum + s.valueCents, 0),
  }
}

/** Products by how often they went into carts, and came back out. */
export function productMoves(rows: readonly CartEventRow[]) {
  const moves = new Map<string, { name: string; added: number; removed: number }>()
  for (const row of rows) {
    if (!row.productSlug || (row.type !== 'ADDED' && row.type !== 'REMOVED')) continue
    const move = moves.get(row.productSlug) ?? { name: row.productName ?? row.productSlug, added: 0, removed: 0 }
    if (row.type === 'ADDED') move.added += Math.max(1, row.quantity)
    else move.removed += 1
    moves.set(row.productSlug, move)
  }
  return [...moves.entries()].map(([slug, move]) => ({ slug, ...move })).sort((a, b) => b.added - a.added || a.name.localeCompare(b.name))
}
