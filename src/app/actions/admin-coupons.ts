'use server'

import { revalidatePath } from 'next/cache'
import { requireArea } from '@/lib/admin/guard'
import { recordAdminAction } from '@/lib/admin/audit'
import { db } from '@/lib/db/client'
import { couponShapeError, normalizeCode } from '@/lib/orders/coupons'
import { parseAmount } from '@/lib/orders/refunds'
import type { CrudState } from '@/app/actions/admin-crud'

/**
 * ─────────────────────────────────────────────────────────────────────────────
 *  COUPON ADMINISTRATION — built second, on purpose.
 *
 *  The admin plan was explicit that a coupon screen alone would be a facade: the
 *  `Coupon` model existed with zero code references, so an operator could have issued
 *  a code to a customer and checkout would have silently ignored it. The redemption
 *  path — pricing, checkout, the atomic claim, every receipt — was built and tested
 *  first. This screen is only worth having because that now exists behind it.
 *
 *  ── Why the catalogue grant, not marketing ─────────────────────────────────
 *  A coupon is a price change. The catalogue area can already reprice every product;
 *  marketing edits subscribers and links. Filing coupons under marketing would let
 *  someone granted only the newsletter mint a 100%-off code.
 *
 *  ── Why codes cannot be edited or deleted ──────────────────────────────────
 *  An order stores the code that discounted it. Editing SAVE10 to mean 50% off would
 *  make every existing order's record describe a discount it did not receive, and
 *  deleting it would orphan them. So a code's terms are fixed at creation: it can be
 *  switched off, and a different deal is a different code.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const ADMIN_PATH = '/admin/coupons'

const ok = (message: string): CrudState => ({ ok: message })
const fail = (error: string): CrudState => ({ error })

/**
 * YYYY-MM-DD as the START of that day in UTC.
 *
 * UTC and said so in the form: a store shipping to fifty states has no single local
 * midnight, and a timezone silently borrowed from whichever server ran the action is
 * how a promotion ends five hours early on the East Coast.
 */
function startOfDayUtc(raw: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null
  const date = new Date(`${raw}T00:00:00Z`)
  return Number.isNaN(date.getTime()) ? null : date
}

function optional(formData: FormData, name: string): string {
  return String(formData.get(name) ?? '').trim()
}

export async function createCoupon(_prev: CrudState, formData: FormData): Promise<CrudState> {
  const guard = await requireArea(ADMIN_PATH)
  if (!guard.ok) return fail(guard.error)

  const code = normalizeCode(optional(formData, 'code'))
  if (!/^[A-Z0-9_-]{3,40}$/.test(code)) {
    return fail('Codes are 3 to 40 letters, numbers, hyphens or underscores.')
  }

  // ── The discount: exactly one of a percentage or a fixed amount ─────────────
  const percentRaw = optional(formData, 'percentOff')
  const amountRaw = optional(formData, 'amountOff')
  if (percentRaw && amountRaw) {
    return fail('Give a percentage or a fixed amount, not both.')
  }

  let percentOff: number | null = null
  let amountOffCents: number | null = null
  if (percentRaw) {
    if (!/^\d{1,3}$/.test(percentRaw)) return fail('The percentage must be a whole number.')
    percentOff = Number(percentRaw)
  } else if (amountRaw) {
    const amount = parseAmount(amountRaw)
    if (!amount.ok) return fail(`Fixed amount: ${amount.error}`)
    amountOffCents = amount.amountCents
  }

  const minRaw = optional(formData, 'minSubtotal')
  let minSubtotalCents = 0
  if (minRaw) {
    const min = parseAmount(minRaw)
    if (!min.ok) return fail(`Minimum spend: ${min.error}`)
    minSubtotalCents = min.amountCents
  }

  // The same check redemption runs, so nothing can be created that checkout refuses.
  const shape = couponShapeError({ percentOff, amountOffCents, minSubtotalCents })
  if (shape) return fail(shape)

  const maxRaw = optional(formData, 'maxRedemptions')
  let maxRedemptions: number | null = null
  if (maxRaw) {
    if (!/^\d{1,7}$/.test(maxRaw) || Number(maxRaw) < 1) {
      return fail('Maximum uses must be a whole number of at least 1, or blank for unlimited.')
    }
    maxRedemptions = Number(maxRaw)
  }

  const startsRaw = optional(formData, 'startsAt')
  const endsRaw = optional(formData, 'endsAt')
  const startsAt = startsRaw ? startOfDayUtc(startsRaw) : null
  if (startsRaw && !startsAt) return fail('Start date is not a valid date.')
  const endDay = endsRaw ? startOfDayUtc(endsRaw) : null
  if (endsRaw && !endDay) return fail('End date is not a valid date.')
  // Inclusive: a code that "ends December 31" works for all of December 31 (UTC).
  const endsAt = endDay ? new Date(endDay.getTime() + 24 * 60 * 60 * 1000) : null
  if (startsAt && endsAt && endsAt <= startsAt) {
    return fail('The end date must be on or after the start date.')
  }

  const existing = await db.coupon.findUnique({ where: { code } })
  if (existing) {
    return fail(`${code} already exists. A different deal needs a different code.`)
  }

  const created = await db.coupon.create({
    data: {
      code,
      percentOff,
      amountOffCents,
      minSubtotalCents,
      maxRedemptions,
      startsAt,
      endsAt,
    },
  })

  await recordAdminAction({
    entityType: 'Coupon',
    entityId: created.id,
    action: 'CREATE',
    actor: guard.identity,
    after: created,
    reason: `Created ${code}`,
  })

  revalidatePath(ADMIN_PATH)
  return ok(`Created ${code}.`)
}

/** Switch a code on or off. The only change a code accepts after creation. */
export async function toggleCoupon(formData: FormData): Promise<void> {
  const guard = await requireArea(ADMIN_PATH)
  if (!guard.ok) return

  const id = String(formData.get('id') ?? '')
  const current = await db.coupon.findUnique({ where: { id } })
  if (!current) return

  await db.coupon.update({ where: { id }, data: { isActive: !current.isActive } })
  await recordAdminAction({
    entityType: 'Coupon',
    entityId: id,
    action: current.isActive ? 'UNPUBLISH' : 'PUBLISH',
    actor: guard.identity,
    reason: `${current.isActive ? 'Disabled' : 'Re-enabled'} ${current.code}`,
  })
  revalidatePath(ADMIN_PATH)
}
