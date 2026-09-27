'use client'

import { openChat } from '@/lib/chat/chat-ui'
import { ChatIcon } from '@/components/ui/icon'
import { tabClass } from '@/components/layout/tab-item'
import { ChatUnreadBadge } from '@/components/chat/unread-badge'

/**
 * The phone's way into live chat — a fifth tab.
 *
 * The tab bar was held at four because "this site has no fifth destination worth
 * permanent screen space". Live chat is that destination: the one route to a person
 * for a buyer on a phone, and on a phone it cannot be a floating bubble without
 * covering the sticky Add-to-Cart.
 *
 * A button, not a link, because it opens a sheet over the current page rather than
 * navigating away — leaving the product a customer is asking about would defeat the
 * point of asking.
 */
export function ChatTab() {
  return (
    <button type="button" onClick={openChat} className={`w-full ${tabClass(false)}`}>
      <span className="relative">
        <ChatIcon className="size-6" />
        <ChatUnreadBadge />
      </span>
      <span>Chat</span>
    </button>
  )
}
