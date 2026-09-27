import { z } from 'zod'
import { catalog } from '@/lib/catalog/repository'
import { isOnStateDirectory, tierFor, tierPriceCents, type Product } from '@/lib/catalog/types'
import {
  evaluateCart,
  freeShippingProgress,
  FREE_SHIPPING_THRESHOLD_CENTS,
} from '@/lib/compliance/shipping'
import type {
  CartComplianceResult,
  EvaluableItem,
  FulfillmentChannel,
  UsJurisdictionCode,
} from '@/lib/compliance/types'
import {
  EMPTY_CART,
  type Cart,
  type CartLine,
  type ResolvedCart,
  type ResolvedLine,
  type ShippingQuote,
} from './types'

export const MAX_LINE_QUANTITY = 99
export const MAX_LINES = 40

/**
 * Shipping rates per fulfillment channel.
 *
 * Only PARCEL can ever be free. Vapes ride a specialty PACT Act compliant carrier
 * and local courier runs are priced per delivery — neither can be given away, and
 * pretending otherwise would put a promise on the page the business cannot keep.
 */
const RATES: Record<FulfillmentChannel, { label: string; costCents: number; estimate: string; note?: string }> = {
  PARCEL: {
    label: 'Standard parcel',
    costCents: 795,
    estimate: '3–5 business days',
  },
  PACT_CARRIER: {
    label: 'Age-restricted carrier',
    costCents: 1995,
    estimate: '5–8 business days',
    note: 'Vapor products ship via a PACT Act compliant carrier, and this shipment is never eligible for free shipping.',
  },
  LOCAL_COURIER: {
    label: 'Same-day local delivery',
    costCents: 1200,
    estimate: 'Today, if ordered before the cutoff',
    note: 'Available only within our local delivery radius.',
  },
}

/**
 * Schema for the cart cookie.
 *
 * The cookie is user-controlled input, so it is parsed on every read. Note what is
 * NOT in it: prices. Those are recomputed from the catalogue server-side on every
 * resolve — a price in a client-writable cookie is a trivially exploitable one.
 */
export const cartCookieSchema = z.object({
  lines: z
    .array(
      z.object({
        slug: z.string().min(1).max(120),
        variantId: z.string().min(1).max(160),
        quantity: z.number().int().min(1).max(MAX_LINE_QUANTITY),
      }),
    )
    .max(MAX_LINES),
})

/**
 * Parse a raw cookie value into a cart.
 *
 * Never throws. A malformed or hostile value yields an empty cart, because an
 * exception here would take down every page that renders a cart count.
 */
export function parseCartCookie(raw: string | undefined | null): Cart {
  if (!raw) return EMPTY_CART
  try {
    const parsed = cartCookieSchema.safeParse(JSON.parse(raw))
    return parsed.success ? normalizeCart(parsed.data) : EMPTY_CART
  } catch {
    return EMPTY_CART
  }
}

export function normalizeCart(cart: Cart): Cart {
  const merged = new Map<string, CartLine>()
  for (const line of cart.lines) {
    const key = `${line.slug}::${line.variantId}`
    const existing = merged.get(key)
    const quantity = Math.min(
      MAX_LINE_QUANTITY,
      Math.max(1, (existing?.quantity ?? 0) + line.quantity),
    )
    merged.set(key, { ...line, quantity })
  }
  return { lines: [...merged.values()].slice(0, MAX_LINES) }
}

export function addLine(cart: Cart, line: CartLine): Cart {
  return normalizeCart({ lines: [...cart.lines, line] })
}

export function updateQuantity(cart: Cart, slug: string, variantId: string, quantity: number): Cart {
  if (quantity <= 0) return removeLine(cart, slug, variantId)
  return {
    lines: cart.lines.map((l) =>
      l.slug === slug && l.variantId === variantId
        ? { ...l, quantity: Math.min(MAX_LINE_QUANTITY, quantity) }
        : l,
    ),
  }
}

export function removeLine(cart: Cart, slug: string, variantId: string): Cart {
  return { lines: cart.lines.filter((l) => !(l.slug === slug && l.variantId === variantId)) }
}

/**
 * Hydrate a cookie cart into a priced, compliance-evaluated cart.
 *
 * Prices are recomputed from the catalogue on every resolve and are NEVER read from
 * the client. The cookie carries identifiers and quantities only — a cart cookie is
 * user-controlled input, and a price in it would be a trivially exploitable one.
 */
export function resolveCart(
  cart: Cart,
  stateCode?: UsJurisdictionCode,
  /**
   * How to look a product up. Defaults to the authored catalogue.
   *
   * Injected rather than imported so the caller can supply products with operator
   * edits applied — an admin repricing a bag has to change what the customer is
   * actually charged, not just what the page says. Keeping it a parameter leaves this
   * function synchronous and pure, which is what lets the pricing rules below be
   * tested exhaustively without a database.
   *
   * `resolveCartLive` in lib/catalog/live-cart.ts is the merged-price caller.
   */
  getProduct: (slug: string) => Product | undefined = catalog.getProduct,
): ResolvedCart {
  const lines: ResolvedLine[] = []

  for (const line of normalizeCart(cart).lines) {
    const product = getProduct(line.slug)
    if (!product) continue // delisted since it was added — drop it silently
    const variant =
      product.variants.find((v) => v.id === line.variantId) ?? product.variants[0]
    if (!variant) continue

    /*
      The tier discounts the SELECTED variant, not the product. A 1 kg bag and a
      50 g bag of the same bark are the same product now, and 15% off has to mean
      15% off whichever one is in the box.
    */
    const tier = tierFor(product.priceTiers, line.quantity)
    const unitPriceCents = tier
      ? tierPriceCents(variant.priceCents, tier)
      : variant.priceCents

    lines.push({
      line,
      product,
      variant,
      unitPriceCents,
      baseUnitPriceCents: variant.priceCents,
      lineTotalCents: unitPriceCents * line.quantity,
      ...(tier ? { bulkTierLabel: tier.label } : {}),
    })
  }

  const evaluableItems: EvaluableItem[] = lines.map((l) => ({
    id: `${l.product.slug}::${l.variant.id}`,
    name: l.product.name,
    productLine: l.product.productLine,
    fulfillmentChannel: l.product.fulfillmentChannel,
    notForHumanConsumption: l.product.notForHumanConsumption,
    ageRestricted: l.product.ageRestricted,
    unitPriceCents: l.unitPriceCents,
    quantity: l.line.quantity,
    ...(stateCode
      ? { onStateProductDirectory: isOnStateDirectory(l.product, stateCode) }
      : {}),
  }))

  // Without a destination we cannot evaluate legality, so nothing is grouped or
  // quoted yet. The UI asks for a state before it asks for anything else.
  const compliance: CartComplianceResult = stateCode
    ? evaluateCart(evaluableItems, stateCode)
    : {
        canProceed: false,
        blocked: [],
        restricted: [],
        shipmentGroups: [],
        requiredAttestations: [],
        minAge: 21,
        requiresAgeVerification: evaluableItems.some((i) => i.ageRestricted),
        requiresAdultSignature: false,
      }

  const progress = freeShippingProgress(compliance.shipmentGroups)

  const quotes: ShippingQuote[] = compliance.shipmentGroups.map((group) => {
    const rate = RATES[group.channel]
    const isFree = group.eligibleForFreeShipping && progress.qualified
    return {
      channel: group.channel,
      label: rate.label,
      costCents: isFree ? 0 : rate.costCents,
      isFree,
      estimate: rate.estimate,
      requiresAdultSignature: group.requiresAdultSignature,
      ...(rate.note ? { note: rate.note } : {}),
    }
  })

  const subtotalCents = lines.reduce((sum, l) => sum + l.lineTotalCents, 0)
  const shippingTotalCents = quotes.reduce((sum, q) => sum + q.costCents, 0)

  return {
    lines,
    itemCount: lines.reduce((n, l) => n + l.line.quantity, 0),
    subtotalCents,
    compliance,
    quotes,
    shippingTotalCents,
    totalCents: subtotalCents + shippingTotalCents,
    ...(stateCode ? { stateCode } : {}),
    evaluableItems,
  }
}

export { EMPTY_CART, FREE_SHIPPING_THRESHOLD_CENTS }

/** Items in the cart, counting quantity: two of one product is two. */
export function cartItemCount(cart: { readonly lines: readonly { readonly quantity: number }[] }): number {
  return cart.lines.reduce((total, line) => total + line.quantity, 0)
}
