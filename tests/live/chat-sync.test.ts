import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * The customer's one chat poller (src/lib/chat/live-sync.ts): which consumer runs,
 * that only one request is in flight, and which timer applies when. The browser
 * pieces it leans on — presence and the ntfy stream — are replaced.
 */

const presence = { present: true }
const stream = { connected: false, subscribed: [] as string[], onPing: null as null | (() => void) }
vi.mock('@/lib/live/activity', () => ({
  IDLE_AFTER_MS: 180_000,
  isPresent: () => presence.present,
  onWake: () => () => {},
}))
vi.mock('@/lib/live/stream', () => ({
  streamConnected: () => stream.connected,
  reevaluateStreams: () => {},
  subscribeStream: (topic: string, sub: { onPing: () => void }) => {
    stream.subscribed.push(topic)
    stream.onPing = sub.onPing
    return () => {
      stream.subscribed = stream.subscribed.filter((t) => t !== topic)
    }
  },
}))

const sync = await import('@/lib/chat/live-sync')

describe('the shared customer chat poller', () => {
  const stops: (() => void)[] = []
  let hour = 0
  beforeEach(() => {
    vi.useFakeTimers()
    // Each test starts well clear of the previous one's last check.
    hour += 1
    vi.setSystemTime(Date.UTC(2030, 0, 1) + hour * 3_600_000)
    presence.present = true
    stream.connected = false
  })
  afterEach(() => {
    for (const stop of stops.splice(0)) stop()
    sync.setChatLiveTopic(null)
    vi.useRealTimers()
  })

  it('runs ONE consumer per check — the open panel over the badge watchers', async () => {
    const badgeA = vi.fn(async () => {})
    const badgeB = vi.fn(async () => {})
    const panel = vi.fn(async () => {})
    stops.push(sync.registerChatSync({ role: 'badge', run: badgeA }))
    await vi.advanceTimersByTimeAsync(0)
    // A second watcher mounting moments later does not ask again.
    stops.push(sync.registerChatSync({ role: 'badge', run: badgeB }))
    await vi.advanceTimersByTimeAsync(0)
    expect(badgeA).toHaveBeenCalledTimes(1)
    expect(badgeB).not.toHaveBeenCalled()

    stops.push(sync.registerChatSync({ role: 'open', run: panel }))
    await vi.advanceTimersByTimeAsync(0)
    expect(panel).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(sync.OPEN_MS)
    expect(panel).toHaveBeenCalledTimes(2)
    expect(badgeA).toHaveBeenCalledTimes(1)
  })

  it('never has two requests in flight, and a ping mid-request earns exactly one more', async () => {
    let release: () => void = () => {}
    const run = vi.fn(() => new Promise<void>((r) => (release = r)))
    stops.push(sync.registerChatSync({ role: 'open', run }))
    void sync.syncChat()
    void sync.syncChat()
    void sync.syncChat()
    expect(run).toHaveBeenCalledTimes(1)
    release()
    await vi.advanceTimersByTimeAsync(0)
    expect(run).toHaveBeenCalledTimes(2)
    release()
    await vi.advanceTimersByTimeAsync(0)
    expect(run).toHaveBeenCalledTimes(2)
  })

  it('chooses its timer from the stream and presence', () => {
    stops.push(sync.registerChatSync({ role: 'badge', run: async () => {} }))
    expect(sync.nextDelay()).toBe(sync.BADGE_MS)
    stream.connected = true
    expect(sync.nextDelay()).toBe(sync.SAFETY_MS)
    presence.present = false
    expect(sync.nextDelay()).toBeNull()

    let hidden = true
    stops.push(sync.registerChatSync({ role: 'open', run: async () => {}, keepWhileHidden: () => hidden }))
    presence.present = true
    expect(sync.nextDelay()).toBe(sync.OPEN_LIVE_MS)
    stream.connected = false
    expect(sync.nextDelay()).toBe(sync.OPEN_MS)
    presence.present = false
    expect(sync.nextDelay()).toBe(sync.HIDDEN_POLL_MS)
    stream.connected = true
    // The stream carries a hidden tab waiting for a reply; no timer.
    expect(sync.nextDelay()).toBeNull()
    hidden = false
    expect(sync.nextDelay()).toBeNull()
  })

  it('listens on the thread topic once known, and a push polls at once', async () => {
    const run = vi.fn(async () => {})
    stops.push(sync.registerChatSync({ role: 'badge', run }))
    await vi.advanceTimersByTimeAsync(0)
    sync.setChatLiveTopic('mlc-1')
    expect(stream.subscribed).toEqual(['mlc-1'])
    stream.onPing!()
    await vi.advanceTimersByTimeAsync(0)
    expect(run).toHaveBeenCalledTimes(2)
    sync.setChatLiveTopic(null)
    expect(stream.subscribed).toEqual([])
  })
})
