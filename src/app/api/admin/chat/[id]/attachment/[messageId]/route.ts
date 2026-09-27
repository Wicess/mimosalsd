import { NextResponse } from 'next/server'
import { db } from '@/lib/db/client'
import { requireChatAdmin } from '@/lib/chat/admin-guard'
import { signedUrl } from '@/lib/storage/r2'

/**
 * Open an attachment from a conversation, as the operator.
 *
 * The key is read from the database by message AND thread, never taken from the
 * request, so this cannot be used to sign an arbitrary private object. The signed URL
 * it redirects to dies in two minutes.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string; messageId: string }> },
) {
  const guard = await requireChatAdmin()
  if (!guard.ok) return guard.response
  const { id, messageId } = await params

  const message = await db.supportMessage.findFirst({
    where: { id: messageId, threadId: id },
    select: { attachmentKey: true },
  })
  if (!message?.attachmentKey) return new NextResponse('Not found', { status: 404 })

  return NextResponse.redirect(await signedUrl(message.attachmentKey, 120), {
    status: 302,
    headers: { 'Cache-Control': 'no-store, private', 'Referrer-Policy': 'no-referrer' },
  })
}
