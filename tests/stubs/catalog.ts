import { CATEGORIES, DIRECTORY_STATES } from '@/lib/catalog/catalog.data'
import { createInMemoryCatalog, setCatalogProvider } from '@/lib/catalog/repository'
import type { SizeLadder } from '@/lib/catalog/sizing'
import { variantsForLadder, type LabBatch, type Product } from '@/lib/catalog/types'

/**
 * ─────────────────────────────────────────────────────────────────────────────
 *  TEST FIXTURES — not the catalogue.
 *
 *  These are the sample products and laboratory batches that used to ship in
 *  `src/lib/catalog/catalog.data.ts`, kept here so the cart, pricing,
 *  shipping-split and compliance tests have realistic data to run against: a
 *  parcel line that needs the intended-use attestation, an age-restricted line,
 *  PACT-carrier vapes that split a cart, and weighed products still waiting for a
 *  pound price.
 *
 *  Production ships an empty authored catalogue. Real products are posted from
 *  the admin panel, and certificates are issued to verified buyers on request, so
 *  nothing below may be copied back into `src/`: the batches in particular are
 *  invented, and an invented certificate on a live storefront is a
 *  misrepresentation.
 *
 *  Slugs, prices, variant ids and batch codes are exactly as they were, because
 *  the tests assert on them.
 * ─────────────────────────────────────────────────────────────────────────────
 */

function image(slug: string, alt: string) {
  return [{ objectKey: `products/${slug}.jpg`, alt, width: 1200, height: 1200 }]
}

/** Bind a ladder to a product, so `sizing` and `variants` cannot describe different sizes. */
function sized(slug: string, ladder: SizeLadder) {
  return { sizing: ladder, variants: variantsForLadder(slug, ladder) }
}

/** A single-unit product — vapes. One variant, no size to choose. */
function unitVariant(slug: string, priceCents: number) {
  return [
    {
      id: `${slug}-unit`,
      sku: `${slug.toUpperCase()}-UNIT`,
      name: 'Single unit',
      priceCents,
      inStock: true,
    },
  ]
}

const MHRB_SPECS: ReadonlyArray<readonly [string, string]> = [
  ['Botanical name', 'Mimosa tenuiflora'],
  ['Part', 'Root bark'],
  ['Origin', 'Brazil'],
  ['Packed', 'United States'],
  ['Intended use', 'Dyeing, soap and cosmetic manufacture, craft, research'],
  ['Not for', 'Human consumption'],
]

const AMANITA_SPECS: ReadonlyArray<readonly [string, string]> = [
  ['Species', 'Amanita muscaria'],
  ['Active compound', 'Muscimol (naturally occurring)'],
  ['Third-party tested', 'Yes — ISO 17025 accredited laboratory'],
  ['Minimum age', '21'],
  ['Made in', 'United States'],
]

const VAPE_SPECS: ReadonlyArray<readonly [string, string]> = [
  ['Type', 'Disposable'],
  ['Sold as', 'Single units'],
  ['Minimum age', '21'],
  ['Delivery', 'Adult signature with photo ID required'],
  ['Carrier', 'PACT Act compliant carrier'],
  ['Free shipping', 'Not eligible — priced per shipment'],
]

const MHRB_COMMON = {
  productLine: 'MIMOSA_HOSTILIS' as const,
  categorySlug: 'mimosa-hostilis',
  specs: MHRB_SPECS,
  notForHumanConsumption: true,
  ageRestricted: false,
  fulfillmentChannel: 'PARCEL' as const,
  pactRegulated: false,
  directoryStates: [],
  priceTiers: [],
  batchCodes: ['MH-2026-0412'],
  isActive: true,
}

const AMANITA_COMMON = {
  productLine: 'AMANITA' as const,
  categorySlug: 'amanita',
  specs: AMANITA_SPECS,
  shortDescription:
    'Contains naturally occurring muscimol. Third-party batch tested. 21+ only. Not available in every state.',
  description:
    'Made from Amanita muscaria and containing naturally occurring muscimol. Amanita muscaria is not a federally controlled substance.\n\nEvery batch is tested by an accredited third-party laboratory. We publish the full panel — potency, heavy metals, pesticides, mycotoxins, residual solvents and microbials — against the batch code printed on your package, so you can match what you received to the exact report for it.\n\nAvailability differs by state, and we will not ship where we cannot lawfully do so. Check your state before ordering.',
  notForHumanConsumption: false,
  ageRestricted: true,
  fulfillmentChannel: 'PARCEL' as const,
  pactRegulated: false,
  directoryStates: [],
  priceTiers: [],
  isActive: true,
}

/**
 * Eleven products, eight of them on sale. The Amanita gummies and capsules have no
 * pound price, which is the case the shop must hide rather than list at $0, so they
 * stay in even though a customer never sees them.
 */
export const FIXTURE_PRODUCTS: readonly Product[] = [
  // ── Mimosa Hostilis — parcel, not for human consumption ─────────────────────
  {
    ...MHRB_COMMON,
    slug: 'mhrb-powder',
    name: 'Mimosa Hostilis Root Bark Powder',
    shortDescription:
      'Finely milled root bark for natural dyeing, soap and cosmetic manufacture, and botanical research. Sold by the pound: 1/4, 1/3, 1/2 and 1 lb. Not food, not for human consumption.',
    description:
      'Finely milled Mimosa Hostilis root bark, sourced in Brazil and packed in the United States. Prized by natural dyers for the deep purple it produces on wool, silk and leather, and for its high tannin content.\n\nMilled to a consistent particle size so it disperses evenly in a cold or warm dye bath. Colour depth varies by fibre, mordant and bath temperature. Store sealed, dry and out of direct sunlight.\n\nSold by the pound in four sizes: 1/4 lb, 1/3 lb, 1/2 lb and 1 lb. Each size has one fixed price, shown beside it.\n\nThis is a raw botanical material. It is not food, it is not a supplement, and it is not sold for human consumption.',
    ...sized('mhrb-powder', {
      // $310 a kilogram as a pound, so a quarter pound is the $35.15 the cart tests expect.
      poundPriceCents: 14061,
      defaultKey: 'f4',
    }),
    images: image('mhrb-powder', 'Mimosa Hostilis root bark, finely milled powder'),
    isFeatured: true,
    rating: { average: 4.8, count: 137 },
  },
  {
    ...MHRB_COMMON,
    slug: 'mhrb-shredded',
    name: 'Mimosa Hostilis Root Bark, Shredded',
    shortDescription:
      'Coarse shredded root bark for natural dyeing and craft work. Sold by the pound: 1/4, 1/3, 1/2 and 1 lb. Not food, not for human consumption.',
    description:
      'Coarsely shredded Mimosa Hostilis root bark, sourced in Brazil and packed in the United States. The shredded cut releases pigment more slowly than powder, which many dyers prefer for longer baths and more even uptake on larger pieces.\n\nSold by the pound in four sizes: 1/4 lb, 1/3 lb, 1/2 lb and 1 lb, each at one fixed price shown beside it.\n\nThis is a raw botanical material. It is not food, it is not a supplement, and it is not sold for human consumption.',
    ...sized('mhrb-shredded', {
      // $165 per 500 g as a pound.
      poundPriceCents: 14969,
      defaultKey: 'f4',
    }),
    images: image('mhrb-shredded', 'Mimosa Hostilis root bark, coarsely shredded'),
    isFeatured: false,
    rating: { average: 4.7, count: 86 },
  },

  // ── Amanita — parcel, age-restricted ────────────────────────────────────────
  {
    ...AMANITA_COMMON,
    slug: 'amanita-gummies-mixed-berry',
    name: 'Amanita Muscaria Gummies — Mixed Berry',
    // No pound price: hidden from the shop until one is set.
    ...sized('amanita-gummies-mixed-berry', { poundPriceCents: 0, defaultKey: 'f4' }),
    images: image('amanita-gummies-mixed-berry', 'Amanita muscaria gummies, mixed berry'),
    batchCodes: ['AM-2026-0388', 'AM-2026-0401'],
    isFeatured: true,
    rating: { average: 4.6, count: 149 },
  },
  {
    ...AMANITA_COMMON,
    slug: 'amanita-gummies-citrus',
    name: 'Amanita Muscaria Gummies — Citrus',
    // No pound price: hidden from the shop until one is set.
    ...sized('amanita-gummies-citrus', { poundPriceCents: 0, defaultKey: 'f4' }),
    images: image('amanita-gummies-citrus', 'Amanita muscaria gummies, citrus'),
    batchCodes: ['AM-2026-0388'],
    isFeatured: false,
    rating: { average: 4.5, count: 63 },
  },
  {
    ...AMANITA_COMMON,
    slug: 'amanita-capsules',
    name: 'Amanita Muscaria Capsules',
    // No pound price: hidden from the shop until one is set.
    ...sized('amanita-capsules', { poundPriceCents: 0, defaultKey: 'f4' }),
    images: image('amanita-capsules', 'Amanita muscaria capsules'),
    batchCodes: ['AM-2026-0401', 'AM-2026-0455'],
    isFeatured: false,
    rating: { average: 4.6, count: 108 },
  },
  {
    ...AMANITA_COMMON,
    slug: 'amanita-caps-whole-dried',
    name: 'Amanita Muscaria Caps — Whole Dried',
    ...sized('amanita-caps-whole-dried', {
      // $75 per 28 g as a pound.
      poundPriceCents: 121498,
      defaultKey: 'f4',
    }),
    images: image('amanita-caps-whole-dried', 'Amanita muscaria caps, whole dried'),
    batchCodes: ['AM-2026-0455'],
    isFeatured: false,
    rating: { average: 4.7, count: 92 },
  },
  {
    ...AMANITA_COMMON,
    slug: 'amanita-powder',
    name: 'Amanita Muscaria Powder',
    ...sized('amanita-powder', {
      // $69 per 28 g as a pound.
      poundPriceCents: 111778,
      defaultKey: 'f4',
    }),
    images: image('amanita-powder', 'Amanita muscaria powder'),
    batchCodes: ['AM-2026-0388'],
    isFeatured: false,
    rating: { average: 4.4, count: 71 },
  },

  // ── Vapes — PACT carrier only; counted in units, never weighed ─────────────
  ...(
    [
      ['disposable-vape-classic', 'Classic', 2500, true],
      ['disposable-vape-menthol', 'Menthol', 2500, true],
      ['disposable-vape-berry', 'Berry', 2700, false],
      ['disposable-vape-citrus', 'Citrus', 2700, false],
    ] as const
  ).map(([slug, name, cents, onDirectory], i) => ({
    slug,
    name: `Disposable Vape — ${name}`,
    productLine: 'VAPE' as const,
    categorySlug: 'disposable-vapes',
    shortDescription:
      'Disposable vapor product, sold by the unit. 21+ only. Adult signature and government-issued photo ID required on delivery.',
    description:
      'A single-use disposable vapor product, sold by the unit — choose how many you want rather than a pack size.\n\nVapor products are governed by the federal PACT Act. In practice that means three things for you: a shorter list of states we can deliver to, verification of your age at checkout, and an adult signature with photo ID at your door. We ship via a carrier that complies with the PACT Act — the postal service and the major parcel carriers do not carry these products.\n\nCheck your state before ordering.',
    specs: VAPE_SPECS,
    notForHumanConsumption: false,
    ageRestricted: true,
    fulfillmentChannel: 'PACT_CARRIER' as const,
    pactRegulated: true,
    directoryStates: onDirectory ? [...DIRECTORY_STATES] : [],
    variants: unitVariant(slug, cents),
    priceTiers: [],
    images: image(slug, `Disposable vape ${name.toLowerCase()}`),
    batchCodes: ['VP-2026-0210'],
    isFeatured: false,
    isActive: true,
    rating: { average: 4.3, count: 18 + i * 9 },
  })),
]

const FULL_PANEL = [
  { panel: 'HEAVY_METALS', analyte: 'Lead', value: '< 0.05', unit: 'ppm', passed: true },
  { panel: 'HEAVY_METALS', analyte: 'Arsenic', value: '< 0.05', unit: 'ppm', passed: true },
  { panel: 'HEAVY_METALS', analyte: 'Cadmium', value: '< 0.02', unit: 'ppm', passed: true },
  { panel: 'HEAVY_METALS', analyte: 'Mercury', value: '< 0.01', unit: 'ppm', passed: true },
  { panel: 'PESTICIDES', analyte: 'Full panel (66 analytes)', value: 'Not detected', passed: true },
  { panel: 'MYCOTOXINS', analyte: 'Aflatoxin B1/B2/G1/G2', value: 'Not detected', unit: 'ppb', passed: true },
  { panel: 'MYCOTOXINS', analyte: 'Ochratoxin A', value: 'Not detected', unit: 'ppb', passed: true },
  { panel: 'SOLVENTS', analyte: 'Residual solvents panel', value: 'Not detected', unit: 'ppm', passed: true },
  { panel: 'MICROBIALS', analyte: 'E. coli / Salmonella', value: 'Not detected', passed: true },
] as const

/** One batch for every batch code a fixture product carries, so none of them dangles. */
export const FIXTURE_BATCHES: readonly LabBatch[] = [
  ['MH-2026-0412', 'ACS Laboratory', '2026-07-15'],
  ['AM-2026-0388', 'ACS Laboratory', '2026-06-02'],
  ['AM-2026-0401', 'Kaycha Labs', '2026-06-28'],
  ['AM-2026-0455', 'ACS Laboratory', '2026-07-22'],
  ['VP-2026-0210', 'Kaycha Labs', '2026-05-19'],
].map(([batchCode, labName, testedAt]) => ({
  batchCode: batchCode!,
  labName: labName!,
  isoAccredited: true,
  testedAt: testedAt!,
  pdfKey: `coa/${batchCode!.toLowerCase()}.pdf`,
  results: FULL_PANEL,
}))

/**
 * Serve the fixtures through the catalogue provider, for the modules that ask
 * `catalog` rather than reading the authored lists. The categories are the real
 * ones, since a category decides compliance and the tests should hold the real
 * rules.
 */
export function installFixtureCatalog(): void {
  setCatalogProvider(createInMemoryCatalog(FIXTURE_PRODUCTS, CATEGORIES, FIXTURE_BATCHES))
}
