'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { getAdminIdentity } from '@/lib/admin/auth'
import { canAccessAdminPath } from '@/lib/admin/areas'
import { db } from '@/lib/db/client'
import { orders } from '@/lib/orders/repository'
import { checkRefund, parseAmount, summariseRefunds } from '@/lib/orders/refunds'
import { reportError } from '@/lib/observability/report-error'

/**
 * ─────────────────────────────────────────────────────────────────────────────
 *  RECORDING A REFUND.
 *
 *  ── This does not move money ───────────────────────────────────────────────
 *  There is no payment processor here, deliberately: the customer paid off-site
 *  through Cash App, Chime, Apple Cash or Bitcoin, and an operator sends it back
 *  the same way. So this action writes down something that has ALREADY happened.
 *  Every word the operator sees says so, because a button labelled "Refund" on a
 *  system that cannot refund is how somebody clicks it and walks away believing a
 *  customer has their money.
 *
 *  ── Why it does not change the order status ────────────────────────────────
 *  Two reasons, and the second is the important one.
 *
 *  A partial refund MUST not: an order that had $20 returned on $100 is still
 *  shipped, still delivered, and marking it REFUNDED would misstate both.
 *
 *  And a full refund must not do it HERE, because `advanceOrder` owns transitions.
 *  It validates against `ALLOWED_TRANSITIONS` and sends the customer email that
 *  goes with each move; a status written from this action would bypass both, and
 *  the first anyone would know is a customer who never heard from us. When a refund
 *  completes the total, the UI says so and offers the transition — an operator makes
 *  that call through the one path that enforces it.
 *
 *  ── Why the cap is re-checked inside the transaction ───────────────────────
 *  Two operators on two tabs, each looking at a $100 order with nothing refunded,
 *  can each pass a check for $100. Validating before the write and again inside the
 *  same transaction is what makes the second one fail instead of returning $200.
 * ─────────────────────────────────────────────────────────────────────────────
 */

export type RefundState = { error?: string; ok?: string }

const fail = (error: string): RefundState => ({ error })

const schema = z.object({
  token: z.string().min(10).max(200),
  amount: z.string().min(1).max(20),
  reason: z
    .string()
    .trim()
    .min(10, 'Say why this was refunded — at least 10 characters.')
    .max(500),
  method: z.enum(['CASHAPP', 'CHIME', 'APPLE_CASH', 'BITCOIN']).optional(),
  reference: z.string().trim().max(200).optional(),
})

export async function issueRefund(
  _previous: RefundState,
  formData: FormData,
): Promise<RefundState> {
  const identity = await getAdminIdentity()
  if (!identity) return fail('Not signed in.')
  if (!canAccessAdminPath(identity.role, identity.adminAreas, '/admin/orders')) {
    return fail('You do not have access to orders.')
  }

  const parsed = schema.safeParse({
    token: formData.get('token'),
    amount: formData.get('amount'),
    reason: formData.get('reason'),
    method: formData.get('method') || undefined,
    reference: formData.get('reference') || undefined,
  })
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? 'Check the values and try again.')
  }

  const amount = parseAmount(parsed.data.amount)
  if (!amount.ok) return fail(amount.error)

  const order = await db.order.findUnique({
    where: { orderToken: parsed.data.token },
    include: { refunds: true },
  })
  if (!order) return fail('Order not found.')

  /*
    Refusing before PAID is not pedantry. The statuses below it are an order that
    was never paid for — recording money going back out on one would put a
    withdrawal in the books against a payment that never came in.
  */
  const REFUNDABLE_FROM = ['PAID', 'PACKED', 'SHIPPED', 'DELIVERED', 'REFUNDED']
  if (!REFUNDABLE_FROM.includes(order.status)) {
    return fail(
      `This order is ${order.status.replace(/_/g, ' ').toLowerCase()} — there is no payment to return. Cancel it instead.`,
    )
  }

  const check = checkRefund(amount.amountCents, order.totalCents, order.refunds)
  if (!check.ok) return fail(check.error)

  try {
    await db.$transaction(async (tx) => {
      // Re-read INSIDE the transaction. See the note above about two tabs.
      const fresh = await tx.refund.findMany({ where: { orderId: order.id } })
      const recheck = checkRefund(amount.amountCents, order.totalCents, fresh)
      if (!recheck.ok) throw new RefundConflict(recheck.error)

      await tx.refund.create({
        data: {
          orderId: order.id,
          amountCents: amount.amountCents,
          method: parsed.data.method,
          reference: parsed.data.reference?.trim() || null,
          reason: parsed.data.reason,
          issuedById: identity.userId,
          issuedBy: identity.email,
        },
      })
    })
  } catch (error) {
    if (error instanceof RefundConflict) return fail(error.message)
    await reportError(error, {
      source: 'action',
      routePath: '/admin/orders',
      context: { stage: 'issue-refund', orderNumber: order.orderNumber },
    })
    return fail('Could not record the refund. It has been logged.')
  }

  /*
    The order's own history, not the general audit table.

    CLAUDE.md rule 8: every order transition writes an immutable OrderEvent, and
    that log is what a chargeback or a regulator is reconstructed from. A refund
    belongs in the same narrative as the payment it reverses — putting it in a
    different table would mean reading two logs to answer one question. No
    `nextStatus` is passed, so the event is appended and the status is left alone.
  */
  const dollars = (amount.amountCents / 100).toFixed(2)
  await orders.appendEvent(order.orderToken, {
    type: 'REFUND_RECORDED',
    message: `Refund of $${dollars} recorded by ${identity.email}${
      parsed.data.reference?.trim() ? ` (ref ${parsed.data.reference.trim()})` : ''
    } — ${parsed.data.reason}`,
    at: new Date().toISOString(),
    actorEmail: identity.email,
  })

  const after = summariseRefunds(order.totalCents, [
    ...order.refunds,
    { amountCents: amount.amountCents },
  ])

  revalidatePath(`/admin/orders/${order.orderNumber}`)
  revalidatePath('/admin/orders')

  return {
    ok: after.fullyRefunded
      ? `Recorded $${dollars}. This order is now refunded in full — move it to Refunded when you are ready.`
      : `Recorded $${dollars}. $${(after.remainingCents / 100).toFixed(2)} still refundable.`,
  }
}

/** Thrown inside the transaction so the write rolls back, caught to become an error. */
class RefundConflict extends Error {}
