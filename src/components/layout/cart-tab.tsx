'use client'

import { openCart } from '@/lib/cart/cart-ui'
import { CartIcon } from '@/components/ui/icon'
import { tabClass, TabMarker } from '@/components/layout/tab-item'
import { url } from '@/lib/seo/routes'
import { cn } from '@/lib/utils'

/**
 * The one interactive tab.
 *
 * Still an anchor to /cart: opening the drawer is layered on top of a link that works
 * without JavaScript and survives a middle-click. Split out so the rest of the bar
 * can stay a Server Component — a client component in the layout would have taken the
 * whole storefront out of prerendering.
 */
export function CartTab({ active, children }: { active: boolean; children?: React.ReactNode }) {
  return (
    <a
      href={url.cart()}
      aria-current={active ? 'page' : undefined}
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
      className={tabClass(active)}
    >
      <span className="relative">
        <CartIcon className={cn('size-6', active && 'text-primary')} />
        {children}
      </span>
      <span className={cn(active && 'font-medium')}>Cart</span>
      {active && <TabMarker />}
    </a>
  )
}
