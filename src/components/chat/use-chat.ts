'use client'

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import {
  emitNotify,
  notificationsSupported,
  NOTIFY_STORAGE_KEY,
  serverFalse,
  showReplyNotification,
  storedNotificationsOn,
  subscribeNotify,
} from '@/lib/chat/reply-notify'
import { markHasThread, setUnread } from '@/lib/chat/unread-store'
import { chatSyncChanged, registerChatSync, setChatLiveTopic } from '@/lib/chat/live-sync'
import { idleFor, isVisible, markPresent } from '@/lib/live/activity'
import { disablePushNotifications, enablePushNotifications } from '@/components/pwa/push-client'
import { openInstallGuide } from '@/components/pwa/install-store'

/**
 * Customer-side chat state: history, live updates, optimistic sending.
 *
 * Ported from WHAM's `use-chat.ts` — the watermark, the merge-by-id, the optimistic
 * bubble that becomes real or flags itself failed — with WHAM's closed-panel polling
 * REMOVED, by decision.
 *
 * WHAM polls a closed widget every 30s to keep an unread badge current, and answers
 * those polls from Redis so Postgres can sleep. There is no Redis here, and the same
 * poll against Neon would hold the database awake for every visitor with a tab open.
 * So the panel is PUSH-driven (lib/live): the shop's reply rings an ntfy topic, and
 * the panel polls once when it hears it. The timing rules live in one place,
 * lib/chat/live-sync.ts, shared with the unread badges so a page runs one poller:
 *
 *   · a push from the shop                      → at once
 *   · panel OPEN, someone here, stream up       → every 25s (presence heartbeat)
 *   · panel OPEN, someone here, no stream       → every 3s, as before
 *   · panel closed                              → the badge watcher's rules
 *   · tab hidden, or no interaction for 3 min   → nothing, then one catch-up poll
 *
 * The last rule is the one from ~/.claude/CLAUDE.md: a chat left open on a second
 * monitor is exactly the "timer keeps both meters running" case the cost playbook
 * exists to stop.
 */

export interface ChatAttachmentView {
  readonly type: string
  readonly name: string
}

export interface ChatMessage {
  readonly id: string
  readonly sender: 'CUSTOMER' | 'ADMIN' | 'SYSTEM'
  readonly body: string
  readonly createdAt: string
  readonly receipt: 'sent' | 'delivered'
  readonly attachment: ChatAttachmentView | null
  readonly edited: boolean
  readonly deleted: boolean
  /** Optimistic row not yet acknowledged by the server. */
  readonly pending?: boolean
  /** The send failed. The text stays on screen so nothing typed is lost. */
  readonly failed?: boolean
  /** A local preview for an optimistic image, before the server has it. */
  readonly localPreview?: string
}

const TYPING_THROTTLE_MS = 2500
/*
  Reply notifications. Polling normally stops while the tab is hidden, so a reply
  could never reach someone who switched away. With notifications on and the chat
  open, a hidden tab keeps listening for a short while after their last activity
  (the push stream, or without one a slow poll), then stops — enough to catch a
  reply they are waiting for, never an open-ended timer holding the database awake.
*/
const HIDDEN_NOTIFY_WINDOW_MS = 10 * 60_000
export function useChat({ open }: { open: boolean }) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [publicId, setPublicId] = useState<string | null>(null)
  /** Whether this visitor's conversation has an email on it. Nothing is sent until it does. */
  const [hasEmail, setHasEmail] = useState(false)
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)

  // Refs, not state: changing these must not re-arm the polling loop, or every poll
  // would tear down its own timer.
  const sinceRef = useRef<string | null>(null)
  const openRef = useRef(open)
  const lastTypingRef = useRef(0)
  const notificationsOn = useSyncExternalStore(subscribeNotify, storedNotificationsOn, serverFalse)
  const canNotify = useSyncExternalStore(subscribeNotify, notificationsSupported, serverFalse)

  useEffect(() => {
    openRef.current = open
  }, [open])

  const merge = useCallback((incoming: readonly ChatMessage[]) => {
    if (incoming.length === 0) return
    setMessages((prev) => {
      const byId = new Map(prev.map((m) => [m.id, m]))
      // A later fetch carries newer state for a message already held; it wins.
      for (const m of incoming) byId.set(m.id, { ...byId.get(m.id), ...m })
      // Drop the optimistic copy once the server has echoed the real one back.
      const echoed = new Set(
        incoming.filter((m) => !m.pending).map((m) => `${m.sender}:${m.body}`),
      )
      return [...byId.values()]
        .filter((m) => !(m.pending && echoed.has(`${m.sender}:${m.body}`)))
        // A message the shop removed vanishes for the customer, as in WHAM.
        .filter((m) => !m.deleted)
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    })
  }, [])

  const poll = useCallback(async () => {
    try {
      const qs = new URLSearchParams()
      if (sinceRef.current) qs.set('since', sinceRef.current)
      // Only an on-screen panel may mark the shop's replies as read.
      if (openRef.current) qs.set('open', '1')
      const response = await fetch(`/api/chat/poll?${qs.toString()}`, { cache: 'no-store' })
      if (!response.ok) return
      const data = (await response.json()) as {
        messages: ChatMessage[]
        /** Older messages the shop has since edited or removed. */
        changes?: ChatMessage[]
        receipts?: { id: string; receipt: 'delivered' }[]
        publicId: string | null
        hasEmail?: boolean
        /** The thread's push topic (lib/live/push.ts). */
        live?: string | null
      }

      if (data.messages.length > 0) {
        // Only replies that arrive while they are looking elsewhere, and never the backlog on first load.
        if (sinceRef.current && storedNotificationsOn() && document.visibilityState === 'hidden') {
          const reply = [...data.messages].reverse().find((m) => m.sender === 'ADMIN')
          if (reply) void showReplyNotification(reply.attachment ? `📎 ${reply.attachment.name}` : reply.body)
        }
        merge(data.messages)
        sinceRef.current = data.messages[data.messages.length - 1]!.createdAt
      }
      // Never moves the watermark: these are older than it by definition.
      if (data.changes?.length) merge(data.changes)
      if (data.receipts?.length) {
        const delivered = new Set(data.receipts.map((r) => r.id))
        setMessages((prev) => {
          let changed = false
          const next = prev.map((m) => {
            if (delivered.has(m.id) && m.receipt !== 'delivered') {
              changed = true
              return { ...m, receipt: 'delivered' as const }
            }
            return m
          })
          return changed ? next : prev
        })
      }
      setPublicId(data.publicId)
      if (data.hasEmail) setHasEmail(true)
      if (data.publicId) markHasThread()
      setChatLiveTopic(data.publicId ? data.live : null)
      // An open chat has read everything on screen: the badges go to zero.
      if (openRef.current) setUnread(0)
    } catch {
      // Offline or transient. The next tick retries.
    } finally {
      setLoading(false)
    }
  }, [merge])

  /*
   * THE LOOP — or rather, this panel's place in the shared one (lib/chat/live-sync).
   *
   * `open` is a dependency on purpose: closing the panel withdraws it completely, and
   * opening it registers afresh, which polls at once.
   */
  useEffect(() => {
    if (!open) return
    // Opening the chat is a tap: it counts as being here.
    markPresent()
    return registerChatSync({
      role: 'open',
      run: poll,
      keepWhileHidden: () => !isVisible() && storedNotificationsOn() && idleFor() < HIDDEN_NOTIFY_WINDOW_MS,
    })
  }, [open, poll])

  // Turning notifications on or off changes whether a hidden tab keeps listening.
  useEffect(() => {
    if (open) chatSyncChanged()
  }, [open, notificationsOn])

  const send = useCallback(async (body: string, extra?: { email?: string; name?: string }) => {
    const text = body.trim()
    if (!text) return false
    const optimistic: ChatMessage = {
      id: `pending-${Date.now()}`,
      sender: 'CUSTOMER',
      body: text,
      createdAt: new Date().toISOString(),
      receipt: 'sent',
      attachment: null,
      edited: false,
      deleted: false,
      pending: true,
    }
    setMessages((prev) => [...prev, optimistic])
    setSending(true)
    try {
      const response = await fetch('/api/chat/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: text, email: extra?.email, name: extra?.name }),
      })
      const data = (await response.json().catch(() => null)) as
        | { ok: true; message: ChatMessage; publicId: string | null; hasEmail?: boolean }
        | { ok: false; error: string; needsEmail?: boolean }
        | null
      if (data && !data.ok && data.needsEmail) {
        // Nothing was sent: take the line back out and let the panel ask for the email.
        setMessages((prev) => prev.filter((m) => m.id !== optimistic.id))
        setHasEmail(false)
        return false
      }
      if (!response.ok || !data || !data.ok) throw new Error('send failed')
      if (data.hasEmail) setHasEmail(true)
      setMessages((prev) => prev.map((m) => (m.id === optimistic.id ? data.message : m)))
      sinceRef.current = data.message.createdAt
      if (data.publicId) setPublicId(data.publicId)
      // Pull in the shop's welcome, which is posted in the same request.
      void poll()
      return true
    } catch {
      // Keep the text, flagged. Losing what someone typed is the worst thing a chat
      // box can do.
      setMessages((prev) =>
        prev.map((m) => (m.id === optimistic.id ? { ...m, pending: false, failed: true } : m)),
      )
      return false
    } finally {
      setSending(false)
    }
  }, [poll])

  const sendFile = useCallback(async (file: File, caption: string, email?: string) => {
    const preview = file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined
    const optimistic: ChatMessage = {
      id: `pending-${Date.now()}`,
      sender: 'CUSTOMER',
      body: caption.trim(),
      createdAt: new Date().toISOString(),
      receipt: 'sent',
      attachment: { type: file.type, name: file.name },
      edited: false,
      deleted: false,
      pending: true,
      ...(preview ? { localPreview: preview } : {}),
    }
    setMessages((prev) => [...prev, optimistic])
    setSending(true)
    try {
      const form = new FormData()
      form.append('file', file)
      if (caption.trim()) form.append('body', caption.trim())
      if (email) form.append('email', email)
      const response = await fetch('/api/chat/upload', { method: 'POST', body: form })
      const data = (await response.json().catch(() => null)) as
        | { ok: true; message: ChatMessage; hasEmail?: boolean }
        | { ok: false; error: string; needsEmail?: boolean }
        | null
      if (!response.ok || !data || !data.ok) {
        setMessages((prev) =>
          prev.map((m) => (m.id === optimistic.id ? { ...m, pending: false, failed: true } : m)),
        )
        return data && !data.ok ? data.error : 'That file did not send.'
      }
      setMessages((prev) => prev.map((m) => (m.id === optimistic.id ? data.message : m)))
      sinceRef.current = data.message.createdAt
      setHasEmail(true)
      return null
    } finally {
      if (preview) URL.revokeObjectURL(preview)
      setSending(false)
    }
  }, [])

  /**
   * Report typing — throttled, because every call is a database write. An emptied
   * composer is sent at once so the operator's "typing…" clears immediately.
   */
  const reportTyping = useCallback((text: string) => {
    const now = Date.now()
    if (text && now - lastTypingRef.current < TYPING_THROTTLE_MS) return
    lastTypingRef.current = text ? now : 0
    void fetch('/api/chat/typing', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
      keepalive: true,
    }).catch(() => {})
  }, [])

  /**
   * Turn on reply notifications: real web push first, so a reply reaches them even
   * with the site closed. enablePushNotifications() is called before anything is
   * awaited, because it must ask for permission inside the tap (Apple's rule). On an
   * iPhone in a Safari tab push needs the app installed, so the install steps open.
   * Where push is unavailable, it falls back to in-page notifications while the site
   * is open.
   */
  const enableNotifications = useCallback(async (): Promise<'granted' | 'denied' | 'unsupported' | 'needs-install'> => {
    const push = await enablePushNotifications()
    if (push === 'subscribed') {
      // The helper stored the preference and recorded the milestone; re-read the bell.
      emitNotify()
      return 'granted'
    }
    if (push === 'needs-install') {
      openInstallGuide()
      return 'needs-install'
    }
    if (push === 'denied' || push === 'dismissed') return 'denied'
    if (!notificationsSupported()) return 'unsupported'
    const permission = Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission()
    if (permission !== 'granted') return 'denied'
    try {
      localStorage.setItem(NOTIFY_STORAGE_KEY, '1')
    } catch {
      // Private mode: on for this page only.
    }
    emitNotify()
    void fetch('/api/visits/activity', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind: 'NOTIFICATIONS_ENABLED', path: window.location.pathname }),
      keepalive: true,
    }).catch(() => {})
    return 'granted'
  }, [])

  const disableNotifications = useCallback(() => {
    try {
      localStorage.removeItem(NOTIFY_STORAGE_KEY)
    } catch {
      // Nothing stored.
    }
    emitNotify()
    // Also stop real push, on the server and in the browser.
    void disablePushNotifications().finally(emitNotify)
  }, [])

  return {
    messages,
    loading,
    sending,
    send,
    sendFile,
    reportTyping,
    publicId,
    hasEmail,
    notificationsOn,
    notificationsSupported: canNotify,
    enableNotifications,
    disableNotifications,
  }
}
