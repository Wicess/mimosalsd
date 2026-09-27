import 'server-only'
import { db } from '@/lib/db/client'
import { PAID_STATUSES } from '@/lib/customers/summary'

/**
 * Reads behind the analytics page and the dashboard's revenue figure.
 *
 * Nothing here runs on a timer. The analytics page has no AutoRefresh on purpose:
 * it reports on orders placed over days and months, a refresh every few seconds
 * would change nothing on it, and each one would keep Neon awake and bill a
 * function invocation for as long as the tab stayed open.
 */

/**
 * The most orders one analytics view loads. Far above what this shop places in a
 * year; the page says so if a period ever reaches it, rather than quietly
 * reporting on a truncated set as though it were complete.
 */
export const ANALYTICS_ROW_CAP = 20_000

/** Orders placed in [start, end), newest first, with what the arithmetic needs. */
export async function ordersPlacedBetween(start: Date, end: Date) {
  return db.order.findMany({
    where: { createdAt: { gte: start, lt: end } },
    select: {
      email: true,
      status: true,
      totalCents: true,
      discountCents: true,
      couponCode: true,
      preferredPaymentMethod: true,
      stateCode: true,
      createdAt: true,
      refunds: { select: { amountCents: true } },
      items: {
        select: { productName: true, productLine: true, quantity: true, lineTotalCents: true },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: ANALYTICS_ROW_CAP,
  })
}

/**
 * Of these customers (grouping keys, as `customerKey` makes them), the ones who
 * had a confirmed payment before `before` — the returning ones. Compared on
 * lower(trim(email)) in SQL for the reason given in `lib/customers/queries.ts`.
 */
export async function customersPaidBefore(
  keys: readonly string[],
  before: Date,
): Promise<Set<string>> {
  if (keys.length === 0) return new Set()
  // The bound as UTC wall time, spelled out: a bare Date is zone-aware, and against
  // this timestamp-without-zone column Postgres would shift it by the session's
  // offset (see `utc` in lib/visitors/flush.ts, where a test caught exactly that).
  const rows = await db.$queryRaw<{ key: string }[]>`
    SELECT DISTINCT lower(trim(email)) AS key FROM "Order"
    WHERE "createdAt" < (${before.toISOString()}::timestamptz AT TIME ZONE 'UTC')
      AND status::text = ANY(${[...PAID_STATUSES]}::text[])
      AND lower(trim(email)) = ANY(${[...keys]}::text[])`
  return new Set(rows.map((row) => row.key))
}

/**
 * All-time net revenue, in cents, without loading every order.
 *
 * The same rule as `netCents` summed over every paid order: gross, less the refund
 * ledger, less the whole total of any REFUNDED order with an empty ledger. The one
 * difference is `netCents` also caps each order's ledger at its total — a case the
 * refund action already makes impossible by refusing more than what remains.
 */
export async function netRevenueAllTime(): Promise<number> {
  const paid = { status: { in: [...PAID_STATUSES] } }
  const [gross, ledger, unledgered] = await Promise.all([
    db.order.aggregate({ _sum: { totalCents: true }, where: paid }),
    db.refund.aggregate({ _sum: { amountCents: true }, where: { order: paid } }),
    db.order.aggregate({
      _sum: { totalCents: true },
      where: { status: 'REFUNDED', refunds: { none: {} } },
    }),
  ])
  return (
    (gross._sum.totalCents ?? 0) -
    (ledger._sum.amountCents ?? 0) -
    (unledgered._sum.totalCents ?? 0)
  )
}
