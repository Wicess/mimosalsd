import { describe, expect, it } from 'vitest'
import { applyOverride, withoutUnpriced, type ProductOverrideRecord } from '@/lib/catalog/overrides'
import { catalog } from '@/lib/catalog/repository'
import { fromPriceCents, type Product } from '@/lib/catalog/types'
import { FIXTURE_PRODUCTS, installFixtureCatalog } from '../stubs/catalog'

/**
 * The overlay decides what a customer is shown and what they are charged, so the
 * cases that matter are the ones where an operator edit could quietly break something:
 * a price ladder losing its proportions, a compliance flag being frozen, or a cleared
 * field blanking a product page instead of restoring the authored copy.
 */

// At load, not in a beforeEach: the two products below are read while the file is
// collected, before any hook has run.
installFixtureCatalog()

const sized = catalog.getProduct('mhrb-powder') as Product
const unsized = catalog.listProducts({ categorySlug: 'disposable-vapes' })[0] as Product

function override(partial: Partial<ProductOverrideRecord>): ProductOverrideRecord {
  return {
    slug: partial.slug ?? sized.slug,
    name: null,
    shortDescription: null,
    description: null,
    specs: null,
    basePriceCents: null,
    defaultSizeKey: null,
    variantPrices: null,
    priceTiers: null,
    notForHumanConsumption: null,
    ageRestricted: null,
    pactRegulated: null,
    fulfillmentChannel: null,
    directoryStates: null,
    isActive: null,
    isFeatured: null,
    ...partial,
  }
}

describe('inheritance', () => {
  it('returns the authored product untouched when there is no override', () => {
    expect(applyOverride(sized, undefined)).toBe(sized)
  })

  it('an all-null override changes nothing', () => {
    // This is the case that matters most: opening the admin form and saving without
    // typing anything must not freeze the product at its current values.
    expect(applyOverride(sized, override({}))).toEqual(sized)
  })

  it('a blank string restores the authored copy rather than emptying the page', () => {
    const merged = applyOverride(sized, override({ name: '   ', description: '' }))
    expect(merged.name).toBe(sized.name)
    expect(merged.description).toBe(sized.description)
  })
})

describe('pricing', () => {
  it('moves every size with the pound price the owner sets', () => {
    const merged = applyOverride(sized, override({ poundPriceCents: 20_000 }))
    expect(merged.sizing!.poundPriceCents).toBe(20_000)
    expect(merged.variants.map((v) => v.priceCents)).toEqual([5_000, 6_667, 10_000, 20_000])
  })

  it('never reads the old base price, which was the price of a different size', () => {
    const merged = applyOverride(sized, override({ basePriceCents: 31_000 }))
    expect(merged.variants).toEqual(sized.variants)
  })

  it('ignores a zero or negative pound price', () => {
    // A free product is never an intended edit, and the parser upstream rejects it —
    // this is the second gate, because the column is nullable and hand-editable.
    expect(applyOverride(sized, override({ poundPriceCents: 0 })).variants).toEqual(sized.variants)
    expect(applyOverride(sized, override({ poundPriceCents: -500 })).variants).toEqual(sized.variants)
  })

  it('shows a product waiting for a pound price once one is set, and hides it until then', () => {
    const waiting = FIXTURE_PRODUCTS.find((p) => p.slug === 'amanita-gummies-citrus')!
    expect(withoutUnpriced(applyOverride(waiting, undefined)).isActive).toBe(false)
    const priced = withoutUnpriced(applyOverride(waiting, override({ slug: waiting.slug, poundPriceCents: 9_900 })))
    expect(priced.isActive).toBe(true)
    expect(priced.variants.every((v) => v.inStock)).toBe(true)
  })

  it('prices a disposable per unit', () => {
    const sku = unsized.variants[0]!.sku
    const merged = applyOverride(
      unsized,
      override({ slug: unsized.slug, variantPrices: { [sku]: 4321 } }),
    )
    expect(merged.variants[0]!.priceCents).toBe(4321)
    expect(fromPriceCents(merged)).toBe(4321)
  })

  it('ignores a non-integer or negative variant price', () => {
    const sku = unsized.variants[0]!.sku
    const merged = applyOverride(
      unsized,
      override({ slug: unsized.slug, variantPrices: { [sku]: 12.5 } }),
    )
    // Integer cents only. A float would round differently in the cart than in the
    // confirmation email, and those two must agree to the cent.
    expect(merged.variants[0]!.priceCents).toBe(unsized.variants[0]!.priceCents)
  })
})

describe('default size', () => {
  it('honours one of the four sizes', () => {
    expect(applyOverride(sized, override({ defaultSizeKey: 'f2' })).sizing!.defaultKey).toBe('f2')
  })

  it('refuses a size that is not one of them', () => {
    // Otherwise the PDP opens on a variant that does not exist.
    const merged = applyOverride(sized, override({ defaultSizeKey: 'f10' }))
    expect(merged.sizing!.defaultKey).toBe(sized.sizing!.defaultKey)
  })
})

describe('compliance flags', () => {
  it('applies false as a real value, not as "unset"', () => {
    // `?? base` would be correct, `|| base` would not — and getting it wrong here
    // means an operator cannot ever turn a flag OFF.
    const merged = applyOverride(sized, override({ notForHumanConsumption: false }))
    expect(merged.notForHumanConsumption).toBe(false)
  })

  it('applies an empty directory list as a real edit', () => {
    const merged = applyOverride(unsized, override({ slug: unsized.slug, directoryStates: [] }))
    expect(merged.directoryStates).toEqual([])
  })

  it('drops junk from the directory list rather than storing it', () => {
    const merged = applyOverride(
      sized,
      override({ directoryStates: ['fl', 'XX1', 'nc', ''] }),
    )
    expect(merged.directoryStates).toEqual(['FL', 'NC'])
  })

  it('ignores a fulfilment channel that is not a real channel', () => {
    // A bad channel would decide how a PACT-regulated product ships.
    const merged = applyOverride(sized, override({ fulfillmentChannel: 'TELEPORT' }))
    expect(merged.fulfillmentChannel).toBe(sized.fulfillmentChannel)
  })

  it('accepts a real channel', () => {
    const merged = applyOverride(sized, override({ fulfillmentChannel: 'PACT_CARRIER' }))
    expect(merged.fulfillmentChannel).toBe('PACT_CARRIER')
  })
})

describe('bulk tiers', () => {
  it('are gone: an override cannot bring them back', () => {
    const merged = applyOverride(
      sized,
      override({ priceTiers: [{ minQuantity: 5, percentOff: 12, label: '5+' }] }),
    )
    expect(merged.priceTiers).toEqual([])
  })
})

describe('specs', () => {
  it('replaces the authored table', () => {
    const merged = applyOverride(sized, override({ specs: [['Origin', 'Brazil']] }))
    expect(merged.specs).toEqual([['Origin', 'Brazil']])
  })

  it('falls back to the authored table when every row is junk', () => {
    const merged = applyOverride(sized, override({ specs: [['', ''], ['only-one-cell']] }))
    expect(merged.specs).toEqual(sized.specs)
  })
})

describe('visibility', () => {
  it('can deactivate a product', () => {
    expect(applyOverride(sized, override({ isActive: false })).isActive).toBe(false)
  })

  it('never changes the slug', () => {
    // URLs are the one thing that must not move — organic search is the only channel.
    const merged = applyOverride(sized, override({ name: 'Something else entirely' }))
    expect(merged.slug).toBe(sized.slug)
  })
})
