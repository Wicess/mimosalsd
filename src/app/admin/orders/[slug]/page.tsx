import { notFound } from 'next/navigation'
import { db } from '@/lib/db/client'
import { AdminPage } from '@/components/admin/shell'
import { AutoRefresh } from '@/components/admin/auto-refresh'
import { OrderActions } from '@/components/admin/order-actions'
import { ALLOWED_TRANSITIONS } from '@/lib/orders/transitions'
import { summariseRefunds } from '@/lib/orders/refunds'
import { RefundForm } from '@/components/admin/refund-form'
import { Badge } from '@/components/ui/badge'
import { jurisdictionName } from '@/lib/compliance/jurisdictions'
import type { UsJurisdictionCode } from '@/lib/compliance/types'
import { formatCents } from '@/lib/utils'
import { url } from '@/lib/seo/routes'
import { canAccessAdminPath } from '@/lib/admin/areas'
import { getAdminSession } from '@/lib/admin/auth'
import { welcomeLines } from '@/lib/orders/welcome-lines'

export const metadata = { title: 'Order' }

/**
 * One order, in full.
 *
 * The queue at /admin/orders is built for triage — scan, act, move on. This is the
 * page you open when something needs deciding: a payment to verify, a customer
 * chasing, a dispute to reconstruct months later.
 *
 * Everything on it is a SNAPSHOT taken at order time, and that is the point. Product
 * names, prices, the compliance verdict and the attestation wording are all frozen on
 * the order rather than read live, so a repriced product or a reworded attestation
 * cannot rewrite history. The event timeline is append-only for the same reason.
 */

const TONE: Record<string, 'warning' | 'info' | 'success' | 'danger' | 'neutral'> = {
  PENDING_VERIFICATION: 'warning',
  AWAITING_PAYMENT: 'warning',
  PAYMENT_CLAIMED: 'warning',
  PAID: 'success',
  PACKED: 'info',
  SHIPPED: 'info',
  DELIVERED: 'success',
  REJECTED: 'danger',
  CANCELLED: 'neutral',
  REFUNDED: 'neutral',
}

/**
 * Statuses that can carry a refund — an order that has been paid for.
 *
 * Mirrored in `app/actions/admin-refunds.ts`, which is the one that ENFORCES it. A
 * hidden form that the action would refuse is a nuisance; a visible form that the
 * action accepts on an unpaid order is a withdrawal recorded against money that
 * never came in. This copy exists so the panel does not render where the action
 * would refuse it.
 */
const REFUNDABLE_FROM = ['PAID', 'PACKED', 'SHIPPED', 'DELIVERED', 'REFUNDED']

function humanise(value: string): string {
  return value.replace(/_/g, ' ').toLowerCase()
}

function stamp(date: Date | null | undefined): string {
  return date ? date.toISOString().slice(0, 16).replace('T', ' ') : '—'
}

function Panel({
  title,
  hint,
  children,
}: {
  title: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <section className="rounded-lg border border-border bg-surface p-3.5 md:p-5">
      <h2 className="font-display text-lg text-foreground">{title}</h2>
      {hint ? <p className="mt-1 text-xs text-foreground-muted">{hint}</p> : null}
      <div className="mt-4">{children}</div>
    </section>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-[11px] font-medium tracking-wide text-foreground-subtle uppercase">
        {label}
      </dt>
      <dd className="mt-0.5 text-sm text-foreground">{children}</dd>
    </div>
  )
}

async function OrderDetail({ orderNumber }: { orderNumber: string }) {
  const order = await db.order.findUnique({
    where: { orderNumber },
    include: {
      items: true,
      shipments: { include: { items: true } },
      attestations: true,
      ageVerifications: true,
      paymentRequest: { include: { handle: true } },
      refunds: { orderBy: { createdAt: 'desc' } },
      events: { orderBy: { createdAt: 'desc' } },
    },
  })

  if (!order) notFound()

  // Display only; the proxy enforces the customers grant on the page itself.
  const session = await getAdminSession()
  const canSeeCustomer = canAccessAdminPath(session?.role, session?.adminAreas ?? [], '/admin/customers')

  const transitions = ALLOWED_TRANSITIONS[order.status] ?? []
  const refundSummary = summariseRefunds(order.totalCents, order.refunds)

  return (
    <div className="space-y-6">
      {/*
        Only while there is something left to happen. A delivered order does not
        change on its own, and refreshing it would wake the database for nothing.
      */}
      {transitions.length > 0 ? <AutoRefresh /> : null}

      <div className="flex flex-wrap items-center gap-3">
        <Badge tone={TONE[order.status] ?? 'neutral'}>{humanise(order.status)}</Badge>
        <span className="tabular text-sm text-foreground-muted">
          placed {stamp(order.placedAt ?? order.createdAt)}
        </span>
        <a
          href={url.orderStatus(order.orderToken)}
          target="_blank"
          rel="noreferrer"
          className="min-h-11 inline-flex items-center text-sm text-foreground-muted underline underline-offset-4 hover:text-foreground"
        >
          Customer&rsquo;s view
        </a>
        <a
          href={`/admin/orders/${order.orderNumber}/invoice`}
          className="min-h-11 inline-flex items-center text-sm text-foreground-muted underline underline-offset-4 hover:text-foreground"
        >
          Invoice &amp; packing slips
        </a>
      </div>

      <Panel
        title="Next step"
        hint="Every transition writes an immutable OrderEvent and, where the customer is waiting on us, sends the matching email."
      >
        <OrderActions token={order.orderToken} orderNumber={order.orderNumber} transitions={transitions} />
      </Panel>

      {/*
        Only from PAID onward. Before that there is no payment to return, and a
        refund form on an unpaid order invites recording a withdrawal against money
        that never arrived.
      */}
      {REFUNDABLE_FROM.includes(order.status) && (
        <Panel
          title="Refunds"
          hint="Money returned by hand, recorded here. This system holds no card processor, so nothing on this page moves money — it writes down what you already sent."
        >
          {order.refunds.length > 0 && (
            <ul className="mb-5 divide-y divide-border">
              {order.refunds.map((refund) => (
                <li key={refund.id} className="py-3 first:pt-0">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="tabular font-medium text-foreground">
                      {formatCents(refund.amountCents)}
                    </span>
                    <span className="tabular text-xs text-foreground-muted">
                      {stamp(refund.createdAt)} · {refund.issuedBy}
                    </span>
                  </div>
                  <p className="mt-1 text-sm leading-relaxed text-foreground-muted">
                    {refund.reason}
                  </p>
                  {(refund.method || refund.reference) && (
                    <p className="mt-1 text-xs text-foreground-subtle">
                      {refund.method ? humanise(refund.method) : 'Method not recorded'}
                      {refund.reference ? ` · ref ${refund.reference}` : ''}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}

          <div className="mb-5 flex flex-wrap gap-x-6 gap-y-1 text-sm">
            <span className="text-foreground-muted">
              Refunded{' '}
              <span className="tabular text-foreground">
                {formatCents(refundSummary.refundedCents)}
              </span>
            </span>
            <span className="text-foreground-muted">
              Remaining{' '}
              <span className="tabular text-foreground">
                {formatCents(refundSummary.remainingCents)}
              </span>
            </span>
          </div>

          {/*
            A full refund does NOT flip the status from here — `advanceOrder` owns
            transitions, validates them and sends the matching email. This says the
            arithmetic is complete and leaves the move to the control that enforces it.
          */}
          {refundSummary.fullyRefunded && order.status !== 'REFUNDED' && (
            <p className="mb-5 text-sm text-warning-fg">
              The full total has been returned. Move this order to Refunded above when
              you are ready.
            </p>
          )}

          <RefundForm
            token={order.orderToken}
            remainingCents={refundSummary.remainingCents}
          />
        </Panel>
      )}

      <Panel title="Items">
        <ul className="divide-y divide-border">
          {order.items.map((item) => (
            <li key={item.id} className="flex flex-wrap gap-2 py-3 first:pt-0">
              <div className="min-w-0 flex-1">
                <p className="font-medium text-foreground">{item.productName}</p>
                <p className="text-xs text-foreground-muted">
                  {item.variantName} · {humanise(item.productLine)} ·{' '}
                  {humanise(item.fulfillmentChannel)}
                </p>
              </div>
              <div className="text-right">
                <p className="tabular text-sm text-foreground">
                  {item.quantity} × {formatCents(item.unitPriceCents)}
                </p>
                <p className="tabular text-sm font-medium text-foreground">
                  {formatCents(item.lineTotalCents)}
                </p>
              </div>
            </li>
          ))}
        </ul>

        <dl className="mt-4 space-y-1 border-t border-border pt-4 text-sm">
          <div className="flex justify-between">
            <dt className="text-foreground-muted">Subtotal</dt>
            <dd className="tabular text-foreground">{formatCents(order.subtotalCents)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-foreground-muted">
              Shipping{order.freeShippingApplied ? ' (free shipping applied)' : ''}
            </dt>
            <dd className="tabular text-foreground">{formatCents(order.shippingCents)}</dd>
          </div>
          {order.paymentDiscountCents > 0 && (
            <div className="flex justify-between">
              <dt className="text-foreground-muted">
                Bitcoin discount
                {/* Frozen at order time so a rate change cannot rewrite the invoice. */}
              </dt>
              <dd className="tabular text-success-fg">
                −{formatCents(order.paymentDiscountCents)}
              </dd>
            </div>
          )}
          {order.discountCents > 0 && (
            <div className="flex justify-between">
              <dt className="text-foreground-muted">
                {/* Named, so an operator can match a discount to the campaign behind it. */}
                Discount{order.couponCode ? ` · ${order.couponCode}` : ''}
              </dt>
              <dd className="tabular text-success-fg">−{formatCents(order.discountCents)}</dd>
            </div>
          )}
          {welcomeLines(order).map((line) => (
            <div key={line.key} className="flex justify-between">
              <dt className="text-foreground-muted">{line.label}</dt>
              <dd className="tabular text-success-fg">−{formatCents(line.cents)}</dd>
            </div>
          ))}
          <div className="flex justify-between border-t border-border pt-2 text-base font-medium">
            <dt className="text-foreground">Total</dt>
            <dd className="tabular text-foreground">{formatCents(order.totalCents)}</dd>
          </div>
        </dl>
      </Panel>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Customer">
          <dl className="space-y-3">
            <Field label="Name">
              {order.firstName} {order.lastName}
            </Field>
            <Field label="Email">
              <a
                href={`mailto:${order.email}`}
                className="inline-block py-1 break-all underline underline-offset-4"
              >
                {order.email}
              </a>
            </Field>
            <Field label="Phone">{order.phone ?? '—'}</Field>
            <Field label="Delivery address">
              <span className="block">{order.addressLine1}</span>
              {order.addressLine2 && <span className="block">{order.addressLine2}</span>}
              <span className="block">
                {order.city}, {order.stateCode} {order.postalCode}
              </span>
              <span className="mt-1 block text-xs text-foreground-muted">
                {jurisdictionName(order.stateCode as UsJurisdictionCode)}
              </span>
            </Field>
          </dl>
          {canSeeCustomer ? (
            <a
              href={`/admin/customers/${order.orderNumber}`}
              className="mt-3 inline-flex min-h-11 items-center text-sm text-foreground-muted underline underline-offset-4 hover:text-foreground"
            >
              Every order from this customer
            </a>
          ) : null}
        </Panel>

        <Panel
          title="Payment"
          hint="Handles are issued from the rotating pool after the order is placed, never rendered into static HTML."
        >
          <dl className="space-y-3">
            <Field label="Preferred method">
              {order.preferredPaymentMethod ? humanise(order.preferredPaymentMethod) : '—'}
            </Field>
            {order.paymentRequest ? (
              <>
                <Field label="Issued handle">
                  {order.paymentRequest.handle
                    ? `${order.paymentRequest.handle.handle}${
                        order.paymentRequest.handle.burnedAt ? ' (burned)' : ''
                      }`
                    : '—'}
                </Field>
                <Field label="Amount">
                  {formatCents(order.paymentRequest.amountCents)}
                </Field>
                {order.paymentRequest.btcAddress && (
                  <Field label="Bitcoin address">
                    <span className="tabular break-all text-xs">
                      {order.paymentRequest.btcAddress}
                    </span>
                    <span className="mt-0.5 block text-xs text-foreground-muted">
                      {order.paymentRequest.btcConfirmations} confirmation
                      {order.paymentRequest.btcConfirmations === 1 ? '' : 's'}
                    </span>
                  </Field>
                )}
                <Field label="Claimed">{stamp(order.paymentRequest.claimedAt)}</Field>
                <Field label="Verified">
                  {stamp(order.paymentRequest.verifiedAt)}
                  {order.paymentRequest.verifiedBy
                    ? ` by ${order.paymentRequest.verifiedBy}`
                    : ''}
                </Field>
                <Field label="Reference">
                  {order.paymentRequest.txRef ?? '—'}
                </Field>
                <Field label="Receipts">
                  {order.paymentRequest.receiptKeys.length > 0 ? (
                    /*
                      Each link goes through /api/admin/orders/[n]/receipts/[i], which
                      re-checks the session and the orders grant, looks the key up from
                      the ORDER by index, and redirects to a signed URL that dies in two
                      minutes. The raw key is never rendered: in an href it would be a
                      permanent, shareable link to a customer's bank screenshot, and a
                      viewer that signed a key taken from the request would read any
                      private object in the bucket.

                      `rel="noreferrer"` so the signed target is not handed on to
                      whatever the receipt image links to.
                    */
                    <ul className="flex flex-wrap gap-2">
                      {order.paymentRequest.receiptKeys.map((key, i) => (
                        <li key={key}>
                          <a
                            href={`/api/admin/orders/${order.orderNumber}/receipts/${i}`}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex min-h-11 items-center rounded-md border border-border-strong bg-surface px-3 text-sm font-medium text-foreground hover:bg-surface-sunken"
                          >
                            Receipt {i + 1}
                            {key.endsWith('.pdf') ? ' (PDF)' : ''}
                          </a>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    '—'
                  )}
                </Field>
              </>
            ) : (
              <p className="text-sm text-foreground-muted">
                No payment instructions issued yet.
              </p>
            )}
          </dl>
        </Panel>
      </div>

      <Panel
        title="Shipments"
        hint="One per fulfilment channel. A cart with gummies and a vape produces two, because a PACT-regulated product cannot travel with an ordinary parcel."
      >
        {order.shipments.length === 0 ? (
          <p className="text-sm text-foreground-muted">Nothing packed yet.</p>
        ) : (
          <ul className="space-y-4">
            {order.shipments.map((shipment) => (
              <li key={shipment.id} className="rounded-md border border-border p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={shipment.channel === 'PARCEL' ? 'neutral' : 'warning'}>
                    {humanise(shipment.channel)}
                  </Badge>
                  <Badge tone="info">{humanise(shipment.status)}</Badge>
                  {shipment.requiresAdultSignature && (
                    <Badge tone="danger">adult signature</Badge>
                  )}
                </div>
                <dl className="mt-3 grid gap-3 md:grid-cols-2">
                  <Field label="Carrier">{shipment.carrier ?? '—'}</Field>
                  <Field label="Tracking">
                    {shipment.trackingUrl && shipment.trackingNumber ? (
                      <a
                        href={shipment.trackingUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="tabular inline-block py-1 break-all underline underline-offset-4"
                      >
                        {shipment.trackingNumber}
                      </a>
                    ) : (
                      (shipment.trackingNumber ?? '—')
                    )}
                  </Field>
                  <Field label="Shipped">{stamp(shipment.shippedAt)}</Field>
                  <Field label="Delivered">{stamp(shipment.deliveredAt)}</Field>
                  {shipment.requiresAdultSignature && (
                    <>
                      <Field label="Signed by">{shipment.signedBy ?? '—'}</Field>
                      <Field label="ID checked">
                        {shipment.idChecked ? 'yes' : 'no'}
                      </Field>
                    </>
                  )}
                </dl>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel
        title="Compliance evidence"
        hint="What the customer was shown and accepted, in the exact wording used at the time. Kept because the wording changes and the evidence must not."
      >
        {order.attestations.length === 0 && order.ageVerifications.length === 0 ? (
          <p className="text-sm text-foreground-muted">None recorded.</p>
        ) : (
          <ul className="space-y-3">
            {order.attestations.map((a) => (
              <li key={a.id} className="rounded-md border border-border p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone="info">{humanise(a.kind)}</Badge>
                  <span className="tabular text-xs text-foreground-muted">
                    {stamp(a.acceptedAt)}
                  </span>
                </div>
                <p className="mt-2 text-sm leading-relaxed text-foreground-muted">
                  {a.text}
                </p>
              </li>
            ))}
            {order.ageVerifications.map((v) => (
              <li key={v.id} className="rounded-md border border-border p-3">
                <Badge tone="warning">age verification</Badge>
                <p className="mt-2 text-xs text-foreground-muted">
                  {humanise(v.method)} · {humanise(v.result)} · {v.provider} ·{' '}
                  {stamp(v.verifiedAt)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel
        title="History"
        hint="Append-only. Never edited, never deleted — this is what a chargeback, a dispute or a regulator gets reconstructed from."
      >
        <ol className="space-y-3">
          {order.events.map((event) => (
            <li key={event.id} className="border-l-2 border-border pl-3">
              <div className="flex flex-wrap items-baseline gap-2">
                <span className="text-sm font-medium text-foreground">
                  {humanise(event.type)}
                </span>
                {event.fromStatus && event.toStatus && (
                  <span className="text-xs text-foreground-muted">
                    {humanise(event.fromStatus)} → {humanise(event.toStatus)}
                  </span>
                )}
                <span className="tabular text-xs text-foreground-subtle">
                  {stamp(event.createdAt)}
                </span>
              </div>
              {event.message && (
                <p className="mt-1 text-sm text-foreground-muted">{event.message}</p>
              )}
              {event.actorEmail && (
                <p className="text-xs text-foreground-subtle">by {event.actorEmail}</p>
              )}
            </li>
          ))}
        </ol>
      </Panel>
    </div>
  )
}

export default async function AdminOrderPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params

  return (
    <AdminPage
      title={`Order ${slug}`}
      description="Everything recorded against this order, frozen as it was at the time. Prices, product names, the compliance verdict and the attestation wording are all snapshots — a later change to the catalogue cannot rewrite what was sold."
    >
      <OrderDetail orderNumber={slug} />
    </AdminPage>
  )
}
