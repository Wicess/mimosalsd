import Link from 'next/link'
import { connection } from 'next/server'
import type { OrderStatus, Prisma } from '@prisma/client'
import { db } from '@/lib/db/client'
import { AdminPage, StatCard } from '@/components/admin/shell'
import { OrderActions } from '@/components/admin/order-actions'
import { ALLOWED_TRANSITIONS } from '@/lib/orders/transitions'
import { Badge } from '@/components/ui/badge'
import { CheckIcon } from '@/components/ui/icon'
import { jurisdictionName } from '@/lib/compliance/jurisdictions'
import type { UsJurisdictionCode } from '@/lib/compliance/types'
import { formatCents } from '@/lib/utils'
import { ORDER_STATUS_TONE, orderStatusLabel } from '@/lib/orders/status-tone'
import { paymentStateOf, revenueSummary, type PaymentState, type RevenueFigure } from '@/lib/orders/revenue'

export const metadata = { title: 'Orders' }

type SearchParams = Promise<Record<string, string | string[] | undefined>>

/*
  The views an owner asks for: everything, what has been paid, what money is still
  on its way, what is waiting to be verified, and what did not go ahead.
*/
const VIEWS = {
  all: { label: 'All orders', statuses: null },
  paid: { label: 'Paid', statuses: ['PAID', 'PACKED', 'SHIPPED', 'DELIVERED'] },
  waiting: { label: 'Waiting for payment', statuses: ['PAYMENT_CLAIMED', 'AWAITING_PAYMENT'] },
  verify: { label: 'To verify', statuses: ['PENDING_VERIFICATION'] },
  closed: { label: 'Cancelled & refunded', statuses: ['CANCELLED', 'REJECTED', 'REFUNDED'] },
} as const satisfies Record<string, { label: string; statuses: readonly OrderStatus[] | null }>
type ViewKey = keyof typeof VIEWS

const utcDate = (date: Date) =>
  date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })

const plural = (count: number, word: string) => `${count.toLocaleString('en-US')} ${word}${count === 1 ? '' : 's'}`

/** Where an order stands on money, as a badge beside its status. */
function PaymentBadge({ state, paidAt }: { state: PaymentState; paidAt: Date | null }) {
  switch (state) {
    case 'paid':
      return (
        <Badge tone="success" icon={<CheckIcon className="size-3.5" />}>
          Paid{paidAt ? ` · ${utcDate(paidAt)}` : ''}
        </Badge>
      )
    case 'refunded':
      return <Badge tone="danger">Refunded</Badge>
    case 'claimed':
      return <Badge tone="warning">Customer says paid · confirm it</Badge>
    case 'awaiting':
      return <Badge tone="neutral">Not paid yet</Badge>
    case 'unverified':
      return <Badge tone="neutral">Not verified yet</Badge>
    default:
      return null
  }
}

function money(figure: RevenueFigure, noun = 'paid order') {
  return { value: formatCents(figure.cents), hint: plural(figure.orders, noun) }
}

async function Revenue() {
  await connection()
  const revenue = await revenueSummary(new Date())
  const month = new Date().toLocaleDateString('en-US', { month: 'long', timeZone: 'UTC' })
  return (
    <section aria-labelledby="revenue-heading">
      <h2 id="revenue-heading" className="font-display text-xl text-foreground">
        Revenue
      </h2>
      <p className="mt-1 max-w-3xl text-sm text-foreground-muted">
        Money you have confirmed: an order counts once you press <em>Confirm payment received</em>,
        and keeps counting as it is packed, shipped and delivered. Refunds are taken off.
      </p>
      <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Total revenue"
          value={formatCents(revenue.allTime.cents)}
          hint={`${plural(revenue.allTime.orders, 'paid order')}${revenue.refundedCents ? `, after ${formatCents(revenue.refundedCents)} refunded` : ''}`}
          tone="success"
        />
        <StatCard label={`This month (${month})`} {...money(revenue.thisMonth)} />
        <StatCard label="Last 7 days" {...money(revenue.last7Days)} />
        <StatCard label="Today" {...money(revenue.today)} />
      </div>

      <p className="mt-5 text-xs font-medium tracking-wide text-foreground-subtle uppercase">
        Not revenue yet · counted once you confirm payment
      </p>
      {/* One per row until a tablet: this theme's `sm` is 375px, too narrow for three amounts. */}
      <div className="mt-2 grid grid-cols-1 gap-3 md:grid-cols-3">
        <StatCard
          label="Customer says paid"
          value={formatCents(revenue.claimed.cents)}
          hint={`${plural(revenue.claimed.orders, 'order')} to check and confirm`}
          {...(revenue.claimed.orders > 0 ? { tone: 'warning' as const } : {})}
        />
        <StatCard
          label="Waiting for payment"
          value={formatCents(revenue.awaiting.cents)}
          hint={`${plural(revenue.awaiting.orders, 'order')} with payment details sent`}
        />
        <StatCard
          label="To verify"
          value={formatCents(revenue.unverified.cents)}
          hint={`${plural(revenue.unverified.orders, 'new order request')}`}
        />
      </div>
    </section>
  )
}

async function Queue({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams
  const raw = Array.isArray(params.show) ? params.show[0] : params.show
  const view: ViewKey = raw && raw in VIEWS ? (raw as ViewKey) : 'all'
  const statuses = VIEWS[view].statuses
  const where: Prisma.OrderWhereInput = statuses ? { status: { in: [...statuses] } } : {}

  /*
   * Ordered by urgency, not recency. A claimed payment is the most time-sensitive
   * thing in the business: the customer has sent money and is waiting to hear.
   * The Paid view reads like a statement instead: newest payment first.
   */
  const [orders, counts] = await Promise.all([
    db.order.findMany({
      where,
      include: { items: true, shipments: true, attestations: true },
      orderBy: view === 'paid' ? [{ paidAt: { sort: 'desc', nulls: 'last' } }, { createdAt: 'desc' }] : [{ status: 'asc' }, { createdAt: 'desc' }],
      take: 100,
    }),
    db.order.groupBy({ by: ['status'], _count: { _all: true }, _sum: { totalCents: true } }),
  ])
  const countFor = (key: ViewKey) => {
    const within = VIEWS[key].statuses as readonly string[] | null
    return counts.filter((c) => c.status !== 'DRAFT' && (!within || within.includes(c.status))).reduce((sum, c) => sum + c._count._all, 0)
  }
  const shownTotal = orders.reduce((sum, order) => sum + order.totalCents, 0)

  const tabs = (
    <nav aria-label="Show orders" className="flex flex-wrap gap-2">
      {(Object.keys(VIEWS) as ViewKey[]).map((key) => (
        <Link
          key={key}
          href={key === 'all' ? '/admin/orders' : `/admin/orders?show=${key}`}
          prefetch={false}
          aria-current={key === view ? 'page' : undefined}
          className={`inline-flex min-h-11 items-center gap-2 rounded-md border px-3 text-sm ${
            key === view
              ? 'border-primary bg-primary-muted text-primary'
              : 'border-border-strong bg-surface text-foreground hover:bg-surface-sunken'
          }`}
        >
          {VIEWS[key].label}
          <span className="tabular rounded-full bg-surface-sunken px-2 py-0.5 text-xs text-foreground-muted">{countFor(key)}</span>
        </Link>
      ))}
    </nav>
  )

  if (orders.length === 0) {
    return (
      <>
        {tabs}
        <div className="mt-4 rounded-lg border border-border bg-surface p-10 text-center">
          <p className="font-medium text-foreground">{view === 'all' ? 'No orders yet.' : `No orders under “${VIEWS[view].label}”.`}</p>
          <p className="mt-1 text-sm text-foreground-muted">
            New order requests appear here, and ops receives an ntfy push the moment one
            lands.
          </p>
        </div>
      </>
    )
  }

  return (
    <>
    {tabs}
    {view === 'paid' ? (
      <p className="mt-3 text-sm text-foreground-muted">
        {plural(orders.length, 'paid order')} shown, worth {formatCents(shownTotal)} before any refunds
        {orders.length === 100 ? ' (the latest 100)' : ''}.
      </p>
    ) : null}
    <ul className="mt-4 space-y-4">
      {orders.map((order) => (
        <li key={order.id} className="rounded-lg border border-border bg-surface p-4">
          <div className="flex flex-wrap items-center gap-3">
            {/*
              The order NUMBER opens the admin detail view. It used to link to the
              customer's own /order/[token] page, which is the one thing an operator
              never wants from the queue — they are triaging, not checking what the
              customer sees. That view is still one click away, from the detail page.
            */}
            <Link
              href={`/admin/orders/${order.orderNumber}`}
              className="tabular min-h-11 inline-flex items-center font-medium text-foreground underline underline-offset-4"
            >
              {order.orderNumber}
            </Link>
            <PaymentBadge state={paymentStateOf(order.status)} paidAt={order.paidAt} />
            <Badge tone={ORDER_STATUS_TONE[order.status] ?? 'neutral'}>
              {orderStatusLabel(order.status)}
            </Badge>
            <Badge tone="neutral">
              {(order.preferredPaymentMethod ?? 'unspecified').replace('_', ' ').toLowerCase()}
            </Badge>
            <span
              className={`tabular ml-auto font-semibold ${paymentStateOf(order.status) === 'paid' ? 'text-success-fg' : 'text-foreground'}`}
            >
              {formatCents(order.totalCents)}
            </span>
          </div>

          <div className="mt-2 grid gap-1 text-sm text-foreground-muted md:grid-cols-2">
            <p>
              {order.firstName} {order.lastName} · {order.email}
            </p>
            <p>
              {order.city}, {jurisdictionName(order.stateCode as UsJurisdictionCode)}{' '}
              {order.postalCode}
            </p>
            <p>
              {order.items.length} line{order.items.length === 1 ? '' : 's'} ·{' '}
              {order.shipments.length} shipment{order.shipments.length === 1 ? '' : 's'}
            </p>
            {/*
              UTC, and it says so.

              Without a `timeZone` this formats in whatever zone the renderer sits in:
              UTC on the server, the operator's own zone in the browser. React found
              two different strings for the same order and reported a hydration
              mismatch on every load of this page — and an operator comparing it
              against the event log, which is UTC, was reading two clocks. The
              analytics pages already pin UTC; this one now matches them.
            */}
            <p>
              Placed{' '}
              {new Date(order.createdAt).toLocaleString('en-US', {
                dateStyle: 'medium',
                timeStyle: 'short',
                timeZone: 'UTC',
              })}{' '}
              UTC
            </p>
          </div>

          {order.shipments.some((s) => s.requiresAdultSignature) && (
            <p className="mt-2 text-sm text-warning-fg">
              Adult signature and photo ID required on delivery.
            </p>
          )}

          {order.attestations.length > 0 && (
            <p className="mt-2 text-xs text-foreground-subtle">
              Attestations on file: {order.attestations.map((a) => a.kind.replace(/_/g, ' ').toLowerCase()).join(' · ')}
            </p>
          )}

          <div className="mt-3 border-t border-border pt-3">
            <OrderActions
              token={order.orderToken}
              orderNumber={order.orderNumber}
              transitions={ALLOWED_TRANSITIONS[order.status] ?? []}
            />
          </div>
        </li>
      ))}
    </ul>
    </>
  )
}

export default function AdminOrdersPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <AdminPage
      title="Orders"
      description="What you have made, then every order. Marking an order paid stays a human decision: a customer saying they have paid only moves it to payment claimed. Every change is written to an append-only event log."
    >
      <Revenue />
      <div className="mt-8">
        <Queue searchParams={searchParams} />
      </div>
    </AdminPage>
  )
}
