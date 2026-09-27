'use client'

import { useId, useState } from 'react'
import { CrossIcon } from '@/components/ui/icon'
import { cn } from '@/lib/utils'

/**
 * The card every engagement prompt sits in: the email sign-up, the install nudge
 * and the notifications ask.
 *
 * A card, not a modal. It floats above the phone's tab bar (bottom-left on a
 * computer, clear of the chat button), the page stays usable around it, and it
 * never takes focus when it appears by itself — it comes back every few seconds,
 * and one that grabbed focus would pull the cursor out of whatever someone was
 * typing. Escape closes it once focus is inside.
 *
 * Motion: rises 16px while fading in on the iOS drawer curve, and leaves faster
 * than it came (180ms), because leaving is the system responding to a tap.
 * Reduced motion keeps the fade and drops the travel.
 */
export function PromptCard({
  open,
  onClose,
  title,
  children,
  icon,
  header,
}: {
  open: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
  icon: React.ReactNode
  /** Shown above the card's content, beside the close button: the site logo, say. */
  header?: React.ReactNode
}) {
  const titleId = useId()
  // Stays on screen through its exit animation, then unmounts when that ends.
  const [present, setPresent] = useState(open)
  const [wasOpen, setWasOpen] = useState(open)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) setPresent(true)
  }
  const leaving = !open

  if (!present) return null

  return (
    <div
      role="dialog"
      aria-modal="false"
      aria-labelledby={titleId}
      data-engagement=""
      onKeyDown={(event) => {
        if (event.key === 'Escape') onClose()
      }}
      onTransitionEnd={(event) => {
        if (leaving && event.target === event.currentTarget) setPresent(false)
      }}
      className={cn(
        'fixed inset-x-3 z-(--z-overlay) bottom-[calc(env(safe-area-inset-bottom)+4.5rem)]',
        'md:inset-x-auto md:bottom-6 md:left-6 md:w-[25rem]',
        'rounded-2xl border border-border-strong bg-surface/95 p-4 shadow-2xl backdrop-blur-[12px] md:p-5',
        'transition-[opacity,translate]',
        leaving
          ? 'pointer-events-none translate-y-2 opacity-0 duration-[180ms] ease-out motion-reduce:translate-y-0'
          : 'translate-y-0 opacity-100 duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] starting:translate-y-4 starting:opacity-0 motion-reduce:starting:translate-y-0',
      )}
    >
      {header ? <div className="mb-3 flex min-h-8 items-center pr-10">{header}</div> : null}
      <div className="flex items-start gap-3">
        <div className="flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-primary/15 text-primary">
          {icon}
        </div>
        <div className="min-w-0 flex-1 pt-0.5">
          <h2 id={titleId} className="pr-8 font-display text-lg leading-snug text-foreground">
            {title}
          </h2>
          {children}
        </div>
      </div>
      <button
        type="button"
        onClick={onClose}
        aria-label="Close"
        className="absolute top-1.5 right-1.5 inline-flex size-11 cursor-pointer items-center justify-center rounded-full text-foreground-muted transition-[scale,color,background-color] duration-[160ms] hover:bg-surface-sunken hover:text-foreground active:scale-[0.94] motion-reduce:active:scale-100"
      >
        <CrossIcon className="size-5" />
      </button>
    </div>
  )
}
