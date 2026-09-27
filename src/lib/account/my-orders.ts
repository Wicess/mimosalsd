import 'server-only'
import { cookies } from 'next/headers'
import { db } from '@/lib/db/client'
import { CHAT_LINKED } from '@/lib/invoices/deliver'
import { isVisitorId, VISITOR_COOKIE } from '@/lib/visitors/cookie'

/**
 * ─────────────────────────────────────────────────────────────────────────────
 *  THE CUSTOMER'S ORDERS, WITHOUT SIGNING IN (owner, 2026-09-14).
 *
 *  There are no customer accounts, so "your orders" means the orders this device
 *  knows are yours:
 *   · orders placed from this browser (the ORDER_PLACED milestone on its visitor id),
 *   · orders placed from its chat (checkout links each order to the chat it came from),
 *   · and, in the browser, orders whose private link was opened here — the link in
 *     the confirmation email (see components/account/remember-order.tsx).
 *
 *  Never by an email address someone types: that would show anyone's orders to
 *  whoever knows their email.
 *
 *  Fields are named explicitly, so this read never depends on a column a later
 *  migration adds.
 * ─────────────────────────────────────────────────────────────────────────────
 */

export interface ProfileOrder {
  readonly orderNumber: string
  readonly orderToken: string
  readonly status: string
  readonly createdAt: string
  readonly totalCents: number
  readonly items: readonly { readonly name: string; readonly variant: string; readonly quantity: number }[]
}

const SELECT = {
  orderNumber: true,
  orderToken: true,
  status: true,
  createdAt: true,
  totalCents: true,
  items: { select: { productName: true, variantName: true, quantity: true } },
} as const

type Row = {
  orderNumber: string
  orderToken: string
  status: string
  createdAt: Date
  totalCents: number
  items: { productName: string; variantName: string; quantity: number }[]
}

function toProfileOrder(row: Row): ProfileOrder {
  return {
    orderNumber: row.orderNumber,
    orderToken: row.orderToken,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
    totalCents: row.totalCents,
    items: row.items.map((item) => ({ name: item.productName, variant: item.variantName, quantity: item.quantity })),
  }
}

export async function ordersForThisBrowser(): Promise<ProfileOrder[]> {
  const visitorId = (await cookies()).get(VISITOR_COOKIE)?.value
  if (!isVisitorId(visitorId)) return []
  try {
    const [placed, threads] = await Promise.all([
      db.visitorActivity.findMany({ where: { visitorId, kind: 'ORDER_PLACED' }, select: { detail: true }, take: 100 }),
      db.supportThread.findMany({ where: { visitorId }, select: { id: true }, take: 20 }),
    ])
    // ORDER_PLACED's detail is "SG-XXXX · $12.00": the order number, then the total.
    const numbers = placed.map((row) => row.detail?.split(' · ')[0]?.trim()).filter((n): n is string => Boolean(n))
    const linked = threads.length
      ? await db.orderEvent.findMany({
          where: { type: CHAT_LINKED, OR: threads.map((thread) => ({ metadata: { path: ['chatThreadId'], equals: thread.id } })) },
          select: { orderId: true },
          take: 100,
        })
      : []
    if (numbers.length === 0 && linked.length === 0) return []
    const rows = await db.order.findMany({
      where: { OR: [{ orderNumber: { in: numbers } }, { id: { in: linked.map((event) => event.orderId) } }] },
      select: SELECT,
      orderBy: { createdAt: 'desc' },
      take: 50,
    })
    return rows.map(toProfileOrder)
  } catch {
    return []
  }
}

const TOKEN = /^[A-Za-z0-9_-]{43}$/

/** Orders by their private links, as remembered by this browser. Unknown tokens are ignored. */
export async function ordersByTokens(tokens: readonly string[]): Promise<ProfileOrder[]> {
  const valid = [...new Set(tokens)].filter((token) => TOKEN.test(token)).slice(0, 20)
  if (valid.length === 0) return []
  try {
    const rows = await db.order.findMany({
      where: { orderToken: { in: valid } },
      select: SELECT,
      orderBy: { createdAt: 'desc' },
    })
    return rows.map(toProfileOrder)
  } catch {
    return []
  }
}
