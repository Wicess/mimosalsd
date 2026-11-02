import { NextResponse } from 'next/server'
import { findThread, visitorId } from '@/lib/chat/core'
import { threadTopic } from '@/lib/live/push'

/**
 * How many staff messages this visitor has not read. One small read for the badges
 * on the chat and profile icons. The watcher calls it only for a visitor who has a
 * conversation: once when a tab opens or comes back, then when a push says the shop
 * wrote (with a rare safety check), or once a minute while the tab is in use if the
 * push stream is unavailable. It cannot hold the database awake for a site left
 * open on a second monitor.
 */
export async function GET(): Promise<Response> {
  const visitor = await visitorId(false)
  const thread = await findThread(visitor)
  return NextResponse.json(
    {
      unread: thread?.unreadForCustomer ?? 0,
      hasThread: Boolean(thread),
      // Where to listen for the next reply instead of asking again (lib/live/push.ts).
      ...(thread ? { live: threadTopic(thread.id) } : {}),
    },
    { headers: { 'Cache-Control': 'no-store' } },
  )
}
