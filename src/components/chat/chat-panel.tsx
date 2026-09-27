'use client'

import Link from 'next/link'
import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { BRAND } from '@/lib/brand'
import { PresenceDot } from '@/components/chat/presence-dot'
import { AttachmentViewer, type ViewerItem } from '@/components/chat/attachment-viewer'
import { CANNED_REPLIES, type CannedReply } from '@/lib/support/canned'
import {
  AlertIcon,
  ArrowLeftIcon,
  BellIcon,
  CheckIcon,
  ChevronRightIcon,
  CrossIcon,
  PaperclipIcon,
  SendIcon,
  ShieldIcon,
  SmileIcon,
} from '@/components/ui/icon'
import { EmojiTray } from './emoji-tray'
import { useChat, type ChatMessage } from './use-chat'
import { preparePush, usePushStatus } from '@/components/pwa/push-client'

/**
 * The conversation.
 *
 * Ported from WHAM's `chat-panel.tsx`: tailed bubbles, a day separator, one tick on
 * the customer's own messages, photos inline, the quotable reference pill, and a
 * failed message that stays on screen with a retry rather than vanishing.
 *
 * Rebuilt on this project's semantic tokens rather than WHAM's hard-coded zinc and
 * brand-blue, so it follows the site into dark mode instead of glowing white in it.
 *
 * Kept from the quick chat this replaces: the four instant answers on first
 * contact. Most people ask one of them, and a correct answer with a link, right now,
 * beats waiting for a person — it costs no request at all.
 */

function timeLabel(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

function dayLabel(iso: string): string {
  const date = new Date(iso)
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(today.getDate() - 1)
  if (date.toDateString() === today.toDateString()) return 'Today'
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday'
  return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

function Bubble({
  m,
  onRetry,
  onMedia,
  onOpen,
}: {
  m: ChatMessage
  onRetry: (m: ChatMessage) => void
  /** A photo finished loading and grew the list. */
  onMedia: () => void
  /** Open a photo, an invoice or a file in the on-site viewer. */
  onOpen: (item: ViewerItem) => void
}) {
  if (m.sender === 'SYSTEM') {
    return (
      <div className="flex justify-center px-2">
        <p className="max-w-[92%] rounded-2xl bg-surface-sunken px-4 py-3 text-center text-[13px] leading-relaxed whitespace-pre-wrap text-foreground-muted">
          {m.body}
        </p>
      </div>
    )
  }

  const mine = m.sender === 'CUSTOMER'
  const isImage = m.attachment?.type.startsWith('image/')
  const src = m.localPreview ?? (m.pending ? undefined : `/api/chat/attachment/${m.id}`)

  return (
    <div className={`flex ${mine ? 'justify-end' : 'justify-start'} motion-safe:animate-[fade-in_180ms_ease-out]`}>
      <div className={`flex max-w-[82%] flex-col gap-1 ${mine ? 'items-end' : 'items-start'}`}>
        <div
          className={[
            'overflow-hidden text-[15px] leading-relaxed',
            // The tail: the corner nearest the sender squares off.
            mine
              ? 'rounded-[20px] rounded-br-md bg-primary text-on-primary'
              : 'rounded-[20px] rounded-bl-md border border-border bg-surface text-foreground',
            m.failed ? 'opacity-70' : '',
          ].join(' ')}
        >
          {m.attachment && isImage && src ? (
            // Opens on the site, never in a new tab: closing it comes back here.
            <button
              type="button"
              onClick={() =>
                onOpen({ src, name: m.attachment!.name, image: true, ...(m.pending ? {} : { messageId: m.id }) })
              }
              aria-label={`View ${m.attachment.name}`}
              className="block cursor-zoom-in"
            >
              {/* A signed, short-lived URL or a local blob — nothing for next/image to optimise. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt={m.attachment.name} onLoad={onMedia} className="max-h-72 w-full max-w-[260px] object-cover object-top" />
            </button>
          ) : null}
          {m.attachment && !isImage ? (
            <button
              type="button"
              disabled={m.pending}
              onClick={() =>
                onOpen({ src: `/api/chat/attachment/${m.id}`, name: m.attachment!.name, image: false, messageId: m.id })
              }
              className="flex min-h-11 w-full cursor-pointer items-center gap-2 px-4 py-2.5 text-left underline underline-offset-4"
            >
              <PaperclipIcon className="size-4 shrink-0" />
              <span className="truncate">{m.attachment.name}</span>
            </button>
          ) : null}
          {m.body ? (
            <p className="px-4 py-2.5 break-words whitespace-pre-wrap">{m.body}</p>
          ) : null}
        </div>

        <span className="flex items-center gap-1 px-1.5 text-[11px] tabular-nums text-foreground-subtle">
          {m.failed ? (
            <button
              type="button"
              onClick={() => onRetry(m)}
              className="inline-flex min-h-8 items-center gap-1 font-medium text-danger-fg"
            >
              <AlertIcon className="size-3" /> Not sent — tap to retry
            </button>
          ) : m.pending ? (
            'Sending…'
          ) : (
            <>
              {timeLabel(m.createdAt)}
              {m.edited ? <span className="italic">· edited</span> : null}
              {/*
                ONE tick, never two. A customer is told their message arrived — never
                the moment the shop read it and had not yet replied.
              */}
              {mine && m.receipt === 'delivered' ? (
                <CheckIcon className="size-3.5 text-accent-fg" aria-label="Received" />
              ) : null}
            </>
          )}
        </span>
      </div>
    </div>
  )
}

export function ChatPanel({
  open,
  onClose,
  variant = 'widget',
}: {
  open: boolean
  onClose: () => void
  /** `page`: the full-screen profile chat, which has its own back button instead of a close. */
  variant?: 'widget' | 'page'
}) {
  const {
    messages,
    loading,
    sending,
    send,
    sendFile,
    reportTyping,
    publicId,
    notificationsOn,
    notificationsSupported,
    enableNotifications,
    disableNotifications,
  } = useChat({ open })
  const [notifyNote, setNotifyNote] = useState<string | null>(null)
  // The photo, invoice or file open in the on-site viewer.
  const [viewing, setViewing] = useState<ViewerItem | null>(null)
  const closeViewer = useCallback(() => setViewing(null), [])
  const pushStatus = usePushStatus()
  // Warm the push set-up as the bell appears, so the tap itself has nothing to wait for.
  useEffect(() => {
    void preparePush()
  }, [])
  const [draft, setDraft] = useState('')
  useEffect(() => {
    const field = inputRef.current
    if (!field) return
    field.style.height = 'auto'
    field.style.height = `${Math.min(field.scrollHeight, 128)}px`
  }, [draft])
  const [email, setEmail] = useState('')
  const [fileError, setFileError] = useState<string | null>(null)
  const [faq, setFaq] = useState<CannedReply | null>(null)
  const [showEmoji, setShowEmoji] = useState(false)
  const listRef = useRef<HTMLDivElement>(null)
  // Whether the reader is at the newest message. A photo that finishes loading
  // grows the list after the scroll; this is how it knows to follow.
  const atBottomRef = useRef(true)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const titleId = useId()
  const emailId = useId()

  const firstContact = messages.length === 0

  // Newest message in view. Layout effect, so it lands before paint and the list
  // never flashes at the top first.
  useLayoutEffect(() => {
    const list = listRef.current
    if (list) list.scrollTop = list.scrollHeight
    atBottomRef.current = true
  }, [messages.length])

  const followMedia = () => {
    const list = listRef.current
    if (list && atBottomRef.current) list.scrollTop = list.scrollHeight
  }

  useEffect(() => {
    if (open) inputRef.current?.focus()
  }, [open])

  async function submit(event?: React.FormEvent) {
    event?.preventDefault()
    const text = draft.trim()
    if (!text || sending) return
    setDraft('')
    setShowEmoji(false)
    reportTyping('')
    await send(text, firstContact && email ? { email } : undefined)
  }

  async function pick(file: File | undefined) {
    setFileError(null)
    if (!file) return
    const error = await sendFile(file, draft)
    if (error) setFileError(error)
    else setDraft('')
    if (fileRef.current) fileRef.current.value = ''
  }

  return (
    <section
      role="dialog"
      aria-modal="false"
      aria-labelledby={titleId}
      className="flex h-full min-h-0 flex-col bg-background"
    >
      <header className="flex shrink-0 items-center gap-3 border-b border-border bg-surface px-4 py-3">
        <div className="min-w-0 flex-1">
          <h2 id={titleId} className="font-product text-base font-medium text-foreground">
            {BRAND.name}
          </h2>
          {/*
            Always "Admin online" (owner, 2026-09-14): the owner is notified of every
            message on their phone and answers straight away, so customers should
            feel free to write. It is the design of the header, not a status read
            from anywhere, so it costs no request and no database query. The words say
            it as well as the light (WCAG 1.4.1).
          */}
          <p className="mt-1 flex items-center gap-2.5 text-xs">
            <PresenceDot online blink />
            <span className="font-medium tracking-wide text-presence">Admin online</span>
          </p>
        </div>
        {notificationsSupported || pushStatus === 'needs-install' ? (
          <button
            type="button"
            aria-pressed={notificationsOn}
            onClick={async () => {
              if (notificationsOn) {
                disableNotifications()
                setNotifyNote('Reply notifications are off.')
                return
              }
              const result = await enableNotifications()
              setNotifyNote(
                result === 'granted'
                  ? 'We will notify you when the team replies.'
                  : result === 'needs-install'
                    ? 'On iPhone, add SnypeGate to your Home Screen first — the steps are open.'
                    : result === 'unsupported'
                      ? 'This browser cannot show notifications.'
                      : 'Notifications are blocked in your browser settings.',
              )
            }}
            aria-label={notificationsOn ? 'Turn off reply notifications' : 'Notify me when the team replies'}
            title={notificationsOn ? 'Reply notifications on' : 'Notify me when the team replies'}
            className={`relative inline-flex size-11 items-center justify-center rounded-full hover:bg-surface-sunken ${
              notificationsOn ? 'text-accent-fg' : 'text-foreground-muted hover:text-foreground'
            }`}
          >
            <BellIcon className="size-5" />
            {notificationsOn ? <span aria-hidden className="absolute top-2.5 right-2.5 size-2 rounded-full bg-accent" /> : null}
          </button>
        ) : null}
        {variant === 'widget' ? (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close chat"
            className="inline-flex size-11 items-center justify-center rounded-full text-foreground-muted hover:bg-surface-sunken hover:text-foreground"
          >
            <CrossIcon className="size-5" />
          </button>
        ) : null}
      </header>
      {notifyNote ? (
        <p role="status" className="shrink-0 border-b border-border bg-surface-sunken px-4 py-2 text-xs text-foreground-muted">
          {notifyNote}
        </p>
      ) : null}

      <div
        ref={listRef}
        onScroll={() => {
          const list = listRef.current
          if (list) atBottomRef.current = list.scrollHeight - list.scrollTop - list.clientHeight < 80
        }}
        className="min-h-0 flex-1 space-y-2 overflow-y-auto overscroll-contain px-3 py-4"
      >
        {loading && messages.length === 0 ? (
          <div className="space-y-3" aria-hidden>
            {[0, 1, 2].map((i) => (
              <div key={i} className={`flex ${i === 1 ? 'justify-end' : 'justify-start'}`}>
                <div className={`h-10 animate-pulse rounded-[20px] bg-surface-sunken ${i === 1 ? 'w-40' : 'w-52'}`} />
              </div>
            ))}
          </div>
        ) : firstContact && faq ? (
          <div className="px-1 motion-safe:animate-[fade-in_180ms_ease-out]">
            <button
              type="button"
              onClick={() => setFaq(null)}
              className="inline-flex min-h-9 items-center gap-1.5 rounded-lg px-2 text-[13px] font-medium text-foreground-muted hover:bg-surface-sunken hover:text-foreground"
            >
              <ArrowLeftIcon className="size-4" /> All questions
            </button>
            <div className="mt-2 rounded-2xl border border-border-subtle bg-surface p-4">
              <p className="font-product text-[15px] font-medium text-foreground">{faq.question}</p>
              <p className="mt-2 text-[14px] leading-relaxed text-foreground-muted">{faq.answer}</p>
              <Link
                href={faq.href}
                onClick={onClose}
                className="mt-3 inline-flex min-h-10 items-center gap-1 text-[14px] font-medium text-accent-fg underline underline-offset-4"
              >
                {faq.linkLabel} <ChevronRightIcon className="size-4" />
              </Link>
            </div>
            <p className="mt-3 px-2 text-center text-[12px] text-foreground-subtle">
              Still need a hand? Write below — a person reads every message.
            </p>
          </div>
        ) : firstContact ? (
          <div className="flex min-h-full flex-col justify-center px-2">
            <div className="text-center">
              <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-accent-muted text-accent-fg">
                <SendIcon className="size-5" />
              </span>
              <p className="mt-3 font-product text-base font-medium text-foreground">How can we help?</p>
              <p className="mx-auto mt-1.5 max-w-[34ch] text-[13px] leading-relaxed text-foreground-muted">
                Ask about a product, an order or where we ship. A person reads every message.
              </p>
            </div>
            <p className="mt-5 px-1 text-[11px] font-semibold tracking-wider text-foreground-subtle uppercase">
              Answered instantly
            </p>
            <ul className="mt-2 space-y-1.5">
              {CANNED_REPLIES.map((reply) => (
                <li key={reply.id}>
                  <button
                    type="button"
                    onClick={() => setFaq(reply)}
                    className="flex min-h-11 w-full items-center justify-between gap-3 rounded-xl border border-border-subtle bg-surface px-4 text-left text-[14px] text-foreground hover:border-border-strong"
                  >
                    {reply.question}
                    <ChevronRightIcon className="size-4 shrink-0 text-foreground-subtle" />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          messages.map((m, i) => {
            const previous = messages[i - 1]
            const newDay =
              !previous || new Date(previous.createdAt).toDateString() !== new Date(m.createdAt).toDateString()
            return (
              <div key={m.id} className={newDay ? 'space-y-2 pt-1' : ''}>
                {newDay ? (
                  <div className="flex justify-center py-1">
                    <span className="rounded-full bg-surface px-3 py-1 text-[11px] font-medium text-foreground-muted ring-1 ring-border">
                      {dayLabel(m.createdAt)}
                    </span>
                  </div>
                ) : null}
                <Bubble m={m} onRetry={(failed) => void send(failed.body)} onMedia={followMedia} onOpen={setViewing} />
              </div>
            )
          })
        )}
        {publicId && !firstContact ? (
          <p className="pt-2 text-center text-[11px] text-foreground-subtle">
            Reference <span className="tabular font-medium text-foreground-muted">{publicId}</span>
          </p>
        ) : null}
      </div>

      <form onSubmit={submit} className="relative shrink-0 border-t border-border bg-surface px-3 pt-2.5 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
        {showEmoji ? (
          <EmojiTray
            className="absolute bottom-full left-3 mb-1"
            onClose={() => setShowEmoji(false)}
            onPick={(emoji) => {
              setDraft((d) => d + emoji)
              inputRef.current?.focus()
            }}
          />
        ) : null}
        {firstContact ? (
          <div className="mb-2">
            <label htmlFor={emailId} className="sr-only">
              Your email, so we can reply if you leave
            </label>
            <input
              id={emailId}
              type="email"
              inputMode="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Your email — optional, so we can reply if you leave"
              className="min-h-11 w-full rounded-2xl border border-border-strong bg-background px-4 text-[16px] text-foreground placeholder:text-foreground-subtle md:text-sm"
            />
          </div>
        ) : null}

        {fileError ? (
          <p role="alert" className="mb-2 text-[12px] font-medium text-danger-fg">
            {fileError}
          </p>
        ) : null}

        <div className="flex items-end gap-2 rounded-[24px] bg-surface-sunken p-1.5 focus-within:ring-2 focus-within:ring-[var(--ring)]">
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/avif,application/pdf"
            className="sr-only"
            tabIndex={-1}
            onChange={(e) => void pick(e.target.files?.[0])}
          />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={sending}
            aria-label="Attach a photo or PDF"
            className="grid size-11 shrink-0 place-items-center rounded-full bg-surface text-foreground-muted hover:text-foreground disabled:opacity-40"
          >
            <PaperclipIcon className="size-4" />
          </button>
          <button
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => setShowEmoji((v) => !v)}
            aria-label="Add emoji"
            aria-expanded={showEmoji}
            className="hidden size-11 shrink-0 place-items-center rounded-full bg-surface text-foreground-muted hover:text-foreground md:grid"
          >
            <SmileIcon className="size-4" />
          </button>
          <textarea
            ref={inputRef}
            value={draft}
            rows={1}
            maxLength={4000}
            onChange={(e) => {
              setDraft(e.target.value)
              reportTyping(e.target.value)
            }}
            // Enter (and the phone keyboard's return key) makes a new line. Only the Send
            // button sends — the owner's rule: a half-written message must never go out
            // because someone reached for the next line.
            enterKeyHint="enter"
            placeholder="Write a message"
            aria-label="Message"
            // 16px on phones stops iOS zooming the page when the field takes focus.
            // The pill around it draws the focus ring; the global :focus-visible outline is
            // unlayered, so it takes `!` to stop a second ring appearing inside the first.
            className="max-h-32 min-h-11 flex-1 resize-none bg-transparent px-2 py-2.5 text-[16px] leading-snug text-foreground placeholder:text-foreground-subtle outline-none! md:text-[15px]"
          />
          <button
            type="submit"
            disabled={!draft.trim() || sending}
            aria-label="Send message"
            className="grid size-11 shrink-0 place-items-center rounded-full bg-primary text-on-primary disabled:opacity-40"
          >
            <SendIcon className="size-4" />
          </button>
        </div>

        <p className="mt-2 flex items-center justify-center gap-1.5 text-[10px] text-foreground-subtle">
          <ShieldIcon className="size-3" />
          Private — only our team sees this conversation and anything you send.
        </p>
      </form>
      <AttachmentViewer item={viewing} onClose={closeViewer} />
    </section>
  )
}
