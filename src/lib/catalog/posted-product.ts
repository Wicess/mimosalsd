import { z } from 'zod'
import type { ProductLine } from '@/lib/compliance/types'
import { CATEGORIES, DIRECTORY_STATES } from './catalog.data'
import { variantsForLadder, type Category, type PriceTier, type Product } from './types'

/**
 * ─────────────────────────────────────────────────────────────────────────────
 *  PRODUCTS POSTED FROM THE ADMIN PANEL.
 *
 *  The authored catalogue lives in code. A posted product lives in the
 *  `PostedProduct` table as one document and becomes an ordinary `Product` here,
 *  so everything downstream (the product page, category grids, search, the cart,
 *  checkout, the sitemap) handles both without knowing which is which.
 *
 *  ── What the operator chooses, and what they do not ────────────────────────
 *  The operator chooses the words, the sizes and prices, the photographs and the
 *  CATEGORY. They do not choose the compliance flags. Those follow from the
 *  category's product line, exactly as they do for every authored product in that
 *  line. So root bark always carries the intended-use attestation, a vape always
 *  ships PACT-only with an adult signature, and no form field can turn either off.
 *  A test holds these presets to the authored catalogue, so the two cannot drift.
 * ─────────────────────────────────────────────────────────────────────────────
 */

/** Only the authored categories can be posted into. LSD and any other controlled substance is not one. */
export function postableCategories(): readonly Category[] {
  return CATEGORIES
}

export function categoryForSlug(slug: string): Category | undefined {
  return CATEGORIES.find((c) => c.slug === slug)
}

type ComplianceFlags = Pick<
  Product,
  | 'notForHumanConsumption'
  | 'ageRestricted'
  | 'fulfillmentChannel'
  | 'pactRegulated'
  | 'directoryStates'
>

/**
 * The compliance flags every product in a line carries.
 *
 * `onStateDirectory` only means anything for vapes. Some states only accept vapor
 * products from brands listed on the state's directory; the authored vapes carry
 * that list or an empty one, and a posted vape does the same.
 */
export function complianceFor(line: ProductLine, onStateDirectory = false): ComplianceFlags {
  switch (line) {
    case 'MIMOSA_HOSTILIS':
      return {
        notForHumanConsumption: true,
        ageRestricted: false,
        fulfillmentChannel: 'PARCEL',
        pactRegulated: false,
        directoryStates: [],
      }
    case 'AMANITA':
      return {
        notForHumanConsumption: false,
        ageRestricted: true,
        fulfillmentChannel: 'PARCEL',
        pactRegulated: false,
        directoryStates: [],
      }
    case 'VAPE':
      return {
        notForHumanConsumption: false,
        ageRestricted: true,
        fulfillmentChannel: 'PACT_CARRIER',
        pactRegulated: true,
        directoryStates: onStateDirectory ? [...DIRECTORY_STATES] : [],
      }
  }
}

/** No bulk tiers in any line: every size has one fixed price (owner, 2026-09-14). */
export function priceTiersFor(): readonly PriceTier[] {
  return []
}

// ── The document ───────────────────────────────────────────────────────────

const MAX_PRICE_CENTS = 1_000_000

export const postedVariantSchema = z.object({
  id: z.string().min(1).max(160),
  sku: z.string().min(1).max(80),
  name: z.string().trim().min(1).max(60),
  priceCents: z.number().int().min(100).max(MAX_PRICE_CENTS),
  compareAtCents: z.number().int().min(100).max(MAX_PRICE_CENTS).optional(),
  inStock: z.boolean(),
})

export const postedImageSchema = z.object({
  /** Only keys the admin uploader writes: content-hashed, public, an image type. */
  objectKey: z.string().regex(/^media\/[0-9a-f]{32}\.(jpg|png|webp|avif|gif)$/),
  alt: z.string().trim().min(3).max(200),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
})

export const postedDocumentSchema = z.object({
  name: z.string().trim().min(3).max(120),
  shortDescription: z.string().trim().min(20).max(300),
  description: z.string().trim().min(40).max(20000),
  specs: z
    .array(z.tuple([z.string().trim().min(1).max(60), z.string().trim().min(1).max(200)]))
    .max(20),
  variants: z.array(postedVariantSchema).min(1).max(12),
  /**
   * The price of a full pound (owner, 2026-09-14). Every product but disposables is
   * sold in 1/4, 1/3, 1/2 and 1 lb from it. Absent on disposables, which have one
   * unit price, and on documents saved before pound pricing.
   */
  poundPriceCents: z.number().int().min(100).max(MAX_PRICE_CENTS).optional(),
  /** Facts only the owner knows, given to the automatic writer. */
  notes: z.string().max(1000).optional(),
  /** The automatic writer's page: sections, advantages, FAQs, sources (2026-09-14). */
  content: z
    .object({
      sections: z.array(z.object({ heading: z.string().min(1).max(120), paragraphs: z.array(z.string().min(1).max(3000)).min(1).max(8) })).max(10),
      advantages: z.array(z.string().min(1).max(300)).max(10),
      faqs: z.array(z.object({ question: z.string().min(1).max(250), answer: z.string().min(1).max(800) })).max(10),
      sources: z.array(z.object({ label: z.string().min(1).max(200), url: z.string().url().max(500) })).max(10),
    })
    .optional(),
  seo: z
    .object({
      metaTitle: z.string().min(1).max(80),
      metaDescription: z.string().min(1).max(200),
      keywords: z.array(z.string().min(1).max(80)).max(12),
    })
    .optional(),
  writer: z.enum(['claude', 'template']).optional(),
  writtenAt: z.string().max(40).optional(),
  images: z.array(postedImageSchema).max(6),
  batchCodes: z.array(z.string().min(1).max(40)).max(10),
  isFeatured: z.boolean(),
  onStateDirectory: z.boolean().default(false),
})

export type PostedDocument = z.infer<typeof postedDocumentSchema>

export interface PostedRecord {
  readonly slug: string
  readonly categorySlug: string
  readonly document: unknown
  readonly isActive: boolean
}

/**
 * A stored row as a storefront `Product`, or undefined when the row cannot be
 * one: an unknown category, or a document that no longer validates. A broken row
 * drops out of the shop rather than taking a page down with it.
 */
export function toPostedProduct(record: PostedRecord): Product | undefined {
  const category = categoryForSlug(record.categorySlug)
  if (!category) return undefined
  const parsed = postedDocumentSchema.safeParse(record.document)
  if (!parsed.success) return undefined
  const doc = parsed.data

  return {
    slug: record.slug,
    name: doc.name,
    productLine: category.productLine,
    categorySlug: category.slug,
    shortDescription: doc.shortDescription,
    description: doc.description,
    specs: doc.specs,
    ...complianceFor(category.productLine, doc.onStateDirectory),
    ...sizesFor(record.slug, category.productLine, doc, record.isActive),
    priceTiers: priceTiersFor(),
    images: doc.images,
    batchCodes: doc.batchCodes,
    isFeatured: doc.isFeatured,
    ...(doc.content ? { content: doc.content } : {}),
    ...(doc.seo ? { seo: doc.seo } : {}),
  }
}

/**
 * A posted product's sizes. By the pound from its pound price; one unit for a
 * disposable. A weighed product saved before pound pricing (with sizes typed by
 * hand, like "7g") is kept out of the shop until its price per pound is set.
 */
function sizesFor(slug: string, line: ProductLine, doc: PostedDocument, isActive: boolean) {
  if (line === 'VAPE') return { variants: doc.variants, isActive }
  if (!doc.poundPriceCents) return { variants: doc.variants, isActive: false }
  const sizing = { poundPriceCents: doc.poundPriceCents, defaultKey: 'f4' }
  const inStock = doc.variants.every((v) => v.inStock)
  return {
    sizing,
    variants: variantsForLadder(slug, sizing).map((v) => ({ ...v, inStock })),
    isActive,
  }
}

// ── Slugs, variant ids and SKUs ────────────────────────────────────────────

/** Lower-case words joined by hyphens, as every authored slug is. */
export function slugify(text: string): string {
  return text
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
    .replace(/-+$/g, '')
}

/**
 * A slug for a new product that no other product has.
 *
 * `taken` holds every slug in use, authored and posted. The URL is permanent once
 * a product is live, so a clash is resolved by suffixing, never by replacing.
 */
export function uniqueSlug(name: string, taken: ReadonlySet<string>): string {
  const base = slugify(name) || 'product'
  if (!taken.has(base)) return base
  for (let n = 2; ; n++) {
    const candidate = `${base}-${n}`
    if (!taken.has(candidate)) return candidate
  }
}

/**
 * A variant's id and SKU, derived from its name.
 *
 * Derived rather than random so an edit that keeps a size's name keeps its id,
 * and a cart holding that size keeps working. The `P-` prefix keeps posted SKUs
 * out of the authored SKU space, because SKUs are unique across the whole table.
 */
export function variantIdentity(productSlug: string, variantName: string) {
  const key = slugify(variantName) || 'unit'
  return {
    id: `${productSlug}--${key}`,
    sku: `P-${productSlug}-${key}`.toUpperCase().slice(0, 80),
  }
}
