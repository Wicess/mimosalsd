'use client'

import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import { CrossIcon } from '@/components/ui/icon'
import { BRAND } from '@/lib/brand'

/**
 * Mobile drawer.
 *
 * The only client component in the admin shell besides the nav links. The sidebar
 * itself stays a Server Component and is passed in as children, so navigation, role
 * filtering and sign-out all work without shipping the nav data to the browser.
 *
 * Three things here are not decoration:
 *
 *  · IT CLOSES ON NAVIGATION. It did not need to before, because every link was a full
 *    document load which tore the drawer down as a side effect. Now that the sidebar
 *    uses `next/link`, tapping a link changes the route without unmounting anything —
 *    so without this the operator taps "Orders" and stares at the menu still covering
 *    the page they just asked for.
 *
 *  · FOCUS IS TRAPPED AND RETURNED. An open drawer that leaves focus behind it lets a
 *    keyboard or screen-reader user tab into a page they cannot see.
 *
 *  · ESCAPE CLOSES IT, and the scrim is a real button, so there is never a modal with
 *    no way out.
 */
export function AdminMobileNav({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const panelRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const titleId = useId()

  /*
   * "Open, on this route" rather than a plain boolean.
   *
   * The drawer must close when the operator taps a link, and with client navigation
   * nothing unmounts to do that for us. Deriving `open` from the route it was opened
   * on closes it the instant the path changes, with no effect synchronising two
   * pieces of state — which is both simpler and what the react-hooks rule against
   * setState-in-an-effect is pointing at.
   */
  const [openedOn, setOpenedOn] = useState<string | null>(null)
  const open = openedOn !== null && openedOn === pathname

  const close = useCallback(() => setOpenedOn(null), [])

  useEffect(() => {
    if (!open) return

    const panel = panelRef.current
    const previouslyFocused = document.activeElement as HTMLElement | null
    // Captured now: by cleanup time the ref may point somewhere else.
    const trigger = triggerRef.current

    // Move focus into the drawer so the next Tab lands inside it, not behind it.
    const focusables = () =>
      Array.from(
        panel?.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])',
        ) ?? [],
      ).filter((el) => el.offsetParent !== null)

    focusables()[0]?.focus()

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpenedOn(null)
        return
      }
      if (e.key !== 'Tab') return

      const items = focusables()
      if (items.length === 0) return
      const first = items[0]!
      const last = items[items.length - 1]!

      // Wrap, so Tab can never reach the page behind the scrim.
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'

    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
      // Back to the button that opened it, not to the top of the document.
      ;(trigger ?? previouslyFocused)?.focus()
    }
  }, [open])

  return (
    <>
      <div className="fixed inset-x-0 top-0 z-(--z-sticky) flex h-14 items-center gap-3 border-b border-white/10 bg-stone-950 px-4 text-white lg:hidden">
        <button
          ref={triggerRef}
          type="button"
          onClick={() => setOpenedOn(pathname)}
          aria-label="Open admin navigation"
          aria-expanded={open}
          aria-haspopup="dialog"
          className="-ml-2 inline-flex size-11 cursor-pointer items-center justify-center rounded-md hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-moss-300 focus-visible:outline-none"
        >
          <span aria-hidden className="space-y-1">
            <span className="block h-0.5 w-5 bg-current" />
            <span className="block h-0.5 w-5 bg-current" />
            <span className="block h-0.5 w-5 bg-current" />
          </span>
        </button>
        <span className="font-display text-base">{BRAND.name}</span>
        <span className="text-[10px] tracking-[0.2em] text-moss-300 uppercase">Admin</span>
      </div>

      {open && (
        <div
          className="fixed inset-0 z-(--z-drawer) lg:hidden"
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
        >
          <h2 id={titleId} className="sr-only">
            Admin navigation
          </h2>
          <button
            type="button"
            aria-label="Close navigation"
            onClick={close}
            className="absolute inset-0 cursor-default bg-stone-950/70 motion-safe:animate-[fade-in_150ms_ease-out]"
          />
          <div
            ref={panelRef}
            className="absolute inset-y-0 left-0 w-72 max-w-[85vw] shadow-xl motion-safe:animate-[slide-in-left_200ms_ease-out]"
          >
            <button
              type="button"
              onClick={close}
              aria-label="Close navigation"
              className="absolute top-4 right-3 z-10 inline-flex size-11 cursor-pointer items-center justify-center rounded-md text-white hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-moss-300 focus-visible:outline-none"
            >
              <CrossIcon className="size-5" />
            </button>
            {children}
          </div>
        </div>
      )}
    </>
  )
}
