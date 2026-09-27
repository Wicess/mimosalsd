import type {
  CartComplianceResult,
  EvaluableItem,
  FulfillmentChannel,
  UsJurisdictionCode,
} from '@/lib/compliance/types'
import type { Product, ProductVariant } from '@/lib/catalog/types'

/** What the cookie stores. Deliberately minimal — prices are never trusted from the client. */
export interface CartLine {
  readonly slug: string
  readonly variantId: string
  readonly quantity: number
}

export interface Cart {
  readonly lines: readonly CartLine[]
}

export const EMPTY_CART: Cart = { lines: [] }

/** A line hydrated from the catalogue, with the price the SERVER computed. */
export interface ResolvedLine {
  readonly line: CartLine
  readonly product: Product
  readonly variant: ProductVariant
  /** Reflects any bulk tier reached at this quantity. */
  readonly unitPriceCents: number
  readonly lineTotalCents: number
  /** The undiscounted unit price, when a bulk tier applied. */
  readonly baseUnitPriceCents: number
  readonly bulkTierLabel?: string
}

export interface ShippingQuote {
  readonly channel: FulfillmentChannel
  readonly label: string
  readonly costCents: number
  readonly isFree: boolean
  readonly estimate: string
  readonly requiresAdultSignature: boolean
  readonly note?: string
}

export interface ResolvedCart {
  readonly lines: readonly ResolvedLine[]
  readonly itemCount: number
  readonly subtotalCents: number
  readonly compliance: CartComplianceResult
  readonly quotes: readonly ShippingQuote[]
  readonly shippingTotalCents: number
  readonly totalCents: number
  readonly stateCode?: UsJurisdictionCode
  readonly evaluableItems: readonly EvaluableItem[]
}
