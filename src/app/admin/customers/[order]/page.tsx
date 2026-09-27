import Link from 'next/link'
import { notFound } from 'next/navigation'
import { AdminPage, Cell, DataTable, Row, StatCard } from '@/components/admin/shell'
import { Badge } from '@/components/ui/badge'
import { canAccessAdminPath } from '@/lib/admin/areas'
import { getAdminSession } from '@/lib/admin/auth'
import { jurisdictionName } from '@/lib/compliance/jurisdictions'
import type { UsJurisdictionCode } from '@/lib/compliance/types'
import { customerContact, customerOrdersFor, type CustomerOrderRow } from '@/lib/customers/queries'
import { netCents, summariseCustomer, type Tally } from '@/lib/customers/summary'
import { ORDER_STATUS_TONE, orderStatusLabel } from '@/lib/orders/status-tone'
import { PAYMENT_LABELS, type PaymentMethod } from '@/lib/orders/types'
import { formatCents } from '@/lib/utils'

export const metadata = { title: 'Customer' }

/**
 * One customer, assembled from their orders.
 *
 * The URL names an ORDER, not a person: `/admin/customers/DEMO-000010` is "whoever
 * placed DEMO-000010". There is no customer id to use — checkout is guest-first — and
 * the email itself would put a customer's address into every request log, browser
 * history and shared link. The list links by each customer's FIRST order, which never
 * changes, so the link survives their next purchase; any of their order numbers
 * resolves to the same page, which is what lets an order page link here for free.
 */

function humanise(value: string): string {
  return value.replace(/_/g, ' ').toLowerCase()
}

function paymentLabel(method: string): string {
  return PAYMENT_LABELS[method as PaymentMethod] ?? humanise(method)
}

function day(date: Date | null | undefined): string {
  return date ? date.toISOString().slice(0, 10) : '—'
}

function Panel({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-border bg-surface p-4 sm:p-5">
      <h2 className="font-display text-lg text-foreground">{title}</h2>
      {hint ? <p className="mt-1 text-xs text-foreground-muted">{hint}</p> : null}
      <div className="mt-4">{children}</div>
    </section>
  )
}

function TallyList({
  items,
  format = humanise,
}: {
  items: readonly Tally[]
  format?: (value: string) => string
}) {
  if (items.length === 0) return <p className="text-sm text-foreground-muted">None recorded.</p>
  return (
    <ul className="flex flex-wrap gap-2">
      {items.map((item) => (
        <li
          key={item.value}
          className="rounded-md border border-border bg-surface-sunken px-2.5 py-1 text-sm text-foreground"
        >
          {format(item.value)}
          <span className="tabular ml-1.5 text-xs text-foreground-muted">×{item.count}</span>
        </li>
      ))}
    </ul>
  )
}

/**
 * Distinct delivery addresses, most used first. Compared loosely — case and spacing
 * — because "12 Oak St" and "12 oak st " are one door. Several addresses under one
 * email is ordinary (home, work, a gift); it is also the first thing to look at when
 * an order is being reshipped somewhere it should not go.
 */
function addresses(orders: readonly CustomerOrderRow[]) {
  const seen = new Map<string, { lines: string[]; count: number; last: Date }>()
  for (const o of orders) {
    const lines = [
      [o.addressLine1, o.addressLine2].filter(Boolean).join(', '),
      `${o.city}, ${o.stateCode} ${o.postalCode}`,
    ]
    const key = lines.join('|').toLowerCase().replace(/\s+/g, ' ').trim()
    const entry = seen.get(key)
    if (entry) {
      entry.count += 1
      if (o.createdAt > entry.last) entry.last = o.createdAt
    } else {
      seen.set(key, { lines, count: 1, last: o.createdAt })
    }
  }
  return [...seen.values()].sort(
    (a, b) => b.count - a.count || b.last.getTime() - a.last.getTime(),
  )
}

async function CustomerDetail({ params }: { params: Promise<{ order: string }> }) {
  // Awaited here, inside the page's Suspense boundary, so the frame streams first.
  const { order: orderNumber } = await params
  const orders = await customerOrdersFor(orderNumber)
  const latest = orders.at(-1)
  if (!latest) notFound()

  const [contact, session] = await Promise.all([
    customerContact(latest.email),
    getAdminSession(),
  ])
  const summary = summariseCustomer(orders)
  const newestFirst = [...orders].reverse()
  const places = addresses(orders)
  const phones = [...new Set(newestFirst.map((o) => o.phone?.trim()).filter(Boolean))]
  const spellings = [...new Set(orders.map((o) => o.email))]

  // Display only — the proxy is what enforces areas. A staff member granted
  // customers but not orders should see order numbers, not links that refuse them.
  const can = (path: string) =>
    canAccessAdminPath(session?.role, session?.adminAreas ?? [], path)
  const canOrders = can('/admin/orders')
  const canMessages = can('/admin/messages')

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <p className="font-display text-xl text-foreground">
          {latest.firstName} {latest.lastName}
        </p>
        <a
          href={`mailto:${latest.email}`}
          className="inline-block py-1 text-sm break-all text-foreground-muted underline underline-offset-4"
        >
          {latest.email}
        </a>
        <span className="tabular text-sm text-foreground-muted">
          customer since {day(summary.firstOrderAt)}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Net spend"
          value={formatCents(summary.netCents)}
          hint={
            summary.refundedCents > 0
              ? `${formatCents(summary.grossCents)} paid, ${formatCents(summary.refundedCents)} refunded`
              : 'confirmed payments'
          }
        />
        <StatCard
          label="Paid orders"
          value={summary.paid}
          hint={
            summary.placed > summary.paid
              ? `of ${summary.placed} placed`
              : summary.paid > 1
                ? 'repeat customer'
                : undefined
          }
        />
        <StatCard
          label="Average order"
          value={summary.averageOrderCents === null ? '—' : formatCents(summary.averageOrderCents)}
          hint="paid orders, before refunds"
        />
        <StatCard label="Last order" value={day(summary.lastOrderAt)} />
      </div>

      <Panel
        title="Orders"
        hint="Newest first. Net is what the order is worth after refunds; an order never paid is worth nothing."
      >
        <DataTable headers={['Order', 'Placed', 'Status', 'Total', 'Net', 'Paid with']}>
          {newestFirst.map((o) => (
            <Row key={o.id}>
              <Cell>
                {canOrders ? (
                  <Link
                    href={`/admin/orders/${o.orderNumber}`}
                    prefetch={false}
                    className="tabular font-medium text-foreground underline underline-offset-4"
                  >
                    {o.orderNumber}
                  </Link>
                ) : (
                  <span className="tabular font-medium text-foreground">{o.orderNumber}</span>
                )}
              </Cell>
              <Cell className="tabular text-xs text-foreground-muted">{day(o.createdAt)}</Cell>
              <Cell>
                <Badge tone={ORDER_STATUS_TONE[o.status] ?? 'neutral'}>{orderStatusLabel(o.status)}</Badge>
              </Cell>
              <Cell className="tabular text-foreground">
                {formatCents(o.totalCents)}
                {o.couponCode ? (
                  <span className="block text-xs text-foreground-muted">
                    {o.couponCode} −{formatCents(o.discountCents)}
                  </span>
                ) : null}
              </Cell>
              <Cell className="tabular font-medium text-foreground">{formatCents(netCents(o))}</Cell>
              <Cell className="text-sm text-foreground-muted">
                {o.preferredPaymentMethod ? paymentLabel(o.preferredPaymentMethod) : '—'}
              </Cell>
            </Row>
          ))}
        </DataTable>
      </Panel>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Where they ship">
          <ul className="space-y-3">
            {places.map((place) => (
              <li key={place.lines.join('|')} className="text-sm">
                <span className="block text-foreground">{place.lines[0]}</span>
                <span className="block text-foreground">{place.lines[1]}</span>
                <span className="tabular block text-xs text-foreground-muted">
                  {place.count} order{place.count === 1 ? '' : 's'} · last {day(place.last)}
                </span>
              </li>
            ))}
          </ul>
          <div className="mt-4 border-t border-border pt-4">
            <TallyList
              items={summary.states}
              format={(code) => jurisdictionName(code as UsJurisdictionCode)}
            />
          </div>
        </Panel>

        <Panel title="How they pay">
          <h3 className="text-[11px] font-medium tracking-wide text-foreground-subtle uppercase">Payment methods</h3>
          <div className="mt-2">
            <TallyList items={summary.paymentMethods} format={paymentLabel} />
          </div>
          <h3 className="mt-5 text-[11px] font-medium tracking-wide text-foreground-subtle uppercase">Coupons</h3>
          <div className="mt-2">
            <TallyList items={summary.coupons} format={(code) => code} />
          </div>
        </Panel>
      </div>

      <Panel title="Contact">
        <dl className="grid gap-4 md:grid-cols-2">
          <div>
            <dt className="text-[11px] font-medium tracking-wide text-foreground-subtle uppercase">Phone</dt>
            <dd className="mt-0.5 text-sm text-foreground">
              {phones.length > 0 ? phones.map((p) => <span key={p} className="tabular block">{p}</span>) : '—'}
            </dd>
          </div>
          <div>
            <dt className="text-[11px] font-medium tracking-wide text-foreground-subtle uppercase">Newsletter</dt>
            <dd className="mt-0.5 text-sm text-foreground">
              {!contact.newsletter
                ? 'Not subscribed'
                : !contact.newsletter.isActive
                  ? 'Unsubscribed'
                  : contact.newsletter.confirmedAt
                    ? `Subscribed, confirmed ${day(contact.newsletter.confirmedAt)}`
                    : 'Subscribed, not yet confirmed'}
            </dd>
          </div>
          {spellings.length > 1 ? (
            <div className="sm:col-span-2">
              <dt className="text-[11px] font-medium tracking-wide text-foreground-subtle uppercase">
                Spellings of this address on orders
              </dt>
              <dd className="mt-0.5 text-sm break-all text-foreground">{spellings.join(' · ')}</dd>
            </div>
          ) : null}
          <div className="sm:col-span-2">
            <dt className="text-[11px] font-medium tracking-wide text-foreground-subtle uppercase">Conversations</dt>
            <dd className="mt-1 text-sm text-foreground">
              {contact.threads.length === 0 ? (
                'None under this email.'
              ) : (
                <ul className="divide-y divide-border">
                  {contact.threads.map((t, i) => (
                    <li key={t.publicId ?? i} className="flex flex-wrap items-baseline gap-x-3 py-2 first:pt-0">
                      <span className="tabular font-medium">{t.publicId ?? '—'}</span>
                      <span className="min-w-0 flex-1 text-foreground-muted">{t.subject ?? 'Live chat'}</span>
                      <span className="text-xs text-foreground-muted">
                        {t.isOpen ? 'open' : 'closed'} · {day(t.lastMessageAt)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              {contact.threads.length > 0 && canMessages ? (
                <Link
                  href="/admin/messages"
                  prefetch={false}
                  className="mt-2 inline-flex min-h-11 items-center text-sm text-foreground-muted underline underline-offset-4 hover:text-foreground"
                >
                  Open the inbox
                </Link>
              ) : null}
            </dd>
          </div>
        </dl>
      </Panel>
    </div>
  )
}

export default function AdminCustomerPage({ params }: { params: Promise<{ order: string }> }) {
  return (
    <AdminPage
      title="Customer"
      description="Everyone who ordered under this email address, however they spelled it. Money counts only once a payment was confirmed, less anything refunded."
      actions={
        <Link
          href="/admin/customers"
          className="inline-flex min-h-11 items-center rounded-md border border-border-strong bg-surface px-3 text-sm font-medium text-foreground hover:bg-surface-sunken"
        >
          All customers
        </Link>
      }
    >
      <CustomerDetail params={params} />
    </AdminPage>
  )
}
