import type {
  AttestationKind,
  FulfillmentChannel,
  UsJurisdictionCode,
} from '@/lib/compliance/types'

export type OrderStatus =
  | 'PENDING_VERIFICATION'
  | 'AWAITING_PAYMENT'
  | 'PAYMENT_CLAIMED'
  | 'PAID'
  | 'PACKED'
  | 'SHIPPED'
  | 'DELIVERED'
  | 'CANCELLED'
  | 'REJECTED'
  | 'REFUNDED'

export type PaymentMethod = 'CASHAPP' | 'CHIME' | 'APPLE_CASH' | 'BITCOIN'

export const PAYMENT_METHODS: readonly PaymentMethod[] = [
  'CASHAPP',
  'CHIME',
  'APPLE_CASH',
  'BITCOIN',
]

/**
 * NOT "Apple Pay".
 *
 * Apple Pay is a card-network wallet that requires an acquiring processor, which we
 * deliberately do not have — that is what keeps PCI scope at zero. Apple Cash is
 * peer-to-peer and is what we can actually accept. Showing an Apple Pay button that
 * is not Apple Pay would be a trust liability on a site whose entire job is looking
 * legitimate.
 */
export const PAYMENT_LABELS: Record<PaymentMethod, string> = {
  CASHAPP: 'Cash App',
  CHIME: 'Chime',
  APPLE_CASH: 'Apple Cash',
  BITCOIN: 'Bitcoin',
}

export interface OrderItem {
  readonly productSlug: string
  readonly variantId: string
  readonly productName: string
  readonly variantName: string
  readonly productLine: string
  readonly fulfillmentChannel: FulfillmentChannel
  readonly unitPriceCents: number
  readonly quantity: number
  readonly lineTotalCents: number
}

export interface OrderShipment {
  readonly channel: FulfillmentChannel
  readonly label: string
  readonly costCents: number
  readonly requiresAdultSignature: boolean
  readonly estimate: string
}

/** Append-only. Never updated, never deleted. */
export interface OrderEvent {
  readonly type: string
  readonly message: string
  readonly at: string
  readonly fromStatus?: OrderStatus
  readonly toStatus?: OrderStatus
  /** Who performed the transition, when it was an operator rather than the system. */
  readonly actorEmail?: string
}

export interface AcceptedAttestation {
  readonly kind: AttestationKind
  /** The exact wording shown at the time. Wording changes; evidence must not. */
  readonly text: string
  readonly acceptedAt: string
}

export interface Order {
  readonly id: string
  readonly orderNumber: string
  /** Unguessable, expiring handle for /order/[token]. No login required. */
  readonly orderToken: string
  readonly status: OrderStatus

  readonly email: string
  readonly phone: string
  readonly firstName: string
  readonly lastName: string
  readonly addressLine1: string
  readonly addressLine2?: string
  readonly city: string
  readonly stateCode: UsJurisdictionCode
  readonly postalCode: string

  readonly items: readonly OrderItem[]
  readonly shipments: readonly OrderShipment[]
  readonly subtotalCents: number
  readonly shippingCents: number
  /** Bitcoin discount in cents, stored so a later rate change cannot rewrite it. */
  readonly paymentDiscountCents: number
  /**
   * Coupon discount in cents. REQUIRED, not optional, on purpose: a money field that
   * can be `undefined` reads as NaN the first time it meets arithmetic, and a receipt
   * that renders "Total: $NaN" is found by a customer, not a test.
   */
  readonly discountCents: number
  /** The coupon that produced `discountCents`, when there was one. */
  readonly couponCode?: string
  /** Welcome discount for an email-list subscriber's first order (0018). */
  readonly subscriberDiscountCents: number
  /** Welcome discount for a first order from someone with the app installed (0018). */
  readonly appDiscountCents: number
  readonly totalCents: number
  readonly freeShippingApplied: boolean
  /**
   * The tracking link this order followed, and its promoter. Stamped at checkout
   * from the /r/ cookie and never recomputed: a link can be renamed, retired or
   * reassigned, and credit already earned must not move.
   */
  readonly attribution?: {
    readonly linkSlug: string
    readonly promoterId: string | null
    /** When the link was clicked. */
    readonly at: string
  }

  readonly preferredPaymentMethod: PaymentMethod
  readonly attestations: readonly AcceptedAttestation[]
  readonly events: readonly OrderEvent[]

  /** What we knew about legality at the moment the order was accepted. */
  readonly complianceSnapshot: {
    readonly stateCode: UsJurisdictionCode
    readonly evaluatedAt: string
    readonly requiresAgeVerification: boolean
    readonly requiresAdultSignature: boolean
  }

  readonly createdAt: string
  readonly expiresAt: string
}
