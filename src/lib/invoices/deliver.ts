import 'server-only'

import { db } from '@/lib/db/client'
import { putObject } from '@/lib/storage/r2'
import { postMessage } from '@/lib/chat/core'
import { BRAND } from '@/lib/brand'
import { reportError } from '@/lib/observability/report-error'
import type { Order } from '@/lib/orders/types'
import { invoiceDataFromOrder, type InvoiceStage } from './data'
import { renderInvoicePng } from './render'
import type { PaymentInstructions } from '@/lib/payments/instructions'

/**
 * Getting an invoice to the customer: stored privately, posted into their chat,
 * and written into the order's event log.
 *
 * ── Which chat ──────────────────────────────────────────────────────────────────
 * A customer's chat is found by the httpOnly visitor cookie in THEIR browser, and
 * the owner's admin session has no access to that cookie. So checkout, which runs
 * in the customer's browser, records the conversation on the order as a CHAT_LINKED
 * event, and everything later (the payment-details invoice included) posts into the
 * thread named there. An event and not a column: the order-event log already records
 * what was known about an order and when, and this needs no migration.
 */

export const CHAT_LINKED = 'CHAT_LINKED'
export const INVOICE_SENT = 'INVOICE_SENT'

export async function linkOrderToChat(orderId: string, threadId: string): Promise<void> {
  await db.orderEvent.create({
    data: {
      orderId,
      type: CHAT_LINKED,
      message: "Order linked to the customer's chat on the site.",
      metadata: { chatThreadId: threadId },
    },
  })
}

/** The conversation this order was placed from, or null when there is none on file. */
export async function chatThreadForOrder(orderId: string): Promise<string | null> {
  const event = await db.orderEvent.findFirst({
    where: { orderId, type: CHAT_LINKED },
    orderBy: { createdAt: 'desc' },
    select: { metadata: true },
  })
  const id = (event?.metadata as { chatThreadId?: unknown } | null)?.chatThreadId
  if (typeof id !== 'string') return null
  // The thread may since have been deleted from the inbox.
  const thread = await db.supportThread.findUnique({ where: { id }, select: { id: true } })
  return thread?.id ?? null
}

export function invoiceFileName(orderNumber: string): string {
  return `Invoice ${orderNumber}.png`
}

/**
 * Render and store one invoice. PRIVATE prefix: an invoice carries a name, a street
 * address and, at the payment stage, the account to pay, so it is only ever served
 * through a short-lived signed URL to someone entitled to the thread.
 */
export async function renderAndStoreInvoice(
  order: Order,
  stage: InvoiceStage,
  payment?: PaymentInstructions,
): Promise<{ key: string; png: Buffer }> {
  const png = await renderInvoicePng(invoiceDataFromOrder(order, stage, payment ? { payment } : {}))
  const key = `private/invoices/${order.orderNumber}/${stage.toLowerCase()}-${Date.now()}.png`
  await putObject(key, png, 'image/png')
  return { key, png }
}

export async function postInvoiceToChat(input: {
  readonly threadId: string
  readonly order: Order
  readonly key: string
  readonly body: string
}): Promise<string> {
  const message = await postMessage({
    threadId: input.threadId,
    fromCustomer: false,
    authorName: BRAND.name,
    body: input.body,
    attachment: { key: input.key, contentType: 'image/png', name: invoiceFileName(input.order.orderNumber) },
  })
  return message.id
}

export async function recordInvoiceSent(
  orderId: string,
  details: {
    readonly stage: InvoiceStage
    readonly key: string
    readonly chatMessageId: string | null
    readonly emailed: boolean | null
    readonly actorEmail?: string
  },
): Promise<void> {
  const where = [details.chatMessageId ? 'chat' : null, details.emailed ? 'email' : null].filter(Boolean)
  await db.orderEvent.create({
    data: {
      orderId,
      type: INVOICE_SENT,
      message:
        details.stage === 'RECEIVED'
          ? `Invoice sent to the customer's ${where.join(' and ') || 'order record only'}.`
          : `Payment details and invoice sent to the customer by ${where.join(' and ') || 'no channel (neither chat nor email succeeded)'}.`,
      metadata: {
        stage: details.stage,
        attachmentKey: details.key,
        chatMessageId: details.chatMessageId,
        emailed: details.emailed,
      },
      ...(details.actorEmail ? { actorEmail: details.actorEmail } : {}),
    },
  })
}

/** The chat message that goes with the invoice a customer gets when they order. */
export function receivedChatMessage(order: Order, methodLabel: string): string {
  return [
    `Thank you, ${order.firstName}! We have your order.`,
    `Order ID: ${order.orderNumber}`,
    '',
    `Your invoice is attached. We are verifying your order now, and your ${methodLabel} payment details will arrive right here and by email.`,
    '',
    'Please keep your Order ID. You will put it in your payment note.',
  ].join('\n')
}

/**
 * Checkout's invoice: rendered and posted after the customer's response has been
 * sent (Next's `after`), so placing an order is not held up by drawing an image.
 * Never throws: the order exists whatever happens here, and a failure is reported
 * so the owner can send the invoice by hand.
 */
export async function sendReceivedInvoice(order: Order, threadId: string, methodLabel: string): Promise<void> {
  try {
    const { key } = await renderAndStoreInvoice(order, 'RECEIVED')
    const chatMessageId = await postInvoiceToChat({
      threadId,
      order,
      key,
      body: receivedChatMessage(order, methodLabel),
    })
    await recordInvoiceSent(order.id, { stage: 'RECEIVED', key, chatMessageId, emailed: null })
  } catch (error) {
    await reportError(error, {
      source: 'action',
      severity: 'ERROR',
      routePath: '/checkout',
      context: { stage: 'received-invoice', orderNumber: order.orderNumber },
    })
  }
}
