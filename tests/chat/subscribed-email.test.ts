import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * Owner, 2026-11-03: a visitor who already subscribed is not asked for their email in
 * the chat. The address comes from their own sign-up, and only while they are still
 * on the list.
 */

const findActivity = vi.fn()
const findSubscriber = vi.fn()

vi.mock('server-only', () => ({}))
vi.mock('@/lib/db/client', () => ({
  db: {
    visitorActivity: { findFirst: (...args: unknown[]) => findActivity(...args) },
    newsletterSubscriber: { findUnique: (...args: unknown[]) => findSubscriber(...args) },
  },
}))

const { subscribedEmail } = await import('@/lib/chat/subscribed-email')

describe('subscribedEmail', () => {
  beforeEach(() => {
    findActivity.mockReset()
    findSubscriber.mockReset()
  })

  it('returns the address this browser subscribed with while it is active', async () => {
    findActivity.mockResolvedValue({ detail: ' Dyer@Example.com ' })
    findSubscriber.mockResolvedValue({ isActive: true })
    await expect(subscribedEmail('visitor-1')).resolves.toBe('dyer@example.com')
    expect(findActivity.mock.calls[0][0].where).toMatchObject({ visitorId: 'visitor-1', kind: 'SUBSCRIBED' })
  })

  it('asks again once the address has unsubscribed', async () => {
    findActivity.mockResolvedValue({ detail: 'dyer@example.com' })
    findSubscriber.mockResolvedValue({ isActive: false })
    await expect(subscribedEmail('visitor-1')).resolves.toBeNull()
  })

  it('asks when this browser never subscribed, or has no visitor cookie', async () => {
    findActivity.mockResolvedValue(null)
    await expect(subscribedEmail('visitor-1')).resolves.toBeNull()
    await expect(subscribedEmail(null)).resolves.toBeNull()
    expect(findActivity).toHaveBeenCalledTimes(1)
  })

  it('falls back to asking when the database fails', async () => {
    findActivity.mockRejectedValue(new Error('down'))
    await expect(subscribedEmail('visitor-1')).resolves.toBeNull()
  })
})
