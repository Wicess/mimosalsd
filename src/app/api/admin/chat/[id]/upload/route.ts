import { randomBytes } from 'node:crypto'
import { after, NextResponse } from 'next/server'
import { db } from '@/lib/db/client'
import { checkOperatorReply, postMessage } from '@/lib/chat/core'
import { cleanBody } from '@/lib/chat/rules'
import { forAdmin } from '@/lib/chat/serialize'
import { requireChatAdmin } from '@/lib/chat/admin-guard'
import { checkReceipt } from '@/lib/orders/receipts'
import { reportError } from '@/lib/observability/report-error'
import { staffReplyNotification } from '@/lib/push/customer'
import { sendPushToVisitor } from '@/lib/push/server'
import { keys, putObject } from '@/lib/storage/r2'

/**
 * The operator sends a photo or a PDF — WHAM's "Attach a photo" in the reply box.
 *
 * Same rules as the customer's upload: the type is decided by reading the bytes, and
 * the file is stored PRIVATELY under the thread, so the customer opens it through
 * their own ownership-checked route and nobody else can. A caption is the business
 * speaking in writing, so it passes the same lexicon gate as a typed reply.
 *
 * Multipart to a route handler rather than a Server Action: actions cap bodies at
 * 1 MB, and a phone photo is several.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireChatAdmin()
  if (!guard.ok) return guard.response
  const { identity } = guard
  const { id } = await params

  const thread = await db.supportThread.findUnique({ where: { id }, select: { id: true, visitorId: true } })
  if (!thread) return NextResponse.json({ ok: false, error: 'Not found.' }, { status: 404 })

  const form = await request.formData().catch(() => null)
  const file = form?.get('file')
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ ok: false, error: 'Choose a file to send.' }, { status: 422 })
  }

  const caption = cleanBody(form?.get('body')) ?? ''
  if (caption) {
    const gate = checkOperatorReply(caption)
    if (!gate.ok) return NextResponse.json({ ok: false, error: gate.error }, { status: 422 })
  }

  const bytes = new Uint8Array(await file.arrayBuffer())
  const check = checkReceipt(bytes)
  if (!check.ok) return NextResponse.json({ ok: false, error: check.error }, { status: 422 })

  try {
    const key = keys.chatAttachment(thread.id, randomBytes(8).toString('hex'), check.signature.ext)
    await putObject(key, bytes, check.signature.contentType)
    const message = await postMessage({
      threadId: thread.id,
      fromCustomer: false,
      body: caption,
      authorName: identity.name || identity.email,
      attachment: {
        key,
        contentType: check.signature.contentType,
        name: file.name.replace(/[^\w. -]/g, '').slice(0, 120) || `file.${check.signature.ext}`,
      },
    })
    after(() =>
      sendPushToVisitor(thread.visitorId, staffReplyNotification({ body: caption, attachmentName: message.attachmentName })),
    )
    return NextResponse.json({ ok: true, message: forAdmin(message) })
  } catch (error) {
    await reportError(error, {
      source: 'route',
      severity: 'ERROR',
      routePath: '/api/admin/chat/[id]/upload',
      context: { stage: 'upload' },
    })
    return NextResponse.json({ ok: false, error: 'That file did not send. It has been logged.' }, { status: 502 })
  }
}
