import { STATE_CITIES } from './state-cities'
import type { ProductLine, UsJurisdictionCode } from '@/lib/compliance/types'
import { effectiveMinAge } from '@/lib/compliance/shipping'
import { LINE_SHORT, type LineVerdict, type StateLegality } from './state-pages'

/**
 * ─────────────────────────────────────────────────────────────────────────────
 *  SERVICE AREA
 *
 *  The same 51 pages, told as "here is what we deliver to your state and how"
 *  rather than only "here is the law". A shopper searching from Ohio wants to know
 *  whether we serve them, what arrives, how long it takes and what it costs; the
 *  statute matters to them only where it changes one of those answers.
 *
 *  Every sentence below is DERIVED — from the state's own rules and from the live
 *  rate table — never written per state by hand. That is deliberate on two counts:
 *
 *   1. Hand-written service copy across 51 states is exactly the templated bulk that
 *      Bing's abuse list names, and it goes stale silently. Derived copy cannot
 *      claim we ship something a rule refuses, because the same row decides both.
 *   2. The costs and transit times here are the ones the cart actually quotes. A
 *      landing page promising "2-day delivery" that the checkout then contradicts is
 *      a claim the data does not support.
 * ─────────────────────────────────────────────────────────────────────────────
 */

/**
 * Transit and cost per channel.
 *
 * Mirrors `RATES` in `lib/cart/cart.ts`, which is not exported. Kept in sync by
 * `tests/legality/state-shipping.test.ts`, which fails if the two ever disagree —
 * a duplicated price that silently drifts is worse than no price at all.
 */
export const CHANNEL_SERVICE = {
  PARCEL: { label: 'Standard parcel', estimate: '3–5 business days', costCents: 795 },
  PACT_CARRIER: {
    label: 'Age-restricted carrier',
    estimate: '5–8 business days',
    costCents: 1995,
  },
} as const

/** Vapor products are PACT Act regulated and travel on their own carrier. */
export function channelForLine(line: ProductLine): keyof typeof CHANNEL_SERVICE {
  return line === 'VAPE' ? 'PACT_CARRIER' : 'PARCEL'
}

export interface StateShipping {
  readonly code: UsJurisdictionCode
  readonly name: string
  /** Lines we can send here — ALLOWED or RESTRICTED, never BLOCKED. */
  readonly available: readonly LineVerdict[]
  readonly refused: readonly LineVerdict[]
  /** True when nothing at all ships to this state. */
  readonly isServed: boolean
  readonly channels: readonly {
    readonly key: keyof typeof CHANNEL_SERVICE
    readonly label: string
    readonly estimate: string
    readonly costCents: number
    readonly carries: readonly string[]
    /*
      A flag, not an amount. It was `freeOver: number` — the threshold in cents — and
      holding a price in the model for pages that must not print one is how a price
      finds its way back onto them.
    */
    readonly eligibleForFreeShipping: boolean
  }[]
  readonly minAge: number
  readonly requiresSignature: boolean
  /** One line, for the page header. */
  readonly summary: string
  /** A short paragraph on what operating here actually involves. */
  readonly detail: string
}

export function getStateShipping(legality: StateLegality): StateShipping {
  const available = legality.verdicts.filter((v) => v.rule.status !== 'BLOCKED')
  const refused = legality.verdicts.filter((v) => v.rule.status === 'BLOCKED')
  const minAge = Math.max(...legality.verdicts.map((v) => effectiveMinAge(v.rule.minAge)))
  const requiresSignature = available.some((v) => v.rule.requiresAdultSignature)

  // One card per channel that actually carries something to this state.
  const channels = (['PARCEL', 'PACT_CARRIER'] as const)
    .map((key) => {
      const carries = available
        .filter((v) => channelForLine(v.productLine) === key)
        .map((v) => LINE_SHORT[v.productLine])
      return {
        key,
        label: CHANNEL_SERVICE[key].label,
        estimate: CHANNEL_SERVICE[key].estimate,
        costCents: CHANNEL_SERVICE[key].costCents,
        carries,
        // Only the parcel channel can carry a free-shipping promise; the PACT
        // carrier never can, and saying otherwise on a state page would be a
        // promise the cart refuses to keep.
        eligibleForFreeShipping: key === 'PARCEL',
      }
    })
    .filter((c) => c.carries.length > 0)

  const names = available.map((v) => LINE_SHORT[v.productLine])
  const summary = !available.length
    ? `We cannot lawfully ship any of our product lines to ${legality.name}.`
    : refused.length === 0
      ? `We ship root bark to ${legality.name} from California, to adults ${minAge} and over.`
      : `We ship ${listOf(names)} to ${legality.name}. ${listOf(refused.map((v) => LINE_SHORT[v.productLine]))} cannot be sent here.`

  const detail = buildDetail(legality, available, refused, channels, minAge)

  return {
    code: legality.code,
    name: legality.name,
    available,
    refused,
    isServed: available.length > 0,
    channels,
    minAge,
    requiresSignature,
    summary,
    detail,
  }
}

function buildDetail(
  legality: StateLegality,
  available: readonly LineVerdict[],
  refused: readonly LineVerdict[],
  channels: StateShipping['channels'],
  minAge: number,
): string {
  const state = legality.name
  const parts: string[] = []

  if (available.length === 0) {
    return `${state} is outside our service area for every line we carry. We would rather say so here than take an order we cannot fulfil and refund it a week later.`
  }

  parts.push(
    /*
      It said the lab report for every batch "is published against the code printed on
      the package". Reports are not published; they are sent on request. 2026-09-28.
    */
    `Orders to ${state} ship from our California branch. We do not hold stock in ${state} and we are not a marketplace reseller: the bark you receive is weighed and sealed by us, and the report for its batch is available on request against the code printed on the package.`,
  )

  const parcel = channels.find((c) => c.key === 'PARCEL')
  if (parcel) {
    parts.push(
      /*
        No transit estimate and no price in the narrative either — same reason as the
        cards. Both are confirmed with the order, once carrier and destination are
        known, rather than published against a state and left to drift out of step
        with checkout.
      */
      `${listOf(parcel.carries)} ${parcel.carries.length === 1 ? 'travels' : 'travel together'} as a standard parcel with tracking, and shipping is confirmed with your order.`,
    )
  }

  const pact = channels.find((c) => c.key === 'PACT_CARRIER')
  if (pact) {
    parts.push(
      `${listOf(pact.carries)} are regulated under the federal PACT Act, so they travel separately on an age-restricted carrier, never bundled with anything else and never eligible for free shipping. If your order mixes the two, it arrives as two deliveries on two different days, and your cart shows that split, with the cost of each, before you order rather than after.`,
    )
  }

  // No signature, photo-ID or verification wording on the page (owner, 2026-09-15 and 2026-09-19);
  // the flag still routes the shipment. Visitors confirm their age when they enter the site.
  parts.push(`Everything we sell is for adults ${minAge} and over.`)

  if (refused.length > 0) {
    parts.push(
      `${listOf(refused.map((v) => LINE_SHORT[v.productLine]))} cannot be sent to ${state}. The cart refuses those items against the address you enter, so you find out before you commit rather than at a refund. The position for each is set out below.`,
    )
  }

  return parts.join(' ')
}

function listOf(items: readonly string[]): string {
  if (items.length === 0) return ''
  if (items.length === 1) return items[0]!
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]!}`
}

/**
 * ─────────────────────────────────────────────────────────────────────────────
 *  THE STATE PAGE IN A SEARCH RESULT (owner, 2026-09-19).
 *
 *  The title read "Shipping to Mississippi — What We Deliver (2026)" and the snippet
 *  "We ship all three of our product lines to Mississippi, 21+ with ID." The owner:
 *  "who searches this online?" — and then, of a question-style replacement, that
 *  these pages should be written to BUY, the way a buyer searches: "Where to buy
 *  Mimosa roots in California", "Mimosa roots in Mississippi, 2026 pricing".
 *  Every state we can ship to is a state we sell in.
 *
 *  So a state that takes root bark gets a buying title and a snippet that answers
 *  where to buy it, from what, at what price. The price is the lowest per-pound price
 *  in the live catalogue, passed in at render, never a figure frozen in a string; it
 *  is written in words because the owner banned symbols from meta tags.
 *
 *  The verdict is the same one the page and the cart read, so "ships to your door"
 *  cannot outlive the rule behind it. The mushroom line is not named in a search
 *  snippet: nothing on this site is written to rank those listings.
 * ─────────────────────────────────────────────────────────────────────────────
 */
const TITLE_LIMIT = 60
/** What a state description aims for: comfortably inside the snippet, not at its edge. */
const DESCRIPTION_TARGET = 145

function fit(preferred: string, fallback: string): string {
  return preferred.length <= TITLE_LIMIT ? preferred : fallback
}

/** "130" for whole dollars, "129.50" otherwise. Words, not a currency symbol. */
function dollars(cents: number): string {
  return cents % 100 === 0 ? String(cents / 100) : (cents / 100).toFixed(2)
}

export function stateSearchMeta(
  shipping: StateShipping,
  year: number | string,
  /** Lowest per-pound price of the root bark that ships here, from the live catalogue. */
  barkFromPoundCents?: number,
): { readonly title: string; readonly description: string } {
  const { name } = shipping
  const bark = shipping.available.some((v) => v.productLine === 'MIMOSA_HOSTILIS')
  const vape = shipping.available.some((v) => v.productLine === 'VAPE')

  if (!bark) {
    return {
      title: fit(`Mimosa Hostilis Root Bark and ${name}, ${year} Shipping Rules`, `Mimosa Hostilis Root Bark and ${name}`),
      description: `We cannot ship Mimosa hostilis root bark to ${name}.${vape ? ' Disposable vapes do ship here, adults 21 and over.' : ''}`,
    }
  }

  const title = fit(`Buy Mimosa Hostilis Root Bark in ${name}, ${year} Pricing`, `Buy Mimosa Hostilis Root Bark in ${name}`)
  const price = barkFromPoundCents ? `, from ${dollars(barkFromPoundCents)} dollars a pound` : ''
  /*
    The cities: "buy mimosa hostilis root bark in Houston" is a real search, and the
    one page that can honestly answer it for Houston is the Texas page.
  */
  const cities = (STATE_CITIES[shipping.code] ?? []).slice(0, 2)
  /*
    Owner, 2026-09-28: the two-city version read too long. One city, and a target of
    about 140 characters, well inside what results pages show.
  */
  const city = cities[0]
  const cityVariants =
    shipping.code === 'DC' || !city
      ? []
      : [`Buy Mimosa hostilis root bark in ${name}, delivered to ${city} and statewide. Powder, shredded or whole${price}.`]
  const full = `Where to buy Mimosa hostilis root bark in ${name}? Order online, shipped from California. Powder, shredded or whole cuts${price}.`
  // A long state name must not push the price off the end of the snippet.
  const short = `Buy Mimosa hostilis root bark in ${name} online, shipped from California. Powder, shredded or whole${price}.`
  const description = [...cityVariants, full, short].find((d) => d.length <= DESCRIPTION_TARGET) ?? short
  return { title, description }
}
