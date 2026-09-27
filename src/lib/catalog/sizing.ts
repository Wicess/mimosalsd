/**
 * ─────────────────────────────────────────────────────────────────────────────
 *  SIZES BY THE POUND — how every weighed product is sold and priced
 *  (owner, 2026-09-14).
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Every product except disposables is sold in four fixed sizes: 1/4 lb, 1/3 lb,
 * 1/2 lb and 1 lb. The owner sets ONE price, the price of a full pound, and every
 * size is that price times its share of a pound:
 *
 *     price(size) = round_to_the_cent(poundPrice × fraction)
 *
 * No grams, no price ranges, no premium for buying small and no bulk discounts:
 * each size has one fixed price, worked out the same way every time. Changing a
 * product's price is editing one number, and the four sizes cannot drift out of
 * proportion with one another.
 *
 * Money is integer cents throughout.
 *
 * DISPOSABLES HAVE NO SIZES. They are counted, not weighed: the owner sets a price
 * per unit and the customer picks how many, so they carry no `sizing` at all.
 */

/** Weighed products are sold by the pound. Nothing else is measured. */
export type SizeUnit = 'lb'

export interface SizeStep {
  /** Stable key, used in variant ids and so never re-pointed. */
  readonly key: string
  /** Share of a pound. */
  readonly fraction: number
  /** What the button and the cart line say. */
  readonly label: string
  /** The spoken form, for screen readers. */
  readonly longLabel: string
  /** Letters and digits only, for the SKU. */
  readonly skuLabel: string
}

/**
 * The four sizes, smallest first. The keys are the ones the old weight ladder used
 * for the same fractions, so a quarter already sitting in a cart stays a quarter.
 */
export const SIZE_STEPS: readonly SizeStep[] = [
  { key: 'f4', fraction: 1 / 4, label: '1/4 lb', longLabel: 'a quarter pound', skuLabel: 'QTR-LB' },
  { key: 'f3', fraction: 1 / 3, label: '1/3 lb', longLabel: 'a third of a pound', skuLabel: 'THIRD-LB' },
  { key: 'f2', fraction: 1 / 2, label: '1/2 lb', longLabel: 'half a pound', skuLabel: 'HALF-LB' },
  { key: 'f1', fraction: 1, label: '1 lb', longLabel: 'one pound', skuLabel: '1-LB' },
]

export const SIZE_KEYS: readonly string[] = SIZE_STEPS.map((step) => step.key)

export interface SizeLadder {
  /** The one price the owner sets: a full pound, in integer cents. 0 until it is set. */
  readonly poundPriceCents: number
  /** Which size the product page opens on. */
  readonly defaultKey: string
}

export interface SizeOption {
  readonly key: string
  /** "1/4 lb". */
  readonly label: string
  /** "a quarter pound". */
  readonly longLabel: string
  readonly fraction: number
  readonly priceCents: number
}

export function sizeStep(key: string): SizeStep | undefined {
  return SIZE_STEPS.find((s) => s.key === key)
}

/** A size's price: the pound price times its share of a pound, to the cent. */
export function sizePriceCents(ladder: SizeLadder, key: string): number {
  const step = sizeStep(key)
  if (!step) return ladder.poundPriceCents
  return Math.round(ladder.poundPriceCents * step.fraction)
}

/** A pound price has been set, so the product can be sold. */
export function isPriced(ladder: SizeLadder): boolean {
  return ladder.poundPriceCents > 0
}

/** Every size, smallest first, with its price. */
export function sizeOptions(ladder: SizeLadder): readonly SizeOption[] {
  return SIZE_STEPS.map((step) => ({
    key: step.key,
    label: step.label,
    longLabel: step.longLabel,
    fraction: step.fraction,
    priceCents: sizePriceCents(ladder, step.key),
  }))
}

/** The option the product page opens on, falling back to the smallest size. */
export function defaultSizeOption(ladder: SizeLadder): SizeOption | undefined {
  const options = sizeOptions(ladder)
  return options.find((o) => o.key === ladder.defaultKey) ?? options[0]
}
