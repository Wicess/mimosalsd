import { NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db/client'
import { deleteThreads } from '@/lib/chat/core'
import { isRecent, ONLINE_WINDOW_MS, TYPING_WINDOW_MS } from '@/lib/chat/rules'
import { reportError } from '@/lib/observability/report-error'
import { requireChatAdmin } from '@/lib/chat/admin-guard'

/**
 * The inbox list.
 *
 * Also the operator's presence heartbeat: an open inbox polls this, and each poll
 * keeps the "online now" dot lit for customers. Close the inbox and within a minute
 * customers see "we reply by hand" instead of a promise nobody is there to keep.
 *
 * Contact-form and bulk enquiries live in the same table, so they appear here in the
 * same list as live chat — one place to look, not two.
 */
export async function GET(request: Request) {
  const guard = await requireChatAdmin()
  if (!guard.ok) return guard.response

  const params = new URL(request.url).searchParams
  const filter = params.get('filter') === 'all' ? 'all' : params.get('filter') === 'closed' ? 'closed' : 'open'
  const q = params.get('q')?.trim().slice(0, 100) ?? ''

  const threads = await db.supportThread.findMany({
    where: {
      // A conversation with nothing in it yet is someone typing their first message
      // (api/chat/typing): listed while they type, not after they walk away.
      AND: [{ OR: [{ messages: { some: {} } }, { customerTypingAt: { gte: new Date(Date.now() - TYPING_WINDOW_MS) } }] }],
      ...(filter === 'open' ? { isOpen: true } : filter === 'closed' ? { isOpen: false } : {}),
      ...(q
        ? {
            /*
             * The person AND what was said, as in WHAM — "which chat was that order
             * number in?" is a real question. Searching message bodies is the most
             * expensive query the inbox makes, which is why the client debounces it,
             * needs two characters, and stops live-polling while a search is showing.
             */
            OR: [
              { displayName: { contains: q, mode: 'insensitive' as const } },
              { email: { contains: q, mode: 'insensitive' as const } },
              { publicId: { contains: q.toUpperCase() } },
              { messages: { some: { body: { contains: q, mode: 'insensitive' as const }, deletedAt: null } } },
            ],
          }
        : {}),
    },
    orderBy: { lastMessageAt: 'desc' },
    take: 100,
    select: {
      id: true,
      publicId: true,
      displayName: true,
      email: true,
      subject: true,
      isOpen: true,
      lastMessageAt: true,
      lastMessageText: true,
      lastSender: true,
      unreadForAdmin: true,
      customerTypingAt: true,
      customerTypingText: true,
      customerLastSeenAt: true,
    },
  })

  return NextResponse.json(
    {
      threads: threads.map((t) => {
        const typing = isRecent(t.customerTypingAt, TYPING_WINDOW_MS)
        return {
          id: t.id,
          publicId: t.publicId,
          displayName: t.displayName ?? t.email ?? t.publicId ?? 'Visitor',
          email: t.email,
          subject: t.subject,
          isOpen: t.isOpen,
          lastMessageAt: t.lastMessageAt.toISOString(),
          lastMessageText: t.lastMessageText,
          lastSender: t.lastSender,
          unread: t.unreadForAdmin,
          online: isRecent(t.customerLastSeenAt, ONLINE_WINDOW_MS),
          typing,
          // WHAM's live preview: what the customer has typed so far, in the inbox row.
          typingText: typing ? t.customerTypingText : null,
        }
      }),
      totalUnread: threads.reduce((sum, t) => sum + t.unreadForAdmin, 0),
    },
    { headers: { 'Cache-Control': 'no-store' } },
  )
}

const bulkSchema = z.object({ ids: z.array(z.string().min(1).max(60)).min(1).max(100) })

/** WHAM's bulk "Select → Delete". Each transcript is kept in the audit log first. */
export async function DELETE(request: Request) {
  const guard = await requireChatAdmin()
  if (!guard.ok) return guard.response
  const parsed = bulkSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ ok: false, error: 'Invalid request.' }, { status: 400 })
  try {
    const deleted = await deleteThreads(parsed.data.ids, guard.identity)
    return NextResponse.json({ ok: true, deleted })
  } catch (error) {
    await reportError(error, {
      source: 'route',
      severity: 'ERROR',
      routePath: '/api/admin/chat/threads',
      context: { action: 'bulk-delete', count: parsed.data.ids.length },
    })
    return NextResponse.json({ ok: false, error: 'That did not work. It has been logged.' }, { status: 500 })
  }
}
