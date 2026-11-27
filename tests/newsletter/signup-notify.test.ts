import { beforeEach, describe, expect, it, vi } from 'vitest'

const upsert = vi.fn().mockResolvedValue({})
vi.mock('@/lib/db/client', () => ({ db: { newsletterSubscriber: { upsert } } }))
const notify = vi.fn().mockResolvedValue(true)
vi.mock('@/lib/notify/ntfy', () => ({ notify }))
vi.mock('@/lib/observability/report-error', () => ({ reportError: vi.fn() }))
// The sign-up is also recorded as visitor activity; not what this test is about.
vi.mock('@/lib/visitors/record-activity', () => ({ recordActivity: vi.fn().mockResolvedValue(undefined) }))

const { subscribeToNewsletter } = await import('@/app/actions/newsletter')

function form(email: string) {
  const data = new FormData()
  data.set('email', email)
  data.set('consent', 'on')
  return data
}

describe('newsletter sign-up', () => {
  beforeEach(() => {
    upsert.mockClear()
    notify.mockClear()
  })

  it('adds the address without ringing the phone', async () => {
    await subscribeToNewsletter({}, form('New@Example.test'))
    expect(upsert.mock.calls[0]![0].create).toEqual({ email: 'new@example.test', source: 'account-page' })
    expect(notify).not.toHaveBeenCalled()
  })

  it('ignores a made-up source or a path that is not a path', async () => {
    const data = form('odd@example.test')
    data.set('source', 'admin')
    data.set('path', 'https://evil.test')
    await subscribeToNewsletter({}, data)
    expect(upsert.mock.calls[0]![0].create).toEqual({ email: 'odd@example.test', source: 'account-page' })
  })
})
