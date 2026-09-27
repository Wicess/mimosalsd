import { beforeEach, describe, expect, it, vi } from 'vitest'

const findUnique = vi.fn()
const upsert = vi.fn().mockResolvedValue({})
vi.mock('@/lib/db/client', () => ({ db: { newsletterSubscriber: { findUnique, upsert } } }))
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

describe('newsletter sign-up notification', () => {
  beforeEach(() => {
    findUnique.mockReset()
    notify.mockClear()
  })

  it('rings the orders topic for a new subscriber, with the newsletter page as the tap target', async () => {
    findUnique.mockResolvedValue(null)
    await subscribeToNewsletter({}, form('New@Example.test'))
    expect(notify).toHaveBeenCalledTimes(1)
    expect(notify.mock.calls[0]![0]).toMatchObject({ topic: 'signups', title: 'New newsletter subscriber' })
    expect(notify.mock.calls[0]![0].body).toContain('new@example.test')
    expect(notify.mock.calls[0]![0].clickUrl).toMatch(/\/admin\/newsletter$/)
  })

  it('says a pop-up sign-up came from the pop-up, and on which page', async () => {
    findUnique.mockResolvedValue(null)
    upsert.mockClear()
    const data = form('popup@example.test')
    data.set('source', 'site-popup')
    data.set('path', '/shop/amanita')
    await subscribeToNewsletter({}, data)
    expect(upsert.mock.calls[0]![0].create).toEqual({ email: 'popup@example.test', source: 'site-popup' })
    expect(notify.mock.calls[0]![0].body).toBe('popup@example.test signed up from the pop-up on /shop/amanita.')
  })

  it('ignores a made-up source or a path that is not a path', async () => {
    findUnique.mockResolvedValue(null)
    upsert.mockClear()
    const data = form('odd@example.test')
    data.set('source', 'admin')
    data.set('path', 'https://evil.test')
    await subscribeToNewsletter({}, data)
    expect(upsert.mock.calls[0]![0].create).toEqual({ email: 'odd@example.test', source: 'account-page' })
    expect(notify.mock.calls[0]![0].body).toBe('odd@example.test signed up from the account page.')
  })

  it('stays quiet when the address was already on the list', async () => {
    findUnique.mockResolvedValue({ id: 'sub_1' })
    await subscribeToNewsletter({}, form('known@example.test'))
    expect(notify).not.toHaveBeenCalled()
  })
})
