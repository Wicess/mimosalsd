import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * The live-chat pings (src/lib/live/push.ts): an unguessable per-thread topic derived
 * from the server secret, and a content-free publish to ntfy.sh after the response.
 * Nothing here reaches the network: fetch and next/server's `after` are replaced.
 */

const scheduled: (() => unknown)[] = []
let afterThrows = false
vi.mock('next/server', () => ({
  after: (fn: () => unknown) => {
    if (afterThrows) throw new Error('`after` was called outside a request scope')
    scheduled.push(fn)
  },
}))

const SECRET = 'x'.repeat(48)
const { threadTopic, staffTopic, publishPing, pingThread, pingThreads, pingStaff } = await import('@/lib/live/push')

describe('the ntfy topics', () => {
  it('are a short prefix and 40 hex characters, stable for a thread and different between threads', () => {
    const a = threadTopic('thread-a', SECRET)!
    expect(a).toMatch(/^mlc-[0-9a-f]{40}$/)
    expect(threadTopic('thread-a', SECRET)).toBe(a)
    expect(threadTopic('thread-b', SECRET)).not.toBe(a)
    // A different secret moves every topic.
    expect(threadTopic('thread-a', 'y'.repeat(48))).not.toBe(a)
    // The id itself never appears in the name.
    expect(a).not.toContain('thread-a')
    expect(a.length).toBeLessThanOrEqual(64)
  })

  it('give the inbox its own topic, never a thread topic', () => {
    const staff = staffTopic(SECRET)!
    expect(staff).toMatch(/^mls-[0-9a-f]{40}$/)
    expect(staff.slice(4)).not.toBe(threadTopic('', SECRET))
  })

  it('are null without a secret of at least 32 characters', () => {
    vi.stubEnv('ADMIN_SESSION_SECRET', 'short')
    expect(threadTopic('thread-a')).toBeNull()
    expect(staffTopic()).toBeNull()
    expect(threadTopic('thread-a', null)).toBeNull()
    vi.unstubAllEnvs()
  })
})

describe('publishing a ping', () => {
  const fetchMock = vi.fn(async () => new Response('{}'))
  beforeEach(() => {
    scheduled.length = 0
    afterThrows = false
    fetchMock.mockClear()
    vi.stubGlobal('fetch', fetchMock)
    vi.stubEnv('ADMIN_SESSION_SECRET', SECRET)
    vi.stubEnv('NTFY_TOKEN', '')
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
  })

  it('POSTs the bare word "sync" to ntfy.sh/<topic>: no message text, no thread id', async () => {
    await publishPing('mlc-abc')
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('https://ntfy.sh/mlc-abc')
    expect(init.method).toBe('POST')
    expect(init.body).toBe('sync')
    expect((init.headers as Record<string, string>).Firebase).toBe('no')
    expect((init.headers as Record<string, string>).Authorization).toBeUndefined()
  })

  it('uses the owner’s ntfy token when one is set', async () => {
    vi.stubEnv('NTFY_TOKEN', 'tk_test')
    await publishPing('mlc-abc')
    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer tk_test')
  })

  it('swallows every failure', async () => {
    fetchMock.mockRejectedValueOnce(new Error('ntfy is down'))
    await expect(publishPing('mlc-abc')).resolves.toBeUndefined()
  })

  it('waits for the response: nothing is sent until after() runs', async () => {
    pingThread('thread-a')
    expect(fetchMock).not.toHaveBeenCalled()
    expect(scheduled).toHaveLength(1)
    await scheduled[0]!()
    const [url] = fetchMock.mock.calls[0] as unknown as [string]
    expect(url).toBe(`https://ntfy.sh/${threadTopic('thread-a', SECRET)}`)
  })

  it('rings the staff topic for customer activity', async () => {
    pingStaff()
    await scheduled[0]!()
    const [url] = fetchMock.mock.calls[0] as unknown as [string]
    expect(url).toBe(`https://ntfy.sh/${staffTopic(SECRET)}`)
  })

  it('caps a bulk delete at 25 pings, deduplicated', async () => {
    pingThreads([...Array.from({ length: 40 }, (_, i) => `t${i}`), 't0'])
    await scheduled[0]!()
    expect(fetchMock).toHaveBeenCalledTimes(25)
  })

  it('sends nothing when unconfigured, or outside a request', () => {
    vi.stubEnv('ADMIN_SESSION_SECRET', '')
    pingThread('thread-a')
    expect(scheduled).toHaveLength(0)
    vi.stubEnv('ADMIN_SESSION_SECRET', SECRET)
    afterThrows = true
    expect(() => pingStaff()).not.toThrow()
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
