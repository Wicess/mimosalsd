import 'server-only'
import { db } from '@/lib/db/client'
import { normalizeCode, type CouponRecord } from './coupons'

/**
 * ─────────────────────────────────────────────────────────────────────────────
 *  COUPON PERSISTENCE — the three database operations redemption needs.
 *
 *  Kept apart from `coupons.ts` so the pricing rules stay pure and exhaustively
 *  testable. Everything here is a thin, deliberate query; everything that decides
 *  whether a coupon applies, and by how much, lives on the other side of that line.
 * ─────────────────────────────────────────────────────────────────────────────
 */

/** Look a coupon up by the code a customer typed. Null when there is no such code. */
export async function findCoupon(rawCode: string): Promise<CouponRecord | null> {
  const code = normalizeCode(rawCode)
  if (!code) return null
  const row = await db.coupon.findUnique({ where: { code } })
  return row
}

/**
 * Take one redemption, ATOMICALLY. Returns false when the code is gone.
 *
 * ── Why a conditional update and not read-then-write ───────────────────────
 * `evaluateCoupon` has already said a slot is free — but it read `timesRedeemed`
 * a moment ago, and two customers can both be told "4 of 5 used" and both proceed.
 * Incrementing unconditionally after that check hands out a sixth redemption.
 *
 * This is one statement: `UPDATE … SET timesRedeemed = timesRedeemed + 1 WHERE
 * timesRedeemed < max`. Postgres takes a row lock for it, so the second of two
 * concurrent claims waits, then re-evaluates the WHERE against the row the first
 * one just committed — and matches nothing. `count === 0` is how the loser finds
 * out, and no lock is held by our code across any other work.
 *
 * `isActive` and the date window are re-checked in the same statement, so a code an
 * operator disabled a second ago cannot be claimed on the strength of a read taken
 * before they did.
 */
export async function claimRedemption(coupon: CouponRecord, now: Date): Promise<boolean> {
  const result = await db.coupon.updateMany({
    where: {
      code: normalizeCode(coupon.code),
      isActive: true,
      AND: [
        { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
        { OR: [{ endsAt: null }, { endsAt: { gt: now } }] },
        coupon.maxRedemptions === null
          ? {}
          : { timesRedeemed: { lt: coupon.maxRedemptions } },
      ],
    },
    data: { timesRedeemed: { increment: 1 } },
  })
  return result.count === 1
}

/**
 * Give one redemption back.
 *
 * For two cases. The order write failed after the slot was claimed, so nothing is
 * holding it. Or the order was cancelled or rejected before anyone paid — without
 * this, anyone willing to place and abandon orders could exhaust a limited code for
 * everyone else.
 *
 * Floored at zero in the WHERE rather than trusted: a release that ran twice for one
 * order must not push the counter negative and quietly grant an extra use.
 */
export async function releaseRedemption(rawCode: string): Promise<void> {
  const code = normalizeCode(rawCode)
  if (!code) return
  await db.coupon.updateMany({
    where: { code, timesRedeemed: { gt: 0 } },
    data: { timesRedeemed: { decrement: 1 } },
  })
}
