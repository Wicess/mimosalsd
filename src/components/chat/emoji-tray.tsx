'use client'

import { useEffect, useRef } from 'react'
import { EMOJIS } from './emoji'

/** WHAM's compact emoji tray — a curated set (see ./emoji), no picker dependency. */
export function EmojiTray({
  onPick,
  onClose,
  className = '',
}: {
  onPick: (emoji: string) => void
  onClose: () => void
  className?: string
}) {
  const ref = useRef<HTMLDivElement>(null)

  // Dismiss on Escape or on any press outside the tray. The toggle button stops its
  // own press from reaching here, so tapping it again closes instead of re-opening.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    const onDown = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('pointerdown', onDown)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('pointerdown', onDown)
    }
  }, [onClose])

  return (
    <div
      ref={ref}
      role="group"
      aria-label="Insert an emoji"
      className={`z-30 grid w-64 grid-cols-8 gap-0.5 rounded-xl border bg-surface p-2 shadow-lg motion-safe:animate-[bubble-in_160ms_var(--ease-out-expo)] ${className}`}
    >
      {EMOJIS.map((emoji) => (
        <button
          key={emoji}
          type="button"
          onClick={() => onPick(emoji)}
          className="grid size-7 place-items-center rounded-md text-lg leading-none hover:bg-surface-sunken"
        >
          {emoji}
        </button>
      ))}
    </div>
  )
}
