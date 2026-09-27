import { afterEach, describe, expect, it, vi } from 'vitest'
import { getUnread, setUnread, subscribeUnread } from '@/lib/chat/unread-store'

describe('the unread count behind the chat and profile badges', () => {
  afterEach(() => setUnread(0))

  it('never goes below zero or fractional, and tells subscribers only on a change', () => {
    const heard = vi.fn()
    const stop = subscribeUnread(heard)
    setUnread(3)
    setUnread(3)
    setUnread(-4)
    setUnread(2.7)
    stop()
    expect(heard).toHaveBeenCalledTimes(3)
    expect(getUnread()).toBe(2)
  })
})

describe('GET /api/chat/unread', () => {
  afterEach(() => {
    vi.resetModules()
    vi.doUnmock('@/lib/chat/core')
  })

  it('reports the thread’s unread count, and nothing for a visitor with no conversation', async () => {
    const findThread = vi.fn()
    vi.doMock('@/lib/chat/core', () => ({ visitorId: async () => 'v', findThread }))
    const { GET } = await import('@/app/api/chat/unread/route')

    findThread.mockResolvedValueOnce({ unreadForCustomer: 4 })
    expect(await (await GET()).json()).toEqual({ unread: 4, hasThread: true })

    findThread.mockResolvedValueOnce(null)
    const none = await GET()
    expect(await none.json()).toEqual({ unread: 0, hasThread: false })
    expect(none.headers.get('cache-control')).toBe('no-store')
  })
})
