/**
 * compliance-allow: therapeutic, treats, cures, relieves, anxiety, medicine, FDA approved -- the writer's rules name these words only to forbid them, and no customer reads a rule; every page the writer produces is scanned again before it saves, with directives ignored
 */
import type { ProductLine } from '@/lib/compliance/types'
import { BRAND } from '@/lib/brand'
import { formatCents } from '@/lib/utils'
import type { ContentSource } from './types'

/**
 * ─────────────────────────────────────────────────────────────────────────────
 *  WHAT THE WRITER MAY SAY, PER PRODUCT LINE (owner, 2026-09-14).
 *
 *  Every statement the automatic writer makes about a product is grounded here:
 *  the facts this site already publishes (the category copy, the shipping policy,
 *  the testing promise, the compliance rules) and the outside sources a page may
 *  cite. Nothing is invented at write time: a claim that is not in this file, in
 *  the owner's own notes or in the photos, is not made.
 *
 *  The sources were each opened and checked before being listed (2026-09-14). A
 *  page cites from this list and never from anywhere else, so a citation can never
 *  be a made-up address.
 * ─────────────────────────────────────────────────────────────────────────────
 */

export interface LineFacts {
  /** What the product is, in fact statements. */
  readonly whatItIs: readonly string[]
  /** What it is sold for, and how buyers use it. Lawful uses only. */
  readonly uses: readonly string[]
  /** Hard rules for every sentence written about this line. */
  readonly rules: readonly string[]
  /** Plain statements a customer should read before buying. Customer-facing. */
  readonly goodToKnow: readonly string[]
  /** Reasons to buy it here that are true of every order in this line. */
  readonly advantages: readonly string[]
  readonly sources: readonly ContentSource[]
  /** Guides and blog posts about this line, by slug, for internal links. */
  readonly guideSlugs: readonly string[]
  readonly postSlugs: readonly string[]
  /**
   * How the page places the product in its category. `{category}` is the category
   * link. Defaults to "It is part of our {category} range.", which only reads true
   * when the product IS that range.
   */
  readonly categoryNote?: string
  /**
   * What follows the product name in the search title. Defaults to the category name,
   * which is only true when the product IS what the category is named for: sassafras
   * sits in the "Mimosa Hostilis Root Bark" category, and its title read "Sassafras
   * Root Bark, Mimosa Hostilis Root Bark" — a different species named as the product.
   */
  readonly titleSuffix?: string
  /** Sold by the pound, or by the unit. */
  readonly soldBy: 'lb' | 'unit'
  /** Batches are lab tested. False where that is not known of every item. */
  readonly labTested?: boolean
  /**
   * Who tests them. The owner says disposables are "very well tested by second party
   * labs" (2026-09-15), so their pages say lab-tested without naming a third party.
   * Absent means an independent third-party laboratory, as the site states for the
   * botanical lines.
   */
  readonly testedBy?: 'third-party' | 'lab'
}

const FREE_FROM = formatCents(BRAND.freeShippingThresholdCents)

/** True of every order on the site. */
/** The same promise without naming who tests, for lines that are not third-party tested. */
export const LAB_FACT_UNNAMED =
  'Every batch is lab-tested before it is offered for sale, and a certified copy of the report is issued to verified buyers on request, against the batch code on the package. Reports are not posted publicly.'

export const LAB_FACT =
  'Every batch is tested by a third-party laboratory, and a certified copy of the report is issued to verified buyers on request, against the batch code on the package. Reports are not posted publicly.'

export const SITE_FACTS: readonly string[] = [
  `${BRAND.name} ships within the United States only. Which products can be sent to a given address is decided at checkout, from the state rules for that product line.`,
  'Every order is checked before payment is requested: that the stock is there and that the order can be shipped to the address given.',
  'Payment details are sent after that check, by chat on the site and by email, with the invoice. No card details are entered on the site.',
  'Every order is packed in double-sealed, smell-proof packaging.',
  `Orders ship with USPS, UPS and other local agencies when necessary, and shipping is free on orders from ${FREE_FROM}, except vapor products.`,
  LAB_FACT,
  'Each size has one fixed price. There are no price ranges and no bulk tiers.',
]

export const LINE_FACTS: Record<ProductLine, LineFacts> = {
  MIMOSA_HOSTILIS: {
    whatItIs: [
      'Mimosa hostilis (Mimosa tenuiflora) root bark is a raw botanical material.',
      'It is sourced in Brazil and packed in the United States.',
      'Natural dyers value it for the deep purple and brown shades it gives on wool, silk and leather, and for its high tannin content.',
    ],
    uses: [
      'Natural dyeing of protein fibres such as wool and silk, and leather.',
      'Soap and cosmetic manufacture, where it is used for colour.',
      'Craft work and botanical research.',
    ],
    rules: [
      'This product is NOT for human consumption and must never be described as food, a supplement, or something to take, drink, smoke or use on the body.',
      'The exact phrase "not for human consumption" may be used; no other wording about consuming it.',
      'Never mention any compound, alkaloid or substance contained in the bark, any extraction, preparation, brew, tea, yield or dose.',
    ],
    goodToKnow: ['It is a raw botanical material, not food and not a supplement. It is not for human consumption.'],
    advantages: [
      'Sold by the pound in 1/4, 1/3, 1/2 and 1 lb, each at one fixed price.',
      'Every batch third-party tested, with the certificate issued on request against its batch code.',
      'Packed in the United States in double-sealed, smell-proof packaging.',
      `Free shipping on orders from ${FREE_FROM}.`,
    ],
    sources: [
      { label: 'Mimosa tenuiflora — Wikipedia', url: 'https://en.wikipedia.org/wiki/Mimosa_tenuiflora' },
      { label: 'Natural dye — Wikipedia', url: 'https://en.wikipedia.org/wiki/Natural_dye' },
      { label: 'Tannin — Wikipedia', url: 'https://en.wikipedia.org/wiki/Tannin' },
    ],
    guideSlugs: ['what-is-mimosa-hostilis-root-bark', 'how-to-read-a-certificate-of-analysis'],
    postSlugs: ['natural-dyeing-with-mimosa-hostilis', 'shipping-restrictions-explained'],
    soldBy: 'lb',
  },
  AMANITA: {
    whatItIs: [
      'Amanita muscaria is a mushroom species, known by its red cap with white spots.',
      'It contains naturally occurring compounds, including muscimol.',
      'It is not listed in the federal controlled substance schedules (21 U.S.C. § 812).',
    ],
    uses: [
      'Sold to adults aged 21 and over.',
    ],
    rules: [
      'No health, medical, therapeutic or wellness claims of any kind: never say it treats, cures, helps with, relieves or improves anything, including sleep, stress, anxiety, mood, pain or focus.',
      'Never describe effects, experiences, dosing, serving sizes or how to take it.',
      'Never call it food, a supplement, safe, natural medicine, FDA approved or legal everywhere.',
      'Always say it is for adults 21 and over. Never mention state restrictions, and never promise delivery to every state.',
    ],
    goodToKnow: [
      'For adults 21 and over.',
    ],
    advantages: [
      'Sold by the pound in 1/4, 1/3, 1/2 and 1 lb, each at one fixed price.',
      'Every batch third-party tested, with the full certificate issued on request against its batch code.',
      'Double-sealed, smell-proof packaging, and free shipping on orders from ' + FREE_FROM + '.',
    ],
    sources: [
      { label: 'Amanita muscaria — Wikipedia', url: 'https://en.wikipedia.org/wiki/Amanita_muscaria' },
      { label: 'Muscimol — Wikipedia', url: 'https://en.wikipedia.org/wiki/Muscimol' },
      { label: '21 U.S. Code § 812, schedules of controlled substances — Cornell Law School', url: 'https://www.law.cornell.edu/uscode/text/21/812' },
      {
        label: 'Letter to industry on Amanita muscaria in food — U.S. Food and Drug Administration',
        url: 'https://www.fda.gov/food/post-market-determinations-use-substance-not-gras/letter-industry-use-amanita-muscaria-or-its-constituents-food',
      },
    ],
    guideSlugs: ['amanita-muscaria-explained', 'how-to-read-a-certificate-of-analysis'],
    postSlugs: ['what-is-muscimol', 'is-amanita-muscaria-legal-in-the-united-states', 'how-we-batch-test-every-product'],
    soldBy: 'lb',
  },
  VAPE: {
    testedBy: 'lab',
    whatItIs: [
      'A disposable vapor product: a single, ready-to-use device.',
      'Vapor products are regulated under the federal PACT Act and cannot be sent through the U.S. Postal Service.',
    ],
    uses: ['Sold to adults aged 21 and over.'],
    rules: [
      'No health claims: never say it is safer or healthier than anything, or helps anyone quit.',
      'Never describe effects, flavour intensity as a benefit to health, or use by anyone under 21.',
      'Never mention signatures, photo ID at delivery, or state restrictions, and never promise delivery to every state: where it ships is shown live on the site, not written into a page.',
      'Never promise free shipping: vapor products are excluded from it.',
    ],
    goodToKnow: [
      'For adults 21 and over.',
      'Vapor products are not included in free shipping.',
    ],
    advantages: [
      'One fixed price per unit: the total is the price times how many.',
      'Shipped with a PACT Act compliant carrier.',
      'Packed in plain, double-sealed packaging.',
    ],
    sources: [
      { label: '15 U.S. Code § 376a, delivery sales (PACT Act) — Cornell Law School', url: 'https://www.law.cornell.edu/uscode/text/15/376a' },
      {
        label: 'Cigarettes, smokeless tobacco and electronic nicotine delivery systems — USPS Publication 52',
        url: 'https://pe.usps.com/text/pub52/pub52c4_026.htm',
      },
      {
        label: 'E-cigarettes, vapes and other ENDS — U.S. Food and Drug Administration',
        url: 'https://www.fda.gov/tobacco-products/products-ingredients-components/e-cigarettes-vapes-and-other-electronic-nicotine-delivery-systems-ends',
      },
    ],
    guideSlugs: ['how-ordering-and-payment-works'],
    postSlugs: ['what-the-pact-act-means-for-buyers', 'shipping-restrictions-explained'],
    soldBy: 'unit',
  },
}

/**
 * A category whose products follow one line's rules without being that line's
 * product (owner, 2026-09-15). "Others" ships and sells exactly like the
 * disposables, but what is in it is not known in advance, so nothing here says
 * what an item IS: the writer takes that from the name, the owner's notes and the
 * photos. The delivery rules, which are true of every item in it, stay.
 */
const CATEGORY_FACTS: Record<string, Partial<LineFacts>> = {
  others: {
    whatItIs: [],
    // Testing is promised of the lines the lab results page covers, not of whatever is posted here.
    labTested: false,
    uses: ['Sold to adults aged 21 and over.'],
    rules: [
      'Never say what the item is, what it is made of or what it does unless the product name, the owner\'s notes or the photos show it.',
      'Never call it a vape or a vapor product unless the name, the notes or the photos say it is one.',
      'No health claims, and never describe effects or use by anyone under 21.',
      'Never mention signatures, photo ID at delivery, or state restrictions, and never promise delivery to every state: where it ships is shown live on the site, not written into a page.',
      'Never promise free shipping: this category is excluded from it.',
    ],
    goodToKnow: [
      'For adults 21 and over.',
      'It ships like our disposables, so it is not included in free shipping.',
    ],
    advantages: [
      'One fixed price per unit: the total is the price times how many.',
      'Packed in plain, double-sealed packaging.',
    ],
    sources: [],
  },
}

/**
 * A product whose facts are its own, not its line's (2026-09-17).
 *
 * LINE_FACTS answers "what is a product in this line?", and for the botanical line
 * that answer names a species: Mimosa hostilis, sourced in Brazil, giving purple on
 * wool. That is true of every product in the category but one. `sassafras-root-bark`
 * is Sassafras albidum — a different genus, a different family and a different
 * continent — and it inherited mimosa's species, origin, dye behaviour, sources and
 * internal links wholesale, so a $170/lb page described a plant it was not selling.
 *
 * Any fact that names a species belongs to the product, not to the line. A second
 * non-mimosa botanical posted into this category needs an entry here, or it gets
 * mimosa's biography the same way this one did.
 */
const PRODUCT_FACTS: Record<string, Partial<LineFacts>> = {
  // Muha Meds all-in-one, matched to the brand's published strain list (2026-09-17).
  'lemon-kush-mintz': muhaAllInOne('Lemon Kush Mintz', 'live resin', 'indica'),
  'muha-meds-juice-man': muhaAllInOne('Juice Man', 'live resin', 'sativa'),
  'uha-meds-grape-dosi': muhaAllInOne('Grape Dosi', 'live resin', 'hybrid'),
  'muha-meds-golden-papaya': muhaAllInOne('Golden Papaya', 'live resin', 'hybrid'),
  'muha-meds-mango-madness': muhaAllInOne('Mango Madness', 'melted diamonds', 'hybrid'),
  'muha-meds-lemon-cherry-gelato': muhaAllInOne('Lemon Cherry Gelato', 'melted diamonds', 'sativa'),
  'muha-meds-grape-gas': muhaAllInOne('Grape Gas', 'melted diamonds', 'indica'),
  'muha-meds-durban-delight': muhaAllInOne('Durban Delight', 'melted diamonds', 'sativa'),
  // Muha Meds 510 cartridges, matched to the brand's published cartridge list (2026-09-17).
  'muha-meds-lemonade-rose': muhaCartridge('Lemonade Rose', 'sativa'),
  'muha-meds-moroccan-peach-rings': muhaCartridge('Moroccan Peach Rings', 'hybrid'),
  'muha-meds': muhaCartridge('Purple Breath', 'indica'),
  'muha-meds-toro-milk-runtz': muhaCartridge('Toro Milk Runtz', 'indica'),
  'muha-meds-white-raspberry': muhaCartridge('White Raspberry', 'hybrid'),
  // Described from the owner's product names; no verified manufacturer source exists.
  'ace-ultra-premium-2g-disposable': deviceFromName({ brand: 'ACE Ultra Premium', format: 'disposable', size: '2g' }),
  'ghost-2g-disposable': deviceFromName({ brand: 'Ghost', format: 'disposable', size: '2g' }),
  'wholemelts-2g-disposable': deviceFromName({ brand: 'Whole Melts', format: 'disposable', size: '2g' }),
  'splitz-2g-disposable-dual-chamber': deviceFromName({ brand: 'Splitz', format: 'disposable', size: '2g', chambers: 'dual chamber' }),
  'turn-2g-disposable': deviceFromName({ brand: 'Turn', format: 'disposable', size: '2g' }),
  'boutiq-switch-gum-2g-disposable': deviceFromName({ brand: 'Boutiq', format: 'disposable', size: '2g', chambers: 'switchable multi-chamber', note: 'It is the brand\'s Switch Gum edition.' }),
  'authentic-boutiq-1g-screw-on-carts': deviceFromName({ brand: 'Boutiq', format: 'cartridge', size: '1g' }),
  'hitz-2g-disposables': deviceFromName({ brand: 'Hitz', format: 'disposable', size: '2g' }),
  'hitz-disposables': deviceFromName({ brand: 'Hitz', format: 'disposable' }),
  'big-chief-2g-disposables': deviceFromName({ brand: 'Big Chief', format: 'disposable', size: '2g' }),
  'madlabs-disposables': deviceFromName({ brand: 'MadLabs', format: 'disposable' }),
  'rawgarden-sauce': deviceFromName({ brand: 'Raw Garden', format: 'disposable', note: 'The name states the brand\'s Live Sauce line.' }),
  'fade-disposable': deviceFromName({ brand: 'Fade', format: 'disposable' }),
  'hollowtips-disposables': deviceFromName({ brand: 'Hollowtips', format: 'disposable' }),
  'fusion-2g-small': deviceFromName({ brand: 'Fusion', format: 'disposable', size: '2g', note: 'The name states the smaller of the brand\'s two body sizes.' }),
  'snooze-disposables': deviceFromName({ brand: 'Snooze', format: 'disposable' }),
  'puffin-dual-disposable': deviceFromName({ brand: 'Puffin', format: 'disposable', chambers: 'dual chamber' }),
  'luigi-2g-v9-disposables': deviceFromName({ brand: 'Luigi', format: 'disposable', size: '2g', note: 'The name states the V9 hardware revision.' }),
  'clean-carys-disposables': deviceFromName({ brand: 'Clean Carys', format: 'disposable' }),
  'uni-2g': deviceFromName({ brand: 'Uni', format: 'disposable', size: '2g' }),
  'muhameds-summer-raffle-edition': deviceFromName({ brand: 'Muha Meds', format: 'disposable', note: 'The name states a Summer Raffle edition. Confirm whether this is a product or a promotion before it is described further.' }),
  'all-new-brand-2g-and-preroll-in-one': deviceFromName({ brand: 'the manufacturer named on the packaging', format: 'disposable', size: '2g', note: 'The name states a 2g device paired with a pre-roll. The listing has no brand on it yet.' }),
  // Muha Meds flower, matched to the brand's published flower list (2026-09-17).
  'muha-mints': muhaFlower('Muha Mints', 'indica'),
  'muha-meds-adios-mf': muhaFlower('Adios MF', 'indica'),
  'muha-meds-brain-freeze': muhaFlower('Brain Freeze', 'indica'),
  'muha-meds-bacio-gelato': muhaFlower('Bacio Gelato', 'hybrid'),
  'muha-meds-black-truffle': muhaFlower('Black Truffle', 'hybrid'),
  'muha-meds-frosted-cherries': muhaFlower('Frosted Cherries', 'hybrid'),
  'sassafras-root-bark': {
    titleSuffix: 'Sassafras Albidum, Sold by the Pound',
    whatItIs: [
      'Sassafras root bark is a raw botanical material, cut from Sassafras albidum, a tree in the laurel family (Lauraceae).',
      'Sassafras albidum is native to eastern North America, and this bark is harvested and packed in the United States.',
      'Bark from the tree has a long history of use as a dye.',
    ],
    uses: [
      'Natural dyeing and craft work.',
      'Botanical research and reference collections.',
    ],
    rules: [
      'This product is NOT for human consumption and must never be described as food, drink, tea, root beer, a flavouring, a supplement, or something to take, brew, steep, smoke or use on the body.',
      'The exact phrase "not for human consumption" may be used; no other wording about consuming it.',
      'Never mention any compound, alkaloid, oil or substance contained in the bark, any extraction, distillation, preparation, brew, tea, yield or dose.',
      'Never call it mimosa, never say it comes from Brazil, and never give it the colours or the tannin content of mimosa root bark: it is a different species from a different continent.',
      'Never state a shade, colour or tannin level for it. The site holds no test of what this bark yields, and a number that is not measured is not written.',
    ],
    goodToKnow: [
      'It is a raw botanical material, not food and not a supplement. It is not for human consumption.',
      'Federal rules prohibit added safrole, oil of sassafras and sassafras bark intended for flavouring from use in human food (21 CFR 189.180). It is sold here for dye and craft work only.',
    ],
    categoryNote: 'It is listed in our {category} category, though it is a different plant.',
    sources: [
      { label: 'Sassafras albidum — Wikipedia', url: 'https://en.wikipedia.org/wiki/Sassafras_albidum' },
      { label: '21 CFR § 189.180, safrole — Cornell Law School', url: 'https://www.law.cornell.edu/cfr/text/21/189.180' },
      { label: 'Natural dye — Wikipedia', url: 'https://en.wikipedia.org/wiki/Natural_dye' },
    ],
    // Deliberately not the mimosa guide or the mimosa dyeing post: neither is about this plant.
    guideSlugs: ['how-to-read-a-certificate-of-analysis'],
    postSlugs: ['shipping-restrictions-explained'],
  },
}

/**
 * Muha Meds all-in-one disposables, from the brand's own product page, read 2026-09-17:
 * https://www.muhameds.com/products/all-in-one
 *
 * The brand publishes the extract each strain is filled with, its indica/sativa/hybrid
 * classification, and the hardware. It publishes NO fill size, NO cannabinoid content and
 * NO statement about hemp status, so none of those is written here — third-party listings
 * quote potency figures for these devices, and a number copied off a reseller is not a
 * measurement. Fill size and cannabinoids come from the owner's COA or stay off the page.
 */
function muhaAllInOne(
  strain: string,
  extract: 'live resin' | 'melted diamonds',
  type: 'indica' | 'sativa' | 'hybrid',
): Partial<LineFacts> {
  const classified = type === 'indica' ? 'an indica' : `a ${type}`
  return {
    whatItIs: [
      `Muha Meds ${strain} is an all-in-one disposable from Muha Meds.`,
      `It is filled with the brand's ${extract} extract, and the brand classifies ${strain} as ${classified}.`,
      'The device is rechargeable over USB-C and uses the brand\'s custom ceramic, postless coil.',
      'Vapor products are regulated under the federal PACT Act and cannot be sent through the U.S. Postal Service.',
    ],
    rules: [
      ...LINE_FACTS.VAPE.rules,
      'Never state a cannabinoid content, potency, percentage or milligram figure: the brand publishes none and the site holds no certificate for these devices.',
      'Never state the fill size in grams unless the owner has confirmed it.',
      'Never say hemp-derived, Farm Bill, THCA or marijuana, and never describe the product\'s legal status: what may be said about that is decided by the state rules, not by a product page.',
      'Never describe the taste, the smell or the experience: the brand publishes a classification and an extract, and that is what the page carries.',
    ],
    sources: [
      { label: 'All-In-One — Muha Meds', url: 'https://www.muhameds.com/products/all-in-one' },
      ...LINE_FACTS.VAPE.sources,
    ],
  }
}

/**
 * Muha Meds 510-thread cartridges, from the brand's cartridge page, read 2026-09-17:
 * https://www.muhameds.com/products/cartridges
 *
 * Five listings sit in the disposables category and are NOT disposables — the brand
 * lists them as cartridges: 510-thread, ceramic core, no battery of their own. Calling
 * a cartridge a disposable on the page would misdescribe what arrives, and it is also
 * the distinction a buyer searching "510 cart" is making. The category is the owner's
 * to change; what the page SAYS is fixed here.
 *
 * Same silences as the all-in-one entry: no fill size, no cannabinoid content, no
 * hemp or legal wording.
 */
function muhaCartridge(strain: string, type: 'indica' | 'sativa' | 'hybrid'): Partial<LineFacts> {
  const classified = type === 'indica' ? 'an indica' : `a ${type}`
  return {
    whatItIs: [
      `Muha Meds ${strain} is a 510-thread cartridge from Muha Meds, not an all-in-one device: it screws onto a 510 battery you already own.`,
      `It is filled with the brand's melted diamonds extract, and the brand classifies ${strain} as ${classified}.`,
      'The cartridge is ceramic-core and universally 510-thread compatible.',
      'Vapor products are regulated under the federal PACT Act and cannot be sent through the U.S. Postal Service.',
    ],
    rules: [
      ...LINE_FACTS.VAPE.rules,
      'Never call it a disposable or an all-in-one: it is a cartridge and has no battery.',
      'Never state a cannabinoid content, potency, percentage or milligram figure: the brand publishes none and the site holds no certificate for these cartridges.',
      'Never state the fill size in grams unless the owner has confirmed it.',
      'Never say hemp-derived, Farm Bill, THCA or marijuana, and never describe the product\'s legal status.',
      'Never describe the taste, the smell or the experience.',
    ],
    sources: [
      { label: 'Cartridges — Muha Meds', url: 'https://www.muhameds.com/products/cartridges' },
      ...LINE_FACTS.VAPE.sources,
    ],
  }
}

/**
 * A device described from the owner's own product name (2026-09-17).
 *
 * ── WHY THESE ARE NOT SOURCED FROM A BRAND SITE ────────────────────────────
 *
 * Muha Meds has one canonical site, which the owner supplied, so its strains,
 * extracts and hardware are quoted from it. The other brands in this catalogue do
 * not. Searching for Big Chief returns bigchiefofficial.com, bigchiefextracts.com,
 * bigchiefsextractofficial.com, bigchiefextractsbrand.com, bigchiefdisposable.us and
 * bigchiefextractshop.com; Boutiq returns boutiqcart.com, switchboutiq.com,
 * boutiqofficial.com, boutiqofficials.com, boutiqdispo.com and boutiqswitchv6.com.
 * Each presents itself as the brand. There is no way from here to tell which is, and
 * a specification copied off the wrong one is a fabricated fact with a citation
 * attached — worse than no fact, because it looks checked.
 *
 * So these entries state only what the OWNER'S OWN product name supports: the brand,
 * the format, the fill size and the chamber configuration. Everything a laboratory
 * or a manufacturer would have to confirm — extract type, strain, classification,
 * potency, cannabinoids — is forbidden by the rules below until it is documented.
 */
function deviceFromName(args: {
  readonly brand: string
  readonly format: 'disposable' | 'cartridge'
  /** Fill size as the name states it, e.g. "2g". Omitted when the name does not say. */
  readonly size?: string
  /** Chamber wording where the name carries it, e.g. "dual chamber". */
  readonly chambers?: string
  /** Anything else the name states, e.g. "V9", "paired with a pre-roll". */
  readonly note?: string
}): Partial<LineFacts> {
  const what = args.format === 'cartridge'
    ? `${args.brand} ${args.size ? `${args.size} ` : ''}cartridges screw onto a 510 battery you already own; no battery comes with them.`
    // "An all-in-one" without a size, "A 2g all-in-one" with one.
    : `${args.size ? `A ${args.size}` : 'An'} all-in-one disposable from ${args.brand}: the device arrives filled and ready, with nothing to assemble.`
  return {
    whatItIs: [
      what,
      ...(args.chambers ? [`It is a ${args.chambers} device.`] : []),
      ...(args.note ? [args.note] : []),
      'Vapor products are regulated under the federal PACT Act and cannot be sent through the U.S. Postal Service.',
    ],
    rules: [
      ...LINE_FACTS.VAPE.rules,
      'State only what the product NAME supports. The brand, the format, the fill size and the chamber count come from the name; nothing else about the device is known.',
      'Never state an extract type, a strain, a classification, a cannabinoid, a potency or a percentage. No verified manufacturer source exists for this brand, and a specification taken from an unverified site is a fabrication with a citation on it.',
      'Never say hemp-derived, Farm Bill, THCA or marijuana, and never describe the product\'s legal status.',
      'Never describe the taste, the smell or the experience.',
      'Cite no outside source: there is none to cite.',
    ],
    sources: [...LINE_FACTS.VAPE.sources],
  }
}

/**
 * Muha Meds flower, from the brand's flower page, read 2026-09-17:
 * https://www.muhameds.com/products/flower
 *
 * Six listings sit in "Others" at $30-35 a unit. The category deliberately says
 * nothing about what an item IS, because it is a catch-all — so these pages carried
 * no description of the product at all. The brand lists all six by name as flower in
 * eighth-ounce jars, which is a verified manufacturer source and the one thing the
 * pages were missing.
 *
 * They are not vapes. The category ships them under the disposables' delivery rules,
 * which is the owner's choice and stays; nothing here calls them a vapor product.
 * Potency, cannabinoids and legal status stay off, as everywhere else.
 */
function muhaFlower(strain: string, type: 'indica' | 'sativa' | 'hybrid'): Partial<LineFacts> {
  const classified = type === 'indica' ? 'an indica' : `a ${type}`
  return {
    whatItIs: [
      `Muha Meds ${strain} is cannabis flower, not a vapor product: whole buds in a jar.`,
      `The brand sells it by the eighth of an ounce and classifies ${strain} as ${classified}, in its indoor-grown range.`,
    ],
    uses: ['Sold to adults aged 21 and over.'],
    rules: [
      'No health, medical, therapeutic or wellness claims of any kind.',
      'Never describe effects, experiences, dosing or how to use it.',
      'Never call it a vape, a vapor product or a disposable: it is flower.',
      'Never state a cannabinoid content, potency, percentage or milligram figure: the brand publishes none and the site holds no certificate for it.',
      'Never say hemp-derived, Farm Bill, THCA or marijuana, and never describe the product\'s legal status.',
      'Never describe the taste, the smell or the appearance beyond what the brand states.',
      'Never mention state restrictions, and never promise delivery to every state.',
    ],
    goodToKnow: ['For adults 21 and over.', 'It ships like our disposables, so it is not included in free shipping.'],
    sources: [{ label: 'Flower — Muha Meds', url: 'https://www.muhameds.com/products/flower' }],
    labTested: false,
    guideSlugs: ['how-ordering-and-payment-works'],
    postSlugs: [],
  }
}

/**
 * What the writer may say about this product, in this category, of this line.
 *
 * Narrowest wins: the product's own facts over its category's, and its category's
 * over its line's.
 */
export function factsFor(line: ProductLine, categorySlug?: string, productSlug?: string): LineFacts {
  const category = categorySlug ? CATEGORY_FACTS[categorySlug] : undefined
  const product = productSlug ? PRODUCT_FACTS[productSlug] : undefined
  if (!category && !product) return LINE_FACTS[line]
  return { ...LINE_FACTS[line], ...category, ...product }
}
