/**
 * Compliance domain types.
 *
 * These types are the contract between the legal reality of the business and the
 * application. Everything downstream — cart, checkout, PDP, legality pages, admin —
 * reads from here. See docs/01-COMPLIANCE-RESEARCH.md for the sourcing behind each rule.
 */

/** The three product lines are three *separate* compliance regimes, not one. */
export type ProductLine = 'MIMOSA_HOSTILIS' | 'AMANITA' | 'VAPE'

export const PRODUCT_LINES: readonly ProductLine[] = [
  'MIMOSA_HOSTILIS',
  'AMANITA',
  'VAPE',
] as const

/**
 * ALLOWED    — ships without qualification.
 * RESTRICTED — may ship, but only if the per-rule conditions are satisfied
 *              (e.g. the SKU appears on that state's product directory).
 * BLOCKED    — never ships. No override path in the UI.
 */
export type RuleStatus = 'ALLOWED' | 'RESTRICTED' | 'BLOCKED'

/**
 * How an item physically reaches the customer. This is the single most consequential
 * field in the schema: USPS is barred from carrying vaping products and UPS/FedEx/DHL
 * all refuse consumer vape shipments, so vapes cannot ride the parcel channel at all.
 */
export type FulfillmentChannel = 'PARCEL' | 'PACT_CARRIER' | 'LOCAL_COURIER'

/** Attestations we must capture and store as evidence alongside the order. */
export type AttestationKind =
  | 'NOT_FOR_HUMAN_CONSUMPTION' // Mimosa Hostilis — intended-use declaration
  | 'AGE_21_PLUS'
  | 'PAYMENT_METHOD_ACKNOWLEDGED'

export interface StateRule {
  /** USPS two-letter code. 50 states + DC. */
  readonly stateCode: UsJurisdictionCode
  readonly productLine: ProductLine
  readonly status: RuleStatus
  /** e.g. "La. R.S. 40:989.1" — required whenever status !== 'ALLOWED'. */
  readonly statuteCitation?: string
  readonly statuteUrl?: string
  /** Plain-English explanation shown to the customer. Required when not ALLOWED. */
  readonly notes?: string
  readonly minAge: number
  readonly requiresAdultSignature: boolean
  /**
   * State maintains a product directory/registry (FDA-authorised products only).
   * The SKU must appear on it. FL, NC, TN, VA, WI for vapes.
   */
  readonly requiresProductDirectory: boolean
  /** Legislation is pending — review before the next content refresh. */
  readonly watch: boolean
  /** ISO date. Content pages surface this so buyers can see how current we are. */
  readonly lastReviewedAt: string
  readonly reviewedBy: string
  readonly effectiveFrom?: string
}

/** The typed answer to "can I ship this line to this state?" */
export interface ShippingDecision {
  readonly allowed: boolean
  readonly status: RuleStatus
  /** Customer-facing, plain English. Never a code, never a stack trace. */
  readonly reason: string
  readonly rule: StateRule
  readonly minAge: number
  readonly requiresAdultSignature: boolean
  readonly requiresProductDirectory: boolean
}

/** Minimum shape the compliance engine needs from a cart line. */
export interface EvaluableItem {
  readonly id: string
  readonly name: string
  readonly productLine: ProductLine
  readonly fulfillmentChannel: FulfillmentChannel
  readonly notForHumanConsumption: boolean
  readonly ageRestricted: boolean
  /** Unit price in integer cents. Never a float. */
  readonly unitPriceCents: number
  readonly quantity: number
  /** True when this SKU is listed on the destination state's product directory. */
  readonly onStateProductDirectory?: boolean
}

export interface BlockedItem {
  readonly item: EvaluableItem
  readonly decision: ShippingDecision
}

/**
 * A cart splits into one shipment per fulfillment channel. A cart containing gummies
 * and a vape produces two shipments, with different carriers, costs and promises.
 */
export interface ShipmentGroup {
  readonly channel: FulfillmentChannel
  readonly items: readonly EvaluableItem[]
  readonly subtotalCents: number
  readonly requiresAdultSignature: boolean
  /** Only PARCEL items count toward the free-shipping threshold. */
  readonly eligibleForFreeShipping: boolean
}

export interface CartComplianceResult {
  readonly canProceed: boolean
  readonly blocked: readonly BlockedItem[]
  readonly restricted: readonly BlockedItem[]
  readonly shipmentGroups: readonly ShipmentGroup[]
  readonly requiredAttestations: readonly AttestationKind[]
  readonly minAge: number
  readonly requiresAgeVerification: boolean
  readonly requiresAdultSignature: boolean
}

export type UsJurisdictionCode =
  | 'AL' | 'AK' | 'AZ' | 'AR' | 'CA' | 'CO' | 'CT' | 'DE' | 'DC' | 'FL'
  | 'GA' | 'HI' | 'ID' | 'IL' | 'IN' | 'IA' | 'KS' | 'KY' | 'LA' | 'ME'
  | 'MD' | 'MA' | 'MI' | 'MN' | 'MS' | 'MO' | 'MT' | 'NE' | 'NV' | 'NH'
  | 'NJ' | 'NM' | 'NY' | 'NC' | 'ND' | 'OH' | 'OK' | 'OR' | 'PA' | 'RI'
  | 'SC' | 'SD' | 'TN' | 'TX' | 'UT' | 'VT' | 'VA' | 'WA' | 'WV' | 'WI' | 'WY'
