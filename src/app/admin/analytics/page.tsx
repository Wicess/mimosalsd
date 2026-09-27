import { connection } from 'next/server'
import { AdminPage, StatCard } from '@/components/admin/shell'
import { BarChart, NumberTable, RangeTabs } from '@/components/admin/figures'
import { jurisdictionName } from '@/lib/compliance/jurisdictions'
import type { ProductLine, UsJurisdictionCode } from '@/lib/compliance/types'
import { LINE_SHORT } from '@/lib/legality/state-pages'
import { PAYMENT_LABELS, type PaymentMethod } from '@/lib/orders/types'
import {
  ANALYTICS_RANGE_LABEL,
  analyticsPeriod,
  breakdown,
  LAST_24_HOURS,
  lineSales,
  orderKpis,
  parseAnalyticsRange,
  payingCustomerKeys,
  percentChange,
  productSales,
  RANGES,
  revenueSeries,
  type AnalyticsRange,
  type BreakdownRow,
  type Period,
  type SeriesPoint,
} from '@/lib/analytics/orders'
import { lastDayOfVisits, periodVisitTotals, weekdayComparison } from '@/lib/analytics/visits'
import type { WeekdayRow } from '@/lib/analytics/weekday'
import { ANALYTICS_ROW_CAP, customersPaidBefore, ordersPlacedBetween } from '@/lib/analytics/queries'
import { formatCents } from '@/lib/utils'

export const metadata = { title: 'Analytics' }

type SearchParams = Promise<Record<string, string | string[] | undefined>>

const lineName = (line: string) => LINE_SHORT[line as ProductLine] ?? line
const methodName = (method: string) => PAYMENT_LABELS[method as PaymentMethod] ?? method
const percent = (ratio: number) => `${Math.round(ratio * 100)}%`

/** "+12% vs the previous 30 days", or why there is no percentage. */
function versus(current: number, previous: number, range: AnalyticsRange): string {
  const change = percentChange(current, previous)
  const span = `the previous ${ANALYTICS_RANGE_LABEL[range]}`
  if (change === null) return current === 0 ? `none in ${span} either` : `none in ${span}`
  if (change === 0) return `level with ${span}`
  return `${change > 0 ? '+' : '−'}${Math.abs(change)}% vs ${span}`
}

function Section({
  title,
  hint,
  children,
}: {
  title: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <section className="mt-8">
      <h2 className="font-display text-lg text-foreground">{title}</h2>
      {hint ? (
        <p className="mt-1 max-w-2xl text-xs leading-relaxed text-foreground-muted">{hint}</p>
      ) : null}
      <div className="mt-3">{children}</div>
    </section>
  )
}

/** Net revenue per bar. The chart itself is shared with visitors (figures.tsx). */
function RevenueChart({ series, range }: { series: readonly SeriesPoint[]; range: AnalyticsRange }) {
  const peak = series.reduce<SeriesPoint | null>(
    (best, point) => (point.netCents > (best?.netCents ?? 0) ? point : best),
    null,
  )
  if (!peak) {
    return (
      <p className="rounded-lg border border-border bg-surface p-6 text-sm text-foreground-muted">
        No paid orders in the last {ANALYTICS_RANGE_LABEL[range]}.
      </p>
    )
  }

  const bucketHeader = range === LAST_24_HOURS ? 'Hour' : { day: 'Day', week: 'Week', month: 'Month' }[RANGES[range].bucket]
  const orders = (n: number) => `${n} paid order${n === 1 ? '' : 's'}`

  return (
    <BarChart
      caption={
        <>
          Best {bucketHeader.toLowerCase()}:{' '}
          <span className="text-foreground">{peak.bucket.title}</span>,{' '}
          <span className="tabular font-medium text-foreground">{formatCents(peak.netCents)}</span>{' '}
          from {orders(peak.paid)}
        </>
      }
      points={series.map((point) => ({
        key: point.bucket.start.toISOString(),
        label: point.bucket.label,
        title: point.bucket.title,
        value: point.netCents,
        detail: orders(point.paid),
        cells: [point.paid, formatCents(point.netCents)],
      }))}
      format={formatCents}
      tableHeaders={[bucketHeader, 'Paid orders', 'Net revenue']}
    />
  )
}

function BreakdownTable({
  rows,
  header,
  name,
  limit = 10,
}: {
  rows: readonly BreakdownRow[]
  header: string
  name: (key: string) => string
  limit?: number
}) {
  if (rows.length === 0) return <p className="text-sm text-foreground-muted">Nothing in this period.</p>
  return (
    <NumberTable
      headers={[header, 'Placed', 'Paid', 'Net revenue']}
      rows={rows.slice(0, limit).map((row) => ({
        key: row.key,
        cells: [name(row.key), row.placed, row.paid, formatCents(row.netCents)],
      }))}
    />
  )
}

const number = (n: number) => n.toLocaleString('en-US')
const MINUS = '\u2212'

/** "+21%" in green, "-8%" in red, or a plain word when there is no percentage. */
function Change({ current, previous }: { current: number; previous: number }) {
  const change = percentChange(current, previous)
  if (change === null) return <span className="text-foreground-subtle">{current > 0 ? 'new' : 'none'}</span>
  if (change === 0) return <span className="text-foreground-muted">level</span>
  return (
    <span className={change > 0 ? 'text-success-fg' : 'text-danger-fg'}>
      {change > 0 ? '+' : MINUS}
      {Math.abs(change)}%
    </span>
  )
}

const dayLabel = (date: Date, options: Intl.DateTimeFormatOptions = { weekday: 'long', month: 'short', day: 'numeric' }) =>
  date.toLocaleDateString('en-US', { timeZone: 'UTC', ...options })

/** Visitors and page views for the chosen period, and for 24 hours, hour by hour with the reason. */
async function VisitsSection({ range, period, now }: { range: AnalyticsRange; period: Period; now: Date }) {
  if (range === LAST_24_HOURS) {
    const visits = await lastDayOfVisits(period.start, period.end)
    const points = period.buckets.map((bucket) => {
      const inHour = visits.views.filter((v) => v.at >= bucket.start.getTime() && v.at < bucket.end.getTime())
      const people = new Set(inHour.map((v) => v.visitorId)).size
      return {
        key: bucket.start.toISOString(),
        label: bucket.label,
        title: bucket.title,
        value: inHour.length,
        detail: `${number(people)} visitor${people === 1 ? '' : 's'}`,
        cells: [number(inHour.length), number(people)],
      }
    })
    return (
      <Section
        title="Visitors and page views, last 24 hours"
        hint="Real visitors only: bots are left out. Compared with the 24 hours before. Hours are UTC."
      >
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard label="Visitors" value={number(visits.current.visitors)} hint={versus(visits.current.visitors, visits.previous.visitors, range)} />
          <StatCard label="Page views" value={number(visits.current.views)} hint={versus(visits.current.views, visits.previous.views, range)} />
          <StatCard label="First-time visitors" value={number(visits.current.newVisitors)} hint={`${number(visits.previous.newVisitors)} the 24 hours before`} />
          <StatCard label="Orders placed" value={number(visits.current.orders)} hint={`${number(visits.previous.orders)} the 24 hours before`} />
        </div>
        <p className="mt-3 rounded-lg border border-border bg-surface p-3 text-sm leading-relaxed text-foreground">{visits.reason}</p>
        <div className="mt-4">
          {visits.current.views === 0 ? (
            <p className="rounded-lg border border-border bg-surface p-6 text-sm text-foreground-muted">No real visitors in the last 24 hours.</p>
          ) : (
            <BarChart
              caption={`${number(visits.current.views)} page views by ${number(visits.current.visitors)} visitors`}
              points={points}
              format={number}
              floor={2}
              tableHeaders={['Hour', 'Page views', 'Visitors']}
            />
          )}
        </div>
      </Section>
    )
  }

  const totals = await periodVisitTotals(period.start, period.end, period.previousStart, now)
  return (
    <Section
      title="Visitors and page views"
      hint="Real visitors only. A visitor counts once per day they visit. The Visitors page has the day-by-day chart."
    >
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Visitors" value={number(totals.current.visitors)} hint={versus(totals.current.visitors, totals.previous.visitors, range)} />
        <StatCard label="Page views" value={number(totals.current.views)} hint={versus(totals.current.views, totals.previous.views, range)} />
      </div>
    </Section>
  )
}

/** Each of the last seven days against the same weekday a week before, with the reason. */
function WeekdayTable({ rows }: { rows: readonly WeekdayRow[] }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-border-data">
      <table className="w-full min-w-[46rem] text-sm">
        <thead className="bg-surface-data">
          <tr>
            {['Day', 'Visitors', 'Page views', 'Orders', 'Why'].map((header, i) => (
              <th
                key={header}
                scope="col"
                className={`px-3 py-2 font-medium text-foreground ${i === 0 || i === 4 ? 'text-left' : 'text-right'}`}
              >
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.day.toISOString()} className="border-t border-border-data align-top">
              <td className="px-3 py-2.5 whitespace-nowrap">
                <span className="block font-medium text-foreground">
                  {dayLabel(row.day)}
                  {row.partial ? <span className="ml-1.5 text-xs font-normal text-accent-fg">so far</span> : null}
                </span>
                <span className="block text-xs text-foreground-muted">
                  vs {dayLabel(row.previousDay, { month: 'short', day: 'numeric' })}
                  {row.partial ? ' at this time' : ''}
                </span>
              </td>
              {(['visitors', 'views', 'orders'] as const).map((field) => (
                <td key={field} className="tabular px-3 py-2.5 text-right whitespace-nowrap">
                  <span className="block font-semibold text-foreground">{number(row.current[field])}</span>
                  <span className="block text-xs text-foreground-muted">
                    vs {number(row.previous[field])} · <Change current={row.current[field]} previous={row.previous[field]} />
                  </span>
                </td>
              ))}
              <td className="min-w-[18rem] px-3 py-2.5 text-xs leading-relaxed text-foreground-muted">{row.reason}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

async function Analytics({ searchParams }: { searchParams: SearchParams }) {
  const range = parseAnalyticsRange((await searchParams).range)
  // Read the clock at request time, never while prerendering.
  await connection()
  const clock = new Date()
  const period = analyticsPeriod(range, clock)

  // One read covers this period and the one before it, for the comparisons.
  const rows = await ordersPlacedBetween(period.previousStart, period.end)
  const capped = rows.length === ANALYTICS_ROW_CAP
  const current = rows.filter((o) => o.createdAt >= period.start)
  const previous = rows.filter((o) => o.createdAt < period.start)

  const now = orderKpis(current)
  const before = orderKpis(previous)
  const paying = payingCustomerKeys(current)
  const returning = (await customersPaidBefore(paying, period.start)).size

  const series = revenueSeries(current, period)
  const lines = lineSales(current)
  const products = productSales(current)
  const byState = breakdown(current, (o) => o.stateCode)
  const byMethod = breakdown(current, (o) => o.preferredPaymentMethod)
  const byCoupon = breakdown(current, (o) => o.couponCode)
  const byStatus = breakdown(current, (o) => o.status).sort((a, b) => b.placed - a.placed)

  return (
    <>
      <RangeTabs
        current={range}
        options={(Object.keys(ANALYTICS_RANGE_LABEL) as AnalyticsRange[]).map((key) => ({ key, label: ANALYTICS_RANGE_LABEL[key] }))}
      />

      {capped ? (
        <p className="mt-4 rounded-md bg-warning-bg p-3 text-sm text-warning-fg">
          This period and the one before it hold more than {ANALYTICS_ROW_CAP.toLocaleString('en-US')}{' '}
          orders, so only the most recent {ANALYTICS_ROW_CAP.toLocaleString('en-US')} are counted.
          The comparison figures are understated. Choose a shorter period for exact numbers.
        </p>
      ) : null}

      <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Net revenue"
          value={formatCents(now.netCents)}
          hint={versus(now.netCents, before.netCents, range)}
        />
        <StatCard
          label="Paid orders"
          value={now.paid}
          hint={versus(now.paid, before.paid, range)}
        />
        <StatCard
          label="Average order"
          value={now.averageOrderCents === null ? '—' : formatCents(now.averageOrderCents)}
          hint={
            now.averageOrderCents === null
              ? 'no paid orders'
              : versus(now.averageOrderCents, before.averageOrderCents ?? 0, range)
          }
        />
        <StatCard
          label="Paying customers"
          value={now.payingCustomers}
          hint={
            now.payingCustomers > 0
              ? `${returning} returning, ${now.payingCustomers - returning} new`
              : versus(0, before.payingCustomers, range)
          }
        />
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Confirmation rate"
          value={now.confirmationRate === null ? '—' : percent(now.confirmationRate)}
          hint={`paid of decided orders · ${now.open} still open`}
        />
        <StatCard
          label="Refunded"
          value={formatCents(now.refundedCents)}
          hint={
            now.grossCents > 0
              ? `${percent(now.refundedCents / now.grossCents)} of paid revenue`
              : 'no paid revenue'
          }
        />
        <StatCard
          label="Coupon orders"
          value={now.couponOrders}
          hint={
            now.couponOrders > 0
              ? `${formatCents(now.discountCents)} discounted · ${percent(now.couponOrders / now.paid)} of paid`
              : 'no discounts given'
          }
        />
        <StatCard
          label="Repeat buyers"
          value={now.repeatCustomers}
          hint="paid twice or more in this period"
        />
      </div>

      <VisitsSection range={range} period={period} now={clock} />

      <Section
        title="Same day, week on week"
        hint="Each of the last seven days against the same weekday a week earlier, so a Tuesday is judged against a Tuesday. Today is compared up to the same time of day. Real visitors only; days are UTC. The reason is worked out from what changed: where visitors came from, where they are, their device, the pages they read, and orders."
      >
        <WeekdayTable rows={await weekdayComparison(clock)} />
      </Section>

      <Section
        title="Net revenue"
        hint="By the date each order was placed. A refund lowers the period its order was placed in, not the day it was sent — right for judging a period, wrong for reconciling a bank statement. Days are UTC."
      >
        <RevenueChart series={series} range={range} />
      </Section>

      <div className="grid gap-x-6 lg:grid-cols-2">
        <Section
          title="By product line"
          hint="Merchandise from paid orders: before discounts and shipping, and before refunds."
        >
          {lines.length === 0 ? (
            <p className="text-sm text-foreground-muted">Nothing sold in this period.</p>
          ) : (
            <NumberTable
              headers={['Line', 'Units', 'Sales']}
              rows={lines.map((line) => ({
                key: line.line,
                cells: [lineName(line.line), line.units, formatCents(line.salesCents)],
              }))}
            />
          )}
        </Section>

        <Section title="Top products" hint="The ten best sellers by the same measure.">
          {products.length === 0 ? (
            <p className="text-sm text-foreground-muted">Nothing sold in this period.</p>
          ) : (
            <NumberTable
              headers={['Product', 'Units', 'Sales']}
              rows={products.slice(0, 10).map((product) => ({
                key: `${product.line}::${product.name}`,
                cells: [
                  <>
                    {product.name}
                    <span className="block text-xs text-foreground-muted">
                      {lineName(product.line)}
                    </span>
                  </>,
                  product.units,
                  formatCents(product.salesCents),
                ],
              }))}
            />
          )}
        </Section>

        <Section title="By state" hint="The ten states with the most net revenue.">
          <BreakdownTable
            rows={byState}
            header="State"
            name={(code) => jurisdictionName(code as UsJurisdictionCode)}
          />
        </Section>

        <Section
          title="By payment method"
          hint="Placed against paid shows which rails customers abandon or fail to complete."
        >
          <BreakdownTable rows={byMethod} header="Method" name={methodName} />
        </Section>
      </div>

      <Section title="Coupons" hint="Orders placed with each code. Net revenue is after the discount.">
        <BreakdownTable rows={byCoupon} header="Code" name={(code) => code} limit={25} />
      </Section>

      <Section title="Orders by status" hint="Where this period's orders stand now.">
        {byStatus.length === 0 ? (
          <p className="text-sm text-foreground-muted">No orders in this period.</p>
        ) : (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
            {byStatus.map((s) => (
              <StatCard
                key={s.key}
                label={s.key.replace(/_/g, ' ').toLowerCase()}
                value={s.placed}
              />
            ))}
          </div>
        )}
      </Section>
    </>
  )
}

export default function AdminAnalyticsPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <AdminPage
      title="Analytics"
      description="What organic actually produced. Paid advertising is prohibited in this category, so there is no ad spend to attribute. Money counts once a payment is confirmed, less refunds — the same rule the customer pages use. Nothing here refreshes on its own; reload to update."
    >
      <Analytics searchParams={searchParams} />
    </AdminPage>
  )
}
