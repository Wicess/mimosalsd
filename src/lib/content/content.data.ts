/**
 * compliance-allow: psilocybin -- the Amanita guide's whole job is to state that
 * Amanita muscaria does NOT contain psilocybin. Searchers and answer engines conflate
 * the two constantly, and correcting that requires naming it. The rule exists to stop
 * us implying equivalence; this content explicitly denies it.
 */
/**
 * Editorial content.
 *
 * The brief: blogs are informative content that ALSO recommends our products. Every
 * post has to earn its ranking on information and convert through contextual
 * recommendation — never through hype, and never through a health claim.
 *
 * Every post opens with an `summary` of 40–60 words. That block is the single
 * highest-leverage AEO technique available: an answer engine should be able to lift
 * it and answer the question correctly without reading further.
 *
 * Pillar guides exist because LLMs preferentially cite long-form comprehensive
 * content. Cluster posts link UP to their pillar; pillars link DOWN to the cluster
 * and OUT to the shop. Authority flows in a loop.
 */

export interface Author {
  readonly slug: string
  readonly name: string
  readonly title: string
  readonly bio: string
}

/*
  ── WHY SO MANY OF THESE RECOMMEND NOTHING (2026-09-17) ──────────────────────

  Every entry below pointed at the sample products — mhrb-powder, mhrb-shredded,
  amanita-gummies-mixed-berry, disposable-vape-classic and the rest — which were
  deleted from this file on 2026-09-15. RecommendedProducts filters a slug it cannot
  resolve and renders null when none survive, so it failed silently: all ten live
  pieces showed no products at all, and the blog-to-revenue loop CLAUDE.md rule 13
  describes has been dead ever since, with nothing to notice it.

  They now point at the four botanical listings, which are real and current. The
  amanita and vapor pieces point at nothing on purpose: those categories are on hold
  pending the laboratory figures, and an irrelevant recommendation is worse than an
  empty block. Restore them when the category comes back.
*/
export interface Post {
  readonly slug: string
  readonly title: string
  /** Answer-first, 40–60 words. The extraction target. */
  readonly summary: string
  readonly body: readonly string[]
  readonly category: string
  readonly authorSlug: string
  readonly publishedAt: string
  readonly updatedAt: string
  /** Pillar this post links up to. */
  readonly pillarSlug?: string
  readonly recommendedProductSlugs: readonly string[]
  readonly isPublished: boolean
  /**
   * Search-result title and description, when they should differ from the title and
   * summary. Optional: the authored pieces use their title and summary, and a piece
   * written in the admin panel carries whatever its editor set. Without these fields
   * the editor's meta boxes would be saved and then silently ignored.
   */
  readonly metaTitle?: string
  readonly metaDesc?: string
  /**
   * The article's own picture in object storage, when one was uploaded from the admin
   * panel. Absent on the authored pieces, which fall back to `postImages()` — the
   * topic-matched product photograph — so an article always has a picture.
   */
  readonly heroImageKey?: string
}

export interface Guide extends Omit<Post, 'pillarSlug' | 'category'> {
  readonly clusterSlugs: readonly string[]
}

export const AUTHORS: readonly Author[] = [
  {
    slug: 'editorial-team',
    name: 'Editorial Team',
    title: 'Compliance and product research',
    bio: 'We publish what we can verify, cite the statutes we rely on, and date every review. Where we are unsure, we say so rather than guessing.',
  },
]

export const GUIDES: readonly Guide[] = [
  {
    slug: 'what-is-mimosa-hostilis-root-bark',
    title: 'What Is Mimosa Hostilis Root Bark?',
    summary:
      'Mimosa Hostilis root bark is the outer bark of the Mimosa tenuiflora tree, native to north-eastern Brazil and Mexico. It is sold as a raw botanical material, valued by natural dyers for the deep purple it produces on wool, silk and leather, and by soap makers for its high tannin content.',
    body: [
      'Mimosa tenuiflora is a fast-growing tree found across north-eastern Brazil and parts of Mexico, where it is known locally as jurema or tepezcohuite. The bark of its root is harvested, dried and either milled to a powder or cut into a coarse shred.',
      'What makes it interesting to craftspeople is tannin. The root bark carries an unusually high tannin load, which is what allows it to bond with protein fibres without an aggressive mordant, and what produces its characteristic purple-to-maroon range on wool and silk.',
      'It is sold in two cuts. Powder disperses quickly and suits shorter baths and smaller pieces. Shredded bark releases pigment more slowly, which many dyers prefer for larger work where even uptake matters more than speed.',
      'Colour depth is a function of fibre, mordant, bath temperature and time rather than of the bark alone. The same material will give a muted mauve on cotton and a deep aubergine on wool. Dyers usually keep notes per batch, because bark from different harvests varies.',
      'One point we are direct about: this is a raw botanical material. It is not food, it is not a supplement, and it is not sold for human consumption. We sell it for dyeing, soap and cosmetic manufacture, craft and botanical research, and our checkout asks buyers to confirm that intended use.',
    ],
    authorSlug: 'editorial-team',
    publishedAt: '2026-08-01',
    updatedAt: '2026-08-28',
    clusterSlugs: ['natural-dyeing-with-mimosa-hostilis', 'shipping-restrictions-explained'],
    recommendedProductSlugs: ['powdered-mimosa-hostils-root', 'mimosa-roots-stripped', 'mimosa-treee-bark'],
    isPublished: true,
  },
  {
    slug: 'how-to-read-a-certificate-of-analysis',
    title: 'How to Read a Certificate of Analysis',
    summary:
      'A certificate of analysis is a third-party laboratory report showing what a specific batch actually contains. Check four things: the laboratory and its accreditation, the batch code matching your package, the date of testing, and whether the panel covers contaminants rather than potency alone.',
    body: [
      'A certificate of analysis — a COA — is the only practical way to know what is in a product you did not make yourself. It is a report from an independent laboratory on a specific batch. That last word matters more than anything else on the page.',
      'Start with the laboratory. An ISO 17025 accreditation means the lab has been independently assessed as competent to run the tests it is reporting. It is the standard buyers are generally told to look for, and it is worth more than a logo.',
      'Then check the batch code. A COA that does not carry the same code as the package in your hand tells you nothing about the package in your hand. This is the most common way a genuine-looking report turns out to be irrelevant — it is a real report, for a different batch.',
      'Check the date. A report from two years ago for a product bought today is a warning sign about the seller, not necessarily about the product.',
      'Then read what was actually tested. Potency alone is not a safety test. A full panel covers heavy metals — lead, arsenic, cadmium and mercury — plus pesticides, mycotoxins, residual solvents and microbials. A report showing only active content is telling you the least useful part of the picture.',
      'We hold the full panel for every batch we sell, filed against the code printed on the package, and we send a certified copy to verified buyers who ask for one. If you have a package with a code we do not recognise, we would genuinely like to hear about it.',
    ],
    authorSlug: 'editorial-team',
    publishedAt: '2026-08-05',
    updatedAt: '2026-08-28',
    clusterSlugs: ['how-we-batch-test-every-product'],
    recommendedProductSlugs: ['powdered-mimosa-hostils-root', 'sassafras-root-bark'],
    isPublished: true,
  },
  {
    slug: 'amanita-muscaria-explained',
    title: 'Amanita Muscaria, Explained',
    summary:
      'Amanita muscaria is the red-and-white fly agaric mushroom. It contains muscimol and ibotenic acid, not psilocybin. That distinction is the reason it is unscheduled under federal law and lawfully sold across the United States, while psilocybin mushrooms are not.',
    body: [
      'Amanita muscaria is probably the most recognisable mushroom in the world — the red cap with white flecks that appears in illustrations far more often than it appears in conversations about what is actually in it.',
      'Its principal compounds are muscimol and ibotenic acid. Neither is listed under the federal Controlled Substances Act, and Amanita muscaria does not appear on the DEA list of drugs of concern. That is the whole legal basis on which it is sold in the United States.',
      'It is worth being precise about what it is not. It does not contain psilocybin. Psilocybin is a Schedule I controlled substance under federal law; Amanita muscaria is unscheduled. Conflating the two — which happens constantly, including in otherwise careful writing — makes a lawful product sound illegal and an illegal one sound lawful.',
      'Federal status is not the whole story. On 18 December 2024 the FDA concluded that Amanita muscaria and its constituents muscimol, ibotenic acid and muscarine do not meet the standard for being generally recognised as safe, and are unapproved food additives; it is also reviewing their use in dietary supplements. That is a finding, not a grey area. State positions are separate again, and we publish each one with the date it was last reviewed.',
      'Several states are drafting rules that would regulate it much as they regulate hemp-derived cannabinoids: age verification at 21, mandatory certificates of analysis, and packaging restrictions. We already do all three as a matter of policy, and we publish where each state stands.',
    ],
    authorSlug: 'editorial-team',
    publishedAt: '2026-08-10',
    updatedAt: '2026-09-18',
    clusterSlugs: ['what-is-muscimol', 'is-amanita-muscaria-legal-in-the-united-states'],
    recommendedProductSlugs: [],
    isPublished: true,
  },
  {
    slug: 'how-ordering-and-payment-works',
    title: 'How Ordering and Payment Works Here',
    summary:
      'We never take payment on this website. You submit an order request and choose a preferred method — Cash App, Chime, Apple Cash or Bitcoin — we check the stock is available and that we can ship to your address, then send instructions. Because no card details are entered on our site, there is nothing here for anyone to steal.',
    body: [
      'Most online shops take your card at checkout. We do not, and the reason is worth explaining because it changes what you should expect.',
      'When you check out here, you are submitting an order request rather than completing a purchase. You tell us where it is going and how you would prefer to pay. We then check two things: that we can lawfully ship every item to your address, and that we have the stock.',
      'Once that is done we send payment instructions for the method you chose. You pay off-site, tell us you have sent it, and a person on our side confirms receipt before anything is despatched.',
      'The trade-off is honest: it is slower than a card checkout. What you get in exchange is that no card data is processed or stored on our servers, so there is no card data here for anyone to steal — not in a breach, not in a leak, not ever.',
      'One clarification, because the naming causes confusion: we accept Apple Cash, which is peer-to-peer, not Apple Pay. Apple Pay is a card-network wallet that requires a payment processor, and we deliberately do not have one. Any site showing you an Apple Pay button while claiming to take no card payments is telling you two things that cannot both be true.',
      'Your Order ID is also your payment reference. Including it is what lets us match a payment to an order quickly, and leaving it off is the most common reason verification takes longer than it should.',
    ],
    authorSlug: 'editorial-team',
    publishedAt: '2026-08-15',
    updatedAt: '2026-08-28',
    clusterSlugs: ['what-the-pact-act-means-for-buyers'],
    recommendedProductSlugs: ['powdered-mimosa-hostils-root', 'mimosa-roots-stripped', 'mimosa-treee-bark'],
    isPublished: true,
  },
]

export const POSTS: readonly Post[] = [
  {
    slug: 'natural-dyeing-with-mimosa-hostilis',
    // Owner-generated, uploaded 2026-09-19. The authored post wins over its Post row, so the key lives here.
    heroImageKey: 'media/fdc5f5132e38a860951d1d9c46b3b836.jpg',
    title: 'Natural Dyeing with Mimosa Hostilis: A Practical Guide',
    summary:
      'Mimosa Hostilis root bark is a tannin-rich natural dye that gives purples, maroons and warm browns on wool and silk, and softer mauves on cotton and linen. The shade depends on the fibre, the mordant, how much bark you use, the bath temperature and the time. Powder colours quickly; shredded bark suits long, slow baths.',
    body: [
      '## Why dyers use Mimosa Hostilis root bark',
      'Mimosa hostilis — also catalogued as Mimosa tenuiflora — is a small, thorny tree native to northeastern Brazil and parts of southern Mexico. Its root bark is unusually rich in tannins, the same family of plant compounds that tanners have relied on for centuries to turn hides into leather.',
      'Those tannins are exactly what make it valuable in a dye pot. They bond readily with protein fibres and with metal mordants, which gives the colour good wash-fastness without synthetic fixatives. The palette runs from dusty rose and mauve through deep burgundy and plum, and with an iron modifier all the way to charcoal grey.',
      '## Choosing your fibre',
      'Protein fibres take this dye best. Wool, silk, alpaca and mohair will pull the deepest, richest purples and maroons, because their structure holds on to both the tannins and the mordant.',
      'Cellulose fibres — cotton, linen, hemp and viscose — can be dyed too, but they tend towards softer mauves and warm pinkish browns. They need a mordant step first to hold the colour, and they reward patience: several dips build a deeper shade than one long bath.',
      'Blends dye unevenly by nature, because each fibre takes the colour differently. That can look beautiful, but if you need an even result, dye a single fibre type.',
      '## Powder or shredded bark?',
      '- Powder has far more surface area, so it releases colour quickly and suits shorter baths. Strain it through a fine cloth before the fibre goes in, or the particles will lodge in the yarn.',
      '- Shredded bark releases colour more slowly, is easy to lift out of the pot, and can be reused for a second or third, lighter bath. It suits long, low-temperature dyeing and larger pieces.',
      'Many dyers keep both: powder for quick samples and small skeins, shredded bark for whole garments and repeat work.',
      '## Preparing the fibre',
      'Start by weighing the fibre dry. Every quantity in natural dyeing is worked out as a percentage of the weight of fibre, usually written WOF, so this number matters more than any other.',
      'Next, scour the fibre: wash it gently in hot water with a pH-neutral detergent to remove spinning oils, dirt and sizing. Colour cannot bond to fibre it cannot reach, and patchy results are most often a scouring problem rather than a dye problem.',
      'Then mordant it. For wool and silk, aluminium potassium sulfate (alum) at around 10 to 15 per cent WOF is the common starting point; some dyers add cream of tartar to keep wool soft. For cotton and linen, aluminium acetate at around 5 to 8 per cent WOF is widely used. Rinse after mordanting, and keep the fibre damp until it goes into the dye.',
      '## Making the dye bath',
      'A practical starting ratio is 50 to 100 grams of bark for every 100 grams of dry fibre. More bark deepens the shade up to a point, past which you are mostly wasting material.',
      'Soak the bark in water overnight; this gives the colour a head start. Then warm the pot slowly and hold it hot but well below a boil — around 80°C (175°F) is a good target — for about an hour. Strain out the bark, or lift out the shredded pieces, and let the bath cool a little before adding the wet fibre.',
      'Bring the bath back up to temperature gently and hold it for 45 minutes to an hour, moving the fibre now and then so the colour takes evenly. For deeper shades, turn off the heat and leave the fibre to cool in the bath overnight.',
      'Do not boil it. High heat pushes the purples towards dull brown, and once a skein has browned it is very difficult to bring back.',
      '## Shifting the shade with modifiers',
      '- An iron after-bath — a small amount of ferrous sulfate, often around 1 to 2 per cent WOF, dissolved in warm water — darkens the colour towards plum, slate and charcoal. Dyers call this saddening. Use it sparingly; too much iron can make wool feel harsh.',
      '- A mildly alkaline rinse tends to push the shade warmer and redder.',
      '- A mildly acidic rinse, such as a little white vinegar or citric acid in water, tends to lighten and cool it.',
      'Bark from different lots behaves differently, so always test a small swatch before modifying a whole piece.',
      '## Rinsing, drying and caring for the finished piece',
      'Let the fibre cool completely before rinsing, then rinse in water of a similar temperature until it runs clear. Wash once with a pH-neutral detergent, rinse again, and dry in the shade. Like most natural dyes, these colours soften with long exposure to direct sunlight, so store and dry finished pieces out of strong sun and wash them cool.',
      '## Soap, craft and other uses',
      'The powder is also a popular natural colourant for cold-process soap, where it gives tones from warm brown to deep plum. The high pH of fresh soap batter can shift the shade, so make a small test batch before a full one. Crafters also use the bark for colouring paper, basketry and leather.',
      '## Working safely',
      '- Wear gloves, and a dust mask when handling powder.',
      '- Keep dedicated pots, spoons and buckets for dyeing, and never use them for food afterwards.',
      '- Work in a well-ventilated space, especially when using mordants and modifiers.',
      '- Spent bark can go on the compost heap; dispose of used mordant and iron baths according to your local guidance.',
      '## Keep a dye journal',
      'Write down the fibre and its weight, the mordant and its percentage, the amount and form of bark, the temperatures, the times and the batch code printed on the bag. Bark from different harvests varies, and the only reliable way to reproduce a shade you love is to know exactly what you did last time.',
    ],
    category: 'dyeing',
    authorSlug: 'editorial-team',
    publishedAt: '2026-08-02',
    updatedAt: '2026-09-13',
    pillarSlug: 'what-is-mimosa-hostilis-root-bark',
    recommendedProductSlugs: ['powdered-mimosa-hostils-root', 'mimosa-roots-stripped', 'mimosa-treee-bark'],
    isPublished: true,
  },
  {
    slug: 'what-is-muscimol',
    heroImageKey: 'media/c9a8c0ec9cd1c7cdf159291e4566e224.jpg',
    title: 'What Is Muscimol?',
    summary:
      'Muscimol is a naturally occurring compound found in the Amanita muscaria mushroom, alongside ibotenic acid. Neither compound is listed under the federal Controlled Substances Act, which is why Amanita muscaria products can be sold lawfully across most of the United States. Being unscheduled is not the same as being approved, and state law is a separate question.',
    body: [
      '## Where muscimol comes from',
      'Muscimol is one of the two compounds most closely associated with Amanita muscaria, the red-capped, white-spotted mushroom often called the fly agaric. The species grows across the temperate and boreal forests of the northern hemisphere, usually in partnership with birch, pine and spruce trees.',
      'The other compound is ibotenic acid. Both belong to a group of chemicals called isoxazoles, and both occur naturally in the mushroom in amounts that vary with the specimen, where it grew and how it was handled afterwards.',
      '## Muscimol and ibotenic acid are related',
      'The two compounds are closely linked. Ibotenic acid can convert into muscimol by losing a molecule of carbon dioxide, a reaction chemists call decarboxylation, and that change is associated with drying and heat.',
      'That is one reason the balance between the two differs from one batch of Amanita material to the next, and it is why any laboratory figure for these compounds belongs to a specific batch rather than to a product in general.',
      '## A different mushroom from the ones that are federally scheduled',
      'Amanita muscaria is often confused with the mushrooms whose active compounds appear on the federal schedules. It is a completely different organism, with different compounds, and it sits under different law. Confusing the two causes real problems: it misleads buyers, and it invites exactly the kind of regulatory attention a lawful product does not deserve.',
      '## Is muscimol a controlled substance?',
      'No. The federal Controlled Substances Act sorts regulated drugs into five schedules, and neither muscimol, ibotenic acid nor Amanita muscaria appears on any of them. A substance that is not scheduled is not federally controlled, and products containing it are not automatically unlawful.',
      'That absence does most of the legal work, and it is the reason Amanita muscaria products can be sold in most of the country.',
      '## Where does the FDA stand on muscimol?',
      'No, and nothing on this site should be read as suggesting otherwise. Federal silence under the Controlled Substances Act is not the same thing as approval. In December 2024 the U.S. Food and Drug Administration stated that Amanita muscaria and its constituents are not authorised for use in conventional food.',
      'In practice that means these products have not been evaluated by the FDA, that no seller may lawfully make health or medical claims about them, and that every product and content page here carries the FDA disclaimer.',
      '## State law is a separate question',
      'States can, and do, go further than federal law. Louisiana, for example, has restricted Amanita muscaria under a state law passed in 2005, and other states have looked at age limits, labelling and testing rules.',
      'Because state positions move, we do not freeze them into an article. Each state has its own legality page with the current position, the law it relies on and the date it was last reviewed, and our cart reads the same record when it checks your delivery address.',
      '## What to look for before you buy',
      '- A batch code on the package that the seller can match to a laboratory report on request.',
      '- The laboratory’s name, its accreditation and the date of the test.',
      '- Contaminant panels: heavy metals, pesticides, mycotoxins, residual solvents and microbials.',
      '- A seller that makes no health claims and restricts sales to adults aged 21 and over.',
      'If any of those are missing, ask the seller for them. A reputable one will already have them published.',
      '## Frequently asked questions',
      'Is muscimol the same as ibotenic acid? No. They are separate compounds that occur together in Amanita muscaria, and ibotenic acid can convert into muscimol.',
      'Is Amanita muscaria legal everywhere in the United States? It is not federally scheduled, but state law varies. Check the legality page for your state before ordering.',
      'Can I buy Amanita products if I am under 21? No. We sell only to adults aged 21 and over, whatever a state’s own minimum is.',
      '## Sources',
      '- [21 CFR 1308.11, Schedule I](https://www.ecfr.gov/current/title-21/chapter-II/part-1308/section-1308.11), Electronic Code of Federal Regulations. The federal Schedule I list, on which neither muscimol, ibotenic acid nor Amanita muscaria appears.\n- [FDA alerts industry and consumers about the use of Amanita muscaria or its constituents in food](https://www.fda.gov/food/hfp-constituent-updates/fda-alerts-industry-and-consumers-about-use-amanita-muscaria-or-its-constituents-food), US Food and Drug Administration, 18 December 2024.',
    ],
    category: 'education',
    authorSlug: 'editorial-team',
    publishedAt: '2026-08-11',
    updatedAt: '2026-09-18',
    pillarSlug: 'amanita-muscaria-explained',
    recommendedProductSlugs: [],
    isPublished: true,
  },
  {
    slug: 'is-amanita-muscaria-legal-in-the-united-states',
    heroImageKey: 'media/adf9d10b529268b843d99801c0630f37.jpg',
    title: 'Is Amanita Muscaria Legal in the United States?',
    summary:
      'At the federal level, yes: Amanita muscaria is not scheduled under the Controlled Substances Act, and neither are muscimol or ibotenic acid. But federal law is only one layer. The FDA does not authorise Amanita muscaria in conventional food, and state law varies and changes, so the answer for your state is on its own page, with the date it was last reviewed.',
    body: [
      '## The short answer',
      'Amanita muscaria is legal to buy and sell under federal law, and it is sold lawfully across most of the United States. Whether it is legal where you live depends on your state, and state positions are the part that changes.',
      '## Federal law: the Controlled Substances Act',
      'The Controlled Substances Act is the federal law that decides which drugs are controlled. It places them into five schedules, enforced by the Drug Enforcement Administration.',
      'Amanita muscaria is not on any schedule, and neither are its two best-known compounds, muscimol and ibotenic acid. A substance that is not scheduled is not federally controlled, so possessing, buying or selling Amanita muscaria is not a federal drug offence.',
      '## Federal law: the FDA',
      'Being unscheduled does not mean being approved. The U.S. Food and Drug Administration regulates food and dietary supplements, and in December 2024 it stated that Amanita muscaria and its constituents are not authorised for use in conventional food.',
      'For a buyer, that has three practical consequences. These products have not been evaluated by the FDA. No seller may lawfully claim they help with any health condition. And the labelling and marketing around them should be conservative — which is why every product and content page here carries the FDA disclaimer and why our copy is checked for health claims before it can be published.',
      '## State law: where the answer varies',
      'States can regulate substances that federal law leaves alone, and some have done so for Amanita muscaria. Louisiana is the longest-standing example: a state law passed in 2005 restricts it along with a list of other plants.',
      'Other states have considered or adopted different approaches: minimum ages, testing and labelling requirements, or rules that regulate Amanita products much like other regulated botanicals. Because these positions change, the only reliable answer is a current one.',
      '## How we keep the state-by-state answer current',
      'We do not publish a list of states in an article, because an article is written once and rarely re-read. Instead, every state’s position lives in a single record that is versioned, cites the law it relies on, and carries the date a person last reviewed it.',
      'Our per-state legality pages publish that record, and our cart reads the very same one. What you read on the legality page and what happens at checkout therefore cannot disagree.',
      '## Age limits',
      'We sell Amanita muscaria products only to adults aged 21 and over, regardless of any lower state minimum. Age is checked in layers: a date-of-birth check before browsing, an attestation at checkout stored with your order, and identity verification before an order is released.',
      '## It is the delivery address that counts',
      'When we decide whether we can ship to you, we check the delivery address, not where you are browsing from or where you live. If you are sending a gift to another state, or ordering while travelling, the law of the state the package is going to is the one that applies.',
      '## If the law changes after you order',
      'Occasionally a state’s position changes between the moment an order is placed and the moment it ships. If that happens, we cancel the affected item, tell you why and cite the rule we are relying on. If you have already paid, that item is refunded in full, including its share of shipping.',
      '## Frequently asked questions',
      'Is Amanita muscaria a controlled substance? Not under federal law. It does not appear on any schedule of the Controlled Substances Act.',
      'Is it the same as the mushrooms that are federally scheduled? No. Amanita muscaria is a different species with different compounds, and it is regulated in a completely different way.',
      'Does legal mean it has been approved as safe? No. Unscheduled means not federally controlled. The FDA has not evaluated these products, and in December 2024 it said Amanita muscaria is not authorised for use in conventional food.',
      'How do I check my state? Open the legality page for your state. It shows the current position, the law behind it and the date it was last reviewed.',
      '## Sources',
      '- [21 CFR 1308.11, Schedule I](https://www.ecfr.gov/current/title-21/chapter-II/part-1308/section-1308.11), Electronic Code of Federal Regulations. The federal Schedule I list, on which neither muscimol, ibotenic acid nor Amanita muscaria appears.\n- [FDA alerts industry and consumers about the use of Amanita muscaria or its constituents in food](https://www.fda.gov/food/hfp-constituent-updates/fda-alerts-industry-and-consumers-about-use-amanita-muscaria-or-its-constituents-food), US Food and Drug Administration, 18 December 2024.',
    ],
    category: 'legality',
    authorSlug: 'editorial-team',
    publishedAt: '2026-08-12',
    updatedAt: '2026-09-18',
    pillarSlug: 'amanita-muscaria-explained',
    recommendedProductSlugs: [],
    isPublished: true,
  },
  {
    slug: 'what-the-pact-act-means-for-buyers',
    heroImageKey: 'media/35cbd9ab032bf79551dd35cd7635b0ad.jpg',
    title: 'What the PACT Act Means When You Order Disposable Vapes',
    summary:
      'The PACT Act is the federal law that governs selling and shipping disposable vapes and other vapor products to consumers. For you it means the postal service cannot carry them, delivery goes by a specialist carrier, and disposables ship separately from anything else in your order.',
    body: [
      '## What the PACT Act is',
      'The PACT Act is a federal law passed in 2009 to regulate the remote sale of cigarettes and smokeless tobacco: sales made online, by phone or by mail, where the buyer and seller never meet. It amended an older statute known as the Jenkins Act and sits in Title 15 of the United States Code.',
      'In December 2020, Congress extended it to electronic nicotine delivery systems — which include disposable vapes and their parts — and the new rules took effect in 2021. Since then, anyone selling vapor products to consumers at a distance has had to follow the same rules as a remote cigarette seller.',
      '## What it requires of sellers',
      'Most of the PACT Act’s obligations fall on the seller rather than the buyer, but they explain almost everything you notice when you order:',
      '- Registration with the federal Bureau of Alcohol, Tobacco, Firearms and Explosives, and with the tobacco tax administrator of every state the seller ships into.',
      '- A report filed with each of those states by the 10th of every month, listing the deliveries made there the month before.',
      '- Collection of all applicable state and local taxes before a delivery is made.',
      '- Packages clearly labelled as containing tobacco products, and a weight limit of 10 pounds per package.',
      '- Verification that every buyer is of legal age.',
      '## Why the postal service cannot carry vapor products',
      'The PACT Act makes these products non-mailable through the United States Postal Service. The postal service’s rules to that effect have applied since October 2021, and the narrow exceptions that exist do not cover deliveries to consumers.',
      '## Why most private carriers decline them too',
      'UPS, FedEx and DHL have each chosen not to carry vapor products to consumers. That leaves specialist carriers set up for age-restricted deliveries. They are slower and more expensive than a standard parcel service, and there is no way to make them otherwise.',
      'The federal minimum age for buying any tobacco product, vapor products included, has been 21 since December 2019.',
      '## Why state registration matters',
      'Every state a seller ships into brings its own registration, reporting and tax obligations. Under the Act those obligations sit with the seller, not with you as the buyer.',
      'Our cart checks each disposable against your delivery address before you order.',
      '## Why vapor products ship separately, and never free',
      'Because vapor products must travel on a different carrier from everything else, an order that contains a vape and another product arrives as two separate shipments. Your cart shows this before you order, one card per shipment.',
      'It is also why vapor products are not included in free shipping. They travel on a different service at a different cost, and advertising otherwise would be a promise we could not keep.',
      '## A quick checklist before you order a disposable',
      '- You are 21 or over.',
      '- You have read what the disposable contains on its product page.',
      '- You expect a separate delivery if your order includes other products.',
      '- For shop or reseller quantities, you have asked the bulk team for volume pricing.',
      '## Sources',
      '- [Treatment of E-Cigarettes in the Mail](https://www.federalregister.gov/documents/2021/10/21/2021-22787/treatment-of-e-cigarettes-in-the-mail), United States Postal Service final rule, Federal Register, 21 October 2021.',
    ],
    category: 'ordering',
    authorSlug: 'editorial-team',
    publishedAt: '2026-08-16',
    updatedAt: '2026-09-18',
    pillarSlug: 'how-ordering-and-payment-works',
    recommendedProductSlugs: [],
    isPublished: true,
  },
  {
    slug: 'shipping-restrictions-explained',
    heroImageKey: 'media/bef52976516f9b1c94f80b4cbc1a538e.jpg',
    title: 'How We Check Where Your Order Is Going',
    summary:
      'How an order travels depends on two things: the product and the carrier that may lawfully carry it. Our cart checks every item against your delivery address before you order, so the delivery you see at checkout is the delivery you get.',
    body: [
      '## Why the delivery address matters',
      'The products we distribute are governed by different bodies of law, and they do not all travel the same way. Disposables go by a specialist carrier under the federal PACT Act; botanical materials go by ordinary parcel services.',
      'We would rather show you that up front, at checkout, than let you discover it after you have paid.',
      '## Three product lines, three sets of rules',
      'Each product line we sell sits under a different legal framework, and each framework is checked on its own.',
      '## Mimosa Hostilis root bark',
      'Mimosa Hostilis root bark is sold as a raw botanical material for natural dyeing, soap making and craft. It travels by ordinary parcel services, and it ships within the United States wherever our state rules allow.',
      '## Amanita muscaria products',
      'Amanita muscaria is not scheduled under the federal Controlled Substances Act, and neither are its compounds muscimol and ibotenic acid. It travels by ordinary parcel services.',
      '## Disposables and other vapor products',
      'Disposables are governed by the federal PACT Act. The postal service cannot carry them and the major private carriers decline them, so they travel with a specialist carrier, separately from anything else in your order.',
      '## Why we check your delivery address, not your location',
      'Websites often guess where you are from your internet connection. That guess is frequently wrong, and it is also the wrong question. What matters legally is where the package is going.',
      'So the cart checks every item against the delivery address you give at checkout. If you are ordering while travelling, or sending a gift to someone in another state, the rules for the destination state are the ones that apply.',
      '## What you will see in your cart',
      '- Each item shows how it will travel and what delivery costs.',
      '- If your order contains both a disposable and anything else, the cart shows two separate shipments, each with its own carrier.',
      '- If anything in your cart cannot go to that address, the cart says so, with the reason, before you order.',
      'You are never asked to guess.',
      '## How we keep state rules accurate',
      'Every state’s position for every product line lives in one record. It is versioned, it cites the law it relies on, and it records who reviewed it and when. Our public legality pages publish that record, and the cart reads the same one.',
      'That design is deliberate: it means the legality page and the checkout can never tell you two different things. Where we do not hold a verified legal review for a product in a state, the cart declines the sale rather than guessing.',
      '## If a rule changes after you order',
      'Laws move. Occasionally a state’s position changes between the moment you order and the moment we ship. If that happens, we cancel the affected item, tell you why and cite the rule we are relying on. If you have already paid, you are refunded in full for that item, including its share of shipping. We never quietly substitute a different product.',
      '## Where we do not ship at all',
      '- Anywhere outside the United States.',
      '- Freight forwarders and package-forwarding services.',
      '## Before you order',
      'Add what you need to your cart. It checks everything against your delivery address before you place your order, and the legality page for your state shows the law behind each position and the date it was last reviewed.',
    ],
    category: 'ordering',
    authorSlug: 'editorial-team',
    publishedAt: '2026-08-18',
    updatedAt: '2026-09-13',
    pillarSlug: 'what-is-mimosa-hostilis-root-bark',
    recommendedProductSlugs: ['powdered-mimosa-hostils-root', 'sassafras-root-bark'],
    isPublished: true,
  },
  {
    slug: 'how-we-batch-test-every-product',
    heroImageKey: 'media/ccb89aaeba80d13e22f0ea1147fd304c.jpg',
    title: 'How We Batch Test Every Product',
    summary:
      'Every batch is lab tested before it goes on sale, the botanical line by an accredited third-party laboratory, and the full report is filed against the batch code printed on your package. Verified buyers can ask for a certified copy of it. The panels cover heavy metals, pesticides, mycotoxins, residual solvents and microbials — the contaminants that matter most, and the part many sellers leave out.',
    body: [
      '## Why we test every batch, not every product',
      'A common practice in this industry is to test one sample of a product, keep that single report, and show it for every unit sold for months or years afterwards. It looks reassuring, and it tells you almost nothing: it describes a batch you did not buy.',
      'Natural materials vary from harvest to harvest and from one production run to the next. So we test per batch and file the report per batch. The report we send you is for the batch in your hands.',
      '## What a batch code is',
      'Every package carries a batch code. The letters identify the product line, the middle figure is the year, and the last figures identify the individual batch. That code is the link between the package on your table and the laboratory report for it.',
      '## Who does the testing',
      'Testing is carried out by independent third-party laboratories, not by us. The laboratory that tested your batch, and its accreditation, are named on the certificate we send you.',
      'We use accredited laboratories. In testing, accreditation normally means ISO/IEC 17025, the international standard that assesses whether a laboratory’s methods, equipment, staff and quality controls produce reliable, repeatable results. It is independent evidence that a lab is competent to run the tests it reports.',
      '## What we test for',
      'Each report covers five panels of contaminants:',
      '- Heavy metals: lead, arsenic, cadmium and mercury, which plants can take up from the soil they grow in.',
      '- Pesticides: a panel of 66 analytes, covering residues from crop protection products.',
      '- Mycotoxins: aflatoxins B1, B2, G1 and G2, and ochratoxin A — toxins produced by moulds that can grow on stored plant material.',
      '- Residual solvents: traces of solvents that can be left behind by processing.',
      '- Microbials: E. coli and Salmonella.',
      'These are the tests that speak to what is actually in a product besides the product itself, and they are the ones most often missing from a seller’s reports.',
      '## How to read the results',
      '- “Not detected” means the laboratory did not find the substance at a level its method can measure.',
      '- A result such as “< 0.05 ppm” means any amount present was below 0.05 parts per million, the lowest level the method reliably quantifies.',
      '- ppm means parts per million; ppb means parts per billion, a thousand times smaller.',
      '- Each line shows whether the batch passed the limit for that test.',
      'Every report also shows the laboratory’s name, whether it is accredited and the date the sample was tested. For more detail, our guide to reading a certificate of analysis walks through a full report line by line.',
      '## What happens to a batch that fails',
      'A batch is tested before it is offered for sale. A batch that does not pass is not offered.',
      '## Getting the report for your package',
      'Certificates are not posted publicly. A certified copy goes to verified, licensed buyers on request, one batch at a time, so a report is always released to a named buyer against a named batch rather than left open for anyone to attach to anything they like.',
      'Find the batch code on your package and ask us for the certificate covering it, through the contact page or the chat on this site. We keep the reports on file, so a package checked months after it was bought still has its report.',
      '## What testing can and cannot tell you',
      'A laboratory report tells you what was found, and not found, in one batch, for the substances the panel looks for. It cannot tell you about substances outside the panel, and it is not an approval. These products have not been evaluated by the FDA. What testing does give you is evidence you can check for yourself, rather than a promise you have to take on trust.',
    ],
    category: 'testing',
    authorSlug: 'editorial-team',
    publishedAt: '2026-08-20',
    updatedAt: '2026-09-13',
    pillarSlug: 'how-to-read-a-certificate-of-analysis',
    recommendedProductSlugs: ['powdered-mimosa-hostils-root', 'sassafras-root-bark'],
    isPublished: true,
  },
]

export function publishedPosts(): readonly Post[] {
  return POSTS.filter((p) => p.isPublished)
}

export function publishedGuides(): readonly Guide[] {
  return GUIDES.filter((g) => g.isPublished)
}

export function getPost(slug: string): Post | undefined {
  return POSTS.find((p) => p.slug === slug && p.isPublished)
}

export function getGuide(slug: string): Guide | undefined {
  return GUIDES.find((g) => g.slug === slug && g.isPublished)
}

export function getAuthor(slug: string): Author | undefined {
  return AUTHORS.find((a) => a.slug === slug)
}
