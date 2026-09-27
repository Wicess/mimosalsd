import { randomBytes } from 'node:crypto'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db/client'
import { notify } from '@/lib/notify/ntfy'
import { orders } from '@/lib/orders/repository'
import {
  checkReceipt,
  MAX_RECEIPTS_PER_ORDER,
  MAX_RECEIPTS_PER_UPLOAD,
  normaliseTxRef,
  RECEIPT_STATUSES,
} from '@/lib/orders/receipts'
import { reportError } from '@/lib/observability/report-error'
import { keys, putObject } from '@/lib/storage/r2'
import { absoluteUrl } from '@/lib/seo/routes'
import { formatCents } from '@/lib/utils'

/**
 * A buyer uploads proof of payment for their own order.
 *
 * Ported from WHAM's `/api/orders/[number]/proof`, keeping its behaviour — several
 * screenshots at once, an optional transaction reference, an immediate loud push to
 * the owner — and changing three things that were wrong for this business:
 *
 *  1. PRIVATE, NOT PUBLIC. WHAM writes receipts to a public R2 URL. That is a
 *     screenshot of somebody's banking app, addressable by anyone holding the link,
 *     forever. Here they go under `receipts/`, which `putObject` stamps
 *     `private, no-store` and `publicUrl()` refuses outright. Operators read them
 *     through a signed URL that expires in minutes.
 *
 *  2. THE TOKEN IS THE CREDENTIAL. WHAM matches order number + email. The order
 *     number is short and sequential, and an email is not a secret; together they
 *     are an oracle. The order token is unguessable, already emailed to the buyer,
 *     and is what `/order/[token]` itself trusts.
 *
 *  3. TYPE BY BYTES. WHAM trusts `file.type`, which the browser — or a script —
 *     simply declares. This sniffs the magic number.
 *
 * Uploading proof also CLAIMS the payment, so the buyer does one thing rather than
 * two. It never marks the order PAID: only a person who has checked the money
 * arrived can do that.
 */

const tokenSchema = z.string().min(20).max(200)

function fail(status: number, error: string) {
  return NextResponse.json({ ok: false, error }, { status })
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token: rawToken } = await params
  const token = tokenSchema.safeParse(rawToken)
  // The same answer for a malformed token and an unknown one — anything else tells a
  // caller which tokens are real.
  if (!token.success) return fail(404, 'We could not find that order.')

  const form = await request.formData().catch(() => null)
  if (!form) return fail(400, 'Expected a file upload.')

  const files = form
    .getAll('files')
    .filter((f): f is File => f instanceof File && f.size > 0)
  const txRef = normaliseTxRef(form.get('txRef'))

  if (files.length === 0 && !txRef) {
    return fail(422, 'Add a screenshot, a PDF receipt or a transaction reference.')
  }
  if (files.length > MAX_RECEIPTS_PER_UPLOAD) {
    return fail(422, `Up to ${MAX_RECEIPTS_PER_UPLOAD} files at a time, please.`)
  }

  const order = await db.order.findUnique({
    where: { orderToken: token.data },
    select: {
      id: true,
      orderNumber: true,
      orderToken: true,
      status: true,
      totalCents: true,
      firstName: true,
      lastName: true,
      paymentRequest: { select: { id: true, receiptKeys: true } },
    },
  })
  if (!order) return fail(404, 'We could not find that order.')

  if (!RECEIPT_STATUSES.has(order.status)) {
    return fail(
      409,
      order.status === 'PENDING_VERIFICATION'
        ? 'We are still verifying this order. Payment instructions will follow — please do not pay yet.'
        : 'This order no longer needs proof of payment.',
    )
  }
  if (!order.paymentRequest) {
    return fail(409, 'Payment instructions have not been issued for this order yet.')
  }

  const existing = order.paymentRequest.receiptKeys.length
  if (existing + files.length > MAX_RECEIPTS_PER_ORDER) {
    return fail(
      422,
      `This order already has ${existing} receipt${existing === 1 ? '' : 's'}. If something is missing, reply to your order email instead.`,
    )
  }

  /*
   * Validate EVERY file before uploading ANY. Checking as we go would leave the first
   * two receipts in the bucket when the third turned out to be a renamed executable —
   * orphaned private objects that nothing references and nothing will ever delete.
   */
  const checked: { bytes: Uint8Array; ext: string; contentType: string }[] = []
  for (const file of files) {
    const bytes = new Uint8Array(await file.arrayBuffer())
    const result = checkReceipt(bytes)
    if (!result.ok) return fail(422, result.error)
    checked.push({
      bytes,
      ext: result.signature.ext,
      contentType: result.signature.contentType,
    })
  }

  const newKeys: string[] = []
  try {
    for (const [i, file] of checked.entries()) {
      const key = keys.paymentReceipt(
        order.orderToken,
        existing + i + 1,
        randomBytes(6).toString('hex'),
        file.ext,
      )
      await putObject(key, file.bytes, file.contentType)
      newKeys.push(key)
    }
  } catch (error) {
    await reportError(error, {
      source: 'route',
      severity: 'FATAL',
      routePath: '/api/orders/[token]/receipt',
      context: { stage: 'r2-upload', orderNumber: order.orderNumber, uploaded: newKeys.length },
    })
    return fail(502, 'The upload did not go through. Please try again in a moment.')
  }

  const firstClaim = order.status === 'AWAITING_PAYMENT'

  await db.paymentIntentRequest.update({
    where: { id: order.paymentRequest.id },
    data: {
      // Appended, never replaced: the bank receipt now and the app screenshot ten
      // minutes later must both survive.
      ...(newKeys.length ? { receiptKeys: { push: newKeys } } : {}),
      ...(txRef ? { txRef } : {}),
      ...(firstClaim ? { claimedAt: new Date() } : {}),
    },
  })

  if (firstClaim) {
    await orders.appendEvent(
      order.orderToken,
      {
        type: 'PAYMENT_CLAIMED',
        message: `Customer uploaded proof of payment${newKeys.length ? ` (${newKeys.length} file${newKeys.length === 1 ? '' : 's'})` : ''}${txRef ? ` — ref ${txRef}` : ''}.`,
        at: new Date().toISOString(),
        // A literal, not `order.status`: `firstClaim` has already established it is
        // AWAITING_PAYMENT, and the Prisma enum carries DRAFT, which the domain
        // OrderStatus deliberately does not.
        fromStatus: 'AWAITING_PAYMENT',
        toStatus: 'PAYMENT_CLAIMED',
      },
      'PAYMENT_CLAIMED',
    )
  } else {
    // Already claimed: record the extra evidence without a second status change.
    await orders.appendEvent(order.orderToken, {
      type: 'RECEIPT_ADDED',
      message: `Customer added ${newKeys.length || 'no'} more file${newKeys.length === 1 ? '' : 's'}${txRef ? ` — ref ${txRef}` : ''}.`,
      at: new Date().toISOString(),
    })
  }

  /*
    Only on the FIRST proof. Every upload used to push, so a customer sending the bank
    confirmation, then the app screenshot, then a transaction id rang the owner's
    phone three times at the top priority for one payment. Later uploads are still
    recorded (RECEIPT_ADDED above) and shown on the order; they just do not ring.
  */
  if (firstClaim) await notify({
    topic: 'orders-paid',
    title: `Payment proof — ${order.orderNumber}`,
    body: `${order.firstName} ${order.lastName} sent ${newKeys.length || 'no'} receipt${newKeys.length === 1 ? '' : 's'} for ${formatCents(order.totalCents)}${txRef ? ` (ref ${txRef})` : ''}. Verify the money arrived before marking paid.`,
    tags: ['receipt'],
    clickUrl: absoluteUrl(`/admin/orders/${order.orderNumber}`),
  })

  return NextResponse.json({ ok: true, uploaded: newKeys.length })
}
