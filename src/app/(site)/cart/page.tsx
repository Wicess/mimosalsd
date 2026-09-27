import type { Metadata } from 'next'
import { PageSection } from '@/components/layout/page-section'
import { Suspense } from 'react'
import { CartContents } from '@/components/commerce/cart-contents'

export const metadata: Metadata = {
  title: 'Your cart',
  // No search intent, and it would dilute crawl budget. Crawlable for link equity.
  robots: { index: false, follow: true },
}

function CartSkeleton() {
  return (
    <div className="grid animate-pulse gap-8 lg:grid-cols-[1fr_22rem]" aria-hidden>
      <div className="h-64 rounded-lg bg-surface-sunken" />
      <div className="h-80 rounded-lg bg-surface-sunken" />
    </div>
  )
}

export default function CartPage() {
  return (
    <main>
      {/* One band, not several. A cart is a single task; ruling it into pieces would separate the lines from the total they add up to. */}
      <PageSection first>
      <h1 className="font-display text-4xl text-foreground">Your cart</h1>
      <p className="mt-2 max-w-4xl text-foreground-muted">
        We check what we can legally ship to you here — before checkout, not after.
      </p>

      <div className="mt-8">
        <Suspense fallback={<CartSkeleton />}>
          <CartContents />
        </Suspense>
      </div>
      </PageSection>
    </main>
  )
}
