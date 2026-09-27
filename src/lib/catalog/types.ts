import type {
  FulfillmentChannel,
  ProductLine,
  UsJurisdictionCode,
} from '@/lib/compliance/types'
import { isPriced, sizeOptions, sizeStep, type SizeLadder } from './sizing'
import type { ProductContent, ProductSeo } from './autowrite/types'

/**
 * Catalog domain types.
 *
 * Deliberately decoupled from the Prisma models. The repository maps between them,
 * so the UI does not break when the schema evolves and — more usefully right now —
 * the whole catalog can be served from memory until the database is provisioned.
 */

export interface ProductImage {
  readonly objectKey: string
  readonly alt: string
  readonly width: number
  readonly height: number
}

export interface ProductVariant {
  readonly id: string
  readonly sku: string
  readonly name: string
  /** Integer cents. Never a float. */
  readonly priceCents: number
  readonly compareAtCents?: number
  readonly inStock: boolean
}

/**
 * Bulk quantity break. Drives the "Bulk discount available" badge.
 *
 * A PERCENTAGE, not a price. Sizes are variants now, so one product can be a
 * $28 bag or a $310 bag depending on what is selected — a tier frozen in cents
 * would sell the 1 kg bag at the 50 g discount. The discount is a property of
 * the quantity ordered; the price is a property of the size in the box.
 */
export interface PriceTier {
  readonly minQuantity: number
  /** Whole percent off the selected variant's unit price. */
  readonly percentOff: number
  readonly label: string
}

/**
 * Unit price after a bulk tier, in whole cents.
 *
 * Rounded, not truncated, and rounded once: computing a line total as
 * `round(unit × pct) × qty` and computing it as `round(unit × pct × qty)` differ
 * by up to a cent per unit, and the cart must agree with the confirmation email
 * to the cent.
 */
export function tierPriceCents(unitCents: number, tier: PriceTier): number {
  return Math.round(unitCents * (1 - tier.percentOff / 100))
}

/** The best tier a quantity has reached, if any. */
export function tierFor(
  tiers: readonly PriceTier[],
  quantity: number,
): PriceTier | undefined {
  return [...tiers]
    .filter((t) => quantity >= t.minQuantity)
    .sort((a, b) => b.minQuantity - a.minQuantity)[0]
}

export interface LabPanelResult {
  readonly panel: string
  readonly analyte: string
  readonly value: string
  readonly unit?: string
  readonly passed: boolean
}

export interface LabBatch {
  readonly batchCode: string
  readonly labName: string
  readonly isoAccredited: boolean
  readonly testedAt: string
  readonly pdfKey?: string
  readonly results: readonly LabPanelResult[]
}

export interface Category {
  readonly slug: string
  readonly name: string
  /**
   * The short label the site navigation uses, where the full name does not fit.
   *
   * The phone rail read "Shop · Mimosa Hostilis Root Bark · Amanita Mus…" at
   * 375px — one and a half categories, with the third a swipe away that nobody
   * knew to make. Navigation is where a name has to be short. The category page,
   * its <title>, the breadcrumb, the footer, the sitemap and llms.txt all keep
   * `name`, because those are the places the full term is what somebody searched.
   *
   * Optional, falling back to `name`, so a category added without one still
   * appears in the menu rather than failing to build.
   */
  readonly navLabel?: string
  readonly productLine: ProductLine
  /** One or two sentences, for the centred page header and the homepage cards. */
  readonly intro: string
  /**
   * The rest of the category's copy, rendered in the body of the category page.
   *
   * Split out from `intro` when the headers were centred: centred text stops being
   * readable past a couple of lines. The words were not cut — a category page that
   * says nothing is thin content, which Bing names directly as grounds for losing
   * crawl budget — they moved below the product grid where length is fine.
   */
  readonly detail?: string
  /**
   * The structured replacement for `detail`.
   *
   * `detail` was one paragraph, and one paragraph is what a category page looks like
   * when nobody has decided what it is for. This is the same subject given a shape an
   * answer engine can lift from: a definition that stands on its own, sub-questions
   * phrased the way people ask them, and a spec sheet.
   *
   * Categories without one fall back to `detail`, so adding this is per-category and
   * nothing regresses while the others are still a paragraph.
   */
  readonly about?: CategoryAbout
  readonly metaTitle: string
  readonly metaDesc: string
  readonly sortOrder: number
}

/** One row of the at-a-glance spec sheet. */
export interface CategoryFact {
  readonly label: string
  readonly value: string
}

/**
 * A sub-question inside the About band.
 *
 * `linkSlug` names a guide or a post WITHOUT saying which. Content moves between the
 * two — `what-is-muscimol` is a post today and reads like a guide — and a hardcoded
 * `/guides/...` here would 404 the day it moved. The component resolves the slug
 * against both collections and renders no link at all if it resolves to neither,
 * which is the rule `lib/seo/routes.ts` learned the hard way: never link a page that
 * does not exist.
 */
export interface CategoryAboutBlock {
  /** An H3, phrased as the question a reader actually types. */
  readonly question: string
  /**
   * Leads with the answer, in 40–60 words.
   *
   * Not a style preference. A passage that reaches its verdict in sentence four is
   * not the passage that gets quoted, and quotation is the whole acquisition channel
   * here — the same rule `content/faq.ts` already holds itself to.
   */
  readonly answer: string
  /** Slug of the one guide or post this block earns a link to. */
  readonly linkSlug?: string
}

export interface CategoryAbout {
  /**
   * The exact heading. Authored rather than derived, because deriving it produced
   * "About amanita muscaria" — a binomial with the genus in lower case, which is
   * both taxonomically wrong and the kind of detail this category is judged on.
   */
  readonly heading: string
  /** The definition block. Stands alone, out of context, as a complete answer. */
  readonly lede: string
  readonly blocks: readonly CategoryAboutBlock[]
  /**
   * The spec sheet — the STABLE facts only.
   *
   * Nothing about state legality, minimum age or review dates belongs here. Those
   * are read from `state_rules` at render time so this page cannot drift from what
   * the cart enforces (CLAUDE.md rule 1), and so a claim can never outlive the data
   * behind it.
   */
  readonly facts: readonly CategoryFact[]
}

export interface Product {
  readonly slug: string
  readonly name: string
  readonly productLine: ProductLine
  readonly categorySlug: string
  readonly shortDescription: string
  readonly description: string
  readonly specs: ReadonlyArray<readonly [string, string]>

  // Compliance flags — these drive UI and cart behaviour, not just labelling.
  readonly notForHumanConsumption: boolean
  readonly ageRestricted: boolean
  readonly fulfillmentChannel: FulfillmentChannel
  readonly pactRegulated: boolean
  /** Jurisdictions where this SKU appears on the state product directory. */
  readonly directoryStates: readonly UsJurisdictionCode[]

  /**
   * How this product's quantity is measured, when it is measured at all.
   *
   * Present on everything sold by weight, which is everything but disposables:
   * 1/4, 1/3, 1/2 and 1 lb, priced from one pound price. Its sizes GENERATE
   * `variants` below, so the cart, the order and the confirmation email keep
   * speaking in variants and know nothing about pounds.
   *
   * Absent on disposables. They are counted, not weighed: one unit price and a
   * quantity.
   */
  readonly sizing?: SizeLadder

  readonly variants: readonly ProductVariant[]
  readonly priceTiers: readonly PriceTier[]
  readonly images: readonly ProductImage[]
  readonly batchCodes: readonly string[]

  readonly isFeatured: boolean
  readonly isActive: boolean
  readonly rating?: { readonly average: number; readonly count: number }

  /** Written automatically for a posted product: sections, advantages, FAQs and sources. */
  readonly content?: ProductContent
  /** Its search title, description and keywords. */
  readonly seo?: ProductSeo
}

/**
 * Variants derived from a size ladder.
 *
 * The ladder is authored; the variants are computed. Nothing downstream of this
 * function knows a ladder exists — the cart validates a `variantId`, the order
 * stores one, and the packing slip prints `variant.name`, which is the size as
 * it is printed on the bag.
 *
 * The id embeds the step key rather than the amount, so re-pricing a line or
 * re-labelling 1000g as 1kg cannot orphan a line already sitting in someone's
 * cart.
 */
export function variantsForLadder(
  slug: string,
  ladder: SizeLadder,
): readonly ProductVariant[] {
  return sizeOptions(ladder).map((option) => ({
    id: `${slug}-${option.key}`,
    sku: `${slug.toUpperCase()}-${sizeStep(option.key)?.skuLabel ?? option.key.toUpperCase()}`,
    name: option.label,
    priceCents: option.priceCents,
    inStock: isPriced(ladder),
  }))
}

/**
 * The price a card shows, and it is one price, not a range (owner, 2026-09-14):
 * the price of a pound for a weighed product, the price of one unit for a
 * disposable.
 */
export function listPrice(product: Product): { readonly cents: number; readonly per: 'lb' | 'unit' } {
  if (product.sizing) return { cents: product.sizing.poundPriceCents, per: 'lb' }
  return { cents: product.variants[0]?.priceCents ?? 0, per: 'unit' }
}

/** Lowest price across variants: what sorting and the price filter compare. */
export function fromPriceCents(product: Product): number {
  return Math.min(...product.variants.map((v) => v.priceCents))
}

/** True when the buyer has a size to choose, so a card must say "From $x". */
export function hasSizeChoice(product: Product): boolean {
  return product.variants.length > 1
}

export function hasBulkPricing(product: Product): boolean {
  return product.priceTiers.length > 0
}

export function isOnStateDirectory(
  product: Product,
  stateCode: UsJurisdictionCode,
): boolean {
  return product.directoryStates.includes(stateCode)
}

export type SortKey = 'featured' | 'price-asc' | 'price-desc' | 'newest' | 'rating'

export interface CatalogFilters {
  readonly categorySlug?: string
  readonly productLine?: ProductLine
  readonly minPriceCents?: number
  readonly maxPriceCents?: number
  /** Hide anything that cannot legally ship to this jurisdiction. */
  readonly shipsTo?: UsJurisdictionCode
  readonly query?: string
  readonly sort?: SortKey
}
