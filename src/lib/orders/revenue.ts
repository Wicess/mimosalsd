import 'server-only'
import { db } from '@/lib/db/client'
import { PAID_STATUSES } from '@/lib/customers/summary'

/**
 * ─────────────────────────────────────────────────────────────────────────────
 *  WHAT THE SHOP HAS GENUINELY MADE (owner, 2026-09-14).
 *
 *  Revenue is money you confirmed: an order counts from the moment you press
 *  "Confirm payment received", which marks it paid and stamps `paidAt`. It stays
 *  counted as it is packed, shipped and delivered. Refunds come off. An order the
 *  customer only SAYS they paid (payment claimed) is not revenue yet, and neither
 *  is one still waiting for payment: those are shown apart, as money on its way.
 *
 *  The same rule as the dashboard's net revenue (lib/analytics/queries.ts
 *  netRevenueAllTime), so the two figures always agree: paid-status totals, less
 *  every refund recorded against them, less the whole total of a refunded order
 *  that has no refund record.
 *
 *  A period is placed by when the payment was confirmed (`paidAt`, or when the
 *  order was placed for orders confirmed before that was recorded), and each
 *  order's refunds travel with it. One query, whatever the size of the order book.
 * ─────────────────────────────────────────────────────────────────────────────
 */

export interface RevenueFigure {
  readonly cents: number
  readonly orders: number
}

export interface RevenueSummary {
  readonly allTime: RevenueFigure
  readonly thisMonth: RevenueFigure
  readonly last7Days: RevenueFigure
  readonly today: RevenueFigure
  /** Paid orders' refunds, all time. */
  readonly refundedCents: number
  /** Customer says they paid; waiting for you to confirm. */
  readonly claimed: RevenueFigure
  /** Payment details sent; nothing received yet. */
  readonly awaiting: RevenueFigure
  /** Order requests not yet verified. */
  readonly unverified: RevenueFigure
}

const DAY = 86_400_000

export function periodStarts(now: Date): { today: Date; last7Days: Date; thisMonth: Date } {
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
  return {
    today,
    last7Days: new Date(today.getTime() - 6 * DAY),
    thisMonth: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)),
  }
}

type Row = {
  all_cents: bigint | number | null
  all_orders: number
  month_cents: bigint | number | null
  month_orders: number
  week_cents: bigint | number | null
  week_orders: number
  today_cents: bigint | number | null
  today_orders: number
  refunded_cents: bigint | number | null
  claimed_cents: bigint | number | null
  claimed_orders: number
  awaiting_cents: bigint | number | null
  awaiting_orders: number
  unverified_cents: bigint | number | null
  unverified_orders: number
}

const n = (value: bigint | number | null | undefined) => Number(value ?? 0)

export async function revenueSummary(now: Date = new Date()): Promise<RevenueSummary> {
  const starts = periodStarts(now)
  // Timestamps are stored as UTC without a zone; compare them as such.
  const at = (date: Date) => date.toISOString().replace('T', ' ').replace('Z', '')
  const [row] = await db.$queryRaw<Row[]>`
    WITH paid AS (
      SELECT
        o."totalCents" AS total,
        COALESCE(o."paidAt", o."createdAt") AS paid_at,
        COALESCE(r.refunded, 0) AS refunded,
        CASE WHEN o.status = 'REFUNDED' AND r.refunded IS NULL THEN o."totalCents" ELSE 0 END AS unledgered
      FROM "Order" o
      LEFT JOIN (SELECT "orderId", SUM("amountCents") AS refunded FROM "Refund" GROUP BY "orderId") r ON r."orderId" = o.id
      WHERE o.status::text = ANY(${[...PAID_STATUSES]}::text[])
    ),
    net AS (SELECT paid_at, total - refunded - unledgered AS cents, refunded + unledgered AS refunds FROM paid),
    open AS (
      SELECT status::text AS status, COUNT(*)::int AS orders, SUM("totalCents") AS cents
      FROM "Order"
      WHERE status::text IN ('PAYMENT_CLAIMED', 'AWAITING_PAYMENT', 'PENDING_VERIFICATION')
      GROUP BY status
    )
    SELECT
      (SELECT SUM(cents) FROM net) AS all_cents,
      (SELECT COUNT(*)::int FROM net) AS all_orders,
      (SELECT SUM(cents) FROM net WHERE paid_at >= ${at(starts.thisMonth)}::timestamp) AS month_cents,
      (SELECT COUNT(*)::int FROM net WHERE paid_at >= ${at(starts.thisMonth)}::timestamp) AS month_orders,
      (SELECT SUM(cents) FROM net WHERE paid_at >= ${at(starts.last7Days)}::timestamp) AS week_cents,
      (SELECT COUNT(*)::int FROM net WHERE paid_at >= ${at(starts.last7Days)}::timestamp) AS week_orders,
      (SELECT SUM(cents) FROM net WHERE paid_at >= ${at(starts.today)}::timestamp) AS today_cents,
      (SELECT COUNT(*)::int FROM net WHERE paid_at >= ${at(starts.today)}::timestamp) AS today_orders,
      (SELECT SUM(refunds) FROM net) AS refunded_cents,
      (SELECT cents FROM open WHERE status = 'PAYMENT_CLAIMED') AS claimed_cents,
      COALESCE((SELECT orders FROM open WHERE status = 'PAYMENT_CLAIMED'), 0) AS claimed_orders,
      (SELECT cents FROM open WHERE status = 'AWAITING_PAYMENT') AS awaiting_cents,
      COALESCE((SELECT orders FROM open WHERE status = 'AWAITING_PAYMENT'), 0) AS awaiting_orders,
      (SELECT cents FROM open WHERE status = 'PENDING_VERIFICATION') AS unverified_cents,
      COALESCE((SELECT orders FROM open WHERE status = 'PENDING_VERIFICATION'), 0) AS unverified_orders
  `
  const figure = (cents: bigint | number | null | undefined, orders: number | undefined) => ({ cents: n(cents), orders: orders ?? 0 })
  return {
    allTime: figure(row?.all_cents, row?.all_orders),
    thisMonth: figure(row?.month_cents, row?.month_orders),
    last7Days: figure(row?.week_cents, row?.week_orders),
    today: figure(row?.today_cents, row?.today_orders),
    refundedCents: n(row?.refunded_cents),
    claimed: figure(row?.claimed_cents, row?.claimed_orders),
    awaiting: figure(row?.awaiting_cents, row?.awaiting_orders),
    unverified: figure(row?.unverified_cents, row?.unverified_orders),
  }
}

/** How an order stands on money, for the list: received, refunded, claimed, or not yet. */
export type PaymentState = 'paid' | 'refunded' | 'claimed' | 'awaiting' | 'unverified' | 'closed'

export function paymentStateOf(status: string): PaymentState {
  if (status === 'REFUNDED') return 'refunded'
  if ((PAID_STATUSES as readonly string[]).includes(status)) return 'paid'
  if (status === 'PAYMENT_CLAIMED') return 'claimed'
  if (status === 'AWAITING_PAYMENT') return 'awaiting'
  if (status === 'PENDING_VERIFICATION') return 'unverified'
  return 'closed'
}
