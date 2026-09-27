'use client'

import Link from 'next/link'
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import {
  ArrowLeftIcon,
  BanIcon,
  ChatIcon,
  CheckSquareIcon,
  CrossIcon,
  EyeIcon,
  EyeOffIcon,
  IdCardIcon,
  ListCheckIcon,
  PaperclipIcon,
  SearchIcon,
  SendIcon,
  SmileIcon,
  SpinnerIcon,
  SquareIcon,
  TrashIcon,
} from '@/components/ui/icon'
import { EmojiTray } from '@/components/chat/emoji-tray'
import { PresenceDot } from '@/components/chat/presence-dot'
import { useActivePoll } from '@/components/chat/use-active-poll'
import { useViewportHeight } from '@/components/chat/use-viewport-height'
import { ConfirmDialog } from './confirm-dialog'
import { ageLabel, dayLabel, initials, lastSeen, useNow, usePref } from './format'
import { mergeMessages } from './merge'
import { MessageRow, SendError } from './message-row'
import { ProfilePanel } from './profile-panel'
import type { InboxFilter, InboxMessage, InboxProfile, InboxReceipt, InboxThread } from './types'

/**
 * The operator's inbox — WHAM's `chat-inbox.tsx`, ported.
 *
 * Thread list on the left, the conversation beside it, and the customer's profile
 * beside that on a wide screen (a sheet on anything narrower). On a phone it is a
 * messaging app rather than a page: pinned under the top bar, one pane at a time,
 * sized to the space the keyboard leaves, with the phone's Back button returning to
 * the list.
 *
 * WHAT IS WHAM'S: search across people and what was said, open/closed filtering,
 * multi-select delete, the live typing preview behind an eye toggle (off by
 * default, remembered), full read receipts, edit and delete on the business's own
 * messages, photo attachments, the emoji tray, block with a confirm step and an
 * optimistic toggle that rolls back, and a failed reply handed back rather than lost.
 *
 * WHAT IS DIFFERENT, and why:
 *
 *  · POLLING STOPS WHEN NOBODY IS THERE. WHAM polls the list every 8s and the thread
 *    every 3–8s for as long as the tab is visible. Here both also stop after three
 *    minutes without a touch — an inbox left open on a second monitor is exactly the
 *    pattern the cost playbook exists to stop (useActivePoll).
 *  · BLOCK IS CHAT-ONLY. WHAM bans the IP from the whole site by mirroring the block
 *    list into Redis for its edge proxy. This site has no Redis, and a database
 *    lookup on every request would keep Neon awake around the clock.
 *  · NO "NEW MESSAGE" BUTTON. WHAM starts conversations with customers who have
 *    accounts. Customers here have none, so there is nobody to address until they
 *    write first.
 *  · COMPLIANCE. A customer's message that trips the lexicon is flagged under the
 *    bubble, and a reply that would make a health claim is refused by the server
 *    with the reason shown in the composer.
 */

const LIST_MS = 8000
/** While the customer is on screen or typing, the conversation deserves 3s. */
const THREAD_FAST_MS = 3000
const THREAD_SLOW_MS = 8000
const MAX_FILE_BYTES = 15 * 1024 * 1024

type Confirm = null | 'block' | 'delete' | 'bulk'
type ActionResult = { ok: boolean; error?: string; message?: InboxMessage }

async function postAction(threadId: string, payload: Record<string, unknown>): Promise<ActionResult> {
  try {
    const res = await fetch(`/api/admin/chat/${threadId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const data = (await res.json().catch(() => null)) as ActionResult | null
    if (!res.ok || !data?.ok) return { ok: false, error: data?.error ?? 'That did not work. Try again.' }
    return data
  } catch {
    return { ok: false, error: 'No connection. Check the network and try again.' }
  }
}

function isTouch(): boolean {
  return window.matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window
}
/**
 * One pane at a time — the phone layout, where Back must return to the list. Below
 * `md`: this project's `sm` is 375px (mobile-first at 375), not WHAM's 640.
 */
function isSinglePane(): boolean {
  return window.matchMedia('(max-width: 767px)').matches
}
/** Wide enough for the profile to sit beside the conversation rather than over it. */
function isWide(): boolean {
  return window.matchMedia('(min-width: 1400px)').matches
}

export function ChatInbox({ initialThreadId = null }: { initialThreadId?: string | null } = {}) {
  useViewportHeight()
  const now = useNow()

  // ── The list ──────────────────────────────────────────────────────────────
  const [threads, setThreads] = useState<InboxThread[]>([])
  const [listLoaded, setListLoaded] = useState(false)
  const [filter, setFilter] = useState<InboxFilter>('open')
  // `search` is what is being typed; `query` is what the server was asked. Apart,
  // so the lookup can wait for a pause in typing.
  const [search, setSearch] = useState('')
  const [query, setQuery] = useState('')
  const [searchBusy, setSearchBusy] = useState(false)
  const [signedOut, setSignedOut] = useState(false)
  const [selectMode, setSelectMode] = useState(false)
  const [selected, setSelected] = useState<ReadonlySet<string>>(() => new Set())

  // ── The open conversation ───────────────────────────────────────────────────
  const [activeId, setActiveId] = useState<string | null>(null)
  const [messages, setMessages] = useState<InboxMessage[]>([])
  const [profile, setProfile] = useState<InboxProfile | null>(null)
  const [loadingThread, setLoadingThread] = useState(false)

  // ── The composer ───────────────────────────────────────────────────────────
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState<string | null>(null)
  const [pendingFile, setPendingFile] = useState<{ file: File; preview: string | null } | null>(null)
  const [showEmoji, setShowEmoji] = useState(false)
  const [editing, setEditing] = useState<{ id: string; body: string } | null>(null)
  const [menuFor, setMenuFor] = useState<string | null>(null)

  // ── Actions and chrome ───────────────────────────────────────────────────────
  const [confirm, setConfirm] = useState<Confirm>(null)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  // WHAM's default: the header just says "typing…". The eye shows their draft.
  const [typingPreview, setTypingPreview] = usePref('sg-chat-typing-preview', false)
  const [profileColumn, setProfileColumn] = usePref('sg-chat-profile-column', true)
  const [profileSheet, setProfileSheet] = useState(false)

  const sinceRef = useRef<string | null>(null)
  const activeRef = useRef<string | null>(null)
  const pushedRef = useRef(false)
  const sendingRef = useRef(false)
  const atBottomRef = useRef(true)
  // A half-written reply belongs to the conversation it was written in — it must
  // never follow the operator into someone else's thread and be sent there.
  const draftsRef = useRef(new Map<string, string>())
  const scrollRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const composerRef = useRef<HTMLTextAreaElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  // ── Loading ────────────────────────────────────────────────────────────────

  const loadThreads = useCallback(async () => {
    try {
      const params = new URLSearchParams({ filter })
      if (query.length >= 2) params.set('q', query)
      const res = await fetch(`/api/admin/chat/threads?${params.toString()}`, { cache: 'no-store' })
      if (res.status === 401) {
        setSignedOut(true)
        return
      }
      if (!res.ok) return
      const data = (await res.json()) as { threads: InboxThread[] }
      setThreads(data.threads)
      setSignedOut(false)
    } catch {
      // Transient. The next tick retries.
    } finally {
      setListLoaded(true)
      setSearchBusy(false)
    }
  }, [filter, query])

  const closeThread = useCallback(() => {
    activeRef.current = null
    sinceRef.current = null
    setActiveId(null)
    setMessages([])
    setProfile(null)
    setProfileSheet(false)
    setEditing(null)
    setMenuFor(null)
  }, [])

  const loadThread = useCallback(
    async (id: string, incremental: boolean) => {
      try {
        const qs = incremental && sinceRef.current ? `?since=${encodeURIComponent(sinceRef.current)}` : ''
        const res = await fetch(`/api/admin/chat/${id}${qs}`, { cache: 'no-store' })
        // The operator moved on while this was in flight; it is not this thread's news.
        if (activeRef.current !== id) return
        if (res.status === 401) {
          setSignedOut(true)
          return
        }
        if (res.status === 404) {
          closeThread()
          setNotice('That conversation was deleted.')
          void loadThreads()
          return
        }
        if (!res.ok) return
        const data = (await res.json()) as {
          messages: InboxMessage[]
          receipts: InboxReceipt[]
          profile: InboxProfile
        }
        if (activeRef.current !== id) return

        const newest = data.messages.at(-1)?.createdAt
        if (newest && (!sinceRef.current || newest > sinceRef.current)) sinceRef.current = newest

        setProfile(data.profile)
        setMessages((prev) => mergeMessages(prev, data.messages, data.receipts, !incremental))
        // Opening a conversation reads it: its badge clears, and its row learns
        // what the thread poll just saw.
        setThreads((prev) => {
          const row = prev.find((t) => t.id === id)
          if (
            !row ||
            (row.unread === 0 &&
              row.online === data.profile.online &&
              row.typing === data.profile.typing &&
              row.typingText === data.profile.typingText &&
              row.isOpen === data.profile.isOpen)
          ) {
            return prev
          }
          return prev.map((t) =>
            t.id === id
              ? {
                  ...t,
                  unread: 0,
                  online: data.profile.online,
                  typing: data.profile.typing,
                  typingText: data.profile.typingText,
                  isOpen: data.profile.isOpen,
                }
              : t,
          )
        })
      } catch {
        // Transient.
      }
    },
    [closeThread, loadThreads],
  )

  // The list: at once on mount and whenever the filter or search changes, then on
  // the active timer. A search result is a deliberate lookup, not a live feed —
  // re-running a message-body search every 8 seconds would be the most expensive
  // thing the inbox does, and would reshuffle rows mid-read — so it does not repeat.
  useActivePoll(loadThreads, LIST_MS, {
    immediate: true,
    key: `${filter}|${query}`,
    repeat: query.length < 2 && !signedOut,
  })

  const pollThread = useCallback(async () => {
    const id = activeRef.current
    if (id) await loadThread(id, true)
  }, [loadThread])
  const customerHere = Boolean(profile?.online || profile?.typing)
  useActivePoll(pollThread, customerHere ? THREAD_FAST_MS : THREAD_SLOW_MS, {
    enabled: Boolean(activeId) && !signedOut,
    key: activeId ?? '',
  })

  // 300ms after the last keystroke, and only from two characters up.
  useEffect(() => {
    const term = search.trim()
    if (term === query || (term.length > 0 && term.length < 2)) return
    const timer = window.setTimeout(() => setQuery(term), 300)
    return () => window.clearTimeout(timer)
  }, [search, query])

  // ── Opening and leaving a conversation ───────────────────────────────────────

  const openThread = useCallback(
    async (id: string) => {
      if (id === activeRef.current) return
      const previous = activeRef.current
      if (previous) draftsRef.current.set(previous, composerRef.current?.value ?? '')
      // On a phone, opening a conversation is a navigation: give Back somewhere to go.
      if (!previous && isTouch() && isSinglePane()) {
        window.history.pushState({ sgChatThread: true }, '')
        pushedRef.current = true
      }
      activeRef.current = id
      sinceRef.current = null
      atBottomRef.current = true
      setActiveId(id)
      setMessages([])
      setProfile(null)
      setLoadingThread(true)
      setEditing(null)
      setMenuFor(null)
      setSendError(null)
      setShowEmoji(false)
      setPendingFile((current) => {
        if (current?.preview) URL.revokeObjectURL(current.preview)
        return null
      })
      setDraft(draftsRef.current.get(id) ?? '')
      await loadThread(id, false)
      if (activeRef.current === id) setLoadingThread(false)
    },
    [loadThread],
  )

  /*
    A notification link (?thread=) opens its conversation through openThread, the same
    path a tap takes. Setting activeId alone showed the conversation's header over
    "No messages yet": the messages are fetched by openThread, which also records
    the thread as active so its responses are not discarded as stale.
  */
  const openedFromLink = useRef(false)
  useEffect(() => {
    if (!initialThreadId || openedFromLink.current) return
    openedFromLink.current = true
    void openThread(initialThreadId)
  }, [initialThreadId, openThread])

  const back = () => {
    if (activeRef.current) draftsRef.current.set(activeRef.current, draft)
    if (pushedRef.current) window.history.back()
    else closeThread()
  }

  // The phone's own Back button returns to the list instead of leaving the inbox.
  useEffect(() => {
    const onPop = () => {
      pushedRef.current = false
      if (activeRef.current) closeThread()
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [closeThread])

  // ── Screen behaviour ─────────────────────────────────────────────────────────

  // Newest message in view — unless the operator has scrolled up to read.
  useLayoutEffect(() => {
    const el = scrollRef.current
    if (el && atBottomRef.current) el.scrollTop = el.scrollHeight
  }, [messages, profile?.typingText, typingPreview])

  // …and stay there as the content grows on its own: a photo finishing loading, the
  // live typing preview appearing. Without this, opening a conversation with a photo
  // in it landed on the oldest message, because the image arrived after the scroll.
  useEffect(() => {
    const el = scrollRef.current
    const inner = contentRef.current
    if (!el || !inner || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(() => {
      if (atBottomRef.current) el.scrollTop = el.scrollHeight
    })
    observer.observe(inner)
    return () => observer.disconnect()
  }, [activeId])

  // The reply box grows with what is typed, up to a limit, then scrolls.
  useLayoutEffect(() => {
    const el = composerRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`
  }, [draft, activeId])

  useEffect(() => {
    if (!menuFor) return
    const close = () => setMenuFor(null)
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setMenuFor(null)
    window.addEventListener('click', close)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('click', close)
      window.removeEventListener('keydown', onKey)
    }
  }, [menuFor])

  useEffect(() => {
    if (!profileSheet) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setProfileSheet(false)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [profileSheet])

  useEffect(() => {
    if (!notice) return
    const timer = window.setTimeout(() => setNotice(null), 6000)
    return () => window.clearTimeout(timer)
  }, [notice])

  // ── Sending ────────────────────────────────────────────────────────────────

  /** Float the conversation to the top of the list with its new last line. */
  const bumpThread = (id: string, preview: string) => {
    setThreads((prev) => {
      const row = prev.find((t) => t.id === id)
      if (!row) return prev
      const moved: InboxThread = {
        ...row,
        lastMessageAt: new Date().toISOString(),
        lastMessageText: preview,
        lastSender: 'ADMIN',
        isOpen: true,
      }
      return [moved, ...prev.filter((t) => t.id !== id)]
    })
  }

  const optimistic = (body: string, attachment: InboxMessage['attachment'], localPreview?: string): InboxMessage => ({
    id: `pending-${Date.now()}`,
    sender: 'ADMIN',
    body,
    createdAt: new Date().toISOString(),
    attachment,
    edited: false,
    deleted: false,
    authorName: null,
    deliveredAt: null,
    readAt: null,
    pending: true,
    ...(localPreview ? { localPreview } : {}),
  })

  const settle = (id: string, pendingId: string, real: InboxMessage) => {
    setMessages((prev) => [...prev.filter((m) => m.id !== pendingId && m.id !== real.id), real])
    if (!sinceRef.current || real.createdAt > sinceRef.current) sinceRef.current = real.createdAt
    setProfile((p) => (p && !p.isOpen ? { ...p, isOpen: true } : p))
    draftsRef.current.delete(id)
  }

  const sendFile = async (id: string, caption: string, chosen: { file: File; preview: string | null }) => {
    const temp = optimistic(caption, { type: chosen.file.type, name: chosen.file.name }, chosen.preview ?? undefined)
    setMessages((prev) => [...prev, temp])
    setPendingFile(null)
    setDraft('')
    try {
      const form = new FormData()
      form.append('file', chosen.file)
      if (caption) form.append('body', caption)
      const res = await fetch(`/api/admin/chat/${id}/upload`, { method: 'POST', body: form })
      const data = (await res.json().catch(() => null)) as ActionResult | null
      if (!res.ok || !data?.ok || !data.message) throw new Error(data?.error ?? 'That file did not send.')
      if (activeRef.current === id) settle(id, temp.id, data.message)
      bumpThread(id, caption || (chosen.file.type === 'application/pdf' ? 'PDF attached' : 'Photo attached'))
      if (chosen.preview) URL.revokeObjectURL(chosen.preview)
    } catch (error) {
      // Hand the file and the caption back, so a retry is one tap.
      if (activeRef.current === id) {
        setMessages((prev) => prev.filter((m) => m.id !== temp.id))
        setPendingFile(chosen)
        setDraft(caption)
        setSendError(error instanceof Error ? error.message : 'That file did not send.')
      } else if (chosen.preview) {
        URL.revokeObjectURL(chosen.preview)
      }
    }
  }

  const reply = async () => {
    const id = activeRef.current
    const text = draft.trim()
    if (!id || sendingRef.current || (!text && !pendingFile)) return
    // Synchronous guard: a fast Enter + click must not send twice before React re-renders.
    sendingRef.current = true
    setSending(true)
    setSendError(null)
    setShowEmoji(false)
    atBottomRef.current = true
    try {
      if (pendingFile) {
        await sendFile(id, text, pendingFile)
        return
      }
      const temp = optimistic(text, null)
      setMessages((prev) => [...prev, temp])
      setDraft('')
      const result = await postAction(id, { action: 'reply', body: text })
      if (result.ok && result.message) {
        if (activeRef.current === id) settle(id, temp.id, result.message)
        bumpThread(id, text)
      } else if (activeRef.current === id) {
        // Never swallow what was typed. The server's reason — usually the
        // compliance lexicon — is shown above the box.
        setMessages((prev) => prev.filter((m) => m.id !== temp.id))
        setDraft(text)
        setSendError(result.error ?? 'Not sent.')
      } else {
        draftsRef.current.set(id, text)
        setNotice(`A reply was not sent: ${result.error ?? 'try again'}`)
      }
    } finally {
      sendingRef.current = false
      setSending(false)
    }
  }

  const pickFile = (file: File | undefined) => {
    if (fileRef.current) fileRef.current.value = ''
    if (!file) return
    if (!/^image\/|^application\/pdf$/.test(file.type)) {
      setSendError('Send a photo (JPG, PNG, WebP, AVIF) or a PDF.')
      return
    }
    if (file.size > MAX_FILE_BYTES) {
      setSendError('That file is over 15 MB.')
      return
    }
    setSendError(null)
    setPendingFile((current) => {
      if (current?.preview) URL.revokeObjectURL(current.preview)
      return { file, preview: file.type.startsWith('image/') ? URL.createObjectURL(file) : null }
    })
    composerRef.current?.focus()
  }

  // ── Editing and removing the business's own messages ──────────────────────────

  const saveEdit = async () => {
    const id = activeRef.current
    if (!id || !editing) return
    const body = editing.body.trim()
    if (!body) return
    const target = editing.id
    const before = messages.find((m) => m.id === target)
    setEditing(null)
    setMessages((prev) => prev.map((m) => (m.id === target ? { ...m, body, edited: true } : m)))
    const result = await postAction(id, { action: 'edit', messageId: target, body })
    if (!result.ok) {
      if (before) setMessages((prev) => prev.map((m) => (m.id === target ? before : m)))
      setNotice(result.error ?? 'That edit was not saved.')
      return
    }
    void loadThreads()
  }

  const deleteMessage = async (messageId: string) => {
    const id = activeRef.current
    if (!id) return
    setMenuFor(null)
    const index = messages.findIndex((m) => m.id === messageId)
    const removed = messages[index]
    setMessages((prev) => prev.filter((m) => m.id !== messageId))
    const result = await postAction(id, { action: 'delete', messageId })
    if (!result.ok) {
      if (removed) {
        setMessages((prev) =>
          [...prev, removed].sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
        )
      }
      setNotice(result.error ?? 'That message was not removed.')
      return
    }
    void loadThreads()
  }

  // ── Conversation actions ─────────────────────────────────────────────────────

  const toggleOpen = async () => {
    const id = activeRef.current
    if (!id || !profile) return
    const next = !profile.isOpen
    setBusy(true)
    setProfile({ ...profile, isOpen: next })
    const result = await postAction(id, { action: next ? 'reopen' : 'close' })
    setBusy(false)
    if (!result.ok) {
      setProfile((p) => (p ? { ...p, isOpen: !next } : p))
      setNotice(result.error ?? 'That did not work.')
      return
    }
    void loadThreads()
  }

  // Optimistic, and rolled back with the server's reason — usually that the visitor
  // has not written yet, so there is no IP on record to block.
  const setBlocked = async (block: boolean) => {
    const id = activeRef.current
    if (!id || !profile) return
    setConfirm(null)
    setBusy(true)
    setProfile({ ...profile, blocked: block, isOpen: block ? false : profile.isOpen })
    const result = await postAction(id, { action: block ? 'block' : 'unblock' })
    setBusy(false)
    if (!result.ok) {
      setProfile((p) => (p ? { ...p, blocked: !block, isOpen: profile.isOpen } : p))
      setNotice(`Could not ${block ? 'block' : 'unblock'}: ${result.error ?? 'try again.'}`)
      return
    }
    setNotice(block ? 'Blocked. They can no longer send messages.' : 'Unblocked.')
    void loadThreads()
  }

  const deleteThread = async () => {
    const id = activeRef.current
    if (!id) return
    setConfirm(null)
    setBusy(true)
    try {
      const res = await fetch(`/api/admin/chat/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error()
      closeThread()
      if (pushedRef.current) {
        pushedRef.current = false
        window.history.back()
      }
      setThreads((prev) => prev.filter((t) => t.id !== id))
      setNotice('Conversation deleted. The transcript is kept in the audit log.')
    } catch {
      setNotice('That conversation was not deleted. Try again.')
    } finally {
      setBusy(false)
    }
  }

  const bulkDelete = async () => {
    const ids = [...selected]
    setConfirm(null)
    if (ids.length === 0) return
    setBusy(true)
    try {
      const res = await fetch('/api/admin/chat/threads', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids }),
      })
      if (!res.ok) throw new Error()
      if (activeRef.current && selected.has(activeRef.current)) closeThread()
      setThreads((prev) => prev.filter((t) => !selected.has(t.id)))
      setSelected(new Set())
      setSelectMode(false)
      setNotice(`${ids.length} ${ids.length === 1 ? 'conversation' : 'conversations'} deleted. Transcripts are kept in the audit log.`)
    } catch {
      setNotice('Nothing was deleted. Try again.')
    } finally {
      setBusy(false)
      void loadThreads()
    }
  }

  const toggleSelect = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const openProfile = () => {
    if (isWide()) setProfileColumn(!profileColumn)
    else setProfileSheet(true)
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  const row = threads.find((t) => t.id === activeId) ?? null
  const name = profile?.displayName ?? row?.displayName ?? ''
  const totalUnread = threads.reduce((n, t) => n + t.unread, 0)
  const allSelected = threads.length > 0 && threads.every((t) => selected.has(t.id))
  const searching = query.length >= 2
  const typingText = profile?.typing ? (profile.typingText ?? '').trim() : ''
  const canSend = (Boolean(draft.trim()) || Boolean(pendingFile)) && !sending

  const presence = profile?.typing
    ? { text: 'typing…', short: 'typing…', tone: 'text-accent-fg font-semibold' }
    : profile?.online
      ? { text: 'active now', short: 'active now', tone: 'text-success-fg' }
      : { text: lastSeen(profile?.customerLastSeenAt ?? null, now), short: lastSeen(profile?.customerLastSeenAt ?? null, now, true), tone: 'text-foreground-subtle' }

  return (
    <div className="fixed inset-x-0 top-14 z-30 flex h-[calc(var(--app-vh,100svh)-3.5rem)] overflow-hidden bg-background md:static md:z-auto md:h-[calc(100dvh-10rem)] md:min-h-[520px] md:rounded-xl md:border lg:fixed lg:inset-y-0 lg:right-0 lg:left-64 lg:z-20 lg:h-auto lg:min-h-0 lg:rounded-none lg:border-0">
      {/* ── Thread list ─────────────────────────────────────────────────────── */}
      <aside
        className={`w-full min-w-0 flex-col border-r bg-surface md:flex md:w-[300px] md:shrink-0 lg:w-[320px] xl:w-[360px] ${activeId ? 'hidden' : 'flex'}`}
        aria-label="Conversations"
      >
        <div className="flex items-center justify-between gap-2 border-b px-3 py-2.5">
          <h2 className="text-[17px] font-semibold tracking-tight text-foreground md:text-xs md:font-semibold md:tracking-wider md:text-foreground-muted md:uppercase">
            <span className="md:hidden">Chat</span>
            <span className="hidden md:inline">Conversations</span>
            {totalUnread > 0 ? <span className="tabular"> · {totalUnread}</span> : null}
          </h2>
          {selectMode ? (
            <button
              type="button"
              onClick={() => {
                setSelectMode(false)
                setSelected(new Set())
              }}
              className="min-h-11 rounded-lg px-2.5 text-[12px] font-medium text-foreground-muted md:min-h-9 hover:bg-surface-sunken hover:text-foreground"
            >
              Cancel
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setSelectMode(true)}
              disabled={threads.length === 0}
              title="Select conversations to delete"
              className="inline-flex min-h-11 items-center gap-1.5 rounded-lg px-2.5 text-[12px] md:min-h-9 font-medium text-foreground-muted hover:bg-surface-sunken hover:text-foreground disabled:opacity-40"
            >
              <ListCheckIcon className="size-4" /> Select
            </button>
          )}
        </div>

        {signedOut ? (
          <p role="alert" className="border-b bg-warning-bg px-3 py-2 text-[12px] text-warning-fg">
            Your session ended.{' '}
            <Link href="/admin/login" className="font-semibold underline underline-offset-2">
              Sign in again
            </Link>{' '}
            to keep receiving messages.
          </p>
        ) : null}

        <div className="space-y-2 border-b px-3 py-2.5">
          {/* The person (name, email, reference) AND what was said. */}
          <div className="relative">
            <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-foreground-subtle" />
            <input
              type="search"
              value={search}
              onChange={(e) => {
                const value = e.target.value
                setSearch(value)
                const term = value.trim()
                setSearchBusy(term.length >= 2 && term !== query)
                if (term.length === 0) setQuery('')
              }}
              placeholder="Search name, email, reference or message"
              aria-label="Search conversations"
              className="min-h-11 w-full rounded-lg border bg-background pr-9 pl-8 text-[16px] md:min-h-10 text-foreground placeholder:text-foreground-subtle focus:border-border-strong focus:outline-none md:text-[13px]"
            />
            {searchBusy ? (
              <SpinnerIcon className="absolute top-1/2 right-2.5 size-4 -translate-y-1/2 text-foreground-subtle motion-safe:animate-spin" />
            ) : search ? (
              <button
                type="button"
                onClick={() => {
                  setSearch('')
                  setQuery('')
                }}
                aria-label="Clear search"
                className="absolute top-1/2 right-1 grid size-8 -translate-y-1/2 place-items-center rounded-md text-foreground-subtle hover:bg-surface-sunken hover:text-foreground"
              >
                <CrossIcon className="size-4" />
              </button>
            ) : null}
          </div>

          <div className="flex gap-1" role="group" aria-label="Show">
            {(['open', 'all', 'closed'] as const).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFilter(f)}
                aria-pressed={filter === f}
                className={`min-h-11 flex-1 rounded-md text-[12px] font-medium capitalize md:min-h-8 ${
                  filter === f ? 'bg-primary text-on-primary' : 'text-foreground-muted hover:bg-surface-sunken hover:text-foreground'
                }`}
              >
                {f}
              </button>
            ))}
          </div>

          {searching && !searchBusy ? (
            <p className="text-[11px] text-foreground-subtle">
              {threads.length === 0
                ? 'No matches'
                : `${threads.length} ${threads.length === 1 ? 'conversation' : 'conversations'} matching “${query}”`}
              {' · live updates paused'}
            </p>
          ) : null}
        </div>

        {selectMode ? (
          <div className="flex items-center justify-between gap-2 border-b bg-surface-sunken px-3 py-2">
            <button
              type="button"
              onClick={() => setSelected(allSelected ? new Set() : new Set(threads.map((t) => t.id)))}
              className="min-h-8 text-[12px] font-medium text-foreground-muted hover:text-foreground"
            >
              {allSelected ? 'Clear all' : 'Select all'}
            </button>
            <span className="tabular text-[12px] text-foreground-subtle">{selected.size} selected</span>
            <button
              type="button"
              onClick={() => setConfirm('bulk')}
              disabled={selected.size === 0 || busy}
              className="inline-flex min-h-8 items-center gap-1.5 rounded-lg bg-danger-fg px-2.5 text-[12px] font-semibold text-background disabled:opacity-40"
            >
              <TrashIcon className="size-3.5" /> Delete
            </button>
          </div>
        ) : null}

        <ul className="min-h-0 flex-1 divide-y overflow-y-auto overscroll-contain">
          {!listLoaded ? (
            [0, 1, 2, 3].map((i) => (
              <li key={i} className="flex gap-3 px-3 py-3.5" aria-hidden>
                <span className="size-10 shrink-0 animate-pulse rounded-full bg-surface-sunken" />
                <span className="flex-1 space-y-2 pt-1">
                  <span className="block h-3 w-1/2 animate-pulse rounded bg-surface-sunken" />
                  <span className="block h-3 w-4/5 animate-pulse rounded bg-surface-sunken" />
                </span>
              </li>
            ))
          ) : threads.length === 0 ? (
            <li className="px-4 py-12 text-center">
              {searching ? (
                <>
                  <p className="text-[13px] text-foreground-muted">Nothing matches “{query}”.</p>
                  {filter === 'open' ? (
                    <button
                      type="button"
                      onClick={() => setFilter('all')}
                      className="mt-2 text-[12px] font-semibold text-accent-fg underline-offset-2 hover:underline"
                    >
                      Search closed conversations too
                    </button>
                  ) : null}
                </>
              ) : (
                <>
                  <ChatIcon className="mx-auto size-8 text-foreground-subtle" />
                  <p className="mt-2 text-[13px] text-foreground-muted">
                    {filter === 'closed' ? 'No closed conversations.' : 'No conversations yet.'}
                  </p>
                  <p className="mx-auto mt-1 max-w-[28ch] text-[12px] leading-relaxed text-foreground-subtle">
                    They appear here the moment a customer writes, and push an ntfy alert.
                  </p>
                </>
              )}
            </li>
          ) : (
            threads.map((t) => {
              const isActive = t.id === activeId
              const isSelected = selected.has(t.id)
              return (
                <li key={t.id}>
                  <button
                    type="button"
                    onClick={() => (selectMode ? toggleSelect(t.id) : void openThread(t.id))}
                    aria-current={isActive ? 'true' : undefined}
                    aria-pressed={selectMode ? isSelected : undefined}
                    className={`flex w-full items-start gap-3 px-3 py-3 text-left transition-colors hover:bg-surface-sunken ${
                      selectMode && isSelected ? 'bg-accent-muted' : isActive ? 'bg-primary-muted' : ''
                    }`}
                  >
                    {selectMode ? (
                      <span className="mt-2.5 shrink-0">
                        {isSelected ? (
                          <CheckSquareIcon className="size-5 text-accent-fg" />
                        ) : (
                          <SquareIcon className="size-5 text-foreground-subtle" />
                        )}
                      </span>
                    ) : null}
                    <span className="relative mt-0.5 grid size-10 shrink-0 place-items-center rounded-full bg-accent-muted text-[13px] font-semibold text-accent-fg">
                      {initials(t.displayName)}
                      {t.online || t.typing ? (
                        <span className="absolute -right-0.5 -bottom-0.5 flex rounded-full bg-surface p-[2px]">
                          <PresenceDot online />
                        </span>
                      ) : null}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline justify-between gap-2">
                        <span className={`truncate text-sm text-foreground ${t.unread ? 'font-semibold' : 'font-medium'}`}>
                          {t.displayName}
                        </span>
                        <span className={`shrink-0 text-[11px] tabular-nums ${t.unread ? 'font-semibold text-accent-fg' : 'text-foreground-subtle'}`}>
                          {now ? ageLabel(t.lastMessageAt, now) : ''}
                        </span>
                      </span>
                      <span className="mt-0.5 flex items-center gap-2">
                        <span className={`line-clamp-1 flex-1 text-[13px] ${t.unread ? 'text-foreground' : 'text-foreground-muted'}`}>
                          {t.typing ? (
                            <span className="font-medium text-accent-fg">
                              typing…{typingPreview && t.typingText ? <span className="font-normal italic"> {t.typingText}</span> : null}
                            </span>
                          ) : (
                            <>
                              {t.lastSender === 'ADMIN' ? <span className="text-foreground-subtle">You: </span> : null}
                              {t.lastMessageText || '—'}
                            </>
                          )}
                        </span>
                        {t.unread > 0 ? (
                          <span className="grid h-5 min-w-5 shrink-0 place-items-center rounded-full bg-danger-fg px-1.5 text-[11px] font-bold text-background tabular-nums">
                            {t.unread}
                            <span className="sr-only"> unread</span>
                          </span>
                        ) : null}
                      </span>
                      <span className="mt-0.5 flex items-center gap-1.5 text-[11px] text-foreground-subtle">
                        <span className="truncate font-mono">
                          {t.publicId}
                          {t.email ? ` · ${t.email}` : ''}
                        </span>
                        {!t.isOpen ? (
                          <span className="shrink-0 rounded bg-surface-sunken px-1.5 py-px text-[10px] font-medium text-foreground-muted">
                            closed
                          </span>
                        ) : null}
                      </span>
                    </span>
                  </button>
                </li>
              )
            })
          )}
        </ul>
      </aside>

      {/* ── Conversation ────────────────────────────────────────────────────── */}
      <section
        className={`min-w-0 flex-1 flex-col md:flex ${activeId ? 'flex' : 'hidden'}`}
        aria-label={activeId ? `Conversation with ${name}` : 'Conversation'}
      >
        {!activeId ? (
          <div className="grid flex-1 place-items-center p-6 text-center">
            <div>
              <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-surface-sunken text-foreground-subtle">
                <ChatIcon className="size-6" />
              </span>
              <p className="mt-3 text-sm font-medium text-foreground">Pick a conversation</p>
              <p className="mt-1 text-[13px] text-foreground-subtle">Replies go straight to the customer’s chat.</p>
            </div>
          </div>
        ) : (
          <>
            <header className="flex shrink-0 items-center gap-1 border-b bg-surface px-2 py-2 md:gap-1.5 md:px-3">
              <button
                type="button"
                onClick={back}
                aria-label="Back to conversations"
                className="grid size-10 shrink-0 place-items-center rounded-lg text-foreground-muted hover:bg-surface-sunken md:hidden"
              >
                <ArrowLeftIcon className="size-5" />
              </button>

              <button
                type="button"
                onClick={openProfile}
                className="flex min-w-0 flex-1 items-center gap-2.5 rounded-lg px-1 py-1 text-left hover:bg-surface-sunken"
                aria-label={`Customer details for ${name}`}
              >
                <span className="relative grid size-9 shrink-0 place-items-center rounded-full bg-accent-muted text-[12px] font-semibold text-accent-fg">
                  {name ? initials(name) : ''}
                </span>
                <span className="min-w-0">
                  {/* The name truncates on its own; presence never shrinks — WHAM's fix
                      for a long name pushing the online dot off the edge. */}
                  <span className="flex min-w-0 items-center gap-1.5 text-sm font-semibold text-foreground">
                    <span className="min-w-0 truncate">{name || '…'}</span>
                    <PresenceDot online={customerHere} />
                    <span className={`shrink-0 text-[11px] font-medium ${presence.tone}`}>
                      <span className="md:hidden">{now ? presence.short : ''}</span>
                      <span className="hidden md:inline">{now ? presence.text : ''}</span>
                    </span>
                  </span>
                  <span className="block truncate font-mono text-[11px] text-foreground-subtle">
                    {profile?.publicId ?? row?.publicId}
                    {profile ? (profile.email ? ` · ${profile.email}` : ' · no email yet') : ''}
                  </span>
                </span>
              </button>

              <button
                type="button"
                onClick={() => setTypingPreview(!typingPreview)}
                aria-pressed={typingPreview}
                aria-label="Live typing preview"
                title={
                  typingPreview
                    ? 'Live typing preview is ON — you see their unsent draft. Tap to show only “typing…”.'
                    : 'Live typing preview is OFF — you see only “typing…”. Tap to see what they are writing.'
                }
                className={`grid size-10 shrink-0 place-items-center rounded-lg ${
                  typingPreview ? 'bg-accent-muted text-accent-fg' : 'text-foreground-subtle hover:bg-surface-sunken hover:text-foreground'
                }`}
              >
                {typingPreview ? <EyeIcon className="size-[18px]" /> : <EyeOffIcon className="size-[18px]" />}
              </button>
              {profile ? (
                <>
                  <button
                    type="button"
                    onClick={() => void toggleOpen()}
                    disabled={busy}
                    className="hidden min-h-9 shrink-0 rounded-lg border px-2.5 text-[12px] font-medium text-foreground-muted hover:border-border-strong hover:text-foreground disabled:opacity-50 md:block"
                  >
                    {profile.isOpen ? 'Close' : 'Reopen'}
                  </button>
                  <button
                    type="button"
                    onClick={() => (profile.blocked ? void setBlocked(false) : setConfirm('block'))}
                    disabled={busy}
                    aria-pressed={profile.blocked}
                    aria-label={profile.blocked ? 'Unblock this visitor' : 'Block this visitor from chat'}
                    title={profile.blocked ? 'Blocked from chat. Tap to unblock.' : 'Block this visitor from chat'}
                    className={`hidden size-10 shrink-0 place-items-center rounded-lg disabled:opacity-50 md:grid ${
                      profile.blocked ? 'bg-danger-bg text-danger-fg' : 'text-foreground-subtle hover:bg-danger-bg hover:text-danger-fg'
                    }`}
                  >
                    <BanIcon className="size-[18px]" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirm('delete')}
                    disabled={busy}
                    aria-label="Delete this conversation"
                    title="Delete conversation"
                    className="hidden size-10 shrink-0 place-items-center rounded-lg text-foreground-subtle hover:bg-danger-bg hover:text-danger-fg disabled:opacity-50 md:grid"
                  >
                    <TrashIcon className="size-[18px]" />
                  </button>
                </>
              ) : null}
              <button
                type="button"
                onClick={openProfile}
                aria-pressed={profileColumn}
                aria-label="Customer details"
                title="Customer details and orders"
                className="grid size-10 shrink-0 place-items-center rounded-lg text-foreground-subtle hover:bg-surface-sunken hover:text-foreground min-[1400px]:aria-pressed:bg-accent-muted min-[1400px]:aria-pressed:text-accent-fg"
              >
                <IdCardIcon className="size-[18px]" />
              </button>
            </header>

            <div
              ref={scrollRef}
              onScroll={() => {
                const el = scrollRef.current
                if (el) atBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 60
              }}
              className="min-h-0 flex-1 overflow-y-auto overscroll-contain bg-background px-3 py-4 md:px-5"
            >
              <div ref={contentRef} className="space-y-3">
              {loadingThread && messages.length === 0 ? (
                <div className="space-y-3" aria-hidden>
                  {[0, 1, 2].map((i) => (
                    <div key={i} className={`flex ${i === 1 ? 'justify-end' : 'justify-start'}`}>
                      <div className={`h-10 animate-pulse rounded-[18px] bg-surface-sunken ${i === 1 ? 'w-44' : 'w-56'}`} />
                    </div>
                  ))}
                </div>
              ) : messages.length === 0 ? (
                <p className="py-10 text-center text-[13px] text-foreground-subtle">No messages yet.</p>
              ) : (
                messages.map((m, i) => {
                  const prev = messages[i - 1]
                  const newDay = !prev || new Date(prev.createdAt).toDateString() !== new Date(m.createdAt).toDateString()
                  return (
                    <div key={m.id} className="space-y-3">
                      {newDay && now ? (
                        <div className="flex justify-center pt-1">
                          <span className="rounded-full bg-surface px-3 py-1 text-[11px] font-medium text-foreground-muted ring-1 ring-border-subtle">
                            {dayLabel(m.createdAt, now)}
                          </span>
                        </div>
                      ) : null}
                      <MessageRow
                        m={m}
                        threadId={activeId}
                        menuOpen={menuFor === m.id}
                        onMenu={setMenuFor}
                        editing={editing?.id === m.id ? editing.body : null}
                        onEditChange={(body) => setEditing((e) => (e ? { ...e, body } : e))}
                        onEditStart={(msg) => {
                          setEditing({ id: msg.id, body: msg.body })
                          setMenuFor(null)
                        }}
                        onEditSave={() => void saveEdit()}
                        onEditCancel={() => setEditing(null)}
                        onDelete={(id) => void deleteMessage(id)}
                      />
                    </div>
                  )
                })
              )}

              {/* Their unsent draft, live — only with the eye on. */}
              {typingPreview && typingText ? (
                <div className="flex justify-start" aria-live="polite">
                  <div className="max-w-[85%] rounded-[18px] rounded-bl-md border border-dashed bg-surface px-3.5 py-2">
                    <span className="mb-0.5 flex items-center gap-1.5 text-[10px] font-semibold tracking-wide text-accent-fg uppercase">
                      typing
                      <span className="inline-flex gap-0.5" aria-hidden>
                        <span className="size-1 rounded-full bg-accent-fg motion-safe:animate-bounce motion-safe:[animation-delay:-0.2s]" />
                        <span className="size-1 rounded-full bg-accent-fg motion-safe:animate-bounce motion-safe:[animation-delay:-0.1s]" />
                        <span className="size-1 rounded-full bg-accent-fg motion-safe:animate-bounce" />
                      </span>
                    </span>
                    <span className="text-[14px] break-words whitespace-pre-wrap text-foreground-muted italic">{typingText}</span>
                  </div>
                </div>
              ) : null}
              </div>
            </div>

            <div className="relative shrink-0 border-t bg-surface p-2.5 pb-[calc(0.625rem+env(safe-area-inset-bottom))]">
              {showEmoji ? (
                <EmojiTray
                  className="absolute bottom-full left-2.5 mb-1"
                  onClose={() => setShowEmoji(false)}
                  onPick={(emoji) => {
                    setDraft((d) => d + emoji)
                    composerRef.current?.focus()
                  }}
                />
              ) : null}
              {sendError ? <SendError text={sendError} onDismiss={() => setSendError(null)} /> : null}
              {profile && (!profile.isOpen || profile.blocked) && !sendError ? (
                <p className="mb-2 px-1 text-[12px] text-foreground-subtle">
                  {profile.blocked
                    ? 'Blocked from chat — they cannot send new messages. Your reply still reaches their open chat.'
                    : 'This conversation is closed. Replying reopens it.'}
                </p>
              ) : null}
              {pendingFile ? (
                <div className="mb-2 flex items-center gap-2 rounded-lg bg-surface-sunken p-1.5">
                  {pendingFile.preview ? (
                    // A local blob preview — nothing for next/image to optimise.
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={pendingFile.preview} alt="" className="size-10 rounded object-cover" />
                  ) : (
                    <span className="grid size-10 place-items-center rounded bg-surface text-foreground-muted">
                      <PaperclipIcon className="size-4" />
                    </span>
                  )}
                  <span className="min-w-0 flex-1 truncate text-[12px] text-foreground-muted">{pendingFile.file.name}</span>
                  <button
                    type="button"
                    onClick={() =>
                      setPendingFile((current) => {
                        if (current?.preview) URL.revokeObjectURL(current.preview)
                        return null
                      })
                    }
                    aria-label="Remove attachment"
                    className="grid size-8 place-items-center rounded-md text-foreground-muted hover:bg-surface"
                  >
                    <CrossIcon className="size-4" />
                  </button>
                </div>
              ) : null}

              <div className="flex items-end gap-2">
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/avif,application/pdf"
                  className="sr-only"
                  tabIndex={-1}
                  onChange={(e) => pickFile(e.target.files?.[0])}
                />
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  disabled={sending}
                  aria-label="Attach a photo or PDF"
                  className="grid size-11 shrink-0 place-items-center rounded-xl border text-foreground-muted hover:border-border-strong hover:text-foreground disabled:opacity-40 md:size-10"
                >
                  <PaperclipIcon className="size-[18px]" />
                </button>
                <button
                  type="button"
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={() => setShowEmoji((v) => !v)}
                  aria-label="Add emoji"
                  aria-expanded={showEmoji}
                  className={`grid size-11 shrink-0 place-items-center rounded-xl border md:size-10 ${
                    showEmoji ? 'border-border-strong text-foreground' : 'text-foreground-muted hover:border-border-strong hover:text-foreground'
                  }`}
                >
                  <SmileIcon className="size-[18px]" />
                </button>
                <textarea
                  ref={composerRef}
                  value={draft}
                  onChange={(e) => {
                    setDraft(e.target.value)
                    if (sendError) setSendError(null)
                  }}
                  onKeyDown={(e) => {
                    // Desktop: Enter sends, Shift+Enter is a new line. On a phone the
                    // Return key makes a new line; the send button sends.
                    if (e.key === 'Enter' && !e.shiftKey && !isTouch()) {
                      e.preventDefault()
                      void reply()
                    }
                  }}
                  rows={1}
                  maxLength={4000}
                  placeholder={pendingFile ? 'Add a caption…' : 'Reply…'}
                  aria-label="Reply"
                  className="max-h-40 min-h-11 flex-1 resize-none overflow-y-auto rounded-xl border bg-background px-3 py-2.5 text-[16px] leading-snug text-foreground placeholder:text-foreground-subtle focus:border-border-strong focus:outline-none md:min-h-10 md:py-2 md:text-sm"
                />
                <button
                  type="button"
                  onClick={() => void reply()}
                  disabled={!canSend}
                  aria-label="Send reply"
                  className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary text-on-primary hover:bg-primary-hover disabled:opacity-40 md:size-10"
                >
                  {sending ? <SpinnerIcon className="size-[18px] motion-safe:animate-spin" /> : <SendIcon className="size-[18px]" />}
                </button>
              </div>
            </div>
          </>
        )}
      </section>

      {/* ── Profile: a column on a wide screen ───────────────────────────────── */}
      {activeId && profileColumn ? (
        <aside className="hidden w-[320px] shrink-0 border-l min-[1400px]:flex min-[1400px]:flex-col" aria-label="Customer details">
          {profile ? (
            <ProfilePanel
              profile={profile}
              now={now}
              busy={busy}
              onToggleOpen={() => void toggleOpen()}
              onBlock={() => setConfirm('block')}
              onUnblock={() => void setBlocked(false)}
              onDelete={() => setConfirm('delete')}
              onClose={() => setProfileColumn(false)}
            />
          ) : (
            <div className="m-4 h-40 animate-pulse rounded-xl bg-surface-sunken" aria-hidden />
          )}
        </aside>
      ) : null}

      {/* ── …and a sheet on anything narrower ────────────────────────────────── */}
      {profileSheet && profile ? (
        <div className="fixed inset-0 z-(--z-overlay) min-[1400px]:hidden" role="dialog" aria-modal="true" aria-label="Customer details">
          <button
            type="button"
            aria-label="Close customer details"
            onClick={() => setProfileSheet(false)}
            className="absolute inset-0 cursor-default bg-stone-950/50 motion-safe:animate-[fade-in_150ms_ease-out]"
          />
          <div className="absolute inset-y-0 right-0 w-full max-w-sm shadow-2xl motion-safe:animate-[slide-in-right_220ms_var(--ease-out-expo)]">
            <ProfilePanel
              profile={profile}
              now={now}
              busy={busy}
              onToggleOpen={() => void toggleOpen()}
              onBlock={() => setConfirm('block')}
              onUnblock={() => void setBlocked(false)}
              onDelete={() => setConfirm('delete')}
              onClose={() => setProfileSheet(false)}
            />
          </div>
        </div>
      ) : null}

      {confirm === 'block' && profile ? (
        <ConfirmDialog
          title={`Block ${profile.displayName} from chat?`}
          body={
            <p>
              They will not be able to send messages from this IP address until you unblock them, and this
              conversation is closed. An IP can be shared — mobile carriers, offices — and a determined person
              can change theirs.
            </p>
          }
          confirmLabel="Block"
          onConfirm={() => void setBlocked(true)}
          onCancel={() => setConfirm(null)}
        />
      ) : null}

      {confirm === 'delete' && activeId ? (
        <ConfirmDialog
          title={`Delete this conversation with ${name}?`}
          body={
            <p>
              Every message goes from the inbox and from their chat. The transcript is kept in the audit log.
              They can still start a new conversation afterwards.
            </p>
          }
          confirmLabel="Delete conversation"
          cancelLabel="Keep it"
          onConfirm={() => void deleteThread()}
          onCancel={() => setConfirm(null)}
        />
      ) : null}

      {confirm === 'bulk' ? (
        <ConfirmDialog
          title={`Delete ${selected.size} ${selected.size === 1 ? 'conversation' : 'conversations'}?`}
          body={<p>They go from the inbox and from the customers’ chats. Each transcript is kept in the audit log.</p>}
          confirmLabel="Delete"
          cancelLabel="Keep them"
          onConfirm={() => void bulkDelete()}
          onCancel={() => setConfirm(null)}
        />
      ) : null}

      {notice ? (
        <div
          role="status"
          className="fixed bottom-4 left-1/2 z-(--z-toast) flex w-[min(92vw,26rem)] -translate-x-1/2 items-start gap-3 rounded-xl bg-foreground px-4 py-3 text-[13px] text-background shadow-2xl motion-safe:animate-[bubble-in_180ms_var(--ease-out-expo)]"
        >
          <p className="min-w-0 flex-1 leading-snug">{notice}</p>
          <button type="button" onClick={() => setNotice(null)} aria-label="Dismiss" className="shrink-0 opacity-70 hover:opacity-100">
            <CrossIcon className="size-4" />
          </button>
        </div>
      ) : null}
    </div>
  )
}
