import { IDLE_AFTER_MS, isPresent, onPresenceChange } from './activity'
import { LIVE_PUSH_ORIGIN } from './config'

/**
 * ONE EventSource per ntfy topic for the whole page, shared by every component that
 * cares (the chat panel, the unread badges, the inbox list and its open thread).
 * Browser-only. The server side is lib/live/push.ts.
 *
 * The stream is open only while somebody is here: visible, and touched in the last
 * three minutes. Hidden or idle, it closes, so a forgotten tab holds nothing open
 * anywhere. When they come back it reopens, and the subscribers do their own
 * catch-up poll (they hear about the return from lib/live/activity).
 *
 * A subscriber may ask to keep it open while hidden for a bounded time
 * (`keepWhileHidden`) — the chat panel does, for a customer who turned reply
 * notifications on and switched away to wait. That costs our servers nothing: the
 * connection is to ntfy.sh.
 *
 * Repeated failures (blocked by a network, ntfy down) give up for ten minutes and
 * report "not connected", and every subscriber falls back to its own timer.
 */

export interface StreamSubscriber {
  /** Something changed on the server: poll once. */
  readonly onPing: () => void
  /** Connected or not, so the subscriber can choose its timer. */
  readonly onStatus?: (connected: boolean) => void
  /** Keep the stream while the tab is hidden or idle, for as long as this returns true. */
  readonly keepWhileHidden?: () => boolean
}

const MAX_FAILURES = 3
const RETRY_AFTER_GIVE_UP_MS = 10 * 60_000
/** Re-check presence while open. Touches nothing but memory. */
const RECHECK_MS = 30_000
const REPLAY_SECONDS = 15

class Channel {
  private readonly subs = new Set<StreamSubscriber>()
  private source: EventSource | null = null
  private connected = false
  private everOpened = false
  private failures = 0
  private gaveUpAt = 0
  private recheck: number | undefined
  private stopPresence: (() => void) | null = null

  constructor(private readonly topic: string) {}

  get size() {
    return this.subs.size
  }

  get isConnected() {
    return this.connected
  }

  add(sub: StreamSubscriber) {
    this.subs.add(sub)
    if (!this.stopPresence) this.stopPresence = onPresenceChange(() => this.evaluate())
    this.evaluate()
  }

  remove(sub: StreamSubscriber) {
    this.subs.delete(sub)
    if (this.subs.size === 0) {
      this.stopPresence?.()
      this.stopPresence = null
    }
    this.evaluate()
  }

  private wanted(): boolean {
    if (this.subs.size === 0 || typeof EventSource === 'undefined') return false
    if (this.gaveUpAt) {
      if (Date.now() - this.gaveUpAt < RETRY_AFTER_GIVE_UP_MS) return false
      this.gaveUpAt = 0
      this.failures = 0
    }
    if (isPresent(IDLE_AFTER_MS)) return true
    for (const sub of this.subs) if (sub.keepWhileHidden?.()) return true
    return false
  }

  evaluate = () => {
    const want = this.wanted()
    if (want && !this.source) this.open()
    else if (!want && this.source) this.close()
  }

  private setConnected(next: boolean) {
    if (this.connected === next) return
    this.connected = next
    for (const sub of [...this.subs]) sub.onStatus?.(next)
  }

  private open() {
    /*
      `since` replays a ping published in the moments before the stream was up (the
      subscriber's catch-up poll and this connection race each other on a return to
      the tab). At worst it costs one extra poll; without it, a reply sent in that
      gap would wait for the safety poll.
    */
    const since = Math.floor(Date.now() / 1000) - REPLAY_SECONDS
    const source = new EventSource(`${LIVE_PUSH_ORIGIN}/${encodeURIComponent(this.topic)}/sse?since=${since}`)
    this.source = source
    this.everOpened = false
    source.onopen = () => {
      if (this.source !== source) return
      const reconnect = this.everOpened
      this.everOpened = true
      this.failures = 0
      this.setConnected(true)
      // A dropped connection may have missed a ping. One poll covers the gap.
      if (reconnect) this.ping()
    }
    source.onmessage = (event: MessageEvent<string>) => {
      if (this.source !== source) return
      // ntfy sends open/keepalive as their own event types; a default "message"
      // event is a publish. Parse defensively and treat anything else as a ping.
      try {
        const data = JSON.parse(event.data) as { event?: string }
        if (data.event && data.event !== 'message') return
      } catch {
        // Not JSON: still a nudge.
      }
      this.ping()
    }
    source.onerror = () => {
      if (this.source !== source) return
      this.setConnected(false)
      this.failures += 1
      // The browser retries on its own; past a few failures in a row, stop and let
      // the timers carry on.
      if (this.failures >= MAX_FAILURES || source.readyState === EventSource.CLOSED) {
        if (this.failures >= MAX_FAILURES) this.gaveUpAt = Date.now()
        this.close()
        if (!this.gaveUpAt) this.evaluate()
      }
    }
    this.recheck = window.setInterval(this.evaluate, RECHECK_MS)
  }

  private close() {
    this.source?.close()
    this.source = null
    if (this.recheck !== undefined) window.clearInterval(this.recheck)
    this.recheck = undefined
    this.setConnected(false)
  }

  private ping() {
    for (const sub of [...this.subs]) sub.onPing()
  }
}

const channels = new Map<string, Channel>()

/** Listen on `topic`. Returns the unsubscribe. */
export function subscribeStream(topic: string, sub: StreamSubscriber): () => void {
  let channel = channels.get(topic)
  if (!channel) {
    channel = new Channel(topic)
    channels.set(topic, channel)
  }
  const ch = channel
  ch.add(sub)
  return () => {
    ch.remove(sub)
    if (ch.size === 0 && channels.get(topic) === ch) channels.delete(topic)
  }
}

export function streamConnected(topic: string | null | undefined): boolean {
  return Boolean(topic && channels.get(topic)?.isConnected)
}

/** Re-evaluate whether streams should be open (e.g. a keepWhileHidden answer changed). */
export function reevaluateStreams(): void {
  for (const ch of channels.values()) ch.evaluate()
}
