import 'server-only'
import type {
  BatchOption,
  CategoryOption,
  PostedProductValues,
} from '@/components/admin/posted-product-form'
import type { ProductLine } from '@/lib/compliance/types'
import { db } from '@/lib/db/client'
import { isMissingTableError } from '@/lib/db/errors'
import { LAB_BATCHES, PRODUCTS } from './catalog.data'
import {
  categoryForSlug,
  complianceFor,
  postableCategories,
  postedDocumentSchema,
} from './posted-product'

/**
 * What posting into a line commits a product to, in words.
 *
 * Built from the same presets the storefront applies, so the form cannot
 * describe rules the cart does not enforce. Claims are deliberately narrow:
 * "21+ only", not "ID-verified", because checkout does not verify ID.
 */
export function rulesFor(line: ProductLine): readonly string[] {
  const flags = complianceFor(line)
  const rules: string[] = []
  if (flags.notForHumanConsumption) {
    rules.push('Sold as not for human consumption. The buyer confirms the intended use at checkout.')
  }
  if (flags.ageRestricted) rules.push('21+ only.')
  rules.push(
    flags.fulfillmentChannel === 'PACT_CARRIER'
      ? 'Ships only by a PACT Act carrier. Never free shipping.'
      : 'Ships by parcel, and counts towards free shipping over $100.',
  )
  rules.push(
    line === 'VAPE'
      ? 'Sold by count: one price per unit, and the customer picks how many.'
      : 'Sold by the pound in 1/4, 1/3, 1/2 and 1 lb, priced from the price per pound.',
  )
  rules.push('Offered only in the states whose rules allow this line. The state rules decide that, not this form.')
  return rules
}

export function postingOptions(): {
  categories: readonly CategoryOption[]
  batches: readonly BatchOption[]
} {
  const categories = postableCategories().map((c) => ({
    slug: c.slug,
    // The short name the shop's menu uses, then the full one, so both read true.
    label: c.navLabel && c.navLabel !== c.name ? `${c.navLabel} — ${c.name}` : c.name,
    productLine: c.productLine,
    rules: rulesFor(c.productLine),
  }))

  // A batch belongs to the lines of the authored products sold from it.
  const batches = LAB_BATCHES.map((b) => ({
    code: b.batchCode,
    label: `${b.batchCode} · ${b.labName} · tested ${b.testedAt}`,
    productLines: [
      ...new Set(PRODUCTS.filter((p) => p.batchCodes.includes(b.batchCode)).map((p) => p.productLine)),
    ],
  }))

  return { categories, batches }
}

/** A posted product, as the edit form's starting values. */
export async function postedForEditing(
  slug: string,
): Promise<PostedProductValues | undefined | 'not-migrated'> {
  let row
  try {
    row = await db.postedProduct.findUnique({ where: { slug } })
  } catch (error) {
    if (isMissingTableError(error)) return 'not-migrated'
    throw error
  }
  if (!row) return undefined

  const parsed = postedDocumentSchema.safeParse(row.document)
  if (!parsed.success) return undefined
  const doc = parsed.data
  const host = (process.env.NEXT_PUBLIC_R2_PUBLIC_HOST || process.env.R2_PUBLIC_HOST)
    ?.replace(/^https?:\/\//, '')
    .replace(/\/$/, '')
  const photo = doc.images[0]

  return {
    slug: row.slug,
    categorySlug: row.categorySlug,
    name: doc.name,
    shortDescription: doc.shortDescription,
    description: doc.description,
    specsText: doc.specs.map(([label, value]) => `${label} | ${value}`).join('\n'),
    // The pound price, or the unit price for a disposable. Empty for a weighed product
    // saved before pound pricing, which must be given one.
    price: doc.poundPriceCents
      ? (doc.poundPriceCents / 100).toFixed(2)
      : categoryForSlug(row.categorySlug)?.productLine === 'VAPE' && doc.variants[0]
        ? (doc.variants[0].priceCents / 100).toFixed(2)
        : '',
    inStock: doc.variants.every((v) => v.inStock),
    batchCodes: doc.batchCodes,
    isFeatured: doc.isFeatured,
    onStateDirectory: doc.onStateDirectory,
    ...(photo && host ? { photoUrl: `https://${host}/${photo.objectKey}` } : {}),
    photoAlt: photo?.alt ?? '',
    isActive: row.isActive,
    written: {
      writer: doc.writer ?? null,
      writtenAt: doc.writtenAt ?? null,
      metaTitle: doc.seo?.metaTitle ?? null,
      metaDescription: doc.seo?.metaDescription ?? null,
      sections: doc.content?.sections.length ?? 0,
      faqs: doc.content?.faqs.length ?? 0,
      sources: doc.content?.sources.length ?? 0,
      photos: doc.images.length,
    },
  }
}
