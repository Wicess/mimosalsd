import { NextResponse } from 'next/server'
import { db } from '@/lib/db/client'
import { findThread, visitorId } from '@/lib/chat/core'
import { signedUrl } from '@/lib/storage/r2'

/**
 * Open an attachment from the customer's OWN conversation.
 *
 * Ownership is the whole check: the message must belong to the thread this visitor
 * cookie resolves to. A message id alone is not enough — ids travel in page payloads
 * and logs — and an endpoint that signed any message's attachment for anyone would
 * let one customer open another customer's photos by changing a URL.
 *
 * The key is read from the database by message id, never taken from the request, and
 * the signed URL it redirects to expires in two minutes.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const thread = await findThread(await visitorId(false))
  if (!thread) return new NextResponse('Not found', { status: 404 })

  const message = await db.supportMessage.findFirst({
    where: { id, threadId: thread.id, deletedAt: null },
    select: { attachmentKey: true, attachmentName: true, attachmentType: true },
  })
  if (!message?.attachmentKey) return new NextResponse('Not found', { status: 404 })

  /*
    ?download=1: the chat viewer's Save button. Passed through this site rather than
    redirected, so saving a photo or an invoice downloads it where the customer is,
    instead of opening the storage address in a new page and leaving the site.
  */
  if (new URL(request.url).searchParams.get('download') === '1') {
    const upstream = await fetch(await signedUrl(message.attachmentKey, 60)).catch(() => null)
    if (!upstream?.ok || !upstream.body) return new NextResponse('Not found', { status: 404 })
    const name = (message.attachmentName ?? 'attachment').replace(/["\\\r\n]/g, '')
    return new NextResponse(upstream.body, {
      headers: {
        'Content-Type': message.attachmentType ?? upstream.headers.get('content-type') ?? 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${name}"`,
        'Cache-Control': 'no-store, private',
        'X-Content-Type-Options': 'nosniff',
      },
    })
  }

  return NextResponse.redirect(await signedUrl(message.attachmentKey, 120), {
    status: 302,
    headers: { 'Cache-Control': 'no-store, private', 'Referrer-Policy': 'no-referrer' },
  })
}
