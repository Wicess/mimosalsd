import { BRAND } from '@/lib/brand'
import { jurisdictionName } from './jurisdictions'
import { getStateRule } from './state-rules'
import type {
  AttestationKind,
  BlockedItem,
  CartComplianceResult,
  EvaluableItem,
  FulfillmentChannel,
  ProductLine,
  ShipmentGroup,
  ShippingDecision,
  StateRule,
  UsJurisdictionCode,
} from './types'

/** Free shipping threshold, in integer cents. Parcel-eligible subtotal only. */
export const FREE_SHIPPING_THRESHOLD_CENTS = 10_000

/**
 * Fail closed. If no rule exists for a (state, line) pair — a data gap, a new
 * jurisdiction, a bad migration — we refuse the sale rather than guess. In this
 * category the cost of an incorrect "yes" is unbounded; the cost of an incorrect
 * "no" is one lost order.
 */
function missingRule(stateCode: UsJurisdictionCode, productLine: ProductLine): StateRule {
  return {
    stateCode,
    productLine,
    status: 'BLOCKED',
    notes: `We do not currently have a verified legal review on file for this product in ${jurisdictionName(stateCode)}, so we cannot ship it there.`,
    minAge: 21,
    requiresAdultSignature: true,
    requiresProductDirectory: false,
    watch: true,
    lastReviewedAt: '1970-01-01',
    reviewedBy: 'SYSTEM_FAIL_CLOSED',
  }
}

/**
 * The age a buyer must actually be, for a given rule.
 *
 * `StateRule.minAge` is the STATUTORY minimum and stays pure — an admin editing a
 * rule needs to see what the statute says, not what our policy does with it. But
 * company policy sets a floor of 21 that a state rule may raise and never lower, so
 * every place that DISPLAYS or ENFORCES an age has to take the higher of the two.
 *
 * This existed as a rule in CLAUDE.md and nowhere in the code. One rule row carries
 * `minAge: 18` (Mimosa Hostilis, which is not federally age-restricted), and the
 * legality pages rendered it raw — so /legality/texas told readers "Minimum age: 18"
 * for a product the 21+ age gate and the checkout attestation both refuse to sell
 * them. On pages built to be cited, that is a published claim the business does not
 * honour.
 */
export function effectiveMinAge(statutoryMinAge: number): number {
  return Math.max(statutoryMinAge, BRAND.minimumAge)
}

export interface CanShipOptions {
  /** True when the specific SKU appears on the destination state's product directory. */
  readonly onStateProductDirectory?: boolean
}

/**
 * The single authoritative answer to "can this product line reach this state?".
 *
 * Returns a typed decision AND a customer-facing reason. Never surface a bare boolean
 * to a buyer — an unexplained refusal reads as a broken site, and an explained one
 * reads as a business that knows the law.
 */
export function canShipTo(
  stateCode: UsJurisdictionCode,
  productLine: ProductLine,
  options: CanShipOptions = {},
): ShippingDecision {
  const rule = getStateRule(stateCode, productLine) ?? missingRule(stateCode, productLine)
  const state = jurisdictionName(stateCode)

  const base = {
    rule,
    status: rule.status,
    minAge: effectiveMinAge(rule.minAge),
    requiresAdultSignature: rule.requiresAdultSignature,
    requiresProductDirectory: rule.requiresProductDirectory,
  } as const

  if (rule.status === 'BLOCKED') {
    return {
      ...base,
      allowed: false,
      reason: rule.notes ?? `We cannot ship this product to ${state}.`,
    }
  }

  if (rule.status === 'RESTRICTED' && rule.requiresProductDirectory) {
    const listed = options.onStateProductDirectory === true
    return {
      ...base,
      allowed: listed,
      reason: listed
        ? `This item is listed on the ${state} product directory and can be shipped there.`
        : `${state} permits only products listed on its state directory, and this item is not currently listed.`,
    }
  }

  if (rule.status === 'RESTRICTED') {
    return {
      ...base,
      allowed: true,
      reason: rule.notes ?? `This product ships to ${state} with additional conditions.`,
    }
  }

  return {
    ...base,
    allowed: true,
    reason: rule.notes ?? `This product ships to ${state}.`,
  }
}

const CHANNEL_ORDER: readonly FulfillmentChannel[] = [
  'PARCEL',
  'PACT_CARRIER',
  'LOCAL_COURIER',
]

function lineSubtotal(item: EvaluableItem): number {
  return item.unitPriceCents * item.quantity
}

/**
 * Evaluate a whole cart against a destination state.
 *
 * Two things happen here that the UI depends on:
 *
 *  1. Blocked and restricted items are identified BEFORE checkout, so a customer is
 *     never told at the payment step that we can't ship something.
 *  2. The cart is split into one shipment per fulfillment channel. A cart with gummies
 *     and a vape produces two shipments with different carriers, costs and promises —
 *     because USPS/UPS/FedEx will not carry the vape at all.
 */
export function evaluateCart(
  items: readonly EvaluableItem[],
  stateCode: UsJurisdictionCode,
): CartComplianceResult {
  const blocked: BlockedItem[] = []
  const restricted: BlockedItem[] = []
  const shippable: EvaluableItem[] = []

  for (const item of items) {
    const decision = canShipTo(stateCode, item.productLine, {
      onStateProductDirectory: item.onStateProductDirectory,
    })
    /*
      Location no longer stops an order at checkout (owner, 2026-09-19). The state
      rules still decide what the state pages say, the shipment split and the minimum
      age; `blocked` stays in the result, always empty, so its readers are unchanged.
    */
    if (decision.status === 'RESTRICTED') restricted.push({ item, decision })
    shippable.push(item)
  }

  const shipmentGroups: ShipmentGroup[] = []
  for (const channel of CHANNEL_ORDER) {
    const groupItems = shippable.filter((i) => i.fulfillmentChannel === channel)
    if (groupItems.length === 0) continue
    shipmentGroups.push({
      channel,
      items: groupItems,
      subtotalCents: groupItems.reduce((sum, i) => sum + lineSubtotal(i), 0),
      requiresAdultSignature: groupItems.some(
        (i) =>
          canShipTo(stateCode, i.productLine, {
            onStateProductDirectory: i.onStateProductDirectory,
          }).requiresAdultSignature,
      ),
      // Only the parcel channel can carry a free-shipping promise. Specialty PACT
      // carriers and local couriers are priced per shipment and are never free.
      eligibleForFreeShipping: channel === 'PARCEL',
    })
  }

  const requiredAttestations: AttestationKind[] = []
  if (shippable.some((i) => i.notForHumanConsumption)) {
    requiredAttestations.push('NOT_FOR_HUMAN_CONSUMPTION')
  }
  if (shippable.some((i) => i.ageRestricted)) {
    requiredAttestations.push('AGE_21_PLUS')
  }
  requiredAttestations.push('PAYMENT_METHOD_ACKNOWLEDGED')

  const minAge = shippable.reduce((max, i) => {
    const rule = getStateRule(stateCode, i.productLine)
    return Math.max(max, effectiveMinAge(rule?.minAge ?? BRAND.minimumAge))
  }, 0)

  return {
    canProceed: blocked.length === 0 && shippable.length > 0,
    blocked,
    restricted,
    shipmentGroups,
    requiredAttestations,
    minAge,
    requiresAgeVerification: shippable.some((i) => i.ageRestricted),
    requiresAdultSignature: shipmentGroups.some((g) => g.requiresAdultSignature),
  }
}

export interface FreeShippingProgress {
  readonly eligibleSubtotalCents: number
  readonly thresholdCents: number
  readonly remainingCents: number
  readonly qualified: boolean
  /** 0–1, for the progress bar. */
  readonly progress: number
  /** True when the cart contains items excluded from the promotion. */
  readonly hasExcludedItems: boolean
}

/**
 * Free shipping over $100 applies to the PARCEL-eligible subtotal only.
 *
 * Vapes ride a specialty PACT carrier and local-courier deliveries are priced per
 * run, so neither can be given away. `hasExcludedItems` exists so the cart can say
 * so inline — a customer must never discover an exclusion at the payment step.
 */
export function freeShippingProgress(
  groups: readonly ShipmentGroup[],
  thresholdCents: number = FREE_SHIPPING_THRESHOLD_CENTS,
): FreeShippingProgress {
  const eligible = groups
    .filter((g) => g.eligibleForFreeShipping)
    .reduce((sum, g) => sum + g.subtotalCents, 0)

  const qualified = eligible >= thresholdCents
  return {
    eligibleSubtotalCents: eligible,
    thresholdCents,
    remainingCents: qualified ? 0 : thresholdCents - eligible,
    qualified,
    progress: thresholdCents === 0 ? 1 : Math.min(1, eligible / thresholdCents),
    hasExcludedItems: groups.some((g) => !g.eligibleForFreeShipping),
  }
}
