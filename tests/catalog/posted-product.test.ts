import { describe, expect, it } from 'vitest'
import { CATEGORIES } from '@/lib/catalog/catalog.data'
import {
  complianceFor,
  postableCategories,
  priceTiersFor,
  slugify,
  toPostedProduct,
  uniqueSlug,
  variantIdentity,
} from '@/lib/catalog/posted-product'
import { FIXTURE_PRODUCTS } from '../stubs/catalog'

const DOC = {
  name: 'Whole Root Bark Chips',
  shortDescription: 'Hand-cut root bark chips for natural dyeing and craft work.',
  description: 'Hand-cut root bark chips for natural dyeing, soap making and craft work. Not food.',
  specs: [['Origin', 'Brazil']],
  variants: [
    { id: 'chips-f4', sku: 'P-CHIPS-QTR-LB', name: '1/4 lb', priceCents: 2400, inStock: true },
  ],
  poundPriceCents: 9_600,
  images: [],
  batchCodes: ['MH-2026-0412'],
  isFeatured: false,
}

describe('complianceFor — held to the authored catalogue', () => {
  // The ratchet: if an authored product's flags ever change, posted products in
  // the same line must change with them, or this fails.
  it.each(FIXTURE_PRODUCTS.map((p) => [p.slug, p] as const))('%s carries its line’s flags', (_, p) => {
    expect(complianceFor(p.productLine, p.directoryStates.length > 0)).toEqual({
      notForHumanConsumption: p.notForHumanConsumption,
      ageRestricted: p.ageRestricted,
      fulfillmentChannel: p.fulfillmentChannel,
      pactRegulated: p.pactRegulated,
      directoryStates: [...p.directoryStates],
    })
  })

  it.each(FIXTURE_PRODUCTS.map((p) => [p.slug, p] as const))('%s has no bulk tiers, like every posted product', (_, p) => {
    expect(priceTiersFor()).toEqual(p.priceTiers)
  })
})

describe('postableCategories', () => {
  it('offers the authored categories and nothing else', () => {
    expect(postableCategories().map((c) => c.slug)).toEqual(CATEGORIES.map((c) => c.slug))
  })
})

describe('toPostedProduct', () => {
  it('turns a row into a storefront product whose flags come from the category', () => {
    const product = toPostedProduct({ slug: 'chips', categorySlug: 'mimosa-hostilis', document: DOC, isActive: true })
    expect(product).toMatchObject({
      slug: 'chips',
      productLine: 'MIMOSA_HOSTILIS',
      categorySlug: 'mimosa-hostilis',
      notForHumanConsumption: true,
      fulfillmentChannel: 'PARCEL',
      isActive: true,
    })
    // Sold by the pound from its pound price, whatever sizes the document lists.
    expect(product!.variants.map((v) => [v.name, v.priceCents])).toEqual([
      ['1/4 lb', 2_400],
      ['1/3 lb', 3_200],
      ['1/2 lb', 4_800],
      ['1 lb', 9_600],
    ])
  })

  it('keeps a weighed product saved before pound pricing out of the shop until it has a pound price', () => {
    const legacy = { ...DOC, poundPriceCents: undefined, variants: [{ id: 'chips--100g', sku: 'P-CHIPS-100G', name: '100g', priceCents: 2400, inStock: true }] }
    expect(toPostedProduct({ slug: 'chips', categorySlug: 'mimosa-hostilis', document: legacy, isActive: true })!.isActive).toBe(false)
  })

  it('makes a posted vape PACT-only, whatever the document says', () => {
    const smuggled = { ...DOC, fulfillmentChannel: 'PARCEL', pactRegulated: false }
    const product = toPostedProduct({ slug: 'v', categorySlug: 'disposable-vapes', document: smuggled, isActive: true })
    expect(product).toMatchObject({ fulfillmentChannel: 'PACT_CARRIER', pactRegulated: true, ageRestricted: true })
  })

  it('opens the directory states only to a vape marked as listed', () => {
    const listed = toPostedProduct({
      slug: 'v',
      categorySlug: 'disposable-vapes',
      document: { ...DOC, onStateDirectory: true },
      isActive: true,
    })
    const unlisted = toPostedProduct({ slug: 'v', categorySlug: 'disposable-vapes', document: DOC, isActive: true })
    expect(listed?.directoryStates.length).toBeGreaterThan(0)
    expect(unlisted?.directoryStates).toEqual([])
  })

  it('drops a row whose category is not authored, rather than guessing', () => {
    expect(toPostedProduct({ slug: 'x', categorySlug: 'lsd', document: DOC, isActive: true })).toBeUndefined()
  })

  it('drops a row whose document no longer validates, rather than breaking the page', () => {
    expect(
      toPostedProduct({ slug: 'x', categorySlug: 'amanita', document: { ...DOC, variants: [] }, isActive: true }),
    ).toBeUndefined()
    expect(toPostedProduct({ slug: 'x', categorySlug: 'amanita', document: null, isActive: true })).toBeUndefined()
  })

  it('refuses image keys the uploader would never have written', () => {
    const doc = { ...DOC, images: [{ objectKey: 'coa/secret.pdf', alt: 'x x x', width: 1, height: 1 }] }
    expect(toPostedProduct({ slug: 'x', categorySlug: 'amanita', document: doc, isActive: true })).toBeUndefined()
  })
})

describe('slugs', () => {
  it('writes lower-case words joined by hyphens', () => {
    expect(slugify('Café Crème — Root Bark (100g) & More!')).toBe('cafe-creme-root-bark-100g-and-more')
    expect(slugify('   ')).toBe('')
  })

  it('never takes a slug that is in use, and never replaces one', () => {
    const taken = new Set(['root-bark', 'root-bark-2', 'new'])
    expect(uniqueSlug('Root Bark', taken)).toBe('root-bark-3')
    expect(uniqueSlug('Brand new thing', taken)).toBe('brand-new-thing')
    expect(uniqueSlug('New', taken)).toBe('new-2')
    expect(uniqueSlug('!!!', new Set())).toBe('product')
  })

  it('gives a size the same id for as long as it keeps its name, so carts survive edits', () => {
    expect(variantIdentity('chips', '100 g')).toEqual({ id: 'chips--100-g', sku: 'P-CHIPS-100-G' })
    expect(variantIdentity('chips', '100 g')).toEqual(variantIdentity('chips', '100 G'))
  })

  it('keeps posted SKUs out of the authored SKU space', () => {
    const authoredSkus = FIXTURE_PRODUCTS.flatMap((p) => p.variants.map((v) => v.sku))
    expect(authoredSkus.some((sku) => sku.startsWith('P-'))).toBe(false)
  })
})
