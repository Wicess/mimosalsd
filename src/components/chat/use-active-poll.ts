'use client'

import { useEffect, useRef } from 'react'

/**
 * Run `poll` on a timer — but only while somebody is actually there.
 *
 * The cost rule from ~/.claude/CLAUDE.md, as a hook: Neon bills for every minute the
 * database is awake and only sleeps after ~5 minutes with ZERO queries, so an inbox
 * left open on a second monitor that keeps polling is the single most expensive
 * thing an admin panel can do. This polls only while the tab is visible AND the
 * operator has touched the page in the last three minutes. Walk away and it stops;
 * the next mouse move, keypress or return to the tab fetches at once and resumes.
 *
 * `poll` and `intervalMs` are read through refs, so changing them — a faster rate
 * while the customer is typing — never tears down the loop. Changing `key` does: it
 * fetches immediately (when `immediate`) and restarts the timer, which is how a new
 * filter or search loads at once. `repeat: false` keeps the immediate fetch but no
 * timer — a search result is a lookup, not a live feed.
 */
const IDLE_AFTER_MS = 3 * 60_000

export function useActivePoll(
  poll: () => Promise<void> | void,
  intervalMs: number,
  {
    enabled = true,
    repeat = true,
    immediate = false,
    key = '',
  }: { enabled?: boolean; repeat?: boolean; immediate?: boolean; key?: string } = {},
) {
  const pollRef = useRef(poll)
  const intervalRef = useRef(intervalMs)
  useEffect(() => {
    pollRef.current = poll
    intervalRef.current = intervalMs
  }, [poll, intervalMs])

  useEffect(() => {
    if (!enabled) return
    let cancelled = false
    let timer: number | undefined
    let lastActivity = Date.now()
    let inFlight = false

    const run = async () => {
      // One request at a time: a slow response must not stack up behind the timer.
      if (inFlight || cancelled) return
      inFlight = true
      try {
        await pollRef.current()
      } finally {
        inFlight = false
      }
    }

    if (immediate) void run()
    if (!repeat) {
      return () => {
        cancelled = true
      }
    }

    const tick = async () => {
      if (cancelled) return
      const visible = document.visibilityState === 'visible'
      const active = Date.now() - lastActivity < IDLE_AFTER_MS
      if (visible && active) await run()
      if (!cancelled) timer = window.setTimeout(tick, intervalRef.current)
    }
    timer = window.setTimeout(tick, intervalRef.current)

    const markActive = () => {
      const wasIdle = Date.now() - lastActivity >= IDLE_AFTER_MS
      lastActivity = Date.now()
      // Back from idle deserves an immediate catch-up, not a wait for the next tick.
      if (wasIdle) void run()
    }
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return
      lastActivity = Date.now()
      void run()
    }

    const ACTIVITY = ['pointerdown', 'pointermove', 'keydown', 'touchstart', 'wheel'] as const
    for (const event of ACTIVITY) window.addEventListener(event, markActive, { passive: true })
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', onVisible)

    return () => {
      cancelled = true
      if (timer) window.clearTimeout(timer)
      for (const event of ACTIVITY) window.removeEventListener(event, markActive)
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', onVisible)
    }
  }, [enabled, repeat, immediate, key])
}
