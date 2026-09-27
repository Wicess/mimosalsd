import { NextResponse } from 'next/server'
import { findThread, visitorId } from '@/lib/chat/core'

/**
 * How many staff messages this visitor has not read. One small read for the badges
 * on the chat and profile icons. The watcher calls it only for a visitor who has a
 * conversation, once a minute while the tab is visible and in use, so it cannot hold
 * the database awake for a site left open on a second monitor.
 */
export async function GET(): Promise<Response> {
  const visitor = await visitorId(false)
  const thread = await findThread(visitor)
  return NextResponse.json(
    { unread: thread?.unreadForCustomer ?? 0, hasThread: Boolean(thread) },
    { headers: { 'Cache-Control': 'no-store' } },
  )
}
