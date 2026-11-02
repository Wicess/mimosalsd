'use client'

import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { isPresent, markPresent, onWake } from '@/lib/live/activity'

/**
 * Keeps a live admin page current without a hard reload — and lets the database sleep.
 *
 * Ported from WHAM, where this pattern was arrived at the expensive way. The naive
 * version of this component is four lines and a `setInterval`, and it is the single
 * most costly thing you can put in an admin panel: Neon bills by how long the database
 * stays awake and only suspends after ~5 minutes with ZERO queries. An operator who
 * leaves a dashboard open on a second monitor pins it awake around the clock, paying
 * to re-render a table nobody is looking at.
 *
 * So the refresh is gated on the operator actually being there. It fires only while
 * the tab is BOTH visible AND recently interacted with. Walk away and it stops, the
 * queries stop, and the database is allowed to scale to zero; the next click,
 * keypress, touch, wheel or return to the tab wakes it and pulls current data
 * immediately.
 *
 * `router.refresh()` rather than `location.reload()`: it re-fetches the RSC payload
 * and reconciles in place, so scroll position and open `<details>` survive.
 *
 * DO NOT put this on a storefront page. It exists to keep an operator's queue honest,
 * not to add background traffic to customer pages. And do not add it to a page that
 * does not actually change on its own — /admin/errors and /admin/newsletter are read
 * when you go looking, and they say so in their own comments.
 */
export function AutoRefresh({
  /** Seconds between refreshes while the operator is active. */
  intervalSeconds = 45,
  /** Stop refreshing after this long with no interaction at all. */
  idleAfterSeconds = 60,
}: {
  intervalSeconds?: number
  idleAfterSeconds?: number
}) {
  const router = useRouter()
  // A wake and the interval can land in the same instant. One refresh per window is plenty.
  const lastRefreshRef = useRef(0)

  useEffect(() => {
    const MIN_GAP_MS = 3000
    const idleMs = Math.max(30, idleAfterSeconds) * 1000

    // Mounting counts as being present, so the first interval tick is allowed.
    markPresent()

    const refresh = () => {
      const now = Date.now()
      if (now - lastRefreshRef.current < MIN_GAP_MS) return
      lastRefreshRef.current = now
      router.refresh()
    }

    const tick = () => {
      // Hidden tab, or nobody home. Either way, let the database sleep.
      if (!isPresent(idleMs)) return
      refresh()
    }

    const id = window.setInterval(tick, Math.max(5, intervalSeconds) * 1000)

    /*
      Returning to the tab, or the first click, key, touch or wheel after going idle,
      earns an immediate refresh. Activity is lib/live/activity's: NOT scroll (an
      auto-moving carousel scrolls forever with nobody there) and not mouse movement.
    */
    const stopWake = onWake(refresh, idleMs)

    return () => {
      window.clearInterval(id)
      stopWake()
    }
  }, [router, intervalSeconds, idleAfterSeconds])

  return null
}
