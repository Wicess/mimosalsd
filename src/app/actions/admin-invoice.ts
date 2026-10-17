'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { getAdminIdentity } from '@/lib/admin/auth'
import { canAccessAdminPath } from '@/lib/admin/areas'
import { recordAdminAction } from '@/lib/admin/audit'
import { db } from '@/lib/db/client'
import { chatThreadForOrder, postInvoiceToChat, recordInvoiceSent, renderAndStoreInvoice } from '@/lib/invoices/deliver'
import { reportError } from '@/lib/observability/report-error'
import { INVOICE_EDITABLE, INVOICE_EDITED, parseDollars, recalculateInvoice } from '@/lib/orders/invoice-edit'
import { orders } from '@/lib/orders/repository'
import { formatCents } from '@/lib/utils'

export type InvoiceEditState = { error?: string; ok?: string }

const schema = z.object({
  orderNumber: z.string().trim().min(6).max(40),
  shipping: z.string().max(20),
  discount: z.string().max(20),
  reason: z.string().trim().min(3, 'Say briefly why the invoice changed.').max(300),
  send: z.boolean(),
})

/**
 * Save an edited invoice, and send the new one to the customer's order chat.
 *
 * The order's own history gets an immutable INVOICE_EDITED event with the before and
 * after, and the audit log gets the same, with who did it. The new invoice is drawn
 * and posted to the chat the order is linked to, so the customer sees the change
 * where they talk to the shop.
 */
export async function editOrderInvoice(_previous: InvoiceEditState, formData: FormData): Promise<InvoiceEditState> {
  const identity = await getAdminIdentity()
  if (!identity) return { error: 'Not signed in.' }
  if (!canAccessAdminPath(identity.role, identity.adminAreas, '/admin/orders')) {
    return { error: 'You do not have access to orders.' }
  }

  const parsed = schema.safeParse({
    orderNumber: formData.get('orderNumber'),
    shipping: formData.get('shipping') ?? '',
    discount: formData.get('discount') ?? '',
    reason: formData.get('reason') ?? '',
    send: formData.get('send') === 'on',
  })
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Check the form and try again.' }
  const d = parsed.data

  const row = await db.order.findUnique({ where: { orderNumber: d.orderNumber }, include: { items: true } })
  if (!row) return { error: 'Order not found.' }
  if (!INVOICE_EDITABLE.has(row.status as never)) {
    return { error: 'The invoice can only be changed before the customer has paid. After that, use a refund.' }
  }

  const shippingCents = parseDollars(d.shipping || '0')
  const discountCents = parseDollars(d.discount || '0')
  if (shippingCents === null || discountCents === null) return { error: 'Shipping and discount must be amounts, like 12.50.' }

  const lines = []
  for (const item of row.items) {
    const quantity = Number(formData.get(`qty:${item.id}`))
    const unitPriceCents = parseDollars(String(formData.get(`price:${item.id}`) ?? ''))
    if (unitPriceCents === null) return { error: `The price for ${item.productName} is not a valid amount.` }
    lines.push({ id: item.id, quantity, unitPriceCents })
  }

  const result = recalculateInvoice(row, row.items.map((i) => i.id), { lines, shippingCents, discountCents })
  if (!result.ok) return { error: result.error }

  const before = {
    lines: row.items.map((i) => ({ name: `${i.productName} (${i.variantName})`, quantity: i.quantity, unitPriceCents: i.unitPriceCents })),
    shippingCents: row.shippingCents,
    discountCents: row.discountCents,
    totalCents: row.totalCents,
  }
  const after = {
    lines: result.lines.map((l) => {
      const item = row.items.find((i) => i.id === l.id)!
      return { name: `${item.productName} (${item.variantName})`, quantity: l.quantity, unitPriceCents: l.unitPriceCents }
    }),
    shippingCents: result.totals.shippingCents,
    discountCents: result.totals.discountCents,
    totalCents: result.totals.totalCents,
  }

  await db.$transaction([
    ...result.lines.map((l) =>
      db.orderItem.update({
        where: { id: l.id },
        data: { quantity: l.quantity, unitPriceCents: l.unitPriceCents, lineTotalCents: l.lineTotalCents },
      }),
    ),
    ...(result.removed.length ? [db.orderItem.deleteMany({ where: { id: { in: [...result.removed] }, orderId: row.id } })] : []),
    db.order.update({
      where: { id: row.id },
      data: {
        subtotalCents: result.totals.subtotalCents,
        shippingCents: result.totals.shippingCents,
        discountCents: result.totals.discountCents,
        totalCents: result.totals.totalCents,
      },
    }),
    db.orderEvent.create({
      data: {
        orderId: row.id,
        type: INVOICE_EDITED,
        message: `Invoice edited: ${formatCents(row.totalCents)} to ${formatCents(result.totals.totalCents)}. ${d.reason}`,
        metadata: { before, after, reason: d.reason },
        actorId: identity.userId,
        actorEmail: identity.email,
      },
    }),
  ])

  await recordAdminAction({
    entityType: 'Order',
    entityId: row.id,
    action: 'UPDATE',
    actor: identity,
    before,
    after,
    reason: `Invoice edited for ${row.orderNumber}: ${d.reason}`,
  })

  let sent = false
  if (d.send) {
    try {
      const order = await orders.findByNumber(row.orderNumber)
      const threadId = order ? await chatThreadForOrder(row.id) : null
      if (order && threadId) {
        const { key } = await renderAndStoreInvoice(order, 'RECEIVED')
        const chatMessageId = await postInvoiceToChat({
          threadId,
          order,
          key,
          body: [
            `Your invoice for order ${order.orderNumber} has been updated.`,
            d.reason,
            '',
            `New total: ${formatCents(order.totalCents)}`,
          ].join('\n'),
        })
        await recordInvoiceSent(row.id, { stage: 'RECEIVED', key, chatMessageId, emailed: null, actorEmail: identity.email })
        sent = true
      }
    } catch (error) {
      await reportError(error, { source: 'action', routePath: '/admin/orders', context: { stage: 'send-edited-invoice', orderNumber: row.orderNumber } })
    }
  }

  revalidatePath(`/admin/orders/${row.orderNumber}`)
  revalidatePath(`/admin/orders/${row.orderNumber}/invoice`)

  const total = formatCents(result.totals.totalCents)
  const resend = row.status === 'AWAITING_PAYMENT' ? ' Payment details were already sent, so send them again to ask for the new amount.' : ''
  if (d.send && !sent) return { ok: `Saved. New total ${total}. The new invoice could not be posted to the customer's chat; it has been logged.${resend}` }
  return { ok: `Saved. New total ${total}.${sent ? ' The new invoice is in the customer’s chat.' : ''}${resend}` }
}
