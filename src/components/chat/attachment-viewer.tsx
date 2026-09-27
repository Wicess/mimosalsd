'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { CrossIcon, PaperclipIcon } from '@/components/ui/icon'

export interface ViewerItem {
  /** Where the photo loads from: the attachment route, or the local preview while sending. */
  readonly src: string
  readonly name: string
  readonly image: boolean
  /** The saved message, for the Save button. Absent while a photo is still sending. */
  readonly messageId?: string
}

/**
 * A photo, an invoice or a file from the chat, opened ON the site (owner,
 * 2026-09-14). It used to open in a new tab, which on a phone, and above all in the
 * installed app, took the customer out of the site; closing it left them outside.
 *
 * Here it fills the screen above the chat, and every way out leads back to the
 * conversation: the close button, a tap outside the photo, Escape, and the phone's
 * own back button or gesture, which closes the viewer instead of leaving the page.
 * Save downloads the file through the site, so it never navigates away either.
 */
export function AttachmentViewer({ item, onClose }: { item: ViewerItem | null; onClose: () => void }) {
  const closeRef = useRef<HTMLButtonElement>(null)
  const pushed = useRef(false)

  const close = useCallback(() => {
    if (pushed.current) {
      // Undo the history entry opening it added; the popstate below then closes it.
      pushed.current = false
      window.history.back()
    } else {
      onClose()
    }
  }, [onClose])

  useEffect(() => {
    if (!item) return
    // One history entry for the open viewer, keeping the router's own state on it, so
    // Back closes the photo rather than the page.
    window.history.pushState({ ...(window.history.state ?? {}), chatViewer: true }, '')
    pushed.current = true
    const onPop = () => {
      pushed.current = false
      onClose()
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close()
    }
    window.addEventListener('popstate', onPop)
    window.addEventListener('keydown', onKey)
    const previous = document.activeElement as HTMLElement | null
    closeRef.current?.focus()
    return () => {
      window.removeEventListener('popstate', onPop)
      window.removeEventListener('keydown', onKey)
      previous?.focus?.()
    }
  }, [item, onClose, close])

  if (!item || typeof document === 'undefined') return null

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={item.name}
      className="fixed inset-0 z-(--z-toast) flex flex-col bg-stone-950/95 motion-safe:animate-[fade-in_160ms_ease-out]"
    >
      <div className="flex shrink-0 items-center gap-2 px-2 pt-[env(safe-area-inset-top)]">
        <button
          ref={closeRef}
          type="button"
          onClick={close}
          aria-label="Close and go back to the chat"
          className="grid size-11 cursor-pointer place-items-center rounded-full! text-white hover:bg-white/10"
        >
          <CrossIcon className="size-6" />
        </button>
        <p className="min-w-0 flex-1 truncate text-sm text-white/80">{item.name}</p>
        {item.messageId ? (
          <a
            href={`/api/chat/attachment/${item.messageId}?download=1`}
            download={item.name}
            className="inline-flex min-h-11 items-center rounded-full! px-4 text-sm font-medium text-white hover:bg-white/10"
          >
            Save
          </a>
        ) : null}
      </div>

      {/* A tap anywhere around the photo closes it, as in a phone's own photo viewer. */}
      <div className="flex min-h-0 flex-1 items-center justify-center p-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)]" onClick={close}>
        {item.image ? (
          <ViewerImage key={item.src} src={item.src} name={item.name} />
        ) : (
          <div
            onClick={(event) => event.stopPropagation()}
            className="flex max-w-sm flex-col items-center gap-3 rounded-2xl bg-white/10 px-6 py-8 text-center text-white"
          >
            <PaperclipIcon className="size-8" />
            <p className="text-sm break-all">{item.name}</p>
            <p className="text-xs text-white/70">This file cannot be shown here. Save it to open it on your device.</p>
          </div>
        )}
      </div>
    </div>,
    document.body,
  )
}

/** The photo, with a spinner until it has loaded. Keyed by its address, so each photo starts fresh. */
function ViewerImage({ src, name }: { src: string; name: string }) {
  const [loaded, setLoaded] = useState(false)
  return (
    <>
      {!loaded ? (
        <span className="absolute size-8 animate-spin rounded-full border-2 border-white/30 border-t-white motion-reduce:animate-none" aria-hidden />
      ) : null}
      {/* A short-lived signed address or a local preview: nothing for next/image to optimise. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={name}
        onLoad={() => setLoaded(true)}
        onClick={(event) => event.stopPropagation()}
        className="max-h-full max-w-full rounded-lg object-contain select-none"
      />
    </>
  )
}
