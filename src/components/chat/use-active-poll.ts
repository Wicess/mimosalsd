'use client'

import { useEffect, useRef } from 'react'
import { isPresent, onWake } from '@/lib/live/activity'
import { streamConnected, subscribeStream } from '@/lib/live/stream'

/**
 * Run `poll` on a timer — but only while somebody is actually there, and, when a
 * push topic is given, mostly not on a timer at all.
 *
 * The cost rule from ~/.claude/CLAUDE.md, as a hook: Neon bills for every minute the
 * database is awake and only sleeps after ~5 minutes with ZERO queries, so an inbox
 * left open on a second monitor that keeps polling is the single most expensive
 * thing an admin panel can do. This polls only while the tab is visible AND the
 * operator has touched the page in the last minute (the playbook's figure for an
 * inbox: three minutes of polling after the last touch kept the database up for
 * eight, counting Neon's own five before it suspends). Walk away and it stops;
 * the next click, keypress, touch, wheel or return to the tab fetches at once and
 * resumes. Scrolling and mouse movement do not count (lib/live/activity explains).
 *
 * `live` is an ntfy topic (lib/live/push.ts). While its shared stream is connected,
 * a push polls at once and the timer slows to `liveIntervalMs`; if the stream is
 * unavailable the timer simply carries on at `intervalMs`, as before.
 *
 * `poll`, `intervalMs` and `liveIntervalMs` are read through refs, so changing them —
 * a faster rate while the customer is typing — never tears down the loop. Changing
 * `key` does: it fetches immediately (when `immediate`) and restarts the timer, which
 * is how a new filter or search loads at once. `repeat: false` keeps the immediate
 * fetch but no timer and no pushes — a search result is a lookup, not a live feed.
 */
const IDLE_AFTER_MS = 60_000

export function useActivePoll(
  poll: () => Promise<void> | void,
  intervalMs: number,
  {
    enabled = true,
    repeat = true,
    immediate = false,
    key = '',
    live = null,
    liveIntervalMs = 15 * 60_000,
  }: {
    enabled?: boolean
    repeat?: boolean
    immediate?: boolean
    key?: string
    live?: string | null
    liveIntervalMs?: number
  } = {},
) {
  const pollRef = useRef(poll)
  const intervalRef = useRef(intervalMs)
  const liveIntervalRef = useRef(liveIntervalMs)
  const liveRef = useRef(live)
  // Set by the polling effect, used by the stream subscription below it.
  const triggerRef = useRef<(() => void) | null>(null)
  const rearmRef = useRef<(() => void) | null>(null)
  useEffect(() => {
    pollRef.current = poll
    intervalRef.current = intervalMs
    liveIntervalRef.current = liveIntervalMs
    liveRef.current = live
  }, [poll, intervalMs, liveIntervalMs, live])

  useEffect(() => {
    if (!enabled) return
    let cancelled = false
    let timer: number | undefined
    let inFlight = false
    let again = false
    let lastRun = Date.now()

    const run = async () => {
      // One request at a time: a slow response must not stack up behind the timer,
      // and a push that lands mid-request earns exactly one more.
      if (cancelled) return
      if (inFlight) {
        again = true
        return
      }
      inFlight = true
      lastRun = Date.now()
      try {
        await pollRef.current()
      } finally {
        inFlight = false
      }
      if (again && !cancelled) {
        again = false
        await run()
      }
    }

    if (immediate) void run()
    if (!repeat) {
      return () => {
        cancelled = true
      }
    }

    const due = () => (streamConnected(liveRef.current) ? liveIntervalRef.current : intervalRef.current)
    const arm = () => {
      if (cancelled) return
      if (timer) window.clearTimeout(timer)
      timer = window.setTimeout(tick, Math.max(0, lastRun + due() - Date.now()))
    }
    const tick = async () => {
      if (cancelled) return
      if (isPresent(IDLE_AFTER_MS)) await run()
      else lastRun = Date.now()
      arm()
    }
    arm()

    triggerRef.current = () => {
      void run().then(arm)
    }
    rearmRef.current = arm
    // Back from idle, or back to the tab, deserves an immediate catch-up.
    const stopWake = onWake(() => triggerRef.current?.(), IDLE_AFTER_MS)

    return () => {
      cancelled = true
      if (timer) window.clearTimeout(timer)
      triggerRef.current = null
      rearmRef.current = null
      stopWake()
    }
  }, [enabled, repeat, immediate, key])

  // The push stream: shared with every other hook on the same topic (one connection).
  useEffect(() => {
    if (!enabled || !repeat || !live) return
    return subscribeStream(live, {
      onPing: () => triggerRef.current?.(),
      onStatus: () => rearmRef.current?.(),
    })
  }, [enabled, repeat, live])
}
