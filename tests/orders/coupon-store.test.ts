import { beforeEach, describe, expect, it, vi } from 'vitest'

const findUnique = vi.fn()
const updateMany = vi.fn()

vi.mock('@/lib/db/client', () => ({ db: { coupon: { findUnique, updateMany } } }))

const { claimRedemption, findCoupon, releaseRedemption } = await import(
  '@/lib/orders/coupon-store'
)

const NOW = new Date('2026-09-11T12:00:00Z')

const limited = {
  code: 'SAVE10',
  percentOff: 10,
  amountOffCents: null,
  minSubtotalCents: 0,
  maxRedemptions: 5,
  timesRedeemed: 4,
  isActive: true,
  startsAt: null,
  endsAt: null,
}

beforeEach(() => {
  findUnique.mockReset()
  updateMany.mockReset()
})

describe('findCoupon', () => {
  it('looks the code up in canonical form', async () => {
    findUnique.mockResolvedValue(limited)
    await findCoupon('  save10 ')
    expect(findUnique).toHaveBeenCalledWith({ where: { code: 'SAVE10' } })
  })

  it('returns null for a blank code without touching the database', async () => {
    // Every query wakes Neon; an empty box is not a reason to.
    expect(await findCoupon('   ')).toBeNull()
    expect(findUnique).not.toHaveBeenCalled()
  })

  it('returns null when there is no such code', async () => {
    findUnique.mockResolvedValue(null)
    expect(await findCoupon('NOPE')).toBeNull()
  })
})

describe('claimRedemption', () => {
  it('reports success when the conditional update matched the row', async () => {
    updateMany.mockResolvedValue({ count: 1 })
    expect(await claimRedemption(limited, NOW)).toBe(true)
  })

  /*
    The losing side of a race. Two customers were both told "4 of 5 used"; the first
    claim took the last slot, and this one's WHERE no longer matches anything.
  */
  it('reports failure when another claim took the last slot first', async () => {
    updateMany.mockResolvedValue({ count: 0 })
    expect(await claimRedemption(limited, NOW)).toBe(false)
  })

  it('guards the claim on the redemption cap inside the same statement', async () => {
    updateMany.mockResolvedValue({ count: 1 })
    await claimRedemption(limited, NOW)
    const { where, data } = updateMany.mock.calls[0]![0]
    expect(where.AND).toContainEqual({ timesRedeemed: { lt: 5 } })
    expect(data).toEqual({ timesRedeemed: { increment: 1 } })
  })

  it('re-checks active and the date window in the same statement', async () => {
    // A code disabled a second ago must not be claimable on a read taken before.
    updateMany.mockResolvedValue({ count: 1 })
    await claimRedemption(limited, NOW)
    const { where } = updateMany.mock.calls[0]![0]
    expect(where.isActive).toBe(true)
    expect(where.AND).toContainEqual({ OR: [{ startsAt: null }, { startsAt: { lte: NOW } }] })
    expect(where.AND).toContainEqual({ OR: [{ endsAt: null }, { endsAt: { gt: NOW } }] })
  })

  it('applies no cap condition to an unlimited code', async () => {
    updateMany.mockResolvedValue({ count: 1 })
    await claimRedemption({ ...limited, maxRedemptions: null }, NOW)
    const { where } = updateMany.mock.calls[0]![0]
    expect(JSON.stringify(where)).not.toContain('timesRedeemed')
  })

  it('claims by the canonical code', async () => {
    updateMany.mockResolvedValue({ count: 1 })
    await claimRedemption({ ...limited, code: 'save10' }, NOW)
    expect(updateMany.mock.calls[0]![0].where.code).toBe('SAVE10')
  })
})

describe('releaseRedemption', () => {
  it('gives one redemption back', async () => {
    updateMany.mockResolvedValue({ count: 1 })
    await releaseRedemption('save10')
    expect(updateMany).toHaveBeenCalledWith({
      where: { code: 'SAVE10', timesRedeemed: { gt: 0 } },
      data: { timesRedeemed: { decrement: 1 } },
    })
  })

  /*
    Floored in the WHERE, not trusted. A release that ran twice for one order must
    not take the counter negative and quietly grant somebody an extra use.
  */
  it('never takes the counter below zero', async () => {
    updateMany.mockResolvedValue({ count: 0 })
    await releaseRedemption('SAVE10')
    expect(updateMany.mock.calls[0]![0].where.timesRedeemed).toEqual({ gt: 0 })
  })

  it('does nothing for a blank code', async () => {
    await releaseRedemption('  ')
    expect(updateMany).not.toHaveBeenCalled()
  })
})
