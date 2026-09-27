import type { Metadata } from 'next'
import { Suspense } from 'react'
import { ChatInbox } from '@/components/admin/chat/chat-inbox'

export const metadata: Metadata = { title: 'Messages' }

/**
 * The operator's inbox: live chat, contact-form and bulk enquiries, in one place.
 *
 * On a phone this is a messaging app, not a page — the inbox pins itself under the
 * top bar and only its panes scroll, so there is no visible title here: a heading
 * above a full-height app surface would push the reply box off the bottom. On a
 * tablet the inbox is a card in a normal page and the title returns. On a desktop
 * it fills the space beside the sidebar and its own list header names it.
 *
 * Auth and the messages-area grant are enforced by the proxy and the admin layout,
 * and again by every API route the inbox calls (lib/chat/admin-guard.ts).
 */
export default function AdminMessagesPage({
  searchParams,
}: {
  searchParams: Promise<{ thread?: string | string[] }>
}) {
  return (
    <div className="md:p-6 lg:p-0">
      <h1 className="sr-only md:not-sr-only md:pb-4 md:font-display md:text-2xl md:text-foreground lg:sr-only">
        Messages
      </h1>
      <Suspense fallback={<ChatInbox />}>
        <InboxOpenedOn searchParams={searchParams} />
      </Suspense>
    </div>
  )
}

/**
 * `?thread=<id>` opens that conversation. It is what a chat, contact or bulk-quote
 * notification links to, so tapping one on a phone lands on the conversation to
 * answer, not on the inbox list with the job of finding it.
 */
async function InboxOpenedOn({
  searchParams,
}: {
  searchParams: Promise<{ thread?: string | string[] }>
}) {
  const { thread } = await searchParams
  const id = typeof thread === 'string' && /^[a-z0-9]{10,40}$/i.test(thread) ? thread : null
  return <ChatInbox initialThreadId={id} />
}
