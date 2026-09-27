import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * ─────────────────────────────────────────────────────────────────────────────
 *  WHICH POOL A CUSTOMER IS ACTUALLY PAID FROM.
 *
 *  Admin → Payments added, listed and burned handles in a table that nothing read.
 *  An operator who put their real Cash App handle in the pool watched it appear in
 *  the list and reasonably believed customers were being given it. They were not:
 *  the order page resolved from PAYMENT_HANDLES_* environment variables, so
 *  burning a compromised handle changed nothing at all.
 *
 *  These lock the table in as the source, and the environment in as the fallback.
 * ─────────────────────────────────────────────────────────────────────────────
 */
const findMany = vi.fn()
vi.mock('@/lib/db/client', () => ({ db: { paymentHandle: { findMany } } }))

const { activeHandles } = await import('@/lib/payments/handles')

const row = (id: string, handle: string, method = 'CASHAPP') => ({ id, method, handle, label: null })

beforeEach(() => {
  findMany.mockReset()
  vi.stubEnv('PAYMENT_HANDLES_CASHAPP', '$from-the-environment')
})

afterEach(() => vi.unstubAllEnvs())

describe('activeHandles', () => {
  it('issues what the admin put in the pool, not what the environment says', async () => {
    findMany.mockResolvedValue([row('h1', '$from-the-admin')])
    expect((await activeHandles()).map((h) => h.handle)).toEqual(['$from-the-admin'])
  })

  /*
    The query does the filtering, so a burned handle never reaches the picker. If
    this where-clause is ever dropped, a frozen account starts taking money again.
  */
  it('asks the database only for handles that may still be issued', async () => {
    findMany.mockResolvedValue([])
    await activeHandles()
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { isActive: true, burnedAt: null } }),
    )
  })

  it('falls back to the environment while the pool is empty', async () => {
    findMany.mockResolvedValue([])
    expect((await activeHandles()).map((h) => h.handle)).toEqual(['$from-the-environment'])
  })

  /*
    A database that is down must not take the order page down with it. Without a
    handle the page already tells the customer their details will follow by email.
  */
  it('falls back to the environment when the database cannot be reached', async () => {
    findMany.mockRejectedValue(new Error('no connection'))
    expect((await activeHandles()).map((h) => h.handle)).toEqual(['$from-the-environment'])
  })

  it('returns nothing at all when neither has a handle', async () => {
    vi.stubEnv('PAYMENT_HANDLES_CASHAPP', '')
    findMany.mockResolvedValue([])
    expect(await activeHandles()).toEqual([])
  })
})
