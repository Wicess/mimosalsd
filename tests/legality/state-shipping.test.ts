import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { CHANNEL_SERVICE, channelForLine, getStateShipping, stateSearchMeta } from '@/lib/legality/state-shipping'
import { getAllStateLegality, LINE_SHORT } from '@/lib/legality/state-pages'

describe('state shipping copy', () => {
  /*
   * The costs and transit times shown on 51 service-area pages are duplicated from
   * the cart's rate table, which is not exported. A duplicated price that drifts is
   * worse than no price: the page promises one thing and the checkout charges
   * another. This reads the source and fails the moment they disagree.
   */
  it('quotes exactly what the cart quotes', () => {
    const source = readFileSync('src/lib/cart/cart.ts', 'utf8')
    for (const [channel, service] of Object.entries(CHANNEL_SERVICE)) {
      const block = source.slice(source.indexOf(`${channel}: {`))
      expect(block, `${channel} cost`).toContain(`costCents: ${service.costCents}`)
      expect(block, `${channel} estimate`).toContain(`estimate: '${service.estimate}'`)
    }
  })

  it('never offers free shipping on the PACT carrier', () => {
    for (const legality of getAllStateLegality()) {
      const shipping = getStateShipping(legality)
      const pact = shipping.channels.find((c) => c.key === 'PACT_CARRIER')
      if (pact) expect(pact.eligibleForFreeShipping, legality.name).toBe(false)
      const parcel = shipping.channels.find((c) => c.key === 'PARCEL')
      if (parcel) expect(parcel.eligibleForFreeShipping).toBe(true)
    }
  })

  /*
   * These pages carry no money at all — not a shipping cost, not a threshold.
   * A price published against fifty-one states is a number that has to track
   * checkout forever, and the first time it does not, the page is lying about what
   * the customer will be charged. Costs belong in the cart, which quotes them.
   */
  it('publishes no monetary figure in any state\'s service copy', () => {
    for (const legality of getAllStateLegality()) {
      const shipping = getStateShipping(legality)
      const text = `${shipping.summary} ${shipping.detail}`
      expect(text, legality.name).not.toMatch(/\$\s?\d/)
    }
  })

  it('routes vapor products to the age-restricted carrier and nothing else there', () => {
    expect(channelForLine('VAPE')).toBe('PACT_CARRIER')
    expect(channelForLine('AMANITA')).toBe('PARCEL')
    expect(channelForLine('MIMOSA_HOSTILIS')).toBe('PARCEL')
  })

  /*
   * The whole point of deriving this copy: a page can never advertise a line the
   * rules refuse. This is the assertion that would have caught the Louisiana
   * incident if service copy had existed then.
   */
  it('never advertises a line the state blocks', () => {
    for (const legality of getAllStateLegality()) {
      const shipping = getStateShipping(legality)
      for (const refused of shipping.refused) {
        const label = LINE_SHORT[refused.productLine]
        expect(shipping.available.map((v) => v.productLine)).not.toContain(refused.productLine)
        expect(shipping.summary, `${legality.name} summary`).not.toMatch(
          new RegExp(`ship (all three|[^.]*${label})[^.]*to ${legality.name}`, 'i'),
        )
        for (const channel of shipping.channels) {
          expect(channel.carries, `${legality.name} ${channel.key}`).not.toContain(label)
        }
      }
    }
  })

  it('refuses nothing anywhere, under the current rules', () => {
    // Every line ships to every state — see the header of `state-rules.data.ts`.
    // Asserted rather than deleted, so a refusal reappearing in the data without
    // a decision fails the build.
    for (const legality of getAllStateLegality()) {
      expect(getStateShipping(legality).refused, legality.code).toHaveLength(0)
    }
  })

  it('states the effective 21+ floor, never the statutory 18', () => {
    for (const legality of getAllStateLegality()) {
      expect(getStateShipping(legality).minAge, legality.name).toBeGreaterThanOrEqual(21)
    }
  })

  it('gives every served state real service copy, not a stub', () => {
    for (const legality of getAllStateLegality()) {
      const shipping = getStateShipping(legality)
      if (!shipping.isServed) continue
      expect(shipping.channels.length, legality.name).toBeGreaterThan(0)
      expect(shipping.detail.split(/\s+/).length, legality.name).toBeGreaterThan(60)
    }
  })
})

/*
  The owner, looking at the search results: "who searches this online?" — then, of a
  question-style replacement: write them to buy, "Where to buy Mimosa roots in
  California", "Mimosa roots in Mississippi 2026 pricing". Every state we ship to is a
  state we sell in. These pin that, and pin the answer to the rules behind the page.
*/
describe('a state page in a search result', () => {
  const all = getAllStateLegality().map((legality) => ({ legality, shipping: getStateShipping(legality) }))
  const takesBark = (s: ReturnType<typeof getStateShipping>) => s.available.some((v) => v.productLine === 'MIMOSA_HOSTILIS')

  it('is a buying title wherever root bark ships, within the title limit', () => {
    for (const { shipping } of all) {
      const { title } = stateSearchMeta(shipping, 2026, 13_000)
      if (takesBark(shipping)) expect(title, shipping.name).toMatch(new RegExp(`^Buy Mimosa Hostilis Root Bark in ${shipping.name}`))
      else expect(title, shipping.name).not.toMatch(/^Buy/)
      expect(title.length, title).toBeLessThanOrEqual(60)
    }
  })

  it('answers where to buy, with the live price, and never loses the price to the limit', () => {
    for (const { shipping } of all) {
      if (!takesBark(shipping)) continue
      const { description } = stateSearchMeta(shipping, 2026, 13_000)
      expect(description, shipping.name).toContain(shipping.name)
      expect(description, shipping.name).toMatch(/from 130 dollars a pound\.$/)
      expect(description.length, description).toBeLessThanOrEqual(160)
    }
  })

  it('writes cents only when there are cents, and drops the price when there is none', () => {
    const shipping = all.find(({ shipping }) => takesBark(shipping))!.shipping
    expect(stateSearchMeta(shipping, 2026, 12_950).description).toMatch(/from 129\.50 dollars a pound\.$/)
    expect(stateSearchMeta(shipping, 2026).description).not.toMatch(/dollars/)
  })

  it('never promises root bark to a state it cannot be sent to', () => {
    for (const { shipping } of all) {
      if (takesBark(shipping)) continue
      expect(stateSearchMeta(shipping, 2026, 13_000).description).toMatch(/^We cannot ship Mimosa hostilis root bark/)
    }
  })

  it('carries no symbols and names no mushroom line', () => {
    for (const { shipping } of all) {
      const { title, description } = stateSearchMeta(shipping, 2026, 13_000)
      expect(`${title} ${description}`).not.toMatch(/amanita|all three|\+|—|&|\$/i)
    }
  })

  it('keeps a long state name inside the limit', () => {
    const dc = all.find(({ shipping }) => shipping.name === 'District of Columbia')!
    const meta = stateSearchMeta(dc.shipping, 2026, 13_000)
    expect(meta.title).toBe('Buy Mimosa Hostilis Root Bark in District of Columbia')
    expect(meta.description).toMatch(/from 130 dollars a pound\.$/)
  })
})
