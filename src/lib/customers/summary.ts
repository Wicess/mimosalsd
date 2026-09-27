import type { OrderStatus } from '@/lib/orders/types'

/**
 * ─────────────────────────────────────────────────────────────────────────────
 *  WHAT A CUSTOMER HAS SPENT — pure, so the money rules can be tested without
 *  a database, and so the customer list, the customer page and analytics all
 *  count the same money the same way.
 *
 *  ── Who a customer is ──────────────────────────────────────────────────────
 *  An email address, compared case-insensitively. Checkout is guest-first and
 *  stores the address as typed, so "Jane@x.com" and "jane@x.com" are two spellings
 *  of one person, and grouping by the raw column would split her history in two.
 *
 *  ── Which money counts ─────────────────────────────────────────────────────
 *  Only orders whose payment was confirmed. A rejected, cancelled or still-unpaid
 *  order is a request, not revenue, and adding its total to "lifetime value" — as
 *  this panel used to — overstates what someone is worth by every order that never
 *  arrived.
 *
 *  Refunds come off. The ledger (`Refund` rows) is the record of money sent back,
 *  EXCEPT one case: an order moved to REFUNDED with nothing in the ledger. That
 *  happens — the status move does not require a ledger entry, and orders refunded
 *  before the ledger existed have none — and there the status is the only record,
 *  and it says the money went back.
 * ─────────────────────────────────────────────────────────────────────────────
 */

/** Orders whose payment was confirmed. REFUNDED included: the money did arrive. */
export const PAID_STATUSES: readonly OrderStatus[] = [
  'PAID',
  'PACKED',
  'SHIPPED',
  'DELIVERED',
  'REFUNDED',
]

export function isPaid(status: string): boolean {
  return (PAID_STATUSES as readonly string[]).includes(status)
}

/** The grouping key. Trimmed too: a stray space should not make a second customer. */
export function customerKey(email: string): string {
  return email.trim().toLowerCase()
}

export interface OrderMoney {
  readonly status: string
  readonly totalCents: number
  readonly refunds: readonly { readonly amountCents: number }[]
}

/** Money returned on one order, in cents. Never more than the order total. */
export function refundedCents(order: OrderMoney): number {
  if (!isPaid(order.status)) return 0
  const ledger = order.refunds.reduce((sum, refund) => sum + refund.amountCents, 0)
  if (order.status === 'REFUNDED' && ledger === 0) return order.totalCents
  return Math.min(order.totalCents, ledger)
}

/** What one order is worth after refunds. Zero for an order that was never paid. */
export function netCents(order: OrderMoney): number {
  return isPaid(order.status) ? order.totalCents - refundedCents(order) : 0
}

export interface CustomerOrder extends OrderMoney {
  readonly createdAt: Date
  readonly stateCode: string
  readonly preferredPaymentMethod: string | null
  readonly couponCode: string | null
}

export interface CustomerSummary {
  /** Every order they submitted, whatever became of it. */
  readonly placed: number
  /** Orders whose payment was confirmed. */
  readonly paid: number
  /** Sum of paid order totals, before refunds. */
  readonly grossCents: number
  readonly refundedCents: number
  /** gross − refunded. The number that means "what this customer is worth". */
  readonly netCents: number
  /** Mean paid order, rounded to the cent. Null with no paid order to average. */
  readonly averageOrderCents: number | null
  readonly firstOrderAt: Date | null
  readonly lastOrderAt: Date | null
  /** Tallies, most frequent first. Across every order, paid or not. */
  readonly states: readonly Tally[]
  readonly paymentMethods: readonly Tally[]
  readonly coupons: readonly Tally[]
}

export interface Tally {
  readonly value: string
  readonly count: number
}

/** Most frequent first; ties alphabetical, so the order is stable between renders. */
function tally(values: readonly (string | null)[]): Tally[] {
  const counts = new Map<string, number>()
  for (const value of values) {
    if (value) counts.set(value, (counts.get(value) ?? 0) + 1)
  }
  return [...counts]
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value))
}

export function summariseCustomer(orders: readonly CustomerOrder[]): CustomerSummary {
  let paid = 0
  let grossCents = 0
  let refunded = 0
  let first: Date | null = null
  let last: Date | null = null

  for (const order of orders) {
    if (isPaid(order.status)) {
      paid += 1
      grossCents += order.totalCents
      refunded += refundedCents(order)
    }
    if (!first || order.createdAt < first) first = order.createdAt
    if (!last || order.createdAt > last) last = order.createdAt
  }

  return {
    placed: orders.length,
    paid,
    grossCents,
    refundedCents: refunded,
    netCents: grossCents - refunded,
    averageOrderCents: paid > 0 ? Math.round(grossCents / paid) : null,
    firstOrderAt: first,
    lastOrderAt: last,
    states: tally(orders.map((o) => o.stateCode)),
    paymentMethods: tally(orders.map((o) => o.preferredPaymentMethod)),
    coupons: tally(orders.map((o) => o.couponCode)),
  }
}

/** Group orders into customers by `customerKey`. Order within each group is kept. */
export function groupByCustomer<T extends { readonly email: string }>(
  orders: readonly T[],
): Map<string, T[]> {
  const groups = new Map<string, T[]>()
  for (const order of orders) {
    const key = customerKey(order.email)
    const group = groups.get(key)
    if (group) group.push(order)
    else groups.set(key, [order])
  }
  return groups
}
