'use client'

import { useEffect } from 'react'
import { markHasThread } from '@/lib/chat/unread-store'

/**
 * Placing an order posts its invoice into the customer's chat, so from the order
 * page on, this browser has a conversation worth watching for replies — even if the
 * customer has never opened the chat themselves.
 */
export function RememberChatThread() {
  useEffect(() => {
    markHasThread()
  }, [])
  return null
}
