import type { Metadata } from 'next'
import { PageSection } from '@/components/layout/page-section'
import { Suspense } from 'react'
import { notFound } from 'next/navigation'
import { orders } from '@/lib/orders/repository'
import { PAYMENT_LABELS } from '@/lib/orders/types'
import { db } from '@/lib/db/client'
import { buildPaymentInstructions, formatUtc } from '@/lib/payments/instructions'
import { jurisdictionName } from '@/lib/compliance/jurisdictions'
import { Badge } from '@/components/ui/badge'
import { AlertIcon, CheckIcon, InfoIcon, ShieldIcon, TruckIcon } from '@/components/ui/icon'
import { PAYMENT_SECURITY_STATEMENT } from '@/lib/compliance/disclaimers'
import { PaymentProofForm } from '@/components/commerce/payment-proof-form'
import { formatCents } from '@/lib/utils'
import { RememberChatThread } from '@/components/chat/remember-thread'
import { RememberOrder } from '@/components/account/remember-order'
import { welcomeLines } from '@/lib/orders/welcome-lines'

export const metadata: Metadata = {
  title: 'Your order',
  // Contains PII and payment instructions. Must never be indexed or followed.
  robots: { index: false, follow: false, nocache: true },
}

const STATUS_COPY: Record<string, { label: string; tone: 'info' | 'warning' | 'success'; detail: string }> = {
  PENDING_VERIFICATION: {
    label: 'Verifying your order',
    tone: 'info',
    detail:
      'We are confirming stock and delivery for your address. This is usually quick. As soon as it is done, your payment details arrive in the chat on this site and by email, with your invoice.',
  },
  AWAITING_PAYMENT: {
    label: 'Awaiting payment',
    tone: 'warning',
    detail: 'Send payment using the instructions below, then let us know.',
  },
  PAYMENT_CLAIMED: {
    label: 'Checking your payment',
    tone: 'info',
    detail: 'Thanks — we are confirming receipt. You do not need to do anything else.',
  },
  PAID: { label: 'Payment received', tone: 'success', detail: 'We are preparing your order for despatch.' },
  PACKED: { label: 'Packed', tone: 'success', detail: 'Your order is packed and awaiting collection.' },
  SHIPPED: { label: 'Shipped', tone: 'success', detail: 'Your order is on its way.' },
  DELIVERED: { label: 'Delivered', tone: 'success', detail: 'Delivered. Thank you.' },
}

/**
 * How to pay: exactly what the owner issued, or nothing yet.
 *
 * It used to name a handle the moment an order existed, picked from the pool for
 * this token, before anyone had verified the order and whatever the owner later
 * sent. Now the owner verifies the order and sends the details from the admin (see
 * lib/payments/issue.ts), and this page shows that same record, with the same
 * instructions, built by the same function as the email, the chat message and the
 * invoice. That match is what the email tells a customer to check: "the details
 * always match your order page".
 */
async function PaymentPanel({
  orderId,
  orderNumber,
  status,
  expiresAt,
}: {
  orderId: string
  orderNumber: string
  status: string
  expiresAt: string
}) {
  const request =
    status === 'AWAITING_PAYMENT' || status === 'PAYMENT_CLAIMED'
      ? await db.paymentIntentRequest.findUnique({ where: { orderId }, include: { handle: true } })
      : null
  const payTo = request?.method === 'BITCOIN' ? request.btcAddress : request?.handle?.handle

  if (!request || !payTo) {
    return (
      <div className="rounded-lg border border-border bg-surface-data p-4">
        <div className="flex gap-3">
          <InfoIcon className="mt-0.5 size-5 shrink-0 text-foreground-muted" />
          <p className="text-sm leading-relaxed text-foreground-muted">
            We are verifying your order. Your payment details will arrive in the chat on this
            site and by email, with your invoice. Keep your Order ID, {orderNumber}: it goes in
            your payment note.
          </p>
        </div>
      </div>
    )
  }

  const ins = buildPaymentInstructions({
    method: request.method,
    payTo,
    payToName: request.handle?.label ?? undefined,
    amountCents: request.amountCents,
    btcAmount: request.btcAmountSats != null ? (Number(request.btcAmountSats) / 1e8).toFixed(8) : undefined,
    btcQuoteUntil: request.method === 'BITCOIN' ? request.expiresAt.toISOString() : undefined,
    orderId: orderNumber,
    payBy: expiresAt,
  })

  return (
    <div className="rounded-lg border border-border-data bg-surface-data p-4">
      <p className="font-medium text-foreground">{ins.headline}</p>
      <dl className="mt-3 space-y-2 text-sm">
        {ins.summary.map((row) => (
          <div key={row.label} className="flex gap-3">
            <dt className="w-28 shrink-0 text-foreground-muted">{row.label}</dt>
            <dd className="tabular min-w-0 font-medium break-all text-foreground select-all">{row.value}</dd>
          </div>
        ))}
      </dl>
      {ins.requirement ? <p className="mt-3 text-sm text-foreground">{ins.requirement}</p> : null}
      <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm leading-relaxed text-foreground">
        {ins.steps.map((step) => (
          <li key={step}>{step}</li>
        ))}
      </ol>
      <ul className="mt-4 space-y-1.5 rounded-md bg-warning-bg p-3 text-xs leading-relaxed text-warning-fg">
        {ins.warnings.map((w) => (
          <li key={w}>{w}</li>
        ))}
      </ul>
      <p className="mt-3 text-xs leading-relaxed text-foreground-muted">{ins.safety}</p>
    </div>
  )
}

/**
 * The order itself. Behind Suspense so the page chrome paints immediately — the
 * whole route is per-order (it is keyed on an unguessable token), so there is
 * nothing else to prerender, but a customer arriving from checkout should see
 * something instantly rather than a blank blocking response.
 */
async function OrderDetail({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const order = await orders.findByToken(token)

  // An unknown token is a 404, never a message confirming the token format was
  // right — that would turn this page into an enumeration oracle.
  if (!order) notFound()

  const status = STATUS_COPY[order.status] ?? STATUS_COPY.PENDING_VERIFICATION!

  return (
    <>
      {/* Puts this order in the profile's Orders on this device. */}
      <RememberOrder token={order.orderToken} />
      <p className="text-sm font-medium tracking-[0.2em] text-foreground-subtle uppercase">
        Order ID {order.orderNumber}
      </p>
      <h1 className="mt-2 font-display text-3xl text-foreground">
        Thank you, {order.firstName}
      </h1>

      <div className="mt-6 rounded-lg border border-border bg-surface p-5">
        <Badge
          tone={status.tone}
          icon={
            status.tone === 'success' ? (
              <CheckIcon className="size-3.5" />
            ) : status.tone === 'warning' ? (
              <AlertIcon className="size-3.5" />
            ) : (
              <InfoIcon className="size-3.5" />
            )
          }
        >
          {status.label}
        </Badge>
        <p className="mt-3 text-sm leading-relaxed text-foreground-muted">{status.detail}</p>
      </div>

      <section className="mt-8">
        <h2 className="font-display text-xl text-foreground">
          How to pay by {PAYMENT_LABELS[order.preferredPaymentMethod]}
        </h2>
        <p className="mt-1 text-sm text-foreground-muted">
          Your order is reserved until {formatUtc(order.expiresAt)}.
        </p>
        <div className="mt-4">
          <PaymentPanel
            orderId={order.id}
            orderNumber={order.orderNumber}
            status={order.status}
            expiresAt={order.expiresAt}
          />
        </div>

        {/*
          PROOF, not a bare "I have paid" button, once there is something to pay.
          Uploading the screenshot also claims the payment, so the buyer does one thing
          instead of two — and the operator gets evidence rather than an assertion.
          Stays visible after the claim as "add another receipt": people send the bank
          confirmation now and the app screenshot ten minutes later.

          Before instructions exist (PENDING_VERIFICATION) the old button is kept as
          it was — this change is about attaching proof, not about who may claim when.
        */}
        {order.status === 'AWAITING_PAYMENT' || order.status === 'PAYMENT_CLAIMED' ? (
          <div className="mt-4">
            <PaymentProofForm
              token={order.orderToken}
              alreadyClaimed={order.status === 'PAYMENT_CLAIMED'}
            />
          </div>
        ) : null}
      </section>

      <section className="mt-10">
        <h2 className="font-display text-xl text-foreground">Your order</h2>
        <ul className="mt-3 divide-y divide-[var(--border)] rounded-lg border border-border bg-surface">
          {order.items.map((item) => (
            <li key={`${item.productSlug}-${item.variantId}`} className="flex justify-between gap-4 p-4 text-sm">
              <span className="text-foreground">
                <span className="text-foreground-muted">{item.quantity}×</span>{' '}
                {item.productName}
              </span>
              <span className="tabular font-medium text-foreground">
                {formatCents(item.lineTotalCents)}
              </span>
            </li>
          ))}
        </ul>

        <dl className="mt-4 space-y-1 text-sm">
          <div className="flex justify-between">
            <dt className="text-foreground-muted">Subtotal</dt>
            <dd className="tabular text-foreground">{formatCents(order.subtotalCents)}</dd>
          </div>
          {/*
            Every discount, shown. This is the page checkout redirects to the instant an
            order is placed, so it is the first statement of what the customer owes —
            and it showed Subtotal, Shipping and a Total that was neither whenever a
            discount applied. A customer whose own arithmetic fails on the first page
            after paying a stranger by Cash App has every reason to think it is a scam.
          */}
          {order.discountCents > 0 && (
            <div className="flex justify-between">
              <dt className="text-foreground-muted">
                Discount{order.couponCode ? ` (${order.couponCode})` : ''}
              </dt>
              <dd className="tabular text-foreground">−{formatCents(order.discountCents)}</dd>
            </div>
          )}
          {welcomeLines(order).map((line) => (
            <div key={line.key} className="flex justify-between">
              <dt className="text-foreground-muted">{line.label}</dt>
              <dd className="tabular text-success-fg">−{formatCents(line.cents)}</dd>
            </div>
          ))}
          <div className="flex justify-between">
            <dt className="text-foreground-muted">Shipping</dt>
            <dd className="tabular text-foreground">{formatCents(order.shippingCents)}</dd>
          </div>
          {order.paymentDiscountCents > 0 && (
            <div className="flex justify-between">
              <dt className="text-foreground-muted">Bitcoin discount</dt>
              <dd className="tabular text-foreground">
                −{formatCents(order.paymentDiscountCents)}
              </dd>
            </div>
          )}
          <div className="flex justify-between border-t border-border pt-1 text-base font-semibold">
            <dt className="text-foreground">Total</dt>
            <dd className="tabular text-foreground">{formatCents(order.totalCents)}</dd>
          </div>
        </dl>
      </section>

      <section className="mt-10">
        <h2 className="font-display text-xl text-foreground">Delivery</h2>
        <address className="mt-2 text-sm not-italic text-foreground-muted">
          {order.firstName} {order.lastName}
          <br />
          {order.addressLine1}
          {order.addressLine2 && (
            <>
              <br />
              {order.addressLine2}
            </>
          )}
          <br />
          {order.city}, {jurisdictionName(order.stateCode)} {order.postalCode}
        </address>

        <ul className="mt-4 space-y-3">
          {order.shipments.map((s) => (
            <li key={s.channel} className="rounded-lg border border-border bg-surface p-4">
              <div className="flex items-center gap-2">
                <TruckIcon className="size-5 text-foreground-muted" />
                <span className="font-medium text-foreground">{s.label}</span>
                <span className="tabular ml-auto text-sm text-foreground-muted">
                  {s.costCents === 0 ? 'Free' : formatCents(s.costCents)} · {s.estimate}
                </span>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <div className="mt-10 rounded-lg border border-border bg-surface-sunken p-4">
        <div className="flex gap-3">
          <ShieldIcon className="mt-0.5 size-5 text-primary" />
          <p className="text-xs leading-relaxed text-foreground-muted">
            {PAYMENT_SECURITY_STATEMENT}
          </p>
        </div>
      </div>
    </>
  )
}

function OrderSkeleton() {
  return (
    <div className="animate-pulse space-y-6" aria-hidden>
      <div className="h-6 w-40 rounded bg-surface-sunken" />
      <div className="h-10 w-64 rounded bg-surface-sunken" />
      <div className="h-24 rounded-lg bg-surface-sunken" />
      <div className="h-48 rounded-lg bg-surface-sunken" />
    </div>
  )
}

export default function OrderStatusPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  // params is NOT awaited here — awaiting it in the page body would pull the dynamic
  // access outside the Suspense boundary and block the whole route from prerendering.
  return (
    <main>
      <RememberChatThread />
      {/* One band. An order record reads top to bottom as one document. */}
      <PageSection first>
      <Suspense fallback={<OrderSkeleton />}>
        <OrderDetail params={params} />
      </Suspense>
      </PageSection>
    </main>
  )
}
