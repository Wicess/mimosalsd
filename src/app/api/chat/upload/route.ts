import { randomBytes } from 'node:crypto'
import { NextResponse } from 'next/server'
import {
  alertOperator,
  clientIp,
  ensureThread,
  findThread,
  isBlocked,
  lastCustomerMessageAt,
  shouldAlertOperator,
  postMessage,
  visitorId,
} from '@/lib/chat/core'
import { cleanBody } from '@/lib/chat/rules'
import { forCustomer } from '@/lib/chat/serialize'
import { checkReceipt } from '@/lib/orders/receipts'
import { reportError } from '@/lib/observability/report-error'
import { keys, putObject } from '@/lib/storage/r2'
import { z } from 'zod'

const emailSchema = z.string().trim().toLowerCase().email().max(320)

/**
 * A customer sends a photo or a PDF in the chat.
 *
 * Ported from WHAM's `/api/chat/upload`, with the same two changes as the payment
 * receipt upload: the file is stored PRIVATELY (WHAM's is public), and its type is
 * decided by reading the bytes (WHAM trusts the declared type). It reuses the receipt
 * rules outright — images and PDF, 15 MB, sniffed — because a photo of a parcel and
 * a photo of a bank receipt are the same risk to a public endpoint.
 *
 * One file per message, as in WHAM: a caption belongs to the picture it describes.
 */
export async function POST(request: Request) {
  const ip = await clientIp()
  if (await isBlocked(ip)) {
    return NextResponse.json({ ok: false, error: 'Could not send that file.' }, { status: 403 })
  }

  const form = await request.formData().catch(() => null)
  const file = form?.get('file')
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ ok: false, error: 'Choose a file to send.' }, { status: 422 })
  }

  const bytes = new Uint8Array(await file.arrayBuffer())
  const check = checkReceipt(bytes)
  if (!check.ok) {
    return NextResponse.json({ ok: false, error: check.error }, { status: 422 })
  }

  const visitor = await visitorId(true)
  if (!visitor) {
    return NextResponse.json({ ok: false, error: 'Could not start a conversation.' }, { status: 500 })
  }

  // Same rule as a typed message: an email before anything is sent.
  const typedEmail = emailSchema.safeParse(form?.get('email') ?? '')
  const email = typedEmail.success ? typedEmail.data : null
  const existing = await findThread(visitor)
  if (!existing?.email && !email) {
    return NextResponse.json(
      { ok: false, error: 'Enter your email to start the chat.', needsEmail: true },
      { status: 422 },
    )
  }

  try {
    const thread = await ensureThread({ visitor, email })
    const wasWaiting = thread.unreadForAdmin > 0
    const previousCustomerAt = await lastCustomerMessageAt(thread.id)

    const key = keys.chatAttachment(thread.id, randomBytes(8).toString('hex'), check.signature.ext)
    await putObject(key, bytes, check.signature.contentType)

    const caption = cleanBody(form?.get('body')) ?? ''
    const message = await postMessage({
      threadId: thread.id,
      fromCustomer: true,
      body: caption,
      ip,
      attachment: {
        key,
        contentType: check.signature.contentType,
        // Display only. The stored name is never a path and never used to read.
        name: file.name.replace(/[^\w. -]/g, '').slice(0, 120) || `file.${check.signature.ext}`,
      },
    })

    // A photo or a file always rings, with the photo inside the notification.
    if (shouldAlertOperator({ hasAttachment: true, wasWaiting, previousCustomerAt })) {
      const pdf = check.signature.ext === 'pdf'
      await alertOperator({
        publicId: thread.publicId ?? 'SG-?',
        displayName: thread.displayName ?? 'Visitor',
        threadId: thread.id,
        email: thread.email,
        kind: pdf ? 'pdf' : 'photo',
        attachmentKey: key,
        preview: caption || (pdf ? 'A PDF is attached. Open the chat to read it.' : 'Photo shown below.'),
      })
    }

    return NextResponse.json({ ok: true, message: forCustomer(message), hasEmail: true })
  } catch (error) {
    await reportError(error, {
      source: 'route',
      severity: 'FATAL',
      routePath: '/api/chat/upload',
      context: { stage: 'upload' },
    })
    return NextResponse.json(
      { ok: false, error: 'That file did not send. Please try again.' },
      { status: 502 },
    )
  }
}
