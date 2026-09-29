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
    navLabel: 'Root bark',
    productLine: 'MIMOSA_HOSTILIS',
    intro:
      'Mimosa hostilis root bark in powder, shredded and whole cuts, plus sassafras root bark, sold by the pound for natural dyeing, soap color and craft. Not for human consumption.',
    detail:
      'Root bark sold by weight as raw material for natural dyers, soap makers and leather workers, shipped from California to US addresses.',
    /*
      Rewritten 2026-09-28 around what buyers type: "mimosa hostilis root bark for
      sale", "powder vs shredded", "how much per pound of wool", "what colors". Each
      answer leads with its verdict so it can be quoted on its own. No sourcing or
      testing claims: the owner has not supplied either for this line.
    */
    about: {
      heading: 'Buying Mimosa hostilis root bark for dyeing',
      lede:
        'Mimosa hostilis root bark is the tannin-rich root bark of Mimosa tenuiflora, a legume tree of northeastern Brazil and southern Mexico also sold as jurema preta. Natural dyers use it for rose, plum, burgundy and brown on wool and silk, and grey to charcoal with iron. It is sold here by the pound for dyeing and craft, not for human consumption.',
      blocks: [
        {
          question: 'Which cut should I buy: powder, shredded or whole?',
          answer:
            'Buy shredded for everyday dyeing: it strains cleanly and gives second and third baths. Buy powder for test skeins, small batches and soap, because it releases color fastest. Buy whole chips and strips to stock up, because they keep longest and can be broken or milled when needed.',
          linkSlug: 'the-three-cuts-of-mimosa-root-bark',
        },
        {
          question: 'How much root bark do I need for a pound of wool?',
          answer:
            'Plan on 50 to 75 percent of the dry fiber weight for a mid shade, which is 8 to 12 ounces of bark per pound of wool, and 25 to 40 percent for a pale tint. Deep plum takes up to an equal weight of bark and fiber. A quarter pound is enough to learn on with test skeins.',
          linkSlug: 'weighing-bark-against-fibre',
        },
        {
          question: 'What colors does Mimosa hostilis give?',
          answer:
            'On wool and silk it gives dusky rose, plum, red-brown and burgundy, deepening with more bark and a longer simmer. An iron afterbath turns the same bath slate grey to charcoal. Keep the pot neutral to slightly acidic to hold the purple tones; alkaline water pulls it toward brown.',
          linkSlug: 'keeping-a-bark-bath-purple',
        },
        {
          question: 'Do I need a mordant?',
          answer:
            'Not for most wool and silk: the bark is rich in tannins, which help the color bind to protein fiber. Alum brightens the pinks and helps the color hold in daylight. Cotton and linen need a tannin-then-alum mordant to reach good depth, because plant fibers carry no protein.',
          linkSlug: 'mordanting-wool-before-a-bark-bath',
        },
        {
          question: 'How is an order placed and shipped?',
          answer:
            'Choose a cut and a size, from a quarter pound to a full pound, and place your order. A person confirms it and sends payment details in your order chat, then the bark ships from California with tracking. We ship to US addresses only, and parcel orders from 100 dollars ship free.',
        },
      ],
      facts: [
        { label: 'Botanical name', value: 'Mimosa tenuiflora (syn. Mimosa hostilis)' },
        { label: 'Also sold as', value: 'MHRB, jurema preta, mimosa tenuiflora bark' },
        { label: 'Cuts', value: 'Powder, shredded, whole chips and strips' },
        { label: 'Also in this range', value: 'Sassafras root bark (Sassafras albidum)' },
        { label: 'Sold by', value: 'The pound: 1/4, 1/3, 1/2 and 1 lb; bulk on request' },
        { label: 'Ships from', value: 'California, to US addresses only' },
        { label: 'Use', value: 'Natural dyeing, soap color, leather work, craft; not for human consumption' },
      ],
    },
    metaTitle: 'Buy Mimosa Hostilis Root Bark, Powder, Shredded or Whole',
    metaDesc:
      'Mimosa hostilis root bark for natural dyeing and soap, by the pound in powder, shredded and whole cuts, plus sassafras root bark. Ships from California.',
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
      'Disposables are what MIMOSALSD is built around. We distribute ready-to-use disposable vapor products — nicotine disposables, and hemp-derived cannabinoid disposables including THCA and THC — to adult customers and to retailers across the United States. Every product is priced per unit, so you order exactly how many you want, and every batch is lab-tested before it is offered. Retailers and bulk buyers get volume pricing through our bulk team.',
    about: {
      heading: 'About our disposables',
      lede:
        'A disposable vape is a sealed, pre-filled vapor device that is ready to use as it arrives: no refilling and no coils to change. MIMOSALSD is a US distributor of disposables, supplying adult customers and retailers with nicotine and hemp-derived cannabinoid disposables, lab-tested by batch and sold by the unit.',
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
      'More from the MIMOSALSD range, priced per unit and shipped via a PACT Act compliant carrier. For adults 21 and over.',
    sortOrder: 4,
  },
]

/**
 * The categories the header and footer link to (owner instruction, 2026-09-28).
 *
 * Every listing in the other three was hidden that day, so their pages are empty and
 * noindex. A menu link to an empty page is a dead end for a visitor and wasted crawl
 * for a search engine. Put a slug back here when its category has live products again.
 */
export const NAV_CATEGORY_SLUGS: readonly string[] = ['mimosa-hostilis']

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
