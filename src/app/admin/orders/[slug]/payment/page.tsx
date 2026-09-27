import { notFound } from 'next/navigation'
import { db } from '@/lib/db/client'
import { AdminPage } from '@/components/admin/shell'
import { PaymentDetailsForm } from '@/components/admin/payment-details-form'
import { Badge } from '@/components/ui/badge'
import { formatCents } from '@/lib/utils'
import { PAYMENT_LABELS, PAYMENT_METHODS, type PaymentMethod } from '@/lib/orders/types'
import { activeHandles, pickHandle } from '@/lib/payments/handles'
import { bitcoinUsdRate } from '@/lib/payments/btc-rate'
import { btcForCents } from '@/lib/payments/instructions'
import { chatThreadForOrder } from '@/lib/invoices/deliver'
import { messagesUrl } from '@/lib/chat/core'

export const metadata = { title: 'Send payment details' }

/**
 * Where the new-order notification lands.
 *
 * The owner taps the push on their phone, signs in if the session has lapsed (they
 * come back here, see ADMIN_NEXT_COOKIE), checks the order at a glance, and sends the
 * payment details: to the customer's email and their chat on the site, at once, with
 * the invoice image and the instructions for their method.
 */
async function PaymentDetails({ orderNumber }: { orderNumber: string }) {
  const order = await db.order.findUnique({
    where: { orderNumber },
    include: {
      items: true,
      paymentRequest: { include: { handle: true } },
    },
  })
  if (!order) notFound()

  const method: PaymentMethod = order.preferredPaymentMethod ?? 'CASHAPP'
  const issuable = order.status === 'PENDING_VERIFICATION' || order.status === 'AWAITING_PAYMENT'

  const [threadId, pool, quote] = await Promise.all([
    chatThreadForOrder(order.id),
    activeHandles().catch(() => []),
    method === 'BITCOIN' ? bitcoinUsdRate() : Promise.resolve(null),
  ])

  // Pre-fill: what this order was already given, else the pool's usual pick for it.
  const suggestions: Partial<Record<PaymentMethod, { payTo: string; payToName?: string }>> = {}
  for (const m of PAYMENT_METHODS) {
    if (m === 'BITCOIN') continue
    const issued = order.paymentRequest?.method === m ? order.paymentRequest.handle : null
    const picked = issued ?? pickHandle(m, order.orderToken, pool)
    if (picked) suggestions[m] = { payTo: picked.handle, ...(picked.label ? { payToName: picked.label } : {}) }
  }
  if (order.paymentRequest?.btcAddress) suggestions.BITCOIN = { payTo: order.paymentRequest.btcAddress }

  const btcQuote = quote
    ? { amount: btcForCents(order.totalCents, quote.usd), rateUsd: quote.usd, source: quote.source, at: quote.at }
    : null

  const units = order.items.reduce((sum, item) => sum + item.quantity, 0)

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-border bg-surface p-4 md:p-5">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={order.status === 'PENDING_VERIFICATION' ? 'warning' : 'info'}>
            {order.status.replace(/_/g, ' ').toLowerCase()}
          </Badge>
          <span className="text-sm text-foreground-muted">{PAYMENT_LABELS[method]}</span>
        </div>
        <p className="tabular mt-3 text-3xl font-semibold text-foreground">{formatCents(order.totalCents)}</p>
        <p className="mt-1 text-sm text-foreground">
          {order.firstName} {order.lastName} · {order.city}, {order.stateCode}
        </p>
        <p className="text-sm break-all text-foreground-muted">{order.email}</p>
        <p className="mt-2 text-sm text-foreground-muted">
          {units} item{units === 1 ? '' : 's'}: {order.items.map((i) => `${i.productName} × ${i.quantity}`).join(', ')}
        </p>
        <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm">
          <a href={`/admin/orders/${order.orderNumber}`} className="inline-flex min-h-11 items-center underline underline-offset-4">
            Full order
          </a>
          {threadId ? (
            <a href={messagesUrl(threadId)} className="inline-flex min-h-11 items-center underline underline-offset-4">
              Customer&apos;s chat
            </a>
          ) : null}
        </div>
      </section>

      {issuable ? (
        <PaymentDetailsForm
          order={{
            orderNumber: order.orderNumber,
            totalCents: order.totalCents,
            method,
            // Every order is written with an expiry; the fallback is the same 48 hours from placing it.
            payBy: (order.expiresAt ?? new Date(order.createdAt.getTime() + 48 * 3600_000)).toISOString(),
            email: order.email,
            hasChat: Boolean(threadId),
            reissue: order.status === 'AWAITING_PAYMENT',
          }}
          suggestions={suggestions}
          btcQuote={btcQuote}
        />
      ) : (
        <p className="rounded-xl border border-border bg-surface-sunken p-4 text-sm text-foreground">
          This order is {order.status.replace(/_/g, ' ').toLowerCase()}, so payment details can no longer be sent from here.{' '}
          <a href={`/admin/orders/${order.orderNumber}`} className="underline underline-offset-4">
            Open the order
          </a>
          .
        </p>
      )}
    </div>
  )
}

export default async function AdminOrderPaymentPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  return (
    <AdminPage
      title={`Order ID ${slug}`}
      description="Verify the order and send the customer how to pay. It goes to their email and their chat on the site at once, with the invoice image and step-by-step instructions for their payment method."
    >
      <PaymentDetails orderNumber={slug} />
    </AdminPage>
  )
}
