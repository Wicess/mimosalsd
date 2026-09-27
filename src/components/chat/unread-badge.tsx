'use client'

import { useSyncExternalStore } from 'react'
import { getUnread, getUnreadServer, subscribeUnread } from '@/lib/chat/unread-store'
import { cn } from '@/lib/utils'

/** The unread-message count on a chat or profile icon. Renders nothing at zero. */
export function ChatUnreadBadge({ className }: { className?: string }) {
  const unread = useSyncExternalStore(subscribeUnread, getUnread, getUnreadServer)
  if (unread <= 0) return null
  return (
    <span
      className={cn(
        'tabular pointer-events-none absolute inline-flex min-w-5 items-center justify-center rounded-full bg-danger-fg px-1.5 text-[11px] leading-5 font-bold text-background shadow-sm ring-2 ring-surface',
        className ?? '-top-1 -right-1',
      )}
    >
      {unread > 99 ? '99+' : unread}
      <span className="sr-only"> unread {unread === 1 ? 'message' : 'messages'}</span>
    </span>
  )
}
