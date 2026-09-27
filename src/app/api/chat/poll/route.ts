import { NextResponse } from 'next/server'
import { db } from '@/lib/db/client'
import { customerViewing, findThread, markDelivered, visitorId } from '@/lib/chat/core'
import { forCustomer } from '@/lib/chat/serialize'

/**
 * The customer's live view of their conversation.
 *
 * Polled, not streamed, for WHAM's reason: SSE would hold a serverless function open
 * for the life of every open tab, billed as wall-clock time on a connection the
 * platform recycles anyway. An indexed `createdAt > since` read is cheap and survives
 * sleep, resume and a flaky mobile network for nothing.
 *
 * And polled ONLY while the chat panel is open. WHAM also polls a closed widget every
 * 30s to keep an unread badge honest, answering those from Redis so Postgres can
 * sleep. This site has no Redis, and the same poll against Neon would keep the
 * database awake for every visitor holding a tab open — the exact pattern behind the
 * last Neon bill. So a closed widget polls nothing, and a reply is seen when the
 * panel opens or the page reloads.
 *
 * Never creates a thread or a cookie: reading a conversation must not mint one.
 */

const PAGE = 60

export async function GET(request: Request) {
  const visitor = await visitorId(false)
  const thread = await findThread(visitor)

  if (!thread) {
    return NextResponse.json(
      { messages: [], publicId: null, unread: 0 },
      { headers: { 'Cache-Control': 'no-store' } },
    )
  }

  const params = new URL(request.url).searchParams
  const sinceRaw = params.get('since')
  const since = sinceRaw ? new Date(sinceRaw) : null
  const open = params.get('open') === '1'

  const incremental = since && !Number.isNaN(since.getTime()) ? since : null

  /*
   * New messages, AND older ones the shop has since corrected or removed — one query.
   *
   * The watermark alone would never carry an edit: the message is older than it. An
   * edit or removal made after the watermark is returned until a newer message moves
   * the watermark past it, by which point this device has already had it.
   */
  const rows = await db.supportMessage.findMany({
    where: {
      threadId: thread.id,
      ...(incremental
        ? {
            OR: [
              { createdAt: { gt: incremental } },
              { editedAt: { gt: incremental } },
              { deletedAt: { gt: incremental } },
            ],
          }
        : {}),
    },
    // Incremental after the first load; the most recent page on the first load.
    orderBy: { createdAt: incremental ? 'asc' : 'desc' },
    take: PAGE,
  })
  const ordered = incremental ? rows : rows.reverse()
  // Only genuinely new rows may move the client's watermark; corrections ride apart.
  const messages = ordered.filter((m) => !incremental || m.createdAt > incremental).map(forCustomer)
  const changes = incremental
    ? ordered.filter((m) => m.createdAt <= incremental).map(forCustomer)
    : []

  /*
   * Receipts, and only as the customer's device genuinely warrants.
   *
   * Arriving at this device counts as delivered. Only an OPEN panel counts as read —
   * a poll from a panel the customer has minimised must never tell the operator a
   * reply was seen.
   */
  if (open) await customerViewing(thread)
  else if (thread.unreadForCustomer > 0) await markDelivered(thread.id, 'CUSTOMER')

  /*
   * Receipt movement on messages the customer ALREADY holds.
   *
   * The watermark only fetches messages newer than `since`, so a tick appearing on a
   * message they sent a minute ago would never reach them without this. Their own
   * recent messages only: a customer sees one tick, and once delivered it never
   * changes, so this list is small and settles quickly.
   */
  const receipts = incremental
    ? (
        await db.supportMessage.findMany({
          where: { threadId: thread.id, fromCustomer: true, deliveredAt: { not: null } },
          orderBy: { createdAt: 'desc' },
          take: 30,
          select: { id: true },
        })
      ).map((r) => ({ id: r.id, receipt: 'delivered' as const }))
    : []

  return NextResponse.json(
    {
      messages,
      changes,
      receipts,
      publicId: thread.publicId,
      unread: open ? 0 : thread.unreadForCustomer,
    },
    { headers: { 'Cache-Control': 'no-store' } },
  )
}
