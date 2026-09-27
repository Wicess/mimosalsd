import type { Metadata } from 'next'
import { BRAND } from '@/lib/brand'

export const metadata: Metadata = {
  title: 'Offline',
  robots: { index: false, follow: false },
}

/**
 * Shown when a page is asked for and there is no network. The service worker
 * keeps this one page, and only this one: everything else must come from the
 * server, because what may lawfully ship changes in the admin.
 *
 * Static and self-contained — no data, no images, no fonts to fetch — since by
 * definition nothing can be fetched when it is needed.
 */
export default function OfflinePage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-5 py-16">
      <p className="text-xs font-medium tracking-[0.2em] text-foreground-subtle uppercase">{BRAND.name}</p>
      <h1 className="mt-3 font-display text-3xl text-foreground">No connection</h1>
      <div className="mt-4 space-y-4 text-base leading-relaxed text-foreground-muted">
        <p>
          This page needs the internet, and there is none right now. Nothing you were doing has been
          lost — your cart is kept on this device.
        </p>
        <p>
          Try again when you are back on a connection. Prices, stock and where we can ship are
          always read live, which is why none of it is stored here to show you now.
        </p>
      </div>
    </main>
  )
}
