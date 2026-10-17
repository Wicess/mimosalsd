/**
 * Editing an order's invoice from the admin panel (owner, 2026-10-17).
 *
 * The owner agrees changes with customers in the chat: a different quantity, a price
 * agreed for a larger order, a shipping charge for an address abroad, a goodwill
 * discount. This is the arithmetic for that edit, kept pure so it can be tested on its
 * own. Money is integer cents throughout (CLAUDE.md rule 8).
 *
 * Only before the customer has paid. After that the invoice is a record of what was
 * paid, and a change to it is a refund, which has its own form.
 */
import type { OrderStatus } from './types'

export const INVOICE_EDITABLE: ReadonlySet<OrderStatus> = new Set(['PENDING_VERIFICATION', 'AWAITING_PAYMENT'])

export const INVOICE_EDITED = 'INVOICE_EDITED'

export interface EditableLine {
  readonly id: string
  readonly quantity: number
  readonly unitPriceCents: number
}

export interface InvoiceTotals {
  readonly subtotalCents: number
  readonly shippingCents: number
  readonly discountCents: number
  readonly subscriberDiscountCents: number
  readonly appDiscountCents: number
  readonly paymentDiscountCents: number
  readonly totalCents: number
}

export interface InvoiceEdit {
  /** Every current line, with its new quantity and unit price. Quantity 0 removes it. */
  readonly lines: readonly EditableLine[]
  readonly shippingCents: number
  readonly discountCents: number
}

export type RecalculatedInvoice =
  | {
      readonly ok: true
      readonly lines: readonly (EditableLine & { readonly lineTotalCents: number })[]
      readonly removed: readonly string[]
      readonly totals: InvoiceTotals
    }
  | { readonly ok: false; readonly error: string }

/** The largest single amount the form accepts: $100,000. A typo, not a price. */
export const MAX_AMOUNT_CENTS = 10_000_000
export const MAX_QUANTITY = 999

/** "12.5", "$12.50", "12" → cents. Null when it is not a usable amount. */
export function parseDollars(raw: string): number | null {
  const cleaned = raw.trim().replace(/^\$/, '').replace(/,/g, '')
  if (!/^\d+(?:\.\d{1,2})?$/.test(cleaned)) return null
  const [whole, fraction = ''] = cleaned.split('.')
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, '0'))
  return Number.isSafeInteger(cents) && cents <= MAX_AMOUNT_CENTS ? cents : null
}

/**
 * The new invoice, or the reason it cannot be saved.
 *
 * The discounts the customer earned at checkout (subscriber, app, paying by Bitcoin)
 * are kept as they were: they are promises made to the customer, and the edit form
 * does not offer them. The operator's own adjustment is `discountCents`.
 */
export function recalculateInvoice(current: InvoiceTotals, currentLineIds: readonly string[], edit: InvoiceEdit): RecalculatedInvoice {
  const known = new Set(currentLineIds)
  if (edit.lines.length !== known.size || edit.lines.some((l) => !known.has(l.id))) {
    return { ok: false, error: 'The order changed while you were editing it. Reload the page and try again.' }
  }
  for (const line of edit.lines) {
    if (!Number.isInteger(line.quantity) || line.quantity < 0 || line.quantity > MAX_QUANTITY) {
      return { ok: false, error: `Quantities are whole numbers from 0 to ${MAX_QUANTITY}.` }
    }
    if (!Number.isInteger(line.unitPriceCents) || line.unitPriceCents < 0 || line.unitPriceCents > MAX_AMOUNT_CENTS) {
      return { ok: false, error: 'A unit price is not a valid amount.' }
    }
  }
  for (const amount of [edit.shippingCents, edit.discountCents]) {
    if (!Number.isInteger(amount) || amount < 0 || amount > MAX_AMOUNT_CENTS) {
      return { ok: false, error: 'Shipping and discount must be amounts of zero or more.' }
    }
  }

  const kept = edit.lines.filter((l) => l.quantity > 0).map((l) => ({ ...l, lineTotalCents: l.quantity * l.unitPriceCents }))
  if (kept.length === 0) {
    return { ok: false, error: 'An invoice needs at least one item. To drop the whole order, cancel it instead.' }
  }
  const subtotalCents = kept.reduce((sum, l) => sum + l.lineTotalCents, 0)
  const totalCents =
    subtotalCents +
    edit.shippingCents -
    edit.discountCents -
    current.subscriberDiscountCents -
    current.appDiscountCents -
    current.paymentDiscountCents
  if (totalCents < 0) {
    return { ok: false, error: 'The discounts come to more than the order. Lower the discount.' }
  }

  return {
    ok: true,
    lines: kept,
    removed: edit.lines.filter((l) => l.quantity === 0).map((l) => l.id),
    totals: {
      subtotalCents,
      shippingCents: edit.shippingCents,
      discountCents: edit.discountCents,
      subscriberDiscountCents: current.subscriberDiscountCents,
      appDiscountCents: current.appDiscountCents,
      paymentDiscountCents: current.paymentDiscountCents,
      totalCents,
    },
  }
}
