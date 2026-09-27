/**
 * Seed script.
 *
 * Populates a development or preview database with a realistic, COMPLIANT catalogue.
 * Every string here passes the banned-terms lexicon — the seed doubles as a reference
 * for the house voice, so copywriters have a correct example to work from.
 *
 * Run: npm run db:seed
 *
 * compliance-allow: psilocybin -- comparative educational copy that explicitly
 * distinguishes our lawful Amanita muscaria products from Schedule I psilocybin.
 * Naming the distinction is the point of the content; implying equivalence is what
 * the rule exists to stop.
 */
import 'dotenv/config'
import type { ProductLine, RuleStatus } from '@prisma/client'
import { BRAND } from '../src/lib/brand'
import { STATE_RULE_SEED } from '../src/lib/compliance/state-rules.data'
import { db } from '../src/lib/db/client'
import { sizeOptions, sizeStep, type SizeLadder } from '../src/lib/catalog/sizing'

async function seedStateRules() {
  for (const rule of STATE_RULE_SEED) {
    await db.stateRule.upsert({
      where: {
        stateCode_productLine: {
          stateCode: rule.stateCode,
          productLine: rule.productLine as ProductLine,
        },
      },
      update: {
        status: rule.status as RuleStatus,
        statuteCitation: rule.statuteCitation ?? null,
        statuteUrl: rule.statuteUrl ?? null,
        notes: rule.notes ?? null,
        minAge: rule.minAge,
        requiresAdultSignature: rule.requiresAdultSignature,
        requiresProductDirectory: rule.requiresProductDirectory,
        watch: rule.watch,
        lastReviewedAt: new Date(rule.lastReviewedAt),
        reviewedBy: rule.reviewedBy,
        effectiveFrom: rule.effectiveFrom ? new Date(rule.effectiveFrom) : null,
      },
      create: {
        stateCode: rule.stateCode,
        productLine: rule.productLine as ProductLine,
        status: rule.status as RuleStatus,
        statuteCitation: rule.statuteCitation ?? null,
        statuteUrl: rule.statuteUrl ?? null,
        notes: rule.notes ?? null,
        minAge: rule.minAge,
        requiresAdultSignature: rule.requiresAdultSignature,
        requiresProductDirectory: rule.requiresProductDirectory,
        watch: rule.watch,
        lastReviewedAt: new Date(rule.lastReviewedAt),
        reviewedBy: rule.reviewedBy,
        effectiveFrom: rule.effectiveFrom ? new Date(rule.effectiveFrom) : null,
      },
    })
  }
  console.log(`  ✓ ${STATE_RULE_SEED.length} state rules`)
}

const CATEGORIES = [
  {
    slug: 'mimosa-hostilis',
    name: 'Mimosa Hostilis Root Bark',
    productLine: 'MIMOSA_HOSTILIS' as const,
    intro:
      'Mimosa Hostilis root bark, milled and shredded, sourced in Brazil and packed in the United States. Natural dyers value it for the deep purple it yields on protein fibres and for its high tannin content. Sold as a raw botanical material for dyeing, soap and cosmetic manufacture, craft and research. It is not food and it is not sold for human consumption.',
    metaTitle: 'Mimosa Hostilis Root Bark Powder & Shredded | Lab-Tested, US-Packed',
    metaDesc:
      'Finely milled and shredded Mimosa Hostilis root bark for natural dyeing, soap making and botanical research. Batch-tested, US-packed, ships to all 50 states.',
    sortOrder: 1,
  },
  {
    slug: 'amanita',
    name: 'Amanita Muscaria',
    productLine: 'AMANITA' as const,
    intro:
      'Amanita muscaria products containing naturally occurring muscimol. Amanita muscaria is not a federally controlled substance and does not contain psilocybin. Every batch is tested by an accredited third-party laboratory for potency, heavy metals, pesticides, mycotoxins and residual solvents, and every result is published against its batch number. Availability varies by state — check your state before ordering.',
    metaTitle: 'Amanita Muscaria Products | Third-Party Lab Tested, State-Verified',
    metaDesc:
      'Amanita muscaria products with published third-party COAs for every batch. Check state availability instantly. 21+ only. Ships to 49 states.',
    sortOrder: 2,
  },
  {
    slug: 'disposable-vapes',
    name: 'Disposable Vapes',
    productLine: 'VAPE' as const,
    intro:
      'Disposable vapor products, shipped only to states where they may lawfully be delivered and only via a PACT Act compliant carrier. Delivery requires an adult signature and a valid government-issued photo ID showing age 21 or over. Availability is restricted in many states — check your state before ordering.',
    metaTitle: 'Disposable Vapes | 21+, Adult Signature Required, State-Verified',
    metaDesc:
      'Disposable vapor products shipped via PACT Act compliant carrier with adult signature required. Check whether we can deliver to your state.',
    sortOrder: 3,
  },
]

/**
 * The catalogue, as eleven products rather than twenty.
 *
 * Sizes are VARIANTS, generated from a ladder by the same `sizeOptions` the
 * storefront uses — importing the formula rather than restating it is the only
 * way the seeded database and the running app can be guaranteed to price a 250 g
 * bag identically.
 *
 * Sold by the pound in 1/4, 1/3, 1/2 and 1 lb; vapes carry no sizes, being counted.
 * No bulk tiers: every size has one fixed price.
 */
const PRODUCTS: Array<{
  slug: string
  name: string
  cat: string
  cents?: number
  sizing?: SizeLadder
  featured?: boolean
  directory?: boolean
}> = [
  // ── Mimosa Hostilis: ships nationwide, the volume and SEO anchor.
  {
    slug: 'mhrb-powder',
    name: 'Mimosa Hostilis Root Bark Powder',
    cat: 'mimosa-hostilis',
    featured: true,
    sizing: { poundPriceCents: 14061, defaultKey: 'f4' },
  },
  {
    slug: 'mhrb-shredded',
    name: 'Mimosa Hostilis Root Bark, Shredded',
    cat: 'mimosa-hostilis',
    sizing: { poundPriceCents: 14969, defaultKey: 'f4' },
  },

  // ── Amanita: blocked in LA, watch-flagged in FL and NY.
  {
    slug: 'amanita-gummies-mixed-berry',
    name: 'Amanita Muscaria Gummies — Mixed Berry',
    cat: 'amanita',
    featured: true,
    sizing: { poundPriceCents: 0, defaultKey: 'f4' },
  },
  {
    slug: 'amanita-gummies-citrus',
    name: 'Amanita Muscaria Gummies — Citrus',
    cat: 'amanita',
    sizing: { poundPriceCents: 0, defaultKey: 'f4' },
  },
  {
    slug: 'amanita-capsules',
    name: 'Amanita Muscaria Capsules',
    cat: 'amanita',
    sizing: { poundPriceCents: 0, defaultKey: 'f4' },
  },
  {
    slug: 'amanita-caps-whole-dried',
    name: 'Amanita Muscaria Caps — Whole Dried',
    cat: 'amanita',
    sizing: { poundPriceCents: 121498, defaultKey: 'f4' },
  },
  {
    slug: 'amanita-powder',
    name: 'Amanita Muscaria Powder',
    cat: 'amanita',
    sizing: { poundPriceCents: 111778, defaultKey: 'f4' },
  },

  // ── Vapes: PACT_CARRIER only, directory-listed where required. Counted, not sized.
  { slug: 'disposable-vape-classic', name: 'Disposable Vape — Classic', cat: 'disposable-vapes', cents: 2500, directory: true },
  { slug: 'disposable-vape-menthol', name: 'Disposable Vape — Menthol', cat: 'disposable-vapes', cents: 2500, directory: true },
  { slug: 'disposable-vape-berry', name: 'Disposable Vape — Berry', cat: 'disposable-vapes', cents: 2700 },
  { slug: 'disposable-vape-citrus', name: 'Disposable Vape — Citrus', cat: 'disposable-vapes', cents: 2700 },
]

const DIRECTORY_STATES = ['FL', 'NC', 'TN', 'VA', 'WI']

async function seedCatalog() {
  const catIds = new Map<string, string>()
  for (const c of CATEGORIES) {
    const row = await db.category.upsert({
      where: { slug: c.slug },
      update: { intro: c.intro, metaTitle: c.metaTitle, metaDesc: c.metaDesc },
      create: c,
    })
    catIds.set(c.slug, row.id)
  }
  console.log(`  ✓ ${CATEGORIES.length} categories`)

  for (const p of PRODUCTS) {
    const category = CATEGORIES.find((c) => c.slug === p.cat)
    if (!category) continue
    const line = category.productLine
    const isVape = line === 'VAPE'
    const isMhrb = line === 'MIMOSA_HOSTILIS'

    const product = await db.product.upsert({
      where: { slug: p.slug },
      update: {},
      create: {
        slug: p.slug,
        name: p.name,
        productLine: line,
        categoryId: catIds.get(p.cat)!,
        shortDescription:
          isMhrb
            ? 'Milled botanical material for natural dyeing, soap and cosmetic manufacture, and research. Not food, not for human consumption.'
            : isVape
              ? 'Disposable vapor product. 21+ only. Adult signature and government-issued photo ID required on delivery.'
              : 'Contains naturally occurring muscimol. Third-party batch tested. 21+ only. Not available in every state.',
        notForHumanConsumption: isMhrb,
        ageRestricted: !isMhrb,
        fulfillmentChannel: isVape ? 'PACT_CARRIER' : 'PARCEL',
        pactRegulated: isVape,
        directoryStates: isVape && p.directory ? DIRECTORY_STATES : [],
        isFeatured: p.featured ?? false,
        isActive: true,
      },
    })

    /*
      One variant per size, priced by the shared ladder. A product with no ladder
      is a vape: one unit, one variant, one price.
    */
    const options = p.sizing ? sizeOptions(p.sizing) : []
    const variants = options.length
      ? options.map((o) => ({
          sku: `${p.slug.toUpperCase()}-${sizeStep(o.key)?.skuLabel ?? o.key.toUpperCase()}`,
          name: o.label,
          priceCents: o.priceCents,
        }))
      : [{ sku: `${p.slug.toUpperCase()}-UNIT`, name: 'Single unit', priceCents: p.cents ?? 0 }]

    for (const v of variants) {
      await db.productVariant.upsert({
        where: { sku: v.sku },
        update: { priceCents: v.priceCents, name: v.name },
        create: { productId: product.id, sku: v.sku, name: v.name, priceCents: v.priceCents },
      })
    }

  }
  console.log(`  ✓ ${PRODUCTS.length} products with variants`)
}

async function seedLabBatches() {
  const batches = [
    { batchCode: 'MH-2026-0412', labName: 'ACS Laboratory', line: 'mhrb' },
    { batchCode: 'AM-2026-0388', labName: 'ACS Laboratory', line: 'amanita' },
    { batchCode: 'AM-2026-0401', labName: 'Kaycha Labs', line: 'amanita' },
    { batchCode: 'AM-2026-0455', labName: 'ACS Laboratory', line: 'amanita' },
    { batchCode: 'VP-2026-0210', labName: 'Kaycha Labs', line: 'vape' },
  ]

  for (const b of batches) {
    const batch = await db.labBatch.upsert({
      where: { batchCode: b.batchCode },
      update: {},
      create: {
        batchCode: b.batchCode,
        labName: b.labName,
        isoAccredited: true,
        testedAt: new Date('2026-07-15'),
        isPublished: true,
        summary:
          'Full panel analysis: potency, heavy metals, pesticides, mycotoxins, residual solvents and microbials. All analytes within specification.',
      },
    })

    // A full panel — not just potency. Buyers are told to check all of these.
    const panels: Array<[string, string, string, string, boolean]> = [
      ['HEAVY_METALS', 'Lead', '< 0.05', 'ppm', true],
      ['HEAVY_METALS', 'Arsenic', '< 0.05', 'ppm', true],
      ['HEAVY_METALS', 'Cadmium', '< 0.02', 'ppm', true],
      ['HEAVY_METALS', 'Mercury', '< 0.01', 'ppm', true],
      ['PESTICIDES', 'Full panel (66 analytes)', 'Not detected', '', true],
      ['MYCOTOXINS', 'Aflatoxin B1/B2/G1/G2', 'Not detected', 'ppb', true],
      ['MYCOTOXINS', 'Ochratoxin A', 'Not detected', 'ppb', true],
      ['SOLVENTS', 'Residual solvents panel', 'Not detected', 'ppm', true],
      ['MICROBIALS', 'E. coli / Salmonella', 'Not detected', '', true],
    ]
    let sortOrder = 0
    for (const [panel, analyte, value, unit, passed] of panels) {
      await db.labResult.create({
        data: { batchId: batch.id, panel, analyte, value, unit, passed, sortOrder: sortOrder++ },
      })
    }

    // Link each batch to the products of its line.
    const prefix = b.line === 'mhrb' ? 'mhrb-' : b.line === 'amanita' ? 'amanita-' : 'disposable-vape-'
    const products = await db.product.findMany({ where: { slug: { startsWith: prefix } } })
    for (const p of products) {
      await db.productBatch.upsert({
        where: { productId_batchId: { productId: p.id, batchId: batch.id } },
        update: {},
        create: { productId: p.id, batchId: batch.id },
      })
    }
  }
  console.log(`  ✓ ${batches.length} lab batches with full panels`)
}

async function seedLocations() {
  // NAP must match the Google Business Profile byte-for-byte. Replace with real data.
  const locations = [
    {
      slug: 'austin-tx',
      name: `${BRAND.name} Austin`,
      addressLine1: '000 Placeholder St',
      city: 'Austin',
      stateCode: 'TX',
      postalCode: '78701',
      phone: '+1-000-000-0000',
      latitude: 30.2672,
      longitude: -97.7431,
      offersSameDay: true,
      sameDayZips: ['78701', '78702', '78703', '78704', '78705'],
      sameDayCutoff: '14:00',
      isPublished: false, // stays unpublished until the address is real and GBP is claimed
    },
  ]
  for (const l of locations) {
    await db.location.upsert({ where: { slug: l.slug }, update: {}, create: l })
  }
  console.log(`  ✓ ${locations.length} location(s) (unpublished — awaiting real NAP)`)
}

async function seedContent() {
  const author = await db.author.upsert({
    where: { slug: 'editorial-team' },
    update: {},
    create: {
      slug: 'editorial-team',
      name: `${BRAND.name} Editorial Team`,
      title: 'Compliance and Product Research',
      bio: 'We publish what we can verify, cite the statutes we rely on, and date every review.',
    },
  })

  // Answer-first summaries — the AI extraction target. Every one is lexicon-clean.
  const posts = [
    ['what-is-mimosa-hostilis-root-bark', 'What Is Mimosa Hostilis Root Bark?', 'Mimosa Hostilis root bark is the outer bark of the Mimosa tenuiflora tree, native to northeastern Brazil and Mexico. It is sold as a raw botanical material, valued by natural dyers for the deep purple it produces on wool, silk and leather, and by soap makers for its high tannin content.', 'guides'],
    ['natural-dyeing-with-mimosa-hostilis', 'Natural Dyeing With Mimosa Hostilis: A Practical Guide', 'Mimosa Hostilis root bark produces purple to maroon shades on protein fibres such as wool and silk. Colour depth depends on fibre type, mordant choice, bath temperature and time. This guide covers ratios, bath preparation and how to get repeatable results.', 'guides'],
    ['how-to-read-a-certificate-of-analysis', 'How to Read a Certificate of Analysis (COA)', 'A certificate of analysis is a third-party laboratory report showing what a specific batch actually contains. Check four things: the laboratory name and accreditation, the batch code matching your package, the date of testing, and whether the panel covers heavy metals, pesticides, mycotoxins and solvents rather than potency alone.', 'guides'],
    ['amanita-muscaria-vs-psilocybin-mushrooms', 'Amanita Muscaria and Psilocybin Mushrooms Are Not the Same Thing', 'Amanita muscaria contains muscimol and ibotenic acid. It does not contain psilocybin. This matters legally: psilocybin is a Schedule I controlled substance under federal law, while Amanita muscaria is unscheduled and is lawfully sold in 49 states.', 'education'],
    ['is-amanita-muscaria-legal-in-the-united-states', 'Is Amanita Muscaria Legal in the United States?', 'Amanita muscaria is not scheduled under the federal Controlled Substances Act and is lawful in 49 states. Louisiana is the sole exception. Several states are drafting regulation that would add age verification and testing requirements.', 'legality'],
    ['what-is-muscimol', 'What Is Muscimol?', 'Muscimol is the primary compound found in Amanita muscaria. It is not listed under the federal Controlled Substances Act, which is why Amanita muscaria products are lawfully sold in most of the United States.', 'education'],
    ['shipping-restrictions-explained', 'Why Some Products Cannot Ship to Your State', 'Availability differs by product line because the law differs by product line. Botanical materials ship to all 50 states. Amanita products ship to 49. Vapor products are governed by the federal PACT Act and are limited to a smaller set of states.', 'shipping'],
    ['what-the-pact-act-means-for-buyers', 'What the PACT Act Means When You Order Vapor Products', 'The PACT Act is a federal law governing how vapor products are sold and shipped. In practice it means three things for you: a smaller list of states we can deliver to, verification of your age at checkout, and an adult signature with photo ID at your door.', 'shipping'],
    ['how-our-payment-process-works', 'How Our Payment Process Works', 'We never take payment on this website. You place an order and choose a preferred method, we verify the order and contact you with instructions, and your order ships once payment is received. No card details are entered on our site, so there is nothing here to steal.', 'ordering'],
    ['how-we-batch-test-every-product', 'How We Batch Test Every Product', 'Every batch is sent to an accredited third-party laboratory before it is offered for sale. We publish the full panel against the batch code printed on your package, so you can match what you received to the exact report for it.', 'quality'],
  ] as const

  for (const [slug, title, summary, category] of posts) {
    await db.post.upsert({
      where: { slug },
      update: {},
      create: {
        slug,
        title,
        summary,
        body: `${summary}\n\n_Full article body to be authored in Step 16._`,
        category,
        authorId: author.id,
        isPublished: false,
      },
    })
  }
  console.log(`  ✓ ${posts.length} posts (drafts)`)
}

async function main() {
  console.log(`\nSeeding ${BRAND.name}…\n`)
  await seedStateRules()
  await seedCatalog()
  await seedLabBatches()
  await seedLocations()
  await seedContent()
  console.log('\n✓ Seed complete.\n')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => db.$disconnect())
