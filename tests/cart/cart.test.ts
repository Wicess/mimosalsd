import { beforeEach, describe, expect, it } from 'vitest'
import {
  addLine,
  normalizeCart,
  removeLine,
  parseCartCookie,
  resolveCart,
  updateQuantity,
  MAX_LINE_QUANTITY,
} from '@/lib/cart/cart'
import { EMPTY_CART, type Cart } from '@/lib/cart/types'
import { resetStateRuleProvider } from '@/lib/compliance/state-rules'
import { installFixtureCatalog } from '../stubs/catalog'

beforeEach(() => {
  installFixtureCatalog()
  resetStateRuleProvider()
})

// A quarter pound of Mimosa powder at $140.61 a pound: $35.15.
const mhrb = { slug: 'mhrb-powder', variantId: 'mhrb-powder-f4', quantity: 1 }
const amanita = {
  slug: 'amanita-powder',
  variantId: 'amanita-powder-f4',
  quantity: 1,
}
const vape = {
  slug: 'disposable-vape-classic',
  variantId: 'disposable-vape-classic-unit',
  quantity: 1,
}

const cartOf = (...lines: Cart['lines']): Cart => ({ lines })

describe('cart mutation', () => {
  it('merges duplicate lines rather than stacking them', () => {
    const cart = addLine(addLine(EMPTY_CART, mhrb), mhrb)
    expect(cart.lines).toHaveLength(1)
    expect(cart.lines[0]?.quantity).toBe(2)
  })

  it('keeps distinct variants separate', () => {
    const cart = addLine(addLine(EMPTY_CART, mhrb), amanita)
    expect(cart.lines).toHaveLength(2)
  })

  it('caps quantity so a hostile cookie cannot request 10,000 units', () => {
    const cart = normalizeCart(cartOf({ ...mhrb, quantity: 99999 }))
    expect(cart.lines[0]?.quantity).toBe(MAX_LINE_QUANTITY)
  })

  it('removes a line when quantity drops to zero', () => {
    const cart = updateQuantity(addLine(EMPTY_CART, mhrb), mhrb.slug, mhrb.variantId, 0)
    expect(cart.lines).toHaveLength(0)
  })

  it('removes only the targeted line', () => {
    const cart = removeLine(
      addLine(addLine(EMPTY_CART, mhrb), amanita),
      mhrb.slug,
      mhrb.variantId,
    )
    expect(cart.lines).toHaveLength(1)
    expect(cart.lines[0]?.slug).toBe(amanita.slug)
  })
})

describe('pricing is computed server-side from the catalogue', () => {
  it('prices a line from the catalogue, not from the cookie', () => {
    const resolved = resolveCart(cartOf(mhrb), 'TX')
    expect(resolved.lines[0]?.unitPriceCents).toBe(3515)
    expect(resolved.subtotalCents).toBe(3515)
  })

  it('drops a line whose product no longer exists rather than throwing', () => {
    const resolved = resolveCart(cartOf({ ...mhrb, slug: 'deleted-product' }), 'TX')
    expect(resolved.lines).toHaveLength(0)
  })

  it('charges one fixed price per size, however many are bought: no bulk discounts', () => {
    const at1 = resolveCart(cartOf({ ...mhrb, quantity: 1 }), 'TX')
    const at10 = resolveCart(cartOf({ ...mhrb, quantity: 10 }), 'TX')
    expect(at10.lines[0]!.unitPriceCents).toBe(at1.lines[0]!.unitPriceCents)
    expect(at10.lines[0]!.lineTotalCents).toBe(at1.lines[0]!.unitPriceCents * 10)
    expect(at10.lines[0]?.bulkTierLabel).toBeUndefined()
  })

  it('prices a disposable as the quantity times its unit price', () => {
    const three = resolveCart(cartOf({ ...vape, quantity: 3 }), 'TX')
    expect(three.lines[0]!.lineTotalCents).toBe(3 * three.lines[0]!.unitPriceCents)
  })

  it('keeps every computed amount an integer', () => {
    const resolved = resolveCart(cartOf({ ...mhrb, quantity: 7 }), 'TX')
    expect(Number.isInteger(resolved.subtotalCents)).toBe(true)
    expect(Number.isInteger(resolved.totalCents)).toBe(true)
    expect(Number.isInteger(resolved.shippingTotalCents)).toBe(true)
  })
})

describe('multi-channel shipment splitting', () => {
  it('splits a mixed cart into two shipments with different carriers', () => {
    const resolved = resolveCart(cartOf(mhrb, vape), 'TX')
    expect(resolved.compliance.shipmentGroups).toHaveLength(2)
    expect(resolved.quotes.map((q) => q.channel)).toEqual(['PARCEL', 'PACT_CARRIER'])
  })

  it('charges shipping once per shipment', () => {
    const resolved = resolveCart(cartOf(mhrb, vape), 'TX')
    expect(resolved.shippingTotalCents).toBe(
      resolved.quotes.reduce((sum, q) => sum + q.costCents, 0),
    )
    expect(resolved.quotes).toHaveLength(2)
  })

  it('requires an adult signature on the PACT shipment only', () => {
    const resolved = resolveCart(cartOf(mhrb, vape), 'TX')
    const parcel = resolved.quotes.find((q) => q.channel === 'PARCEL')
    const pact = resolved.quotes.find((q) => q.channel === 'PACT_CARRIER')
    expect(parcel?.requiresAdultSignature).toBe(false)
    expect(pact?.requiresAdultSignature).toBe(true)
  })
})

describe('free shipping never over-promises', () => {
  it('applies to a parcel-only cart over the threshold', () => {
    const resolved = resolveCart(cartOf({ ...mhrb, quantity: 3 }), 'TX')
    expect(resolved.subtotalCents).toBeGreaterThanOrEqual(10000)
    expect(resolved.quotes.find((q) => q.channel === 'PARCEL')?.isFree).toBe(true)
  })

  it('never makes a PACT shipment free, however large the order', () => {
    const resolved = resolveCart(cartOf({ ...mhrb, quantity: 10 }, { ...vape, quantity: 10 }), 'TX')
    const pact = resolved.quotes.find((q) => q.channel === 'PACT_CARRIER')
    expect(pact?.isFree).toBe(false)
    expect(pact?.costCents).toBeGreaterThan(0)
  })

  it('does not let vape subtotal push a cart over the free-shipping threshold', () => {
    // $90 of parcel + $250 of vapes: the parcel shipment must still be charged.
    const resolved = resolveCart(
      cartOf({ ...mhrb, quantity: 2 }, { ...vape, quantity: 10 }),
      'TX',
    )
    expect(resolved.quotes.find((q) => q.channel === 'PARCEL')?.isFree).toBe(false)
  })
})

describe('compliance is enforced at the cart, not at checkout', () => {
  /*
    The seed ships every line everywhere now, on the owner's instruction — see
    the header of `state-rules.data.ts`. What the cart must still do is carry the
    destination through and refuse WITHOUT one; that a blocked rule stops the
    cart is proved in tests/compliance/shipping.test.ts against an injected rule,
    since no destination in the current data would exercise it.
  */
  it('proceeds for every previously restricted destination', () => {
    for (const s of ['LA', 'CA', 'FL', 'NY'] as const) {
      const resolved = resolveCart(cartOf(mhrb, amanita, vape), s)
      expect(resolved.compliance.canProceed, s).toBe(true)
      expect(resolved.compliance.blocked, s).toHaveLength(0)
    }
  })

  it('still splits the cart by fulfilment channel, which is not a state position', () => {
    // Vapes travel on PACT_CARRIER and parcel goods do not, so a mixed cart is
    // two shipments wherever it is going. Opening every state must not merge them.
    const resolved = resolveCart(cartOf(mhrb, vape), 'CA')
    expect(resolved.compliance.shipmentGroups.length).toBeGreaterThan(1)
  })

  it('ships a vape to a former directory state without the SKU being listed', () => {
    const unlisted = resolveCart(
      cartOf({ slug: 'disposable-vape-berry', variantId: 'disposable-vape-berry-unit', quantity: 1 }),
      'FL',
    )
    expect(unlisted.compliance.canProceed).toBe(true)
  })

  it('cannot proceed without a destination — legality is unknowable', () => {
    const resolved = resolveCart(cartOf(mhrb))
    expect(resolved.compliance.canProceed).toBe(false)
    expect(resolved.quotes).toHaveLength(0)
    expect(resolved.lines).toHaveLength(1) // items still shown and priced
  })

  it('requires the intended-use attestation whenever MHRB is present', () => {
    expect(resolveCart(cartOf(mhrb), 'TX').compliance.requiredAttestations).toContain(
      'NOT_FOR_HUMAN_CONSUMPTION',
    )
    expect(
      resolveCart(cartOf(amanita), 'TX').compliance.requiredAttestations,
    ).not.toContain('NOT_FOR_HUMAN_CONSUMPTION')
  })

  it('requires age verification only when the cart holds an age-restricted item', () => {
    expect(resolveCart(cartOf(mhrb), 'TX').compliance.requiresAgeVerification).toBe(false)
    expect(resolveCart(cartOf(amanita), 'TX').compliance.requiresAgeVerification).toBe(true)
  })
})

describe('cart cookie parsing — untrusted input', () => {
  it('returns an empty cart for missing or empty input', () => {
    expect(parseCartCookie(undefined).lines).toHaveLength(0)
    expect(parseCartCookie(null).lines).toHaveLength(0)
    expect(parseCartCookie('').lines).toHaveLength(0)
  })

  it('never throws on malformed JSON — a crash would take down every page with a cart count', () => {
    for (const bad of ['{', 'not json', '[]', 'null', '{"lines":"nope"}', '{"nope":1}']) {
      expect(() => parseCartCookie(bad)).not.toThrow()
      expect(parseCartCookie(bad).lines, bad).toHaveLength(0)
    }
  })

  it('rejects a line with a non-integer or negative quantity', () => {
    expect(
      parseCartCookie('{"lines":[{"slug":"a","variantId":"b","quantity":1.5}]}').lines,
    ).toHaveLength(0)
    expect(
      parseCartCookie('{"lines":[{"slug":"a","variantId":"b","quantity":-3}]}').lines,
    ).toHaveLength(0)
  })

  it('rejects a quantity above the cap rather than clamping it', () => {
    expect(
      parseCartCookie('{"lines":[{"slug":"a","variantId":"b","quantity":100000}]}').lines,
    ).toHaveLength(0)
  })

  it('rejects absurdly long identifiers', () => {
    const slug = 'x'.repeat(500)
    expect(
      parseCartCookie(`{"lines":[{"slug":"${slug}","variantId":"b","quantity":1}]}`).lines,
    ).toHaveLength(0)
  })

  it('caps the number of distinct lines', () => {
    const lines = Array.from({ length: 200 }, (_, i) => ({
      slug: `p${i}`,
      variantId: 'v',
      quantity: 1,
    }))
    expect(parseCartCookie(JSON.stringify({ lines })).lines).toHaveLength(0)
  })

  it('accepts and normalizes a valid cookie', () => {
    const cart = parseCartCookie(
      JSON.stringify({ lines: [mhrb, mhrb] }),
    )
    expect(cart.lines).toHaveLength(1)
    expect(cart.lines[0]?.quantity).toBe(2)
  })

  it('carries no price data — prices are never trusted from the client', () => {
    const cart = parseCartCookie(
      '{"lines":[{"slug":"mhrb-powder","variantId":"mhrb-powder-f4","quantity":1,"unitPriceCents":1}]}',
    )
    expect(cart.lines[0]).not.toHaveProperty('unitPriceCents')
    // And the resolved price comes from the catalogue, not the injected value.
    expect(resolveCart(cart, 'TX').lines[0]?.unitPriceCents).toBe(3515)
  })
})
