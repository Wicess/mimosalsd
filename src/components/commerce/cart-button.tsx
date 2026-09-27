'use client'

import { openCart } from '@/lib/cart/cart-ui'
import { CartIcon } from '@/components/ui/icon'
import { url } from '@/lib/seo/routes'

/**
 * Header cart control.
 *
 * Deliberately still an anchor to /cart. Opening the drawer is an enhancement layered
 * on top: without JavaScript, on a middle-click, or with modifier keys held, this
 * behaves like the ordinary link it looks like. Rendering a `<button>` here would
 * break "open in new tab" on a control that every shopper expects to be a link.
 *
 * `children` carries the server-rendered item count, so this file never reads the cart.
 */
export function CartButton({ children }: { children?: React.ReactNode }) {
  return (
    <a
      href={url.cart()}
      onClick={(event) => {
        // Let the browser handle any click that means "somewhere else, please".
        if (
          event.defaultPrevented ||
          event.metaKey ||
          event.ctrlKey ||
          event.shiftKey ||
          event.altKey ||
          event.button !== 0
        ) {
          return
        }
        event.preventDefault()
        openCart()
      }}
      className="relative inline-flex min-h-11 items-center gap-2 rounded-md px-3 text-sm text-foreground hover:bg-surface-sunken"
    >
      <CartIcon className="size-5" />
      <span className="sr-only">Cart</span>
      {children}
    </a>
  )
}
