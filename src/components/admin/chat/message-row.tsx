'use client'

import {
  AlertIcon,
  CheckCheckIcon,
  CheckIcon,
  MoreIcon,
  PaperclipIcon,
  PencilIcon,
  TrashIcon,
} from '@/components/ui/icon'
import { clockTime, exactTime } from './format'
import type { InboxMessage } from './types'

/**
 * One message in the operator's view of a conversation.
 *
 * Ported from WHAM's inbox: tailed bubbles, the owner-only menu (edit, delete) on
 * the business's own messages, inline editing, and FULL receipts — one tick for
 * delivered, two for read, each with its time — because whether a customer actually
 * saw a quote changes what the operator does next. The customer only ever sees one
 * tick (lib/chat/rules.ts).
 *
 * Added here: a customer message that trips the compliance lexicon says so, under
 * the bubble, before anyone replies to it.
 */

function Receipt({ m }: { m: InboxMessage }) {
  if (m.pending) return <span>Sending…</span>
  if (m.readAt) {
    return (
      <span className="inline-flex items-center gap-1 text-success-fg" title={`Read ${exactTime(m.readAt)}`}>
        <CheckCheckIcon className="size-3.5" /> Read {clockTime(m.readAt)}
      </span>
    )
  }
  if (m.deliveredAt) {
    return (
      <span className="inline-flex items-center gap-1" title={`Delivered ${exactTime(m.deliveredAt)}`}>
        <CheckIcon className="size-3.5" /> Delivered
      </span>
    )
  }
  return <span>Sent</span>
}

export function MessageRow({
  m,
  threadId,
  menuOpen,
  onMenu,
  editing,
  onEditChange,
  onEditStart,
  onEditSave,
  onEditCancel,
  onDelete,
}: {
  m: InboxMessage
  threadId: string
  menuOpen: boolean
  onMenu: (id: string | null) => void
  editing: string | null
  onEditChange: (body: string) => void
  onEditStart: (m: InboxMessage) => void
  onEditSave: () => void
  onEditCancel: () => void
  onDelete: (id: string) => void
}) {
  if (m.sender === 'SYSTEM') {
    return (
      <div className="flex justify-center px-2">
        <p className="max-w-[88%] rounded-2xl bg-surface-sunken px-4 py-2.5 text-center text-[12px] leading-relaxed whitespace-pre-wrap text-foreground-muted">
          {m.body}
          <span className="mt-1 block text-[10px] tracking-wide text-foreground-subtle uppercase">
            Automatic · {clockTime(m.createdAt)}
          </span>
        </p>
      </div>
    )
  }

  const mine = m.sender === 'ADMIN'
  const isEditing = editing !== null
  const isImage = m.attachment?.type.startsWith('image/')
  const href = m.pending ? undefined : `/api/admin/chat/${threadId}/attachment/${m.id}`
  const src = m.localPreview ?? href
  const flags = m.flags ?? []

  return (
    <div
      className={`group flex items-end gap-1 motion-safe:animate-[bubble-in_180ms_var(--ease-out-expo)] ${mine ? 'justify-end' : 'justify-start'}`}
    >
      {/* Owner-only controls. Revealed on hover on desktop; always reachable on touch. */}
      {mine && !m.pending && !isEditing ? (
        <div className="relative flex opacity-100 transition-opacity duration-150 md:opacity-0 md:group-focus-within:opacity-100 md:group-hover:opacity-100">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onMenu(menuOpen ? null : m.id)
            }}
            aria-label="Message options"
            aria-expanded={menuOpen}
            className="grid size-8 place-items-center rounded-lg text-foreground-subtle hover:bg-surface-sunken hover:text-foreground"
          >
            <MoreIcon className="size-4" />
          </button>
          {menuOpen ? (
            <div
              onClick={(e) => e.stopPropagation()}
              className="absolute right-0 bottom-9 z-30 w-36 overflow-hidden rounded-xl border bg-surface py-1 shadow-lg motion-safe:animate-[bubble-in_150ms_var(--ease-out-expo)]"
            >
              {m.body ? (
                <button
                  type="button"
                  onClick={() => onEditStart(m)}
                  className="flex min-h-11 w-full items-center gap-2 px-3 text-left text-xs font-medium text-foreground md:min-h-9 hover:bg-surface-sunken"
                >
                  <PencilIcon className="size-3.5" /> Edit
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => onDelete(m.id)}
                className="flex min-h-11 w-full items-center gap-2 px-3 text-left text-xs font-medium text-danger-fg md:min-h-9 hover:bg-danger-bg"
              >
                <TrashIcon className="size-3.5" /> Delete
              </button>
            </div>
          ) : null}
        </div>
      ) : null}

      <div className={`flex max-w-[85%] flex-col gap-1 md:max-w-[75%] ${mine ? 'items-end' : 'items-start'}`}>
        {isEditing ? (
          <div className="w-72 max-w-full rounded-2xl bg-surface p-2 shadow-sm ring-2 ring-[var(--ring)]">
            <textarea
              autoFocus
              value={editing}
              onChange={(e) => onEditChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  onEditSave()
                }
                if (e.key === 'Escape') onEditCancel()
              }}
              rows={3}
              aria-label="Edit message"
              className="w-full resize-none rounded-lg border bg-background px-2.5 py-2 text-[16px] text-foreground focus:outline-none md:text-sm"
            />
            <div className="mt-1.5 flex justify-end gap-1.5">
              <button
                type="button"
                onClick={onEditCancel}
                className="min-h-11 rounded-lg px-2.5 text-[12px] font-medium text-foreground-muted md:min-h-8 hover:text-foreground"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={onEditSave}
                disabled={!editing.trim()}
                className="min-h-11 rounded-lg bg-primary px-3 text-[12px] font-semibold text-on-primary md:min-h-8 disabled:opacity-40"
              >
                Save
              </button>
            </div>
          </div>
        ) : (
          <div
            className={[
              'overflow-hidden text-[14px] leading-relaxed',
              mine
                ? 'rounded-[18px] rounded-br-md bg-primary text-on-primary shadow-sm'
                : `rounded-[18px] rounded-bl-md border bg-surface text-foreground shadow-sm ${flags.length ? 'ring-2 ring-warning-fg/40' : ''}`,
              m.pending ? 'opacity-70' : '',
            ].join(' ')}
          >
            {m.attachment && isImage && src ? (
              <a href={href} target="_blank" rel="noreferrer" aria-label={`Open ${m.attachment.name}`} className="block">
                {/* A 2-minute signed URL or a local blob — nothing for next/image to optimise. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={src}
                  alt={m.attachment.name}
                  loading="lazy"
                  className="max-h-72 w-full max-w-[280px] object-cover"
                />
              </a>
            ) : null}
            {m.attachment && !isImage ? (
              <a
                href={href}
                target="_blank"
                rel="noreferrer"
                className="flex min-h-11 items-center gap-2 px-3.5 py-2 underline underline-offset-4"
              >
                <PaperclipIcon className="size-4 shrink-0" />
                <span className="truncate">{m.attachment.name}</span>
              </a>
            ) : null}
            {m.body ? <p className="px-3.5 py-2 break-words whitespace-pre-wrap">{m.body}</p> : null}
          </div>
        )}

        {flags.length > 0 && !mine ? (
          <p className="inline-flex items-start gap-1 px-1 text-[11px] leading-snug font-medium text-warning-fg">
            <AlertIcon className="mt-px size-3.5" />
            Mentions {flags.map((f) => `“${f}”`).join(', ')}. Reply without a health claim.
          </p>
        ) : null}

        <span className={`px-1 text-[10px] tabular-nums text-foreground-subtle ${mine ? 'text-right' : ''}`}>
          {mine ? (
            <>
              {m.authorName ? <span>{m.authorName} · </span> : null}
              <span title={exactTime(m.createdAt)}>{clockTime(m.createdAt)}</span>
              {' · '}
              <Receipt m={m} />
            </>
          ) : (
            <span title={exactTime(m.createdAt)}>{clockTime(m.createdAt)}</span>
          )}
          {m.edited ? <span className="italic"> · edited</span> : null}
        </span>
      </div>
    </div>
  )
}

/** A failed send never vanishes silently; this is the line that says so. */
export function SendError({ text, onDismiss }: { text: string; onDismiss: () => void }) {
  return (
    <div role="alert" className="mb-2 flex items-start gap-2 rounded-lg bg-danger-bg px-3 py-2 text-[12px] leading-snug text-danger-fg">
      <AlertIcon className="mt-px size-3.5 shrink-0" />
      <p className="min-w-0 flex-1">{text}</p>
      <button type="button" onClick={onDismiss} className="shrink-0 font-semibold underline underline-offset-2">
        Dismiss
      </button>
    </div>
  )
}
