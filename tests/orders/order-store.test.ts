import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Order } from '@/lib/orders/types'

/**
 * The order store is chosen lazily, by the repository itself, in whichever bundle
 * calls it. These load a FRESH copy of the module each time, because the bug this
 * guards against was precisely one copy of the module being configured and another
 * being used.
 */
const fresh = async () => {
  vi.resetModules()
  return import('@/lib/orders/repository')
}

const ORDER = { orderToken: 'tok', orderNumber: '202609-ABC123', events: [] } as unknown as Order

let saved: string | undefined
beforeEach(() => {
  saved = process.env.DATABASE_URL
  delete process.env.DATABASE_URL
})
afterEach(() => {
  if (saved === undefined) delete process.env.DATABASE_URL
  else process.env.DATABASE_URL = saved
})

describe('order store selection', () => {
  it('keeps orders in memory when no database is configured', async () => {
    const { orders } = await fresh()
    await orders.create(ORDER)
    expect(await orders.findByToken('tok')).toBe(ORDER)
  })

  it('needs no boot-time setup: the first call chooses', async () => {
    // Nothing calls setOrderProvider here, which is what a production bundle
    // looks like now that instrumentation no longer does it.
    const { orders } = await fresh()
    expect(await orders.list()).toEqual([])
  })

  it('lets an explicit provider win over the lazy choice', async () => {
    const { orders, setOrderProvider } = await fresh()
    const create = vi.fn(async (o: Order) => o)
    setOrderProvider({
      create,
      findByToken: async () => undefined,
      findByNumber: async () => undefined,
      appendEvent: async () => undefined,
      list: async () => [],
    })
    await orders.create(ORDER)
    expect(create).toHaveBeenCalledWith(ORDER)
  })

  it('chooses once, however many calls arrive together', async () => {
    const { orders } = await fresh()
    await Promise.all([orders.create(ORDER), orders.list(), orders.findByToken('tok')])
    // One in-memory store: the order written by the first call is visible to a later one.
    expect(await orders.findByNumber('202609-ABC123')).toBe(ORDER)
  })
})
