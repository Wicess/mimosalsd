import { describe, expect, it } from 'vitest'
import { isPriced, sizeOptions, sizePriceCents, SIZE_STEPS, type SizeLadder } from '@/lib/catalog/sizing'
import { listPrice, variantsForLadder } from '@/lib/catalog/types'
import { FIXTURE_PRODUCTS } from '../stubs/catalog'

const ladder: SizeLadder = { poundPriceCents: 14_000, defaultKey: 'f4' }

describe('sizes by the pound', () => {
  it('sells 1/4, 1/3, 1/2 and 1 lb, smallest first', () => {
    expect(SIZE_STEPS.map((s) => s.label)).toEqual(['1/4 lb', '1/3 lb', '1/2 lb', '1 lb'])
  })

  it('prices every size from the pound price alone, with no premium and no rounding to dollars', () => {
    expect(sizeOptions(ladder).map((o) => [o.label, o.priceCents])).toEqual([
      ['1/4 lb', 3_500],
      ['1/3 lb', 4_667],
      ['1/2 lb', 7_000],
      ['1 lb', 14_000],
    ])
  })

  it('rounds a third to the nearest cent', () => {
    expect(sizePriceCents({ poundPriceCents: 10_000, defaultKey: 'f4' }, 'f3')).toBe(3_333)
    expect(sizePriceCents({ poundPriceCents: 10_001, defaultKey: 'f4' }, 'f3')).toBe(3_334)
  })

  it('never charges more for less', () => {
    const prices = sizeOptions({ poundPriceCents: 111_778, defaultKey: 'f4' }).map((o) => o.priceCents)
    expect([...prices].sort((a, b) => a - b)).toEqual(prices)
  })

  it('gives every size a stable id and a plain SKU, and sells nothing without a pound price', () => {
    const variants = variantsForLadder('mhrb-powder', ladder)
    expect(variants.map((v) => v.id)).toEqual(['mhrb-powder-f4', 'mhrb-powder-f3', 'mhrb-powder-f2', 'mhrb-powder-f1'])
    expect(variants.map((v) => v.sku)).toEqual(['MHRB-POWDER-QTR-LB', 'MHRB-POWDER-THIRD-LB', 'MHRB-POWDER-HALF-LB', 'MHRB-POWDER-1-LB'])
    expect(variants.every((v) => v.inStock)).toBe(true)
    const unpriced = { poundPriceCents: 0, defaultKey: 'f4' }
    expect(isPriced(unpriced)).toBe(false)
    expect(variantsForLadder('x', unpriced).some((v) => v.inStock)).toBe(false)
  })
})

describe('the catalogue', () => {
  it('sells everything but disposables by the pound, and disposables by the unit', () => {
    for (const product of FIXTURE_PRODUCTS) {
      if (product.productLine === 'VAPE') {
        expect(product.sizing).toBeUndefined()
        expect(product.variants).toHaveLength(1)
        expect(listPrice(product).per).toBe('unit')
      } else {
        expect(product.sizing).toBeDefined()
        expect(product.variants.map((v) => v.name)).toEqual(['1/4 lb', '1/3 lb', '1/2 lb', '1 lb'])
        expect(listPrice(product).per).toBe('lb')
      }
      // One fixed price per size: no bulk discounts anywhere.
      expect(product.priceTiers).toEqual([])
    }
  })

  it('starts each weighed product at its old weight price, as a pound', () => {
    const pound = (slug: string) => FIXTURE_PRODUCTS.find((p) => p.slug === slug)!.sizing!.poundPriceCents
    // $310 a kilogram is $140.61 a pound.
    expect(pound('mhrb-powder')).toBe(Math.round((31_000 / 1000) * 453.59237))
    expect(pound('mhrb-shredded')).toBe(Math.round((16_500 / 500) * 453.59237))
    // Sold by count before, so there is no weight price: waiting for the owner.
    expect(pound('amanita-gummies-citrus')).toBe(0)
  })
})
