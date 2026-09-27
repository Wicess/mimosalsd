'use client'

import { useEffect, useSyncExternalStore } from 'react'
import {
  getCartCount,
  getCartCountServerSnapshot,
  setCartCount,
  subscribeCartCount,
} from '@/lib/cart/cart-count-store'

/**
 * The number on a cart icon. `initial` is the count the server read from the cart
 * cookie; a cart action that has since reported a newer count wins until the server
 * renders again, at which point the server's number is the truth once more — so a
 * cart emptied by placing an order cannot leave a stale number behind.
 */
export function CartBadge({ initial }: { initial: number }) {
  const live = useSyncExternalStore(subscribeCartCount, getCartCount, getCartCountServerSnapshot)

  useEffect(() => {
    setCartCount(null)
  }, [initial])

  const count = live ?? initial
  if (count <= 0) return null

  /*
    `text-on-accent`, not `text-accent-fg`. The two names read alike and mean
    opposite things: `accent-fg` is accent-coloured TEXT for a plain background, and
    in the dark theme it is the exact gold of `bg-accent` (#e6d283 on #e6d283), so
    the count vanished into its own badge. `on-accent` is the token for text on the
    gold, near-black in both themes.

    The ring, in the colour of the bar behind it, separates the badge from the cart
    icon's strokes where they meet.
  */
  return (
    <span
      className="tabular absolute -right-0.5 -top-0.5 inline-flex min-w-5 items-center justify-center rounded-full bg-accent px-1.5 text-xs font-semibold leading-5 text-on-accent ring-2 ring-surface"
      aria-hidden
    >
      {count > 99 ? '99+' : count}
    </span>
  )
}
