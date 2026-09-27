'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { getAdminIdentity } from '@/lib/admin/auth'
import { canAccessAdminPath } from '@/lib/admin/areas'
import { db } from '@/lib/db/client'
import { reportError } from '@/lib/observability/report-error'
import { sendEmail } from '@/lib/mail/mailer'
import {
  paymentConfirmedEmail,
  shippedEmail,
} from '@/lib/mail/templates'
import { notify } from '@/lib/notify/ntfy'
import { orders } from '@/lib/orders/repository'
import { ALLOWED_TRANSITIONS } from '@/lib/orders/transitions'
import { releaseRedemption } from '@/lib/orders/coupon-store'
import type { OrderStatus } from '@/lib/orders/types'
import { absoluteUrl, url } from '@/lib/seo/routes'

export type AdminOrderState = { error?: string; ok?: boolean }

/**
 * Operator-driven order transitions.
 *
 * Every action re-checks the session. A server action is a public HTTP endpoint — the
 * fact that the button lives behind an authenticated layout says nothing about who is
 * calling it.
 *
 * Only these transitions are permitted, and only from these states. An order cannot
 * jump from PENDING_VERIFICATION straight to SHIPPED, because that would mean goods
 * left the building without anyone confirming payment.
 */

const schema = z.object({
  token: z.string().min(20).max(200),
  next: z.enum([
    'AWAITING_PAYMENT',
    'PAYMENT_CLAIMED',
    'PAID',
    'PACKED',
    'SHIPPED',
    'DELIVERED',
    'REJECTED',
    'CANCELLED',
    'REFUNDED',
  ]),
  note: z.string().max(500).optional(),
})

const MESSAGES: Partial<Record<OrderStatus, string>> = {
  AWAITING_PAYMENT: 'Order verified. Payment instructions issued.',
  PAID: 'Payment receipt confirmed by an operator.',
  PACKED: 'Order packed and awaiting collection.',
  SHIPPED: 'Order handed to the carrier.',
  DELIVERED: 'Delivery confirmed.',
  REJECTED: 'Order rejected by an operator.',
  CANCELLED: 'Order cancelled.',
  REFUNDED: 'Order refunded.',
}

export async function advanceOrder(
  _previous: AdminOrderState,
  formData: FormData,
): Promise<AdminOrderState> {
  /*
   * The identity, not just "is someone signed in".
   *
   * Every transition writes an immutable OrderEvent, and that log is what a
   * chargeback, a dispute or a regulator gets reconstructed from. It used to record
   * `actorEmail: 'admin'` for everyone, which answers "was this authorised" and not
   * "who authorised it" — and on the transition that confirms money was received,
   * those are not the same question.
   */
  const identity = await getAdminIdentity()
  if (!identity) return { error: 'Not signed in.' }
  if (!canAccessAdminPath(identity.role, identity.adminAreas, '/admin/orders')) {
    return { error: 'You do not have access to orders.' }
  }

  const parsed = schema.safeParse({
    token: formData.get('token'),
    next: formData.get('next'),
    note: formData.get('note') || undefined,
  })
  if (!parsed.success) return { error: 'Invalid request.' }

  const order = await orders.findByToken(parsed.data.token)
  if (!order) return { error: 'Order not found.' }

  /*
    Verifying an order now means sending its payment details, and that happens on
    the payment page, which takes the details, moves the order on and delivers them.
    A bare status change here would verify an order the customer can never pay.
  */
  if (parsed.data.next === 'AWAITING_PAYMENT') {
    return { error: 'Open "Send payment details" on this order to verify it and send the customer how to pay.' }
  }

  const permitted = ALLOWED_TRANSITIONS[order.status] ?? []
  if (!permitted.includes(parsed.data.next)) {
    return {
      error: `An order cannot move from ${order.status.replace(/_/g, ' ').toLowerCase()} to ${parsed.data.next.replace(/_/g, ' ').toLowerCase()}.`,
    }
  }

  await orders.appendEvent(
    order.orderToken,
    {
      type: parsed.data.next,
      message: parsed.data.note?.trim()
        ? `${MESSAGES[parsed.data.next] ?? 'Status updated.'} — ${parsed.data.note.trim()}`
        : (MESSAGES[parsed.data.next] ?? 'Status updated.'),
      at: new Date().toISOString(),
      fromStatus: order.status,
      toStatus: parsed.data.next,
      actorEmail: identity.email,
    },
    parsed.data.next,
  )

  /*
    A cancelled or rejected order gives its coupon redemption back.

    The redemption was taken when the order was placed, because that is when the
    discount was quoted and frozen onto it. An order that never goes on to be paid
    should not keep holding it — otherwise anyone willing to place and abandon
    orders can exhaust a limited code for every real customer after them.

    After the event is written, and best-effort: the transition has already happened,
    and failing to release a slot leaves a code slightly MORE restricted than it
    should be, which is the safe direction to be wrong in. `releaseRedemption` floors
    the counter at zero, so a release that somehow ran twice cannot grant a use.
  */
  if (
    (parsed.data.next === 'CANCELLED' || parsed.data.next === 'REJECTED') &&
    order.couponCode
  ) {
    await releaseRedemption(order.couponCode).catch(() => undefined)
  }

  // The customer hears about every transition that changes what they should do next.
  const updated = await orders.findByToken(order.orderToken)
  if (updated) {
    if (parsed.data.next === 'PAID') {
      await sendEmail(paymentConfirmedEmail(updated))
    } else if (parsed.data.next === 'SHIPPED') {
      await sendEmail(shippedEmail(updated, parsed.data.note?.trim() || undefined))
    }
  }

  /*
   * Confirming payment stamps the payment record too, not just the order status.
   *
   * `verifiedAt`/`verifiedBy` existed on PaymentIntentRequest and nothing ever wrote
   * them, so the row that says which pooled handle was issued had no record of anyone
   * having checked the money arrived. Tracing a disputed payment back to the operator
   * who cleared it was impossible.
   */
  if (parsed.data.next === 'PAID') {
    try {
      await db.paymentIntentRequest.updateMany({
        where: { orderId: order.id, verifiedAt: null },
        data: { verifiedAt: new Date(), verifiedBy: identity.email },
      })
    } catch (error) {
      // The order has already advanced. Losing the stamp must not undo that.
      await reportError(error, {
        source: 'action',
        routePath: '/admin/orders',
        context: { stage: 'stamp-payment-verified', orderNumber: order.orderNumber },
      })
    }

    await notify({
      topic: 'orders-paid',
      title: `Payment confirmed — ${order.orderNumber}`,
      body: `${order.firstName} ${order.lastName} · ready to pack.`,
      clickUrl: absoluteUrl(`/admin/orders/${order.orderNumber}`),
    })
  }

  revalidatePath('/admin/orders')
  revalidatePath(`/admin/orders/${order.orderNumber}`)
  revalidatePath('/admin')
  revalidatePath(url.orderStatus(order.orderToken))
  return { ok: true }
}
