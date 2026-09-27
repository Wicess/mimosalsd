'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { notify } from '@/lib/notify/ntfy'
import { orders } from '@/lib/orders/repository'
import { PAYMENT_LABELS } from '@/lib/orders/types'
import { absoluteUrl, url } from '@/lib/seo/routes'
import { formatCents } from '@/lib/utils'

export type ClaimState = { done?: boolean; error?: string }

const schema = z.object({ token: z.string().min(20).max(200) })

/**
 * Customer asserts they have paid.
 *
 * This never marks the order PAID — only a human verifying receipt does that. It
 * moves the order to PAYMENT_CLAIMED and pushes ops a notification, and it writes an
 * append-only event so the sequence is reconstructable in a dispute.
 */
export async function claimPayment(
  _previous: ClaimState,
  formData: FormData,
): Promise<ClaimState> {
  const parsed = schema.safeParse({ token: formData.get('token') })
  if (!parsed.success) return { error: 'Could not update this order.' }

  const order = await orders.findByToken(parsed.data.token)
  if (!order) return { error: 'Could not find this order.' }

  if (order.status !== 'PENDING_VERIFICATION' && order.status !== 'AWAITING_PAYMENT') {
    // Already claimed or further along — treat as success rather than an error, so a
    // double submit does not look like a failure to the customer.
    return { done: true }
  }

  await orders.appendEvent(
    order.orderToken,
    {
      type: 'PAYMENT_CLAIMED',
      message: 'Customer reported that payment was sent.',
      at: new Date().toISOString(),
      fromStatus: order.status,
      toStatus: 'PAYMENT_CLAIMED',
    },
    'PAYMENT_CLAIMED',
  )

  await notify({
    topic: 'orders-paid',
    title: `Payment claimed — ${order.orderNumber}`,
    body: `${order.firstName} ${order.lastName} reports paying ${formatCents(order.totalCents)} by ${PAYMENT_LABELS[order.preferredPaymentMethod]}. Verify receipt before despatch.`,
    tags: ['money_with_wings'],
    clickUrl: absoluteUrl(`/admin/orders/${order.orderNumber}`),
  })

  revalidatePath(url.orderStatus(order.orderToken))
  return { done: true }
}
