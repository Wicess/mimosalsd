'use client'

import { useEffect } from 'react'
import { getChatUiOpen } from '@/lib/chat/chat-ui'
import { CHAT_URL, showReplyNotification, storedNotificationsOn } from '@/lib/chat/reply-notify'
import { forgetThread, getUnread, hasThread, setUnread } from '@/lib/chat/unread-store'
import { registerChatSync, setChatLiveTopic } from '@/lib/chat/live-sync'

/**
 * Keeps the unread badges current while the chat is closed, and pops a notification
 * when a new staff message arrives (if the visitor turned notifications on).
 *
 * Cost first, as the cost playbook asks: nothing at all for a visitor with no
 * conversation. Otherwise one check when the tab opens or comes back, then a check
 * only when the shop's reply rings the thread's push topic (lib/live), with a
 * 15-minute safety net — or, if the push stream is unavailable, one small request a
 * minute while the tab is visible and in use. The timing lives in
 * lib/chat/live-sync.ts, shared with the open chat panel, so however many watchers a
 * page mounts it runs ONE poller. Web push covers the site being closed.
 */
export function UnreadWatcher() {
  useEffect(() => {
    const check = async () => {
      if (!hasThread() || getChatUiOpen() || window.location.pathname === CHAT_URL) return
      try {
        const response = await fetch('/api/chat/unread', { cache: 'no-store' })
        if (!response.ok) return
        const data = (await response.json()) as { unread: number; hasThread: boolean; live?: string | null }
        if (!data.hasThread) {
          forgetThread()
          setChatLiveTopic(null)
          setUnread(0)
          return
        }
        setChatLiveTopic(data.live)
        const before = getUnread()
        setUnread(data.unread)
        if (data.unread > before && storedNotificationsOn()) {
          const n = data.unread
          void showReplyNotification(n === 1 ? 'You have a new message from our team.' : `You have ${n} new messages from our team.`)
        }
      } catch {
        // Offline: the next check catches up.
      }
    }
    return registerChatSync({ role: 'badge', run: check })
  }, [])

  return null
}
