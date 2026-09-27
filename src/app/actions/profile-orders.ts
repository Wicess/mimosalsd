'use server'

import { z } from 'zod'
import { ordersByTokens, type ProfileOrder } from '@/lib/account/my-orders'

const schema = z.array(z.string().max(64)).max(20)

/**
 * The orders behind the private links this browser has opened. The token is the
 * credential for an order (it is what the order page itself runs on), so anyone who
 * holds one may already see that order; this reveals nothing more.
 */
export async function rememberedOrders(tokens: unknown): Promise<ProfileOrder[]> {
  const parsed = schema.safeParse(tokens)
  if (!parsed.success) return []
  return ordersByTokens(parsed.data)
}
