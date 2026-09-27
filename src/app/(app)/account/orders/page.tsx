import type { Metadata } from 'next'
import { Suspense } from 'react'
import { ProfileFrame } from '@/components/account/profile-frame'
import { ProfileOrders } from '@/components/account/profile-orders'
import { ordersForThisBrowser } from '@/lib/account/my-orders'

export const metadata: Metadata = {
  title: 'Your orders',
  robots: { index: false, follow: false },
}

async function Orders() {
  return <ProfileOrders initial={await ordersForThisBrowser()} />
}

/** The profile's orders: shown straight away, with no sign-in (see lib/account/my-orders.ts). */
export default function ProfileOrdersPage() {
  return (
    <ProfileFrame current="orders">
      <h1 className="font-display text-3xl text-foreground">Your orders</h1>
      <p className="mt-1 text-sm text-foreground-muted">Every order from this device, newest first. Tap one for its payment details and tracking.</p>
      <div className="mt-5">
        <Suspense fallback={<div className="h-40 animate-pulse rounded-2xl bg-surface-sunken motion-reduce:animate-none" aria-hidden />}>
          <Orders />
        </Suspense>
      </div>
    </ProfileFrame>
  )
}
