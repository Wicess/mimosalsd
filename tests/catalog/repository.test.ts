import { beforeEach, describe, expect, it } from 'vitest'
import { LAB_BATCHES, PRODUCTS } from '@/lib/catalog/catalog.data'
import { catalog, unavailableIn } from '@/lib/catalog/repository'
import {
  fromPriceCents,
  hasBulkPricing,
  tierPriceCents,
} from '@/lib/catalog/types'
import { resetStateRuleProvider } from '@/lib/compliance/state-rules'
import { scanText } from '@/lib/compliance/lexicon'
import { installFixtureCatalog } from '../stubs/catalog'

beforeEach(() => {
  installFixtureCatalog()
  resetStateRuleProvider()
})

describe('what production ships', () => {
  it('authors no products and no laboratory batches', () => {
    // Products are posted from the admin panel, and certificates are issued to
    // verified buyers on request. A sample product or an invented batch left in the
    // authored lists would sit on the live storefront pretending to be real, so the
    // invariants below run against tests/stubs/catalog.ts instead.
    expect(PRODUCTS).toHaveLength(0)
    expect(LAB_BATCHES).toHaveLength(0)
  })
})

describe('catalogue integrity', () => {
  it('has 4 categories (Others added 2026-09-15), and sells the 8 products that have a price', () => {
    expect(catalog.listCategories()).toHaveLength(4)
    // The Amanita gummies and capsules wait for a price per pound (owner, 2026-09-14).
    expect(catalog.listProducts()).toHaveLength(8)
    expect(catalog.getProduct('amanita-gummies-citrus')).toBeUndefined()
  })

  it('gives every product a unique slug', () => {
    const slugs = catalog.listProducts().map((p) => p.slug)
    expect(new Set(slugs).size).toBe(slugs.length)
  })

  it('gives every product at least one variant with a positive integer price', () => {
    for (const p of catalog.listProducts()) {
      expect(p.variants.length, p.slug).toBeGreaterThan(0)
      for (const v of p.variants) {
        expect(Number.isInteger(v.priceCents), `${v.sku} must be integer cents`).toBe(true)
        expect(v.priceCents).toBeGreaterThan(0)
      }
    }
  })

  it('points every product at a category that exists', () => {
    for (const p of catalog.listProducts()) {
      expect(catalog.getCategory(p.categorySlug), p.slug).toBeDefined()
    }
  })

  it('points every batch code at a batch that exists', () => {
    for (const p of catalog.listProducts()) {
      for (const code of p.batchCodes) {
        expect(catalog.getBatch(code), `${p.slug} -> ${code}`).toBeDefined()
      }
    }
  })

  it('publishes a full panel for every batch, not potency alone', () => {
    for (const batch of catalog.listBatches()) {
      const panels = new Set(batch.results.map((r) => r.panel))
      for (const required of ['HEAVY_METALS', 'PESTICIDES', 'MYCOTOXINS', 'SOLVENTS']) {
        expect(panels.has(required), `${batch.batchCode} missing ${required}`).toBe(true)
      }
    }
  })

  it('resolves a batch case-insensitively — QR codes and printed labels vary', () => {
    expect(catalog.getBatch('am-2026-0388')?.batchCode).toBe('AM-2026-0388')
    expect(catalog.getBatch('AM-2026-0388')?.batchCode).toBe('AM-2026-0388')
  })
})

describe('compliance flags match the product line', () => {
  it('marks every Mimosa product not-for-human-consumption and parcel-shippable', () => {
    for (const p of catalog.listProducts({ productLine: 'MIMOSA_HOSTILIS' })) {
      expect(p.notForHumanConsumption, p.slug).toBe(true)
      expect(p.ageRestricted, p.slug).toBe(false)
      expect(p.fulfillmentChannel, p.slug).toBe('PARCEL')
    }
  })

  it('marks every vape PACT-regulated, age-restricted and off the parcel channel', () => {
    const vapes = catalog.listProducts({ productLine: 'VAPE' })
    expect(vapes.length).toBeGreaterThan(0)
    for (const p of vapes) {
      expect(p.pactRegulated, p.slug).toBe(true)
      expect(p.ageRestricted, p.slug).toBe(true)
      // USPS is barred from carrying these and UPS/FedEx refuse them.
      expect(p.fulfillmentChannel, p.slug).toBe('PACT_CARRIER')
    }
  })

  it('marks every Amanita product age-restricted and never not-for-consumption', () => {
    for (const p of catalog.listProducts({ productLine: 'AMANITA' })) {
      expect(p.ageRestricted, p.slug).toBe(true)
      expect(p.notForHumanConsumption, p.slug).toBe(false)
    }
  })

  it('only ever lists vapes on a state product directory', () => {
    for (const p of catalog.listProducts()) {
      if (p.directoryStates.length > 0) expect(p.productLine, p.slug).toBe('VAPE')
    }
  })
})

describe('every catalogue string passes the compliance lexicon', () => {
  it('has clean product copy', () => {
    for (const p of catalog.listProducts()) {
      const copy = [p.name, p.shortDescription, p.description, ...p.specs.flat()].join('\n')
      const result = scanText(copy, { productLines: [p.productLine] })
      expect(
        result.clean,
        `${p.slug}: ${result.blocking.map((m) => m.term).join(', ')}`,
      ).toBe(true)
    }
  })

  it('has clean category copy', () => {
    for (const c of catalog.listCategories()) {
      const copy = [c.name, c.intro, c.metaTitle, c.metaDesc].join('\n')
      const result = scanText(copy, { productLines: [c.productLine] })
      expect(
        result.clean,
        `${c.slug}: ${result.blocking.map((m) => m.term).join(', ')}`,
      ).toBe(true)
    }
  })
})

describe('filtering and sorting', () => {
  it('filters by category', () => {
    const items = catalog.listProducts({ categorySlug: 'amanita' })
    expect(items.length).toBe(2)
    expect(items.every((p) => p.categorySlug === 'amanita')).toBe(true)
  })

  it('sorts by price ascending and descending', () => {
    const asc = catalog.listProducts({ sort: 'price-asc' }).map(fromPriceCents)
    expect([...asc].sort((a, b) => a - b)).toEqual(asc)
    const desc = catalog.listProducts({ sort: 'price-desc' }).map(fromPriceCents)
    expect([...desc].sort((a, b) => b - a)).toEqual(desc)
  })

  it('requires every search term to match, narrowing rather than widening', () => {
    expect(catalog.listProducts({ query: 'mimosa powder' }).length).toBeGreaterThan(0)
    expect(catalog.listProducts({ query: 'mimosa nonsense' })).toHaveLength(0)
  })

  it('filters by price range', () => {
    const items = catalog.listProducts({ minPriceCents: 5000, maxPriceCents: 10000 })
    for (const p of items) {
      expect(fromPriceCents(p)).toBeGreaterThanOrEqual(5000)
      expect(fromPriceCents(p)).toBeLessThanOrEqual(10000)
    }
  })
})

describe('shipsTo filtering reflects the current legal position', () => {
  /*
    The seed ships every line to every jurisdiction now, on the owner's
    instruction — see the header of `state-rules.data.ts`. These assert THAT, so
    a restriction reappearing in the data without a decision fails the build.

    The proof that the FILTER still excludes a blocked line lives in
    tests/compliance/shipping.test.ts, against an injected rule.
  */
  it('shows every product in every jurisdiction', () => {
    const all = catalog.listProducts().length
    for (const s of ['LA', 'CA', 'FL', 'NY', 'TX'] as const) {
      expect(catalog.listProducts({ shipsTo: s }), s).toHaveLength(all)
    }
  })

  it('no longer gates any vape on a state product directory', () => {
    for (const s of ['FL', 'NC', 'TN', 'VA', 'WI'] as const) {
      const vapes = catalog.listProducts({ shipsTo: s, productLine: 'VAPE' })
      expect(vapes.length, s).toBe(
        catalog.listProducts({ productLine: 'VAPE' }).length,
      )
    }
  })

  it('ships the whole Mimosa line to all jurisdictions including Louisiana', () => {
    const all = catalog.listProducts({ productLine: 'MIMOSA_HOSTILIS' }).length
    expect(
      catalog.listProducts({ productLine: 'MIMOSA_HOSTILIS', shipsTo: 'LA' }),
    ).toHaveLength(all)
  })
})

describe('unavailableIn explains rather than silently hiding', () => {
  it('returns nothing anywhere, because nothing is currently restricted', () => {
    for (const s of ['LA', 'CA', 'FL', 'NY', 'TX'] as const) {
      expect(unavailableIn(s), s).toHaveLength(0)
    }
  })
})

describe('bulk pricing', () => {
  it('offers tiers only on the nationally shippable line', () => {
    for (const p of catalog.listProducts()) {
      if (hasBulkPricing(p)) expect(p.productLine, p.slug).toBe('MIMOSA_HOSTILIS')
    }
  })

  it('discounts more at every step, and never past free', () => {
    for (const p of catalog.listProducts()) {
      if (!hasBulkPricing(p)) continue
      let previousQty = 0
      let previousOff = 0
      for (const tier of p.priceTiers) {
        expect(tier.minQuantity, `${p.slug}`).toBeGreaterThan(previousQty)
        expect(tier.percentOff, `${p.slug} @${tier.minQuantity}`).toBeGreaterThan(previousOff)
        expect(tier.percentOff).toBeLessThan(100)
        previousQty = tier.minQuantity
        previousOff = tier.percentOff
      }
    }
  })

  it('applies the discount to whichever size is in the box', () => {
    for (const p of catalog.listProducts()) {
      if (!hasBulkPricing(p)) continue
      const tier = p.priceTiers[p.priceTiers.length - 1]!
      // The same percentage off the cheapest and the dearest variant must give
      // two different prices — the bug this replaced gave both the same one.
      const cheapest = tierPriceCents(fromPriceCents(p), tier)
      const dearest = tierPriceCents(
        Math.max(...p.variants.map((v) => v.priceCents)),
        tier,
      )
      expect(Number.isInteger(cheapest)).toBe(true)
      expect(Number.isInteger(dearest)).toBe(true)
      if (p.variants.length > 1) expect(dearest).toBeGreaterThan(cheapest)
    }
  })
})
