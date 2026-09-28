import type { UsJurisdictionCode } from '@/lib/compliance/types'
import { STATE_DYEING_FACTS, type StateDyeingFacts } from './state-dyeing.data'
import { STATE_HERITAGE, type HeritageFact } from './state-heritage.data'

/**
 * Dyeing with root bark, state by state.
 *
 * What makes a state page worth its own URL for someone buying bark to dye with is
 * the handful of local facts that change their results: how hard their tap water is
 * (hard, alkaline water is the commonest reason a Mimosa bath turns brown instead of
 * purple), how humid their summers are (which decides how they should store dried
 * bark), whether sassafras grows wild around them, and where the state's own dyers
 * and spinners meet.
 *
 * Every fact comes from `state-dyeing.data.ts`, which carries the source for each
 * one. A fact that could not be verified is absent there, and its paragraph is simply
 * not written — nothing here is generated to fill a gap.
 */

export interface DyeingParagraph {
  /** Stable key, for React and for tests. */
  readonly key: 'delivery' | 'water' | 'storage' | 'sassafras'
  readonly heading: string
  readonly text: string
  readonly sourceUrl?: string
}

export interface FiberEvent {
  readonly name: string
  readonly place: string
  readonly month: string | null
  readonly url: string
}

export interface StateDyeingGuide {
  readonly paragraphs: readonly DyeingParagraph[]
  readonly events: readonly FiberEvent[]
  /** The state's own fiber, textile and dye heritage, each fact with its source. */
  readonly heritage: readonly HeritageFact[]
  /** One answer for the page's FAQ, when the water fact is known. */
  readonly waterFaq?: { readonly question: string; readonly answer: string }
}

/*
  Census regions, used only to say how far a parcel travels from California. No
  transit times are published: those are confirmed with the order, when the carrier
  and the address are known.
*/
const WEST: readonly UsJurisdictionCode[] = ['AK', 'AZ', 'CO', 'HI', 'ID', 'MT', 'NV', 'NM', 'OR', 'UT', 'WA', 'WY']
const MIDWEST: readonly UsJurisdictionCode[] = ['IL', 'IN', 'IA', 'KS', 'MI', 'MN', 'MO', 'NE', 'ND', 'OH', 'SD', 'WI']
const NORTHEAST: readonly UsJurisdictionCode[] = ['CT', 'ME', 'MA', 'NH', 'NJ', 'NY', 'PA', 'RI', 'VT']

function deliveryText(code: UsJurisdictionCode, state: string, neighbours: readonly string[]): string {
  const base = deliverySentence(code, state)
  if (neighbours.length === 0) return base
  return `${base} The same service, at the same prices, covers neighbouring ${listOf(neighbours)}, so a guild or a class that spans the state line can order to either side of it.`
}

function listOf(items: readonly string[]): string {
  if (items.length <= 1) return items[0] ?? ''
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`
}

function deliverySentence(code: UsJurisdictionCode, state: string): string {
  if (code === 'CA') {
    return `Orders to addresses in ${state} never leave the state: they are packed and shipped from our California branch, which makes this the shortest journey we ship.`
  }
  if (code === 'AK' || code === 'HI') {
    return `Parcels to ${state} travel from California by air as well as road, so allow a little longer than for an address in the lower 48; the window is confirmed with your order.`
  }
  if (WEST.includes(code)) {
    return `${state} is a short journey from our California branch: parcels stay in the western states from the moment they leave us, and the delivery window is confirmed with your order.`
  }
  if (MIDWEST.includes(code)) {
    return `Parcels to ${state} cross the Rockies from our California branch into the Midwest, so allow a little longer than for a western address; the delivery window is confirmed with your order.`
  }
  if (NORTHEAST.includes(code)) {
    return `Parcels to ${state} cross the whole country from our California branch to the Northeast, the longest journey in the lower 48, so allow a little longer than for a western address; the delivery window is confirmed with your order.`
  }
  return `Parcels to ${state} cross the country from our California branch into the South, so allow a little longer than for a western address; the delivery window is confirmed with your order.`
}

/*
  What the hardness category means for a Mimosa dye bath. The practical advice is the
  same the pillar guide gives — pH 5 to 6 keeps the purples — so the two cannot
  disagree about what a dyer should do.
*/
const WATER_ADVICE: Record<NonNullable<StateDyeingFacts['waterHardness']>, string> = {
  soft: 'Soft water suits Mimosa hostilis well: the bath stays close to neutral, which is where the rose and plum tones hold, so most dyers here can use tap water as it comes. The one thing soft municipal water can carry is chlorine, which dulls some colors; filling the dye pot the night before and letting it stand uncovered lets most of it escape. Rainwater, naturally soft and slightly acidic, is the ideal dye water if you can collect it.',
  moderate:
    'Moderately hard water is workable, but it nudges the bath toward alkaline. If a first bath comes out browner than you expected, a small splash of white vinegar or a pinch of citric acid, to bring the pot to about pH 5 to 6, usually brings the purples back.',
  hard: 'Hard water is the commonest reason a Mimosa bath turns brown instead of purple, because the minerals push the pot alkaline. Use rainwater or distilled water for the dye bath, or bring tap water down to about pH 5 to 6 with white vinegar or citric acid before the bark goes in.',
  'very hard':
    'Very hard water is the commonest reason a Mimosa bath turns brown instead of purple, because the minerals push the pot alkaline. For the clearest color, use rainwater or distilled water for the dye bath, or bring tap water down to about pH 5 to 6 with white vinegar or citric acid before the bark goes in.',
  varies:
    'Because hardness differs across the state, test a strip of pH paper in your own tap water first. Near neutral, use it as it comes; if it reads alkaline, bring the pot to about pH 5 to 6 with white vinegar or citric acid, or use rainwater, so the purples hold.',
}

function storageAdvice(state: string, humidity: string): string {
  const humid = /humid|wet|rain|subtropical|tropical|muggy/i.test(humidity)
  const dry = /arid|dry|desert/i.test(humidity)
  const lead = `NOAA's climate summary for ${state} describes ${humidity}.`
  if (humid) {
    return `${lead} Where the summers are humid, damp is the thing to guard against: keep bark sealed in its bag or an airtight jar, add a desiccant packet if it will sit for months, and store it somewhere cool rather than in a basement or a garage that sweats in summer.`
  }
  if (dry) {
    return `${lead} Dry air works in bark's favour. Keep it sealed and out of direct sun, which fades the powder and the cut faces of shredded bark over time, and it holds its color well past a year.`
  }
  return `${lead} The usual rule applies: keep bark sealed, dry and out of the light, away from a damp basement, and it holds its color well past a year.`
}

export function buildDyeingGuide(
  code: UsJurisdictionCode,
  state: string,
  /** Names of the bordering jurisdictions, from the border map in state-pages.ts. */
  neighbours: readonly string[] = [],
): StateDyeingGuide {
  const facts = STATE_DYEING_FACTS[code]
  const paragraphs: DyeingParagraph[] = [
    { key: 'delivery', heading: `How root bark reaches ${state}`, text: deliveryText(code, state, neighbours) },
  ]
  let waterFaq: StateDyeingGuide['waterFaq']

  if (facts?.waterHardness && facts.waterNote) {
    const text = `${facts.waterNote} ${WATER_ADVICE[facts.waterHardness]}`
    paragraphs.push({
      key: 'water',
      heading: `Tap water in ${state}, and what it does to a Mimosa dye bath`,
      text,
      ...(facts.waterSource ? { sourceUrl: facts.waterSource } : {}),
    })
    waterFaq = {
      question: `What water should I use to dye with Mimosa hostilis in ${state}?`,
      answer: text,
    }
  }

  if (facts?.humidity) {
    paragraphs.push({
      key: 'storage',
      heading: `Storing root bark in ${state}`,
      text: storageAdvice(state, facts.humidity),
      ...(facts.humiditySource ? { sourceUrl: facts.humiditySource } : {}),
    })
  }

  if (facts && facts.sassafrasNative !== null) {
    paragraphs.push({
      key: 'sassafras',
      heading: facts.sassafrasNative ? `Sassafras grows wild in ${state}` : `Sassafras and ${state}`,
      text: facts.sassafrasNative
        ? `Sassafras albidum, the tree our sassafras root bark comes from, is native to ${state}, and it is easy to spot on a walk by its three leaf shapes on one branch: plain ovals, mittens and three-lobed leaves. Dyers here are working with one of their own region's traditional dye trees; on alum-mordanted wool the root bark gives warm tans and rose-browns.`
        : `Sassafras albidum is native to eastern North America and does not grow wild in ${state}, so sassafras root bark is one of the few ways to work with it here. On alum-mordanted wool it gives warm tans and rose-browns, and it overdyes well on a pale Mimosa hostilis pink.`,
      ...(facts.sassafrasSource ? { sourceUrl: facts.sassafrasSource } : {}),
    })
  }

  return { paragraphs, events: facts?.fiberEvents ?? [], heritage: STATE_HERITAGE[code] ?? [], ...(waterFaq ? { waterFaq } : {}) }
}
