import 'server-only'

import { db } from '@/lib/db/client'
import { orders } from '@/lib/orders/repository'
import type { Order, PaymentMethod } from '@/lib/orders/types'
import { PAYMENT_LABELS } from '@/lib/orders/types'
import { sendEmail } from '@/lib/mail/mailer'
import { paymentInstructionsEmail } from '@/lib/mail/templates'
import { reportError } from '@/lib/observability/report-error'
import { isValidBitcoinAddress } from './bitcoin-address'
import {
  buildPaymentInstructions,
  instructionsAsText,
  normalizeAppleCashRecipient,
  normalizeBtcAmount,
  normalizeCashtag,
  normalizeChimeSign,
  type IssuedPaymentDetails,
  type PaymentInstructions,
} from './instructions'
import {
  chatThreadForOrder,
  invoiceFileName,
  postInvoiceToChat,
  recordInvoiceSent,
  renderAndStoreInvoice,
} from '@/lib/invoices/deliver'
import { postMessage } from '@/lib/chat/core'
import { BRAND } from '@/lib/brand'
import { paymentDetailsNotification } from '@/lib/push/customer'
import { sendPushToVisitor } from '@/lib/push/server'

/**
 * ─────────────────────────────────────────────────────────────────────────────
 *  ISSUE PAYMENT DETAILS — what happens when the owner presses Send.
 *
 *  The owner taps the new-order notification, lands on the order's payment page,
 *  enters where to pay, and sends. This does all of it in one go:
 *
 *   1. checks what was typed for the method (a $Cashtag, a $ChimeSign, an Apple Cash
 *      phone or email, or a Bitcoin address whose checksum must verify)
 *   2. verifies the order: PENDING_VERIFICATION moves to AWAITING_PAYMENT, with the
 *      owner named on the event. Sending again while AWAITING_PAYMENT re-issues.
 *   3. records what was issued: the handle joins the payment pool (so it can be
 *      traced and burned later), and the order's PaymentIntentRequest holds it, or,
 *      for Bitcoin, the address, amount and quote. Before this existed nothing ever
 *      created a PaymentIntentRequest, so customers' proof uploads were refused.
 *   4. draws the invoice with the instructions and sends it to the customer's chat
 *      and email at once, each with the same instructions written out as text
 *   5. writes an INVOICE_SENT event saying exactly which channels succeeded
 *
 *  Steps 1–3 are all-or-nothing. Steps 4–5 are best-effort and reported separately:
 *  once the order is verified, a failed email must not undo it, and the page tells
 *  the owner which channel did not go so they can follow up.
 * ─────────────────────────────────────────────────────────────────────────────
 */

export interface IssuePaymentInput {
  readonly orderNumber: string
  readonly method: PaymentMethod
  readonly payTo: string
  readonly payToName?: string
  /** Bitcoin only. */
  readonly btcAmount?: string
  readonly btcRateUsd?: number
  readonly btcQuoteMinutes?: number
  readonly actorEmail: string
}

export type IssuePaymentResult =
  | {
      readonly ok: true
      readonly orderNumber: string
      readonly reissued: boolean
      readonly chat: 'sent' | 'no-chat' | 'failed'
      readonly email: 'sent' | 'failed'
      readonly invoiceAttached: boolean
      readonly instructions: PaymentInstructions
    }
  | { readonly ok: false; readonly error: string; readonly field?: 'payTo' | 'btcAmount' | 'method' }

const ISSUABLE = new Set(['PENDING_VERIFICATION', 'AWAITING_PAYMENT'])

export async function issuePaymentDetails(input: IssuePaymentInput): Promise<IssuePaymentResult> {
  const order = await orders.findByNumber(input.orderNumber)
  if (!order) return { ok: false, error: 'Order not found.' }
  if (!ISSUABLE.has(order.status)) {
    return {
      ok: false,
      error: `This order is ${order.status.replace(/_/g, ' ').toLowerCase()}. Payment details can only be sent before the customer has paid.`,
    }
  }

  /*
    The Bitcoin discount was taken off the total at checkout, because the customer
    chose Bitcoin. Switching an order to or from Bitcoin here would leave that total
    wrong in one direction or the other, so it is refused. Switching between the
    other three changes nothing about the price.
  */
  if ((input.method === 'BITCOIN') !== (order.preferredPaymentMethod === 'BITCOIN')) {
    return {
      ok: false,
      field: 'method',
      error:
        input.method === 'BITCOIN'
          ? 'This order was priced without the Bitcoin discount. Ask the customer to place a new order to pay with Bitcoin.'
          : 'This order was priced with the Bitcoin discount. Ask the customer to place a new order to pay another way.',
    }
  }

  // ── 1. What was typed ──
  let payTo: string
  let btcAmount: string | undefined
  if (input.method === 'CASHAPP' || input.method === 'CHIME' || input.method === 'APPLE_CASH') {
    const check =
      input.method === 'CASHAPP'
        ? normalizeCashtag(input.payTo)
        : input.method === 'CHIME'
          ? normalizeChimeSign(input.payTo)
          : normalizeAppleCashRecipient(input.payTo)
    if (!check.ok) return { ok: false, field: 'payTo', error: check.error }
    payTo = check.value
  } else {
    payTo = input.payTo.trim()
    if (!isValidBitcoinAddress(payTo)) {
      return {
        ok: false,
        field: 'payTo',
        error: 'That is not a valid Bitcoin address. Its checksum does not match, so a character is wrong or missing. Copy it again from your wallet.',
      }
    }
    const amount = normalizeBtcAmount(input.btcAmount ?? '')
    if (!amount.ok) return { ok: false, field: 'btcAmount', error: amount.error }
    btcAmount = amount.value
  }

  const now = new Date()
  const payToName = input.payToName?.trim().slice(0, 80) || undefined
  // A reservation that has already lapsed is renewed: sending details re-reserves the order.
  const orderExpiry = new Date(order.expiresAt)
  const renewReservation = orderExpiry.getTime() < now.getTime() + 6 * 3600_000
  const payBy = renewReservation ? new Date(now.getTime() + 48 * 3600_000) : orderExpiry
  const quoteMinutes = Math.min(Math.max(input.btcQuoteMinutes ?? 60, 15), 24 * 60)
  const btcQuoteUntil = input.method === 'BITCOIN' ? new Date(now.getTime() + quoteMinutes * 60_000) : undefined

  const details: IssuedPaymentDetails = {
    method: input.method,
    payTo,
    payToName,
    amountCents: order.totalCents,
    btcAmount,
    btcRateUsd: input.btcRateUsd,
    btcQuoteUntil: btcQuoteUntil?.toISOString(),
    orderId: order.orderNumber,
    payBy: payBy.toISOString(),
  }
  const instructions = buildPaymentInstructions(details)
  const reissued = order.status === 'AWAITING_PAYMENT'

  // ── 2 and 3. Verify the order and record what was issued, all or nothing ──
  try {
    await db.$transaction(async (tx) => {
      const dbOrder = await tx.order.findUnique({
        where: { orderNumber: order.orderNumber },
        select: { id: true, status: true },
      })
      if (!dbOrder || !ISSUABLE.has(dbOrder.status)) throw new IssueRefused('This order changed while you were sending. Reload the page.')

      let handleId: string | null = null
      if (input.method !== 'BITCOIN') {
        const existing = await tx.paymentHandle.findUnique({
          where: { method_handle: { method: input.method, handle: payTo } },
        })
        if (existing?.burnedAt) {
          throw new IssueRefused(
            `${payTo} is marked burned${existing.burnReason ? ` (${existing.burnReason})` : ''}. Use a different ${PAYMENT_LABELS[input.method]} account.`,
          )
        }
        const handle = await tx.paymentHandle.upsert({
          where: { method_handle: { method: input.method, handle: payTo } },
          create: { method: input.method, handle: payTo, label: payToName ?? null, timesIssued: 1, lastUsedAt: now },
          update: { timesIssued: { increment: 1 }, lastUsedAt: now, isActive: true, ...(payToName ? { label: payToName } : {}) },
        })
        handleId = handle.id
      }

      const request = {
        method: input.method,
        amountCents: order.totalCents,
        handleId,
        btcAddress: input.method === 'BITCOIN' ? payTo : null,
        btcAmountSats: btcAmount ? BigInt(Math.round(Number(btcAmount) * 1e8)) : null,
        btcQuoteLockedAt: input.method === 'BITCOIN' ? now : null,
        expiresAt: btcQuoteUntil ?? payBy,
      }
      await tx.paymentIntentRequest.upsert({
        where: { orderId: dbOrder.id },
        create: { orderId: dbOrder.id, ...request },
        update: request,
      })

      const where = `${PAYMENT_LABELS[input.method]} to ${payTo}${btcAmount ? ` (${btcAmount} BTC)` : ''}`
      await tx.orderEvent.create({
        data: {
          orderId: dbOrder.id,
          type: reissued ? 'PAYMENT_DETAILS_REISSUED' : 'AWAITING_PAYMENT',
          message: reissued
            ? `Payment details sent again: ${where}.`
            : `Order verified. Payment details issued: ${where}.${renewReservation ? ' Reservation renewed for 48 hours.' : ''}`,
          fromStatus: reissued ? null : 'PENDING_VERIFICATION',
          toStatus: reissued ? null : 'AWAITING_PAYMENT',
          actorEmail: input.actorEmail,
        },
      })
      await tx.order.update({
        where: { id: dbOrder.id },
        data: {
          ...(reissued ? {} : { status: 'AWAITING_PAYMENT' }),
          ...(input.method !== order.preferredPaymentMethod ? { preferredPaymentMethod: input.method } : {}),
          ...(renewReservation ? { expiresAt: payBy } : {}),
        },
      })
    })
  } catch (error) {
    if (error instanceof IssueRefused) return { ok: false, error: error.message }
    throw error
  }

  // ── 4 and 5. Deliver to chat and email at once ──
  const current: Order = (await orders.findByNumber(order.orderNumber)) ?? order
  const text = instructionsAsText(instructions, order.orderNumber)

  let key: string | null = null
  let png: Buffer | null = null
  try {
    ;({ key, png } = await renderAndStoreInvoice(current, 'PAYMENT', instructions))
  } catch (error) {
    await reportError(error, {
      source: 'action',
      severity: 'ERROR',
      routePath: '/admin/orders/[slug]/payment',
      context: { stage: 'render-payment-invoice', orderNumber: order.orderNumber },
    })
  }

  const threadId = await chatThreadForOrder(order.id).catch(() => null)
  const chatBody = [`Hi ${order.firstName}, your order is verified. Here is how to pay.`, '', text].join('\n')

  const [chatOutcome, emailOutcome] = await Promise.all([
    (async (): Promise<{ status: 'sent' | 'no-chat' | 'failed'; messageId: string | null }> => {
      if (!threadId) return { status: 'no-chat', messageId: null }
      try {
        const messageId = key
          ? await postInvoiceToChat({ threadId, order: current, key, body: chatBody })
          : (await postMessage({ threadId, fromCustomer: false, authorName: BRAND.name, body: chatBody })).id
        return { status: 'sent', messageId }
      } catch (error) {
        await reportError(error, {
          source: 'action',
          severity: 'ERROR',
          routePath: '/admin/orders/[slug]/payment',
          context: { stage: 'post-payment-invoice', orderNumber: order.orderNumber },
        })
        return { status: 'failed', messageId: null }
      }
    })(),
    (async (): Promise<'sent' | 'failed'> => {
      const message = paymentInstructionsEmail(current, instructions)
      const sent = await sendEmail(
        png ? { ...message, attachments: [{ name: invoiceFileName(order.orderNumber), content: png }] } : message,
      )
      return sent ? 'sent' : 'failed'
    })(),
  ])

  await recordInvoiceSent(order.id, {
    stage: 'PAYMENT',
    key: key ?? '(image not rendered)',
    chatMessageId: chatOutcome.messageId,
    emailed: emailOutcome === 'sent',
    actorEmail: input.actorEmail,
  }).catch(() => undefined)

  // ── 6. And to their lock screen, when they turned notifications on ──
  // Found through the chat the order was placed from. Never throws.
  if (threadId) {
    const thread = await db.supportThread.findUnique({ where: { id: threadId }, select: { visitorId: true } }).catch(() => null)
    await sendPushToVisitor(
      thread?.visitorId,
      paymentDetailsNotification({ orderNumber: order.orderNumber, orderToken: order.orderToken, methodLabel: instructions.methodLabel }),
    )
  }

  return {
    ok: true,
    orderNumber: order.orderNumber,
    reissued,
    chat: chatOutcome.status,
    email: emailOutcome,
    invoiceAttached: Boolean(key),
    instructions,
  }
}

class IssueRefused extends Error {}
