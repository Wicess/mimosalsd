'use client'

import { usePathname, useSearchParams } from 'next/navigation'
import { useEffect } from 'react'

/**
 * ─────────────────────────────────────────────────────────────────────────────
 *  BACK TO WHERE YOU WERE (owner, 2026-09-15).
 *
 *  Leave a page and come back, and it opens at the spot you left, on the site and
 *  in the admin panel alike. "Coming back" is either of:
 *
 *    - the browser's back or forward button, or a swipe;
 *    - a link to the page you were on just before this one (a list, then an item,
 *      then the list again from a breadcrumb or the sidebar).
 *
 *  Any other link opens its page at the top, as links do.
 *
 *  ── Why the browser does not already do this ──────────────────────────────
 *  It restores the position the moment the address changes, when the page coming
 *  back is still loading and too short to scroll that far, so it lands at the top.
 *  This takes over (`scrollRestoration = 'manual'`) and keeps putting the page back
 *  at the remembered spot as its content arrives, for up to four seconds. Any touch,
 *  wheel or key from the visitor stops it at once: nobody has their scroll taken away.
 *
 *  Positions, and the last two addresses, live in this tab's sessionStorage. Many
 *  of the site's links are plain anchors that load a whole new document, which
 *  starts this module over, so its memory has to outlive the document; it is gone
 *  when the tab closes. A link with a #fragment keeps its own target.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const STORE = 'sg-scroll'
const MAX_PAGES = 60
const GIVE_UP_MS = 4000
const SETTLE_MS = 350

const positions = new Map<string, number>()
/** The address whose scroll is being recorded. */
let current: string | null = null
/** The address before it: a link back here counts as coming back. */
let previous: string | null = null
/** False until this document has placed its first page. */
let booted = false
let loaded = false
/** Where the last back/forward is going, set before the router renders it. */
let traversingTo: string | null = null
let restoring = false
let frame = 0
let saveTimer: ReturnType<typeof setTimeout> | undefined

const here = () => window.location.pathname + window.location.search

function load() {
  // Once per document: a second read would put back a trail this document has moved on from.
  if (loaded) return
  loaded = true
  try {
    const stored = JSON.parse(sessionStorage.getItem(STORE) ?? '{}') as { at?: Record<string, unknown>; trail?: unknown }
    for (const [key, y] of Object.entries(stored.at ?? {})) {
      if (typeof y === 'number' && Number.isFinite(y)) positions.set(key, y)
    }
    const trail = Array.isArray(stored.trail) ? stored.trail : []
    previous = typeof trail[0] === 'string' ? trail[0] : null
    current = typeof trail[1] === 'string' ? trail[1] : null
  } catch {
    // Storage blocked or unreadable: remember for this document's life only.
  }
}

function persist() {
  clearTimeout(saveTimer)
  try {
    sessionStorage.setItem(STORE, JSON.stringify({ at: Object.fromEntries(positions), trail: [previous, current] }))
  } catch {
    // Storage full or blocked: positions still work until the tab reloads.
  }
}

function remember(key: string, y: number) {
  positions.delete(key)
  positions.set(key, Math.max(0, Math.round(y)))
  while (positions.size > MAX_PAGES) positions.delete(positions.keys().next().value as string)
  clearTimeout(saveTimer)
  saveTimer = setTimeout(persist, 300)
}

function stop() {
  restoring = false
  cancelAnimationFrame(frame)
}

/** Hold the page at `y` while its content loads in, until it stays there or time is up. */
function restore(y: number) {
  stop()
  restoring = true
  const started = performance.now()
  let steadySince = 0
  const tick = () => {
    if (!restoring) return
    const room = Math.max(0, document.documentElement.scrollHeight - window.innerHeight)
    const target = Math.min(y, room)
    if (Math.abs(window.scrollY - target) > 1) window.scrollTo({ top: target, behavior: 'instant' })
    const now = performance.now()
    const arrived = room >= y - 1 && Math.abs(window.scrollY - y) <= 2
    steadySince = arrived ? steadySince || now : 0
    if ((arrived && now - steadySince >= SETTLE_MS) || now - started >= GIVE_UP_MS) {
      stop()
      if (current) remember(current, window.scrollY)
      return
    }
    frame = requestAnimationFrame(tick)
  }
  frame = requestAnimationFrame(tick)
}

export function ScrollMemory() {
  const pathname = usePathname()
  const search = useSearchParams().toString()

  useEffect(() => {
    load()
    const before = window.history.scrollRestoration
    window.history.scrollRestoration = 'manual'

    let queued = false
    const onScroll = () => {
      if (queued) return
      queued = true
      requestAnimationFrame(() => {
        queued = false
        // Between an address changing and its page arriving, the scroll belongs to neither.
        if (restoring || !booted || !current || here() !== current) return
        remember(current, window.scrollY)
      })
    }
    const onPopState = () => {
      traversingTo = here()
    }
    const onInput = () => {
      if (restoring) stop()
    }
    const inputs = ['wheel', 'touchstart', 'pointerdown', 'keydown'] as const

    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('popstate', onPopState)
    window.addEventListener('pagehide', persist)
    for (const type of inputs) window.addEventListener(type, onInput, { passive: true })
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('popstate', onPopState)
      window.removeEventListener('pagehide', persist)
      for (const type of inputs) window.removeEventListener(type, onInput)
      // A restore in flight is left to finish: React re-runs this effect in development.
      window.history.scrollRestoration = before
    }
  }, [])

  useEffect(() => {
    const key = pathname + (search ? `?${search}` : '')
    if (booted && key === current) return

    let comingBack: boolean
    if (booted) {
      comingBack = traversingTo === key || key === previous
    } else {
      // A new document: a reload, back or forward into it, or a plain link back to the page before.
      const entry = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined
      comingBack = entry?.type === 'reload' || entry?.type === 'back_forward' || key === previous
    }
    if (key !== current) {
      previous = current
      current = key
    }
    booted = true
    traversingTo = null
    persist()

    if (comingBack && !window.location.hash) restore(positions.get(key) ?? 0)
  }, [pathname, search])

  return null
}
