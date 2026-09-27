import { headers } from 'next/headers'
import { Suspense } from 'react'
import { CartTab } from '@/components/layout/cart-tab'
import { ChatTab } from '@/components/layout/chat-tab'
import { CartCount } from '@/components/commerce/cart-count'
import { tabClass, TabMarker } from '@/components/layout/tab-item'
import { GridIcon, HomeIcon } from '@/components/ui/icon'
import { url } from '@/lib/seo/routes'
import { cn } from '@/lib/utils'

/**
 * Bottom tab bar. Phones only.
 *
 * The storefront's primary navigation lived in a header that, at 375px, collapsed to
 * a logo and a single "Shop" link — everything else was a scroll away in the footer.
 * A tab bar puts the destinations a shopper actually moves between within thumb reach
 * and never scrolls away, which is what the apps this was modelled on do.
 *
 * Five items — the platform ceiling. It was held at four because this site had no
 * fifth destination worth permanent screen space; live chat is that destination, and
 * on a phone it cannot be a floating bubble without covering the sticky Add-to-Cart.
 *
 * A SERVER component. The obvious build — a client component calling `usePathname()`
 * — compiles and then fails the production build on every route: under Cache
 * Components that hook is runtime-only data, so a layout-level component using it
 * blocks prerendering site-wide. The proxy already writes the path to `x-pathname`
 * for the admin shell, so the active tab is resolved here with no client JavaScript
 * at all. Only the cart tab is interactive, and only because it opens the drawer.
 */
const TABS = [
  { href: url.home(), label: 'Home', Icon: HomeIcon },
  { href: url.shop(), label: 'Shop', Icon: GridIcon },
] as const

export async function MobileTabBar() {
  const pathname = (await headers()).get('x-pathname') ?? '/'

  return (
    <nav
      aria-label="Primary"
      // Blurred for the same reason as the buy bar above it: 95% alpha alone let page
      // content read through the navigation.
      className="fixed inset-x-0 bottom-0 z-(--z-sticky) border-t border-border bg-surface/95 backdrop-blur-[10px] md:hidden"
      // Keeps the row clear of the home indicator on a gesture-navigation phone.
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <ul className="flex">
        {TABS.map(({ href, label, Icon }) => {
          /*
           * Home matches only itself; everything else matches its subtree, so
           * /shop/amanita still lights up "Shop". Without the exact case, Home would
           * be active everywhere, since every path starts with "/".
           */
          const active = href === '/' ? pathname === '/' : pathname.startsWith(href)
          return (
            <li key={label} className="flex-1">
              <a href={href} aria-current={active ? 'page' : undefined} className={tabClass(active)}>
                <Icon className={cn('size-6', active && 'text-primary')} />
                <span className={cn(active && 'font-medium')}>{label}</span>
                {active && <TabMarker />}
              </a>
            </li>
          )
        })}

        <li className="flex-1">
          <ChatTab />
        </li>
        <li className="flex-1">
          <CartTab active={pathname.startsWith(url.cart())}>
            <Suspense fallback={null}>
              <CartCount />
            </Suspense>
          </CartTab>
        </li>
      </ul>
    </nav>
  )
}
