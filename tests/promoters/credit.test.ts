import { beforeEach, describe, expect, it, vi } from 'vitest'
import { encodeAttribution } from '@/lib/promoters/attribution'

const findUnique = vi.fn()
const cookieStore = new Map<string, string>()
vi.mock('@/lib/db/client', () => ({ db: { trackingLink: { findUnique } } }))
vi.mock('next/headers', () => ({
  cookies: async () => ({ get: (name: string) => (cookieStore.has(name) ? { value: cookieStore.get(name) } : undefined) }),
}))

const { creditForOrder } = await import('@/lib/promoters/credit')

const NOW = new Date('2026-09-12T12:00:00Z')
const clicked = (days: number) => encodeAttribution('reddit-dye', new Date(NOW.getTime() - days * 86_400_000))

beforeEach(() => {
  cookieStore.clear()
  findUnique.mockReset()
})

describe('creditForOrder', () => {
  it('credits the promoter whose link was clicked', async () => {
    cookieStore.set('ref', clicked(2))
    findUnique.mockResolvedValue({ slug: 'reddit-dye', promoterId: 'pro_1' })
    expect(await creditForOrder(NOW)).toEqual({
      linkSlug: 'reddit-dye',
      promoterId: 'pro_1',
      at: new Date(NOW.getTime() - 2 * 86_400_000).toISOString(),
    })
  })

  it('records the link even when it belongs to no one', async () => {
    cookieStore.set('ref', clicked(1))
    findUnique.mockResolvedValue({ slug: 'reddit-dye', promoterId: null })
    expect(await creditForOrder(NOW)).toMatchObject({ linkSlug: 'reddit-dye', promoterId: null })
  })

  it('credits nobody without a cookie, past the window, or for a link since deleted', async () => {
    expect(await creditForOrder(NOW)).toBeNull()

    cookieStore.set('ref', clicked(31))
    expect(await creditForOrder(NOW)).toBeNull()
    expect(findUnique).not.toHaveBeenCalled() // not even looked up

    cookieStore.set('ref', clicked(1))
    findUnique.mockResolvedValue(null)
    expect(await creditForOrder(NOW)).toBeNull()
  })

  /*
    An order must never fail because attribution could not be worked out — including
    on a deploy that lands before migration 0013.
  */
  it('gives up quietly when the lookup throws', async () => {
    cookieStore.set('ref', clicked(1))
    findUnique.mockRejectedValue(Object.assign(new Error('no such column'), { code: 'P2022' }))
    expect(await creditForOrder(NOW)).toBeNull()
    findUnique.mockRejectedValue(new Error('connection lost'))
    expect(await creditForOrder(NOW)).toBeNull()
  })
})
