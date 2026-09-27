import type { PaymentMethod } from './types'

/**
 * Bitcoin discount.
 *
 * Card-adjacent rails cost us in fees and in chargeback exposure; a Bitcoin transfer
 * costs neither and cannot be reversed after the fact. The discount is that saving
 * handed back, not a promotion — which is why it lives here as a rate rather than in
 * a campaign table that expires.
 */
export const BITCOIN_DISCOUNT_RATE = 0.07

export function discountRateFor(method: PaymentMethod): number {
  return method === 'BITCOIN' ? BITCOIN_DISCOUNT_RATE : 0
}

/**
 * The discount in whole cents.
 *
 * Rounded DOWN, always. A half-cent rounded up is a cent we quoted and cannot take,
 * and across an order book that is a reconciliation gap nobody can explain later.
 * Rounding down means the customer is never charged more than the quote.
 *
 * Applied to the goods only. Shipping is a cost we pay a carrier — discounting it
 * would mean paying part of someone's postage for choosing a payment rail.
 */
export function paymentDiscountCents(subtotalCents: number, method: PaymentMethod): number {
  const rate = discountRateFor(method)
  if (rate === 0) return 0
  return Math.floor(subtotalCents * rate)
}

/** Percentage as shown in the UI: 7, not 0.07. */
export function discountPercent(method: PaymentMethod): number {
  return Math.round(discountRateFor(method) * 100)
}
