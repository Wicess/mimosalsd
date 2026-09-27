import { Suspense } from 'react'
import { CompanyEmailProvider } from '@/components/site/company-email'
import { getCompanyEmail } from '@/lib/site/company-email.server'
import { SiteHeader } from '@/components/layout/site-header'
import { SiteFooter } from '@/components/layout/site-footer'
import { DeferredUI } from '@/components/ui/deferred'
import { CartDrawer } from '@/components/commerce/cart-drawer'
import { MobileTabBar } from '@/components/layout/mobile-tab-bar'
import {
  CartDrawerContents,
  CartDrawerSkeleton,
} from '@/components/commerce/cart-drawer-contents'

/**
 * Storefront chrome.
 *
 * Lives in a route group so that `/admin` does NOT inherit it. It did at first, and
 * the consequences were not cosmetic: the age gate rendered over the admin panel and
 * blocked every click, so an operator could not verify an order without first
 * declaring their date of birth. The site header and footer rendered there too.
 *
 * A route group keeps the URLs identical while giving the two surfaces genuinely
 * separate shells.
 */
export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  // The company email, for client components that cannot await it (the error page,
  // the contact form's confirmation). Cached, so it costs nothing per request.
  const email = await getCompanyEmail()
  return (
    <CompanyEmailProvider email={email}>
      <SiteHeader />
      {/*
        Reserves a viewport while Suspense content streams, so the footer does not
        jump by the full height of the page when it arrives (measured at 0.348 CLS
        against a 0.1 budget before this was added).
      */}
      <div className="min-h-dvh">{children}</div>
      <SiteFooter />

      {/*
        Phones get a tab bar; desktop keeps the header. The count reads the cart
        cookie, so it is isolated behind its own Suspense boundary exactly as the
        header's copy is — the bar itself stays prerenderable.
      */}
      <Suspense fallback={null}>
        <MobileTabBar />
      </Suspense>
      {/*
        The drawer's contents read the cart cookie, so they MUST sit behind Suspense.
        Reached directly from the layout body, that one `cookies()` call would opt
        every storefront route out of prerendering — the same trap the product page
        hit before its purchase panel was split out.
      */}
      <CartDrawer>
        <Suspense fallback={<CartDrawerSkeleton />}>
          <CartDrawerContents />
        </Suspense>
      </CartDrawer>
      <DeferredUI />
    </CompanyEmailProvider>
  )
}
