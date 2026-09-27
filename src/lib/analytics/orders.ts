import { customerKey, isPaid, netCents, refundedCents } from '@/lib/customers/summary'

/**
 * ─────────────────────────────────────────────────────────────────────────────
 *  ORDER ANALYTICS — pure, over rows the page has already loaded.
 *
 *  Money follows the customer rules in `lib/customers/summary.ts` exactly: only
 *  confirmed payments count, refunds come off, and an order moved to REFUNDED with
 *  an empty ledger counts as fully returned. The customer list, the customer page,
 *  the dashboard and this module all agree because they share those functions.
 *
 *  An order is counted in the period it was PLACED, refunds included. "Net revenue
 *  for September" means what September's orders turned out to be worth, so a refund
 *  issued in October lowers September — which is the number you want when judging
 *  a month, and the wrong one for reconciling a bank statement. The page says so.
 *
 *  Periods are whole UTC days ending today, and every bar is a whole day, week or
 *  month, so no bar is a partial bucket pretending to be a full one.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const DAY_MS = 24 * 60 * 60 * 1000

export const RANGES = {
  '7d': { label: '7 days', bucket: 'day', count: 7 },
  '30d': { label: '30 days', bucket: 'day', count: 30 },
  '13w': { label: '13 weeks', bucket: 'week', count: 13 },
  '12m': { label: '12 months', bucket: 'month', count: 12 },
} as const

export type RangeKey = keyof typeof RANGES
export const DEFAULT_RANGE: RangeKey = '30d'

/**
 * The analytics page's extra option (owner, 2026-09-14): the last 24 hours, hour by
 * hour. Kept out of RANGES, which the visitors page also lists, because its days are
 * filed nightly and have no hours.
 */
export const LAST_24_HOURS = '24h'
export type AnalyticsRange = RangeKey | typeof LAST_24_HOURS

export const ANALYTICS_RANGE_LABEL: Record<AnalyticsRange, string> = {
  [LAST_24_HOURS]: '24 hours',
  ...(Object.fromEntries(Object.entries(RANGES).map(([key, value]) => [key, value.label])) as Record<RangeKey, string>),
}

export function parseAnalyticsRange(value: unknown): AnalyticsRange {
  return value === LAST_24_HOURS ? LAST_24_HOURS : parseRange(value)
}

export function parseRange(value: unknown): RangeKey {
  return typeof value === 'string' && Object.hasOwn(RANGES, value)
    ? (value as RangeKey)
    : DEFAULT_RANGE
}

export interface Bucket {
  readonly start: Date
  /** Exclusive. */
  readonly end: Date
  /** Short axis label: "Sep 3", "Jun 12", "Oct". */
  readonly label: string
  /** Full description for the tooltip and the screen-reader table. */
  readonly title: string
}

export interface Period {
  readonly range: AnalyticsRange
  readonly start: Date
  /** Exclusive: the start of tomorrow, UTC (or of next month, for months). */
  readonly end: Date
  /** Start of the equal-length period before this one, for comparison. */
  readonly previousStart: Date
  readonly buckets: readonly Bucket[]
}

const fmt = (date: Date, options: Intl.DateTimeFormatOptions) =>
  date.toLocaleDateString('en-US', { timeZone: 'UTC', ...options })

/**
 * The last 24 whole-and-current hours: from the start of the hour 23 hours ago to
 * the end of this one. Hours are UTC, like the days.
 */
export function hourlyPeriod(now: Date): Period {
  const HOUR = 3_600_000
  const end = Math.ceil((now.getTime() + 1) / HOUR) * HOUR
  const start = end - 24 * HOUR
  const time = (date: Date) => date.toLocaleTimeString('en-US', { timeZone: 'UTC', hour: 'numeric' })
  const buckets: Bucket[] = Array.from({ length: 24 }, (_, i) => {
    const s = new Date(start + i * HOUR)
    const e = new Date(start + (i + 1) * HOUR)
    return {
      start: s,
      end: e,
      label: time(s),
      title: `${fmt(s, { weekday: 'short', month: 'short', day: 'numeric' })}, ${time(s)} to ${time(e)} UTC`,
    }
  })
  return {
    range: LAST_24_HOURS,
    start: new Date(start),
    end: new Date(end),
    previousStart: new Date(start - 24 * HOUR),
    buckets,
  }
}

export function analyticsPeriod(range: AnalyticsRange, now: Date): Period {
  return range === LAST_24_HOURS ? hourlyPeriod(now) : periodFor(range, now)
}

export function periodFor(range: RangeKey, now: Date): Period {
  const { bucket, count } = RANGES[range]
  const y = now.getUTCFullYear()
  const m = now.getUTCMonth()
  const tomorrow = Date.UTC(y, m, now.getUTCDate() + 1)

  if (bucket === 'month') {
    // Calendar months, the current one last. Date.UTC normalises a negative month.
    const buckets: Bucket[] = []
    for (let i = count - 1; i >= 0; i--) {
      const start = new Date(Date.UTC(y, m - i, 1))
      buckets.push({
        start,
        end: new Date(Date.UTC(y, m - i + 1, 1)),
        label: fmt(start, { month: 'short' }),
        title: fmt(start, { month: 'long', year: 'numeric' }),
      })
    }
    return {
      range,
      start: new Date(Date.UTC(y, m - count + 1, 1)),
      end: new Date(Date.UTC(y, m + 1, 1)),
      previousStart: new Date(Date.UTC(y, m - 2 * count + 1, 1)),
      buckets,
    }
  }

  const span = (bucket === 'week' ? 7 : 1) * DAY_MS
  const start = tomorrow - count * span
  const buckets: Bucket[] = []
  for (let i = 0; i < count; i++) {
    const s = new Date(start + i * span)
    buckets.push({
      start: s,
      end: new Date(start + (i + 1) * span),
      label: fmt(s, { month: 'short', day: 'numeric' }),
      title:
        bucket === 'week'
          ? `Week of ${fmt(s, { month: 'long', day: 'numeric', year: 'numeric' })}`
          : fmt(s, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }),
    })
  }
  return {
    range,
    start: new Date(start),
    end: new Date(tomorrow),
    previousStart: new Date(start - count * span),
    buckets,
  }
}

export interface AnalyticsOrder {
  readonly email: string
  readonly status: string
  readonly totalCents: number
  readonly discountCents: number
  readonly couponCode: string | null
  readonly preferredPaymentMethod: string | null
  readonly stateCode: string
  readonly createdAt: Date
  readonly refunds: readonly { readonly amountCents: number }[]
  readonly items: readonly {
    readonly productName: string
    readonly productLine: string
    readonly quantity: number
    readonly lineTotalCents: number
  }[]
}

/** Still waiting on us or on the customer — neither paid nor turned away. */
const OPEN_STATUSES = new Set(['PENDING_VERIFICATION', 'AWAITING_PAYMENT', 'PAYMENT_CLAIMED'])
/** Settled without payment. */
const TURNED_AWAY = new Set(['REJECTED', 'CANCELLED'])

export interface OrderKpis {
  readonly placed: number
  readonly paid: number
  readonly open: number
  /**
   * Paid ÷ (paid + rejected + cancelled). Orders still open are left out: counting
   * them as failures would make every recent period look worse than it was, simply
   * because its orders have not finished yet. Null when nothing has been decided.
   */
  readonly confirmationRate: number | null
  readonly grossCents: number
  readonly refundedCents: number
  readonly netCents: number
  readonly averageOrderCents: number | null
  readonly payingCustomers: number
  /** Customers with two or more paid orders inside the period. */
  readonly repeatCustomers: number
  readonly couponOrders: number
  readonly discountCents: number
}

export function orderKpis(orders: readonly AnalyticsOrder[]): OrderKpis {
  let paid = 0
  let open = 0
  let turnedAway = 0
  let grossCents = 0
  let refunded = 0
  let couponOrders = 0
  let discountCents = 0
  const paidPerCustomer = new Map<string, number>()

  for (const order of orders) {
    if (OPEN_STATUSES.has(order.status)) open += 1
    if (TURNED_AWAY.has(order.status)) turnedAway += 1
    if (!isPaid(order.status)) continue
    paid += 1
    grossCents += order.totalCents
    refunded += refundedCents(order)
    if (order.couponCode) {
      couponOrders += 1
      discountCents += order.discountCents
    }
    const key = customerKey(order.email)
    paidPerCustomer.set(key, (paidPerCustomer.get(key) ?? 0) + 1)
  }

  const decided = paid + turnedAway
  return {
    placed: orders.length,
    paid,
    open,
    confirmationRate: decided > 0 ? paid / decided : null,
    grossCents,
    refundedCents: refunded,
    netCents: grossCents - refunded,
    averageOrderCents: paid > 0 ? Math.round(grossCents / paid) : null,
    payingCustomers: paidPerCustomer.size,
    repeatCustomers: [...paidPerCustomer.values()].filter((n) => n >= 2).length,
    couponOrders,
    discountCents,
  }
}

/** The paying customers in `orders`, as grouping keys. */
export function payingCustomerKeys(orders: readonly AnalyticsOrder[]): string[] {
  return [...new Set(orders.filter((o) => isPaid(o.status)).map((o) => customerKey(o.email)))]
}

/**
 * Percentage change, rounded. Null when there is nothing to compare against — "up
 * from zero" has no percentage, and inventing one (∞, or 100%) misleads.
 */
export function percentChange(current: number, previous: number): number | null {
  if (previous === 0) return null
  return Math.round(((current - previous) / previous) * 100)
}

export interface SeriesPoint {
  readonly bucket: Bucket
  readonly netCents: number
  readonly paid: number
}

export function revenueSeries(orders: readonly AnalyticsOrder[], period: Period): SeriesPoint[] {
  const points = period.buckets.map((bucket) => ({ bucket, netCents: 0, paid: 0 }))
  for (const order of orders) {
    if (!isPaid(order.status)) continue
    const t = order.createdAt.getTime()
    // At most thirty contiguous buckets: a linear scan is cheaper than being clever.
    const point = points.find((p) => t >= p.bucket.start.getTime() && t < p.bucket.end.getTime())
    if (point) {
      point.netCents += netCents(order)
      point.paid += 1
    }
  }
  return points
}

export interface BreakdownRow {
  readonly key: string
  readonly placed: number
  readonly paid: number
  readonly netCents: number
}

/**
 * Orders grouped by any one field, most revenue first. Rows whose key is null are
 * dropped — "no coupon" is not a coupon.
 */
export function breakdown(
  orders: readonly AnalyticsOrder[],
  keyOf: (order: AnalyticsOrder) => string | null,
): BreakdownRow[] {
  const rows = new Map<string, { key: string; placed: number; paid: number; netCents: number }>()
  for (const order of orders) {
    const key = keyOf(order)
    if (!key) continue
    const row = rows.get(key) ?? { key, placed: 0, paid: 0, netCents: 0 }
    row.placed += 1
    if (isPaid(order.status)) {
      row.paid += 1
      row.netCents += netCents(order)
    }
    rows.set(key, row)
  }
  return [...rows.values()].sort(
    (a, b) => b.netCents - a.netCents || b.placed - a.placed || a.key.localeCompare(b.key),
  )
}

export interface ProductSales {
  readonly name: string
  readonly line: string
  readonly units: number
  /** Sum of line totals: before discounts and shipping, and before refunds. */
  readonly salesCents: number
}

type MutableSales = { name: string; line: string; units: number; salesCents: number }

/** What paid orders contained, by product, best-selling first. */
export function productSales(orders: readonly AnalyticsOrder[]): ProductSales[] {
  const rows = new Map<string, MutableSales>()
  for (const order of orders) {
    if (!isPaid(order.status)) continue
    for (const item of order.items) {
      const key = `${item.productLine}::${item.productName}`
      const row = rows.get(key) ?? {
        name: item.productName,
        line: item.productLine,
        units: 0,
        salesCents: 0,
      }
      row.units += item.quantity
      row.salesCents += item.lineTotalCents
      rows.set(key, row)
    }
  }
  return [...rows.values()].sort(
    (a, b) => b.salesCents - a.salesCents || b.units - a.units || a.name.localeCompare(b.name),
  )
}

/** The same, rolled up by product line. */
export function lineSales(orders: readonly AnalyticsOrder[]): ProductSales[] {
  const rows = new Map<string, MutableSales>()
  for (const product of productSales(orders)) {
    const row = rows.get(product.line) ?? {
      name: product.line,
      line: product.line,
      units: 0,
      salesCents: 0,
    }
    row.units += product.units
    row.salesCents += product.salesCents
    rows.set(product.line, row)
  }
  return [...rows.values()].sort(
    (a, b) => b.salesCents - a.salesCents || a.line.localeCompare(b.line),
  )
}
