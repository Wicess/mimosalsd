'use client'

import { useCallback, useEffect, useRef, useSyncExternalStore } from 'react'
import {
  closeCart,
  getCartUiOpen,
  getCartUiServerSnapshot,
  subscribeCartUi,
} from '@/lib/cart/cart-ui'
import { CrossIcon } from '@/components/ui/icon'

/**
 * Slide-over cart.
 *
 * The panel chrome is a client component; everything inside it is server-rendered and
 * passed as `children`, so reading the cart cookie stays on the server and this file
 * ships no cart logic. After a mutation the caller runs `router.refresh()` and the
 * server content re-renders in place.
 *
 * Modal behaviour that is easy to leave out and immediately noticeable when missing:
 * Escape closes, the scrim closes, focus moves into the panel on open and returns to
 * whatever opened it on close, Tab is trapped while open, and the page behind does not
 * scroll. Enter is 260ms and exit 160ms — an exit that matches the entrance duration
 * reads as sluggish because the user has already decided to leave.
 */
export function CartDrawer({ children }: { children: React.ReactNode }) {
  const open = useSyncExternalStore(
    subscribeCartUi,
    getCartUiOpen,
    getCartUiServerSnapshot,
  )
  const panelRef = useRef<HTMLDivElement>(null)
  const restoreFocusTo = useRef<HTMLElement | null>(null)

  const close = useCallback(() => closeCart(), [])

  // Remember the trigger so focus can go back to it, and move focus into the panel.
  useEffect(() => {
    if (!open) return
    restoreFocusTo.current = document.activeElement as HTMLElement | null
    const id = window.setTimeout(() => {
      panelRef.current?.querySelector<HTMLElement>('[data-cart-close]')?.focus()
    }, 0)
    return () => {
      window.clearTimeout(id)
      restoreFocusTo.current?.focus?.()
    }
  }, [open])

  // Escape to dismiss, and keep Tab inside the panel while it is open.
  useEffect(() => {
    if (!open) return
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault()
        close()
        return
      }
      if (event.key !== 'Tab') return
      const focusable = panelRef.current?.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      )
      if (!focusable || focusable.length === 0) return
      const first = focusable[0]!
      const last = focusable[focusable.length - 1]!
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [open, close])

  // Freeze the page behind the panel. Padding compensates for the removed scrollbar
  // so the header does not visibly jump sideways as the drawer opens.
  useEffect(() => {
    if (!open) return
    const { body, documentElement } = document
    const gap = window.innerWidth - documentElement.clientWidth
    const previousOverflow = body.style.overflow
    const previousPadding = body.style.paddingRight
    body.style.overflow = 'hidden'
    if (gap > 0) body.style.paddingRight = `${gap}px`
    return () => {
      body.style.overflow = previousOverflow
      body.style.paddingRight = previousPadding
    }
  }, [open])

  return (
    <div
      // Kept mounted so the server-rendered contents stay warm between openings, and
      // `inert` keeps them out of the tab order and the accessibility tree when closed.
      className={[
        'fixed inset-0 z-(--z-modal)',
        open ? '' : 'pointer-events-none',
      ].join(' ')}
      // React 19 takes a real boolean; the old empty-string form reads as FALSE here.
      inert={!open}
      aria-hidden={!open}
    >
      {/* Scrim. Dense enough to isolate the panel without hiding the page entirely. */}
      <button
        type="button"
        tabIndex={-1}
        aria-label="Close cart"
        onClick={close}
        className={[
          'absolute inset-0 h-full w-full cursor-default bg-stone-950/55 backdrop-blur-[2px]',
          'motion-safe:transition-opacity motion-safe:duration-200',
          open ? 'opacity-100' : 'opacity-0',
        ].join(' ')}
      />

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Your cart"
        className={[
          // A side bar on every screen: on a phone it leaves the page showing beside it.
          'absolute inset-y-0 right-0 flex w-[min(21rem,84vw)] flex-col bg-surface shadow-2xl md:w-[min(28rem,88vw)]',
          'motion-safe:transition-transform motion-safe:ease-out',
          open
            ? 'translate-x-0 motion-safe:duration-[260ms]'
            : 'translate-x-full motion-safe:duration-[160ms]',
        ].join(' ')}
      >
        <div className="flex items-center justify-between border-b border-border px-4 py-2.5 md:px-5 md:py-4">
          <h2 className="font-display text-base text-foreground md:text-lg">Your cart</h2>
          <button
            type="button"
            data-cart-close
            onClick={close}
            aria-label="Close cart"
            className="-mr-2 inline-flex size-11 cursor-pointer items-center justify-center rounded-md text-foreground-muted transition-colors hover:bg-surface-sunken hover:text-foreground"
          >
            <CrossIcon className="size-5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 md:px-5 md:py-5">
          {children}
        </div>
      </div>
    </div>
  )
}
