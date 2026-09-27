import type { Category, LabBatch, PriceTier, Product } from './types'

/**
 * ─────────────────────────────────────────────────────────────────────────────
 *  THE CATALOGUE — single source of truth.
 *
 *  Consumed by both the in-memory repository (which serves the app until the
 *  database is provisioned) and prisma/seed.ts. One definition, so the seeded
 *  database and the running app can never disagree about what we sell.
 *
 *  EVERY string here passes the banned-terms lexicon. This file doubles as the
 *  reference for house voice: describe what a thing IS and what it is FOR, never
 *  what it supposedly DOES to a person. Copywriters get a correct example rather
 *  than a style guide to interpret.
 * ─────────────────────────────────────────────────────────────────────────────
 */

export const CATEGORIES: readonly Category[] = [
  {
    slug: 'mimosa-hostilis',
    name: 'Mimosa Hostilis Root Bark',
    navLabel: 'Mimosa',
    productLine: 'MIMOSA_HOSTILIS',
    intro:
      'Raw botanical material for dyeing, soap and craft. Not food, and not sold for human consumption.',
    detail:
      'Milled and shredded root bark, sourced in Brazil and packed in the United States. Natural dyers value it for the deep purple it yields on protein fibres and for its unusually high tannin content. Sold for dyeing, soap and cosmetic manufacture, craft and research.',
    /*
      2026-09-18: the title ran to 68 characters and was cut in results, and the
      description fixed "ships to all 50 states" into a string. Where a line ships is
      read from state_rules at checkout; the meta says what the material is.
    */
    metaTitle: 'Mimosa Hostilis and Sassafras Root Bark for Dyeing',
    metaDesc:
      'Milled, shredded and stripped Mimosa hostilis root bark, and sassafras root bark, sold as raw material for natural dyeing, soap making and craft.',
    sortOrder: 1,
  },
  {
    slug: 'amanita',
    name: 'Amanita Muscaria',
    navLabel: 'Mushrooms',
    productLine: 'AMANITA',
    intro:
      'Naturally occurring muscimol, lab-tested by batch. For adults 21 and over.',
    detail:
      'Amanita muscaria is not a federally controlled substance. Every batch is tested by an accredited third-party laboratory for potency, heavy metals, pesticides, mycotoxins and residual solvents, and a certified copy of the result is issued to verified buyers on request, against its batch number.',
    /*
      The About band on /shop/amanita.

      Written to be QUOTED, not skimmed. Acquisition here is entirely organic and
      increasingly happens inside an answer engine rather than a results page, so the
      lede has to survive being lifted out of the page with no surrounding context,
      and each block has to reach its verdict in the first sentence.

      What is deliberately NOT here: any statement about which states we ship to, what
      the minimum age is, or when a position was reviewed. Those are read from
      `state_rules` at render time. Writing them here would put a second, frozen copy
      of the legality position on the site — which is exactly how a page ends up
      asserting something the database stopped supporting months earlier.

      Also not here: the comparison against scheduled mushrooms. `content/faq.ts`
      already answers that question on this same page, under an allow directive, and
      answering it twice on one URL is the duplication Bing names directly.
    */
    about: {
      heading: 'About Amanita muscaria',
      lede:
        'Amanita muscaria is the red-capped fly agaric mushroom. Its principal naturally occurring compounds are muscimol and ibotenic acid, neither of which appears on the federal Controlled Substances Act schedules. That absence is the entire legal basis on which these products are sold in the United States.',
      blocks: [
        {
          question: 'What is muscimol?',
          answer:
            'Muscimol is the principal compound in Amanita muscaria, occurring naturally alongside ibotenic acid. Neither is listed on the federal schedules, and a compound that is not scheduled federally is not federally controlled. Federal silence is not the same as federal approval, and we do not present it as one.',
          linkSlug: 'what-is-muscimol',
        },
        {
          question: 'How is each batch tested?',
          answer:
            'Every batch goes to an ISO-accredited third-party laboratory before it is offered for sale, and the full panel is filed against the batch code printed on your package; verified buyers can ask us for a certified copy. The panel covers potency plus heavy metals, pesticides, mycotoxins, residual solvents and microbials — the contaminant work that is most often left out.',
          linkSlug: 'how-we-batch-test-every-product',
        },
        {
          question: 'Is it available where I live?',
          answer:
            'State positions live in one table that this page, the per-state pages and your cart all read from. None of them is written by hand, so what you read here and what happens at checkout cannot drift apart, and every position carries the date a person last reviewed it.',
          linkSlug: 'is-amanita-muscaria-legal-in-the-united-states',
        },
      ],
      facts: [
        { label: 'Common name', value: 'Fly agaric' },
        { label: 'Botanical name', value: 'Amanita muscaria' },
        { label: 'Principal compounds', value: 'Muscimol, ibotenic acid' },
        { label: 'Federal status', value: 'Not scheduled under the Controlled Substances Act' },
        { label: 'Lab testing', value: 'Every batch, ISO-accredited third-party laboratory' },
        {
          label: 'Panel covered',
          value: 'Potency, heavy metals, pesticides, mycotoxins, residual solvents, microbials',
        },
        { label: 'Certificate', value: 'Issued to verified buyers on request, by batch code' },
      ],
    },
    metaTitle: 'Amanita Muscaria Products, Third Party Lab Tested and State Verified',
    metaDesc:
      'Amanita muscaria products, third-party tested by batch, with certificates issued to verified buyers on request. Check state availability instantly. 21+ only.',
    sortOrder: 2,
  },
  /*
    DISPOSABLES LEAD (owner, 2026-09-15): "we are a distributor of disposable
    products". The category the business is built around, so it is written the
    fullest: an about band that answers the questions a buyer and an answer engine
    actually ask.

    Owner's instructions on wording, same day: no copy about adult signatures or
    photo ID at the door, and no "restricted in some states" warnings. Plain "21+"
    stays. Neither instruction changes what the cart and the carrier do — delivery
    channels and state rules are still read from the data at checkout (CLAUDE.md
    rules 1 and 2) — and nothing here claims the opposite, either: no promise of
    delivery to every state is written anywhere in this entry.

    Testing is described as "lab-tested by batch", with certificates issued to
    verified buyers on request. It does not say "third-party": the owner describes
    the disposables' testing as second-party, and the site says only what is true.
  */
  {
    slug: 'disposable-vapes',
    name: 'Disposable Vapes',
    navLabel: 'Disposables',
    productLine: 'VAPE',
    intro:
      'Disposable vapes, distributed direct: nicotine and hemp-derived cannabinoid disposables, lab-tested by batch and sold by the unit. For adults 21 and over.',
    detail:
      'Disposables are what SnypeGate is built around. We distribute ready-to-use disposable vapor products — nicotine disposables, and hemp-derived cannabinoid disposables including THCA and THC — to adult customers and to retailers across the United States. Every product is priced per unit, so you order exactly how many you want, and every batch is lab-tested before it is offered. Retailers and bulk buyers get volume pricing through our bulk team.',
    about: {
      heading: 'About our disposables',
      lede:
        'A disposable vape is a sealed, pre-filled vapor device that is ready to use as it arrives: no refilling and no coils to change. SnypeGate is a US distributor of disposables, supplying adult customers and retailers with nicotine and hemp-derived cannabinoid disposables, lab-tested by batch and sold by the unit.',
      blocks: [
        {
          question: 'What kinds of disposables do you distribute?',
          answer:
            'Two families: nicotine disposables, and hemp-derived cannabinoid disposables, including THCA and THC. Each product page states exactly what that device contains, its flavour and its size, so the contents are always on the page you order from rather than implied by the category.',
        },
        {
          question: 'Are your disposables lab-tested?',
          answer:
            'Yes. Every batch is tested before it is offered for sale, and results are kept against the batch code on the package. Verified buyers and licensed retailers can ask us for a certified copy of the report for the batch they received, through the contact page.',
          linkSlug: 'how-to-read-a-certificate-of-analysis',
        },
        {
          question: 'How are disposables shipped?',
          answer:
            'Through a carrier that complies with the federal PACT Act, which governs how every vapor product is sent to a customer at a distance. The postal service does not carry vapor products at all, so disposables always travel separately from anything else in your order, with their own tracking.',
          linkSlug: 'what-the-pact-act-means-for-buyers',
        },
        {
          question: 'Do you supply retailers and bulk buyers?',
          answer:
            'Yes. As a distributor we sell disposables in volume as well as by the unit. Retailers, vape shops and resellers can request wholesale pricing from the bulk page, and a person replies with pricing for the quantities you need.',
        },
        {
          question: 'How is the price worked out?',
          answer:
            'Per unit. Each disposable has one price, and your total is that price times the number you order, so there are no pack sizes to compare. Disposables travel on their own carrier, and the delivery charge for that shipment is shown in your cart before you order.',
          linkSlug: 'how-ordering-and-payment-works',
        },
      ],
      facts: [
        { label: 'What we are', value: 'US distributor of disposable vapor products' },
        { label: 'Families', value: 'Nicotine disposables; hemp-derived cannabinoid disposables (THCA, THC)' },
        { label: 'Format', value: 'Sealed, pre-filled, ready to use' },
        { label: 'Sold as', value: 'Single units; volume pricing for retailers' },
        { label: 'Lab testing', value: 'By batch, before sale' },
        { label: 'Certificate', value: 'Issued to verified buyers on request, by batch code' },
        { label: 'Carrier', value: 'PACT Act compliant carrier' },
      ],
    },
    /*
      2026-09-18: the title ran to 67 characters and the description to 172, so both
      were cut in results — the description at "with wholesale pricing for." Rewritten
      to what the listings show: no nicotine product is listed, and the hemp basis
      waits on the laboratory figures, so neither is asserted in the search snippet.
    */
    metaTitle: 'Disposable Vapes and 510 Cartridges, Sold by the Unit',
    metaDesc:
      'All-in-one disposables and 510 cartridges from Muha Meds, Ghost, Boutiq and more, sold by the unit to adults 21 and over, with wholesale pricing for retailers.',
    /* First: the category the business leads with. */
    sortOrder: 0,
  },
  /*
    Others (owner, 2026-09-15): products that are not Mimosa, Amanita or a
    disposable, sold and shipped under the disposables' rules — by the unit, 21+,
    PACT Act carrier. The owner chose those rules for the whole category. Nothing
    below says what an item is, because the category does not decide that: each
    product page does.
  */
  {
    slug: 'others',
    name: 'Others',
    navLabel: 'Others',
    productLine: 'VAPE',
    intro: 'More from our range, sold by the unit. For adults 21 and over.',
    detail:
      'Everything in this category ships the way our disposables do, via a carrier that complies with the federal PACT Act. Each item is priced per unit, and the total is that price times how many you order.',
    metaTitle: 'Other Products, Sold by the Unit, 21 and Over',
    metaDesc:
      'More from the SnypeGate range, priced per unit and shipped via a PACT Act compliant carrier. For adults 21 and over.',
    sortOrder: 4,
  },
]

export const DIRECTORY_STATES = ['FL', 'NC', 'TN', 'VA', 'WI'] as const

/**
 * Bulk discounts are gone (owner, 2026-09-14): every size has one fixed price.
 * Kept as an empty list so a product's tiers are always a list.
 */
export const BULK_TIERS: readonly PriceTier[] = []

/**
 * ─────────────────────────────────────────────────────────────────────────────
 *  NOTHING IS WRITTEN HERE ANY MORE (owner, 2026-09-15).
 *
 *  This file used to carry eight sample products — milled root bark, Amanita caps
 *  and powder, four disposables — with placeholder photographs and five invented
 *  laboratory batches, so the storefront could be built and measured before there
 *  was anything real to sell. The owner now posts every product from the admin
 *  panel, so the samples were deleted rather than left to sit alongside the real
 *  catalogue pretending to be part of it.
 *
 *  Both lists stay, empty and typed, because the shape is the contract: the
 *  in-memory repository, the merge with the database, the seed and the tests all
 *  read them, and an empty catalogue is a valid catalogue. Add a product HERE only
 *  for something that must exist in every deployment before a database does.
 *
 *  The categories above are still authored, because a category decides compliance —
 *  which states, which carrier, what age — and that is not a thing to type into a
 *  form. A product is posted into one of them.
 * ─────────────────────────────────────────────────────────────────────────────
 */
export const PRODUCTS: readonly Product[] = []

/**
 * Laboratory batches, published against the batch code on a package.
 *
 * Empty: the five that were here were sample data, invented alongside the sample
 * products, and a fabricated certificate of analysis on a regulated storefront is
 * a misrepresentation rather than a placeholder. Certificates now go to verified
 * buyers on request (see /lab-results). A real report, uploaded as a real PDF with
 * the batch code from the package, is what belongs in this list.
 */
export const LAB_BATCHES: readonly LabBatch[] = []
