import { IDLE_AFTER_MS, isPresent, onWake } from '@/lib/live/activity'
import { reevaluateStreams, streamConnected, subscribeStream } from '@/lib/live/stream'

/**
 * The customer's ONE chat poller. Browser-only.
 *
 * Several things on a page want to know when the shop has written: the open chat
 * panel (the conversation itself), and the unread badges with their notification
 * (the watcher, mounted by the site shell and again by the profile frame). They used
 * to run their own timers. Now each registers here, and one loop serves them all:
 * whenever a check is due, the most important consumer runs — the open panel if
 * there is one, otherwise a badge watcher — and only one request is ever in flight.
 *
 * WHEN a check is due, cheapest first:
 *
 *   · a push arrives on the thread's ntfy topic (lib/live/push.ts) → at once
 *   · coming back to the tab, or the first touch after 3 idle minutes → at once
 *   · while the push stream is connected and someone is here:
 *       open panel  → every 25s, the presence heartbeat that keeps the operator's
 *                     "active now" dot honest (ONLINE_WINDOW_MS is 45s)
 *       badges only → every 15 minutes, a safety net in case a push went missing
 *   · without the stream (no topic yet, blocked, ntfy down) — the previous timers:
 *       open panel  → every 3s; badges → every 60s
 *   · hidden or idle: nothing at all — except an open panel whose customer turned
 *     reply notifications on, which keeps listening (the stream, or failing that a
 *     30s poll) for ten minutes after their last touch, so a reply they are waiting
 *     for can still reach them.
 */

export type ChatSyncRole = 'open' | 'badge'

export interface ChatSyncConsumer {
  readonly role: ChatSyncRole
  readonly run: () => Promise<void>
  /** True while this consumer wants pushes even though the tab is hidden. */
  readonly keepWhileHidden?: () => boolean
}

export const OPEN_MS = 3000
export const OPEN_LIVE_MS = 25_000
export const BADGE_MS = 60_000
export const SAFETY_MS = 15 * 60_000
export const HIDDEN_POLL_MS = 30_000
/** A second badge watcher mounting right after the first does not ask again. */
const REMOUNT_GAP_MS = 5000

const consumers: ChatSyncConsumer[] = []
let topic: string | null = null
let stopStream: (() => void) | null = null
let stopWake: (() => void) | null = null
let timer: ReturnType<typeof setTimeout> | undefined
let inFlight = false
let again = false
let lastRunAt = 0

function lead(): ChatSyncConsumer | undefined {
  return consumers.find((c) => c.role === 'open') ?? consumers[0]
}

function keepWhileHidden(): boolean {
  return consumers.some((c) => c.keepWhileHidden?.() ?? false)
}

/** How long after the last check the next one is due, or null for "not until something happens". */
export function nextDelay(): number | null {
  const c = lead()
  if (!c) return null
  const live = streamConnected(topic)
  const present = isPresent(IDLE_AFTER_MS)
  if (c.role === 'open') {
    if (present) return live ? OPEN_LIVE_MS : OPEN_MS
    if (c.keepWhileHidden?.()) return live ? null : HIDDEN_POLL_MS
    return null
  }
  if (!present) return null
  return live ? SAFETY_MS : BADGE_MS
}

function schedule(): void {
  if (timer !== undefined) clearTimeout(timer)
  timer = undefined
  const d = nextDelay()
  if (d === null) return
  timer = setTimeout(
    () => {
      timer = undefined
      // A stream that gave up may be due another try; a hidden window may have expired.
      reevaluateStreams()
      if (nextDelay() === null) return
      void syncChat()
    },
    Math.max(0, lastRunAt + d - Date.now()),
  )
}

/** Check now (single-flight: a request asked for mid-flight runs once more after it). */
export async function syncChat(): Promise<void> {
  if (inFlight) {
    again = true
    return
  }
  const c = lead()
  if (!c) return
  inFlight = true
  lastRunAt = Date.now()
  try {
    await c.run()
  } catch {
    // The consumer handles its own errors; a throw must not stop the loop.
  } finally {
    inFlight = false
  }
  if (again) {
    again = false
    return syncChat()
  }
  schedule()
}

function connectStream(): void {
  stopStream?.()
  stopStream = null
  if (!topic || consumers.length === 0) return
  stopStream = subscribeStream(topic, {
    onPing: () => void syncChat(),
    onStatus: () => schedule(),
    keepWhileHidden,
  })
}

/** The thread's ntfy topic, as the last check reported it. Null forgets it. */
export function setChatLiveTopic(next: string | null | undefined): void {
  const value = next || null
  if (value === topic) return
  topic = value
  connectStream()
}

export function getChatLiveTopic(): string | null {
  return topic
}

export function registerChatSync(consumer: ChatSyncConsumer): () => void {
  consumers.push(consumer)
  if (consumers.length === 1) {
    stopWake = onWake(() => void syncChat(), IDLE_AFTER_MS)
    connectStream()
  }
  // An opening panel always loads at once. A badge watcher checks once per tab,
  // not once per component that happens to mount.
  if (consumer.role === 'open' || Date.now() - lastRunAt > REMOUNT_GAP_MS) void syncChat()
  else schedule()
  reevaluateStreams()

  return () => {
    const i = consumers.indexOf(consumer)
    if (i >= 0) consumers.splice(i, 1)
    if (consumers.length === 0) {
      stopWake?.()
      stopWake = null
      stopStream?.()
      stopStream = null
      if (timer !== undefined) clearTimeout(timer)
      timer = undefined
      return
    }
    schedule()
    reevaluateStreams()
  }
}

/** Tell the loop that a consumer's keepWhileHidden answer may have changed. */
export function chatSyncChanged(): void {
  reevaluateStreams()
  schedule()
}
