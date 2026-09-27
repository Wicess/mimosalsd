import type { FulfillmentChannel, UsJurisdictionCode } from '@/lib/compliance/types'
import { variantsForLadder, type Product } from './types'
import { isPriced, SIZE_KEYS } from './sizing'

/**
 * Operator edits, layered over the authored catalogue.
 *
 * WHY AN OVERLAY AND NOT A DATABASE CATALOGUE. The authored catalogue is read
 * synchronously by the edge proxy, which returns real 404s for slugs that do not
 * exist — under Cache Components a `notFound()` after the PPR shell has flushed
 * returns HTTP 200 with not-found content, a soft 404 that drains crawl budget on a
 * site whose only acquisition channel is organic search. The edge cannot reach Neon,
 * so a database catalogue would take that protection away.
 *
 * An override can only CHANGE a product, never add or remove one. The set of valid
 * slugs therefore stays exactly what the authored file says, the proxy keeps working
 * untouched, and every page keeps prerendering.
 *
 * Null means inherit. That is the whole contract: clearing a field in the admin
 * restores the authored value instead of blanking the page, so no edit is a one-way
 * door and nothing an operator does can leave a product page empty.
 */

export interface ProductOverrideRecord {
  readonly slug: string
  readonly name: string | null
  readonly shortDescription: string | null
  readonly description: string | null
  readonly specs: unknown
  readonly basePriceCents: number | null
  /** The price of a full pound (0020). Every size is derived from it. */
  readonly poundPriceCents?: number | null
  readonly defaultSizeKey: string | null
  readonly variantPrices: unknown
  readonly priceTiers: unknown
  readonly notForHumanConsumption: boolean | null
  readonly ageRestricted: boolean | null
  readonly pactRegulated: boolean | null
  readonly fulfillmentChannel: string | null
  readonly directoryStates: unknown
  readonly isActive: boolean | null
  readonly isFeatured: boolean | null
}

const CHANNELS = new Set<FulfillmentChannel>(['PARCEL', 'PACT_CARRIER', 'LOCAL_COURIER'])

/** JSON columns are `unknown` at the type level and operator-authored at runtime. */
function asSpecs(value: unknown): ReadonlyArray<readonly [string, string]> | undefined {
  if (!Array.isArray(value)) return undefined
  const rows = value
    .filter((row): row is unknown[] => Array.isArray(row) && row.length >= 2)
    .map((row) => [String(row[0]), String(row[1])] as const)
    .filter(([label, detail]) => label.trim() !== '' && detail.trim() !== '')
  return rows.length > 0 ? rows : undefined
}


function asDirectoryStates(value: unknown): readonly UsJurisdictionCode[] | undefined {
  if (!Array.isArray(value)) return undefined
  return value
    .map((v) => String(v).toUpperCase())
    .filter((v) => /^[A-Z]{2}$/.test(v)) as readonly UsJurisdictionCode[]
}

function asVariantPrices(value: unknown): Record<string, number> | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined
  const out: Record<string, number> = {}
  for (const [sku, cents] of Object.entries(value as Record<string, unknown>)) {
    const n = Number(cents)
    // Integer cents only, and never negative. A float here would round differently in
    // the cart than in the confirmation email.
    if (Number.isInteger(n) && n >= 0) out[sku] = n
  }
  return Object.keys(out).length > 0 ? out : undefined
}

/**
 * Merge one override onto one authored product.
 *
 * Pure, and exported so the merge can be tested exhaustively without a database.
 * The rules that carry money are the ones worth reading twice:
 *
 *  · Editing `basePriceCents` regenerates the WHOLE size ladder through
 *    `variantsForLadder`, because every other size is derived from the base by the
 *    house curve. Writing variant prices directly would let the ladder drift out of
 *    proportion, and the 1 kg bag could end up cheaper per gram than the 500 g one.
 *  · `defaultSizeKey` is only honoured if the ladder actually contains that step.
 *    An operator picking a size the product is not packed in would otherwise open the
 *    PDP on a variant that does not exist.
 */
export function applyOverride(
  base: Product,
  override: ProductOverrideRecord | undefined,
): Product {
  if (!override) return base

  const name = override.name?.trim() || base.name
  const specs = asSpecs(override.specs) ?? base.specs
  const directoryStates = asDirectoryStates(override.directoryStates) ?? base.directoryStates
  const channel =
    override.fulfillmentChannel && CHANNELS.has(override.fulfillmentChannel as FulfillmentChannel)
      ? (override.fulfillmentChannel as FulfillmentChannel)
      : base.fulfillmentChannel

  let sizing = base.sizing
  let variants = base.variants

  if (base.sizing) {
    /*
      The pound price the owner set. The old `basePriceCents` is NOT read: it was the
      price of a different base size (a kilogram, 28 grams, a pack of 20), and read
      as a pound it would sell a pound at the price of an ounce.
    */
    const poundPriceCents =
      override.poundPriceCents && override.poundPriceCents > 0
        ? override.poundPriceCents
        : base.sizing.poundPriceCents

    const candidateKey = override.defaultSizeKey?.trim()
    const defaultKey =
      candidateKey && SIZE_KEYS.includes(candidateKey) ? candidateKey : base.sizing.defaultKey

    sizing = { poundPriceCents, defaultKey }

    // Only regenerate when something actually moved. Rebuilding identical variants
    // would churn object identity for every product on every render.
    if (poundPriceCents !== base.sizing.poundPriceCents || defaultKey !== base.sizing.defaultKey) {
      variants = variantsForLadder(base.slug, sizing)
    }
  } else {
    // No ladder — vapes and anything else sold as a single unit. Prices are per SKU.
    const prices = asVariantPrices(override.variantPrices)
    if (prices) {
      variants = base.variants.map((v) =>
        prices[v.sku] === undefined ? v : { ...v, priceCents: prices[v.sku]! },
      )
    }
  }

  return {
    ...base,
    name,
    shortDescription: override.shortDescription?.trim() || base.shortDescription,
    description: override.description?.trim() || base.description,
    specs,
    notForHumanConsumption:
      override.notForHumanConsumption ?? base.notForHumanConsumption,
    ageRestricted: override.ageRestricted ?? base.ageRestricted,
    pactRegulated: override.pactRegulated ?? base.pactRegulated,
    fulfillmentChannel: channel,
    directoryStates,
    ...(sizing ? { sizing } : {}),
    variants,
    // No bulk discounts: every size has one fixed price (owner, 2026-09-14).
    priceTiers: [],
    isActive: override.isActive ?? base.isActive,
    isFeatured: override.isFeatured ?? base.isFeatured,
  }
}

/** Apply a whole map of overrides to a list. */
export function applyOverrides(
  products: readonly Product[],
  overrides: ReadonlyMap<string, ProductOverrideRecord>,
): readonly Product[] {
  return products.map((p) => withoutUnpriced(applyOverride(p, overrides.get(p.slug))))
}

/**
 * A product sold by the pound with no pound price yet is kept out of the shop: a
 * product at $0.00 is worse than no product. It reappears the moment its price is set.
 */
export function withoutUnpriced(product: Product): Product {
  return product.sizing && !isPriced(product.sizing) ? { ...product, isActive: false } : product
}
