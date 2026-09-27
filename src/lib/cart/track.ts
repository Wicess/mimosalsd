import 'server-only'
import { after } from 'next/server'
import { cookies } from 'next/headers'
import { db } from '@/lib/db/client'
import { resolveCartLive } from '@/lib/catalog/live-cart'
import { ATTRIBUTION_COOKIE, parseAttribution } from '@/lib/promoters/attribution'
import { reportError } from '@/lib/observability/report-error'
import { isVisitorId, VISITOR_COOKIE } from '@/lib/visitors/cookie'
import type { Cart } from './types'

/**
 * ─────────────────────────────────────────────────────────────────────────────
 *  CART TRACKING (owner, 2026-09-14): every change to a cart, as it happens.
 *
 *  Recorded against the visitor cookie and the tracking link they followed, with
 *  the cart's value right after the change, so the admin can rebuild every cart,
 *  see which were abandoned and what was in them (lib/cart/sessions.ts), and credit
 *  cart adds to the social post that brought the visitor.
 *
 *  It never costs the customer anything: the cookies are read during the request,
 *  and everything else, the pricing and the write, runs after the response has gone.
 *  Any failure is reported and swallowed, including the columns not existing yet on
 *  a database without migration 0019.
 * ─────────────────────────────────────────────────────────────────────────────
 */

export type CartEventType = 'ADDED' | 'UPDATED' | 'REMOVED' | 'CHECKOUT_STARTED' | 'ORDER_PLACED' | 'BLOCKED_BY_STATE'

/** Checkout reopened within this long is the same visit to checkout, not a new one. */
const CHECKOUT_REPEAT_MS = 30 * 60 * 1000

export async function trackCart(
  type: CartEventType,
  {
    cart,
    product,
    variant,
    quantity = 0,
    valueCents,
    stateCode,
    reason,
  }: {
    /** The cart as it is after this change. */
    cart?: Cart
    product?: { readonly slug: string; readonly name: string }
    variant?: { readonly id: string; readonly name: string }
    quantity?: number
    /** The event's own value when it is known up front: an order's total. */
    valueCents?: number
    stateCode?: string | null
    reason?: string | null
  } = {},
): Promise<void> {
  let visitorId: string | null = null
  let linkSlug: string | null = null
  try {
    const store = await cookies()
    const visitor = store.get(VISITOR_COOKIE)?.value
    visitorId = isVisitorId(visitor) ? visitor : null
    linkSlug = parseAttribution(store.get(ATTRIBUTION_COOKIE)?.value, new Date())?.slug ?? null
  } catch {
    return
  }

  after(async () => {
    try {
      if (type === 'CHECKOUT_STARTED' && visitorId) {
        const recent = await db.cartActivity.findFirst({
          where: { visitorId, type, createdAt: { gte: new Date(Date.now() - CHECKOUT_REPEAT_MS) } },
          select: { id: true },
        })
        if (recent) return
      }
      const resolved = cart ? await resolveCartLive(cart) : null
      const line =
        resolved && product && variant
          ? resolved.lines.find((l) => l.product.slug === product.slug && l.variant.id === variant.id)
          : undefined
      await db.cartActivity.create({
        data: {
          visitorId,
          type,
          productSlug: product?.slug ?? null,
          productName: product?.name ?? null,
          variantId: variant?.id ?? null,
          variantName: variant?.name ?? null,
          quantity,
          valueCents: valueCents ?? (line ? line.unitPriceCents * Math.max(1, quantity) : 0),
          cartValueCents: resolved?.subtotalCents ?? 0,
          cartItems: resolved?.itemCount ?? 0,
          linkSlug,
          stateCode: stateCode ?? null,
          reason: reason ? reason.slice(0, 500) : null,
        },
      })
    } catch (error) {
      await reportError(error, { source: 'action', severity: 'WARN', context: { stage: 'cart-tracking', type } }).catch(() => undefined)
    }
  })
}
