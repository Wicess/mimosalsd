import 'server-only'
import { db } from '@/lib/db/client'
import type { CartEventRow } from './sessions'

const FIELDS = {
  visitorId: true,
  type: true,
  productSlug: true,
  productName: true,
  variantId: true,
  variantName: true,
  quantity: true,
  cartValueCents: true,
  cartItems: true,
  valueCents: true,
  linkSlug: true,
  stateCode: true,
  reason: true,
  createdAt: true,
} as const

/** Cart events since `start`, oldest first. Null when migration 0019 is not applied yet. */
export async function cartEventsSince(start: Date, visitorId?: string): Promise<CartEventRow[] | null> {
  try {
    return await db.cartActivity.findMany({
      where: { createdAt: { gte: start }, ...(visitorId ? { visitorId } : {}) },
      select: FIELDS,
      orderBy: { createdAt: 'asc' },
      take: 20_000,
    })
  } catch {
    return null
  }
}
