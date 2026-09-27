'use client'

import { useEffect, useId, useRef } from 'react'

/**
 * WHAM's confirm step for the two irreversible-feeling actions — blocking a visitor
 * and deleting a conversation. Escape and the scrim cancel; focus starts on the
 * SAFE button, so a stray Enter keeps the conversation rather than losing it.
 */
export function ConfirmDialog({
  title,
  body,
  confirmLabel,
  cancelLabel = 'Cancel',
  onConfirm,
  onCancel,
}: {
  title: string
  body: React.ReactNode
  confirmLabel: string
  cancelLabel?: string
  onConfirm: () => void
  onCancel: () => void
}) {
  const titleId = useId()
  const cancelRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    const previously = document.activeElement as HTMLElement | null
    cancelRef.current?.focus()
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onCancel()
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      previously?.focus?.()
    }
  }, [onCancel])

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      className="fixed inset-0 z-(--z-modal) grid place-items-center bg-stone-950/50 p-4 motion-safe:animate-[fade-in_150ms_ease-out]"
      onClick={(e) => e.target === e.currentTarget && onCancel()}
    >
      <div className="w-full max-w-sm rounded-2xl border bg-surface p-5 shadow-2xl motion-safe:animate-[bubble-in_180ms_var(--ease-out-expo)]">
        <p id={titleId} className="text-sm font-semibold text-foreground">
          {title}
        </p>
        <div className="mt-1.5 text-[13px] leading-relaxed text-foreground-muted">{body}</div>
        <div className="mt-5 flex justify-end gap-2">
          <button
            ref={cancelRef}
            type="button"
            onClick={onCancel}
            className="min-h-10 rounded-lg px-3.5 text-sm font-medium text-foreground-muted hover:bg-surface-sunken hover:text-foreground"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="min-h-10 rounded-lg bg-danger-fg px-4 text-sm font-semibold text-background hover:opacity-90 active:scale-[0.98]"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
