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
    name: 'Editorial desk',
    title: 'Written and checked in house',
    bio: 'Everything here is written by the people who weigh, pack and answer the phone. We publish the working numbers — ratios, temperatures, quantities — and where a figure depends on your water or your fibre we say so instead of rounding it into a promise.',
  },
]

export const GUIDES: readonly Guide[] = [
  {
    slug: 'what-is-mimosa-hostilis-root-bark',
    title: 'Mimosa Hostilis Root Bark: A Dyer\'s Handbook',
    summary:
      'Mimosa hostilis root bark is the inner bark of the root of Mimosa tenuiflora, a fast-growing tree of north-eastern Brazil and southern Mexico. Dyers buy it for one reason: it is unusually rich in tannin, and tannin on protein fibre gives purple. It is sold by the pound in three cuts.',
    body: [
      'This page is the short version of everything else in this section. If you read one thing before your first pound arrives, read this.',
      '## The tree, and which part is sold',
      'Mimosa tenuiflora — the name Mimosa hostilis is still the one the trade uses — is a small, fast-growing tree found across north-eastern Brazil and into southern Mexico, where it is known as jurema and as tepezcohuite. It regrows quickly after cutting and after fire, which is why the root bark is harvested as a by-product of land already being worked rather than from anything rare.',
      'What is sold is the inner bark of the root: stripped off, dried, and then either left in lengths, cut coarse, or milled to a powder.',
      '## Why dyers want it',
      'Tannin. The root bark carries an unusually heavy tannin load, and tannins bond readily to the protein in wool and silk. That bond is what makes the colour stay, and it is why this material gives depth on animal fibre that most plant colours cannot reach. On cotton and linen it needs more work and lands paler and browner.',
      'The colour range runs from dusty rose through aubergine to maroon, with slate and charcoal available through an iron modifier. It is not a reliable source of bright anything, and it browns if you boil it.',
      '## The three cuts',
      '| Cut | Behaves like | Suits |',
      '| --- | --- | --- |',
      '| Powder | Fast, strong, needs straining | Small batches, soap, test pots |',
      '| Shredded | Slower, easy to strain, re-baths well | Larger fibre work |',
      '| Stripped | Slowest, closest to raw | Long cold baths, leather |',
      'The cut changes the speed and the handling, not the colour. Full detail in [the three cuts of mimosa root bark](/blog/the-three-cuts-of-mimosa-root-bark) and [why particle size changes everything in a dye pot](/blog/why-particle-size-changes-everything-in-a-dye-pot).',
      '## The five numbers worth memorising',
      '- **80°C / 175°F** — the working temperature. Boiling turns purple to brown and cannot be undone.\n- **10 to 15%** — alum, as a percentage of dry fibre weight.\n- **50 to 100%** — bark, as a percentage of dry fibre weight.\n- **pH 5 to 8** — the safe range for wool and silk.\n- **1 to 2%** — iron, if you want slate rather than purple.',
      'Every percentage is of the **dry** weight of the fibre, weighed before it is wetted. That one habit prevents more disappointment than any other.',
      '## The order to learn it in',
      '1. [Mordant properly](/blog/mordanting-wool-before-a-bark-bath) — alum fully dissolved, an hour just under a simmer, cooled in the pot.\n2. [Hold the temperature down](/blog/keeping-a-bark-bath-purple) — this is the one fault that cannot be corrected.\n3. [Weigh the bark against the fibre](/blog/weighing-bark-against-fibre) and write the ratio down.\n4. [Test on a scrap first](/blog/testing-a-dye-before-you-commit-a-fleece). Every batch differs.\n5. Then start moving [pH](/blog/using-ph-to-steer-the-shade) and [iron](/blog/iron-as-a-modifier-how-far-to-go), one at a time.',
      '## Storage and safety in two lines',
      'Dry, dark, sealed and off the floor; kept that way it holds its strength for years, and [caking is the warning sign](/blog/storing-root-bark-so-it-lasts). Fine powder makes an airborne dust, so open the bag low in still air and wear a fitted mask when weighing or milling it — [the full list is here](/blog/working-safely-with-fine-milled-bark).',
      '## What this material is not',
      'It is a raw botanical material sold for dyeing, soap making and craft work. It is not food, it is not a supplement, and it is not for human consumption. Our checkout asks you to confirm that intended use, and we would rather lose the sale than blur it.',
    ],
    authorSlug: 'editorial-team',
    publishedAt: '2026-09-27',
    updatedAt: '2026-09-27',
    clusterSlugs: [
      'the-three-cuts-of-mimosa-root-bark',
      'why-particle-size-changes-everything-in-a-dye-pot',
      'what-tannins-do-in-a-dye-bath',
      'storing-root-bark-so-it-lasts',
      'buying-by-the-pound-and-what-it-saves',
      'milling-your-own-powder-at-home',
      'working-safely-with-fine-milled-bark',
      'sassafras-albidum-the-north-american-dye-tree',
      'natural-dyeing-with-mimosa-hostilis',
    ],
    recommendedProductSlugs: ['mimosa-hostilis-root-bark-powder', 'shredded-mimosa-hostilis-root-bark', 'whole-mimosa-hostilis-root-bark'],
    // The site's own bark photograph (2026-09-28): the sample fallback files do not exist in storage.
    heroImageKey: 'media/7a5f77fc5187e4717ac3854bf185d9a5.jpg',
    isPublished: true,
  },
  {
    /*
      Rewritten 2026-09-28 for botanical dye material. It was written around cannabis
      certificates (potency, THCa arithmetic) and linked to articles withdrawn with
      that line.
    */
    slug: 'how-to-read-a-certificate-of-analysis',
    title: 'How to Read a Certificate of Analysis for Root Bark',
    metaTitle: 'How to Read a Certificate of Analysis for Root Bark',
    metaDesc:
      'Read a botanical certificate in four steps: match the batch code, check the test date, check the lab\'s accreditation scope, then read identity and contaminants.',
    summary:
      'Check four things in this order: does the batch code on the report match the bag in your hand, when was it tested, is the laboratory accredited for those tests, and does the report cover species identity and contaminants such as heavy metals and microbes. A report that fails the first check describes different material.',
    body: [
      'A certificate of analysis is a laboratory\'s report on one sample from one batch. For root bark sold as a dye material it answers two questions: is this the plant the label says it is, and what else came with it. Read in the right order, it settles both in a couple of minutes.',
      '## The order that matters',
      '| Step | What you are checking | If it fails |\n| --- | --- | --- |\n| 1 | The batch code matches your bag | The report describes different material |\n| 2 | The test date | An old report describes the bark as it was then |\n| 3 | The laboratory, in its accreditor\'s directory | It is one company\'s word |\n| 4 | Identity and contaminant results | Neither question has been answered |',
      'Step one first, always. The most common disappointment is not a forged report but a genuine one for a batch you do not have. See [what a batch code is for](/blog/what-a-batch-code-is-for).',
      '## Why the date matters',
      'Dried bark keeps well but not forever. Moisture creeps in, light fades the cut faces, and oxygen slowly darkens the color compounds. Sealed, nitrogen-flushed packaging slows that a great deal, which is why a report dated close to when the bag was packed is the one that describes it best. See [why a test date matters as much as the figure](/blog/why-a-test-date-matters-as-much-as-the-figure).',
      '## Accreditation is scoped',
      'A laboratory is accredited for **specific tests**, not in general. One accredited for heavy metals is not thereby accredited for microbial counts, even on the same letterhead. The accreditor publishes the scope, and it takes a minute to check. See [what ISO 17025 accreditation means](/blog/what-iso-17025-accreditation-means).',
      '## What a report on bark should cover',
      '- **Identity**: that the material is the species named, by microscopy or a chemical fingerprint.\n- **Heavy metals**: lead, arsenic, cadmium and mercury, which a root can take up from its soil.\n- **Microbial counts**: bacteria, yeast and mold, which matter in anything handled by hand.\n- **Moisture and foreign matter**: damp bark spoils, and grit or soil is weight you paid for.',
      'For what each line means, see [what a contaminant panel actually covers](/blog/what-a-contaminant-panel-actually-covers).',
      '## Dry weight or as received',
      'A result on a dry weight basis is not the same as one reported as received: bark that holds some moisture reads lower as received. The certificate says which basis it uses; the bag usually does not.',
      '## The abbreviations',
      '**ND** not detected. **LOD** the smallest amount the method can detect. **LOQ** the smallest amount it can put a reliable number on; a result below it reads `<LOQ`, which is not the same as zero. **Action limit** the threshold a result is judged against. The rest are in [a glossary of certificate terms](/blog/a-glossary-of-certificate-terms).',
      '## What to ask a seller',
      'Ask for the report held for the batch code printed on your bag, not a sample report for the product in general, and not a screenshot. You can ask us for ours through the [contact page](/contact).',
    ],
    authorSlug: 'editorial-team',
    publishedAt: '2026-09-27',
    updatedAt: '2026-09-28',
    clusterSlugs: [
      'what-iso-17025-accreditation-means',
      'what-a-contaminant-panel-actually-covers',
      'what-a-batch-code-is-for',
      'why-a-test-date-matters-as-much-as-the-figure',
      'reading-a-label-line-by-line',
      'a-glossary-of-certificate-terms',
    ],
    recommendedProductSlugs: ['mimosa-hostilis-root-bark-powder', 'sassafras-root-bark'],
    // The site's own bark photograph (2026-09-28): the sample fallback files do not exist in storage.
    heroImageKey: 'media/7ead9637654a35b0f657cca5774b0298.jpg',
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
    // Unpublished 2026-09-28: parent-build text on a withdrawn line or an unconfirmed claim.
    isPublished: false,
  },
  {
    /*
      Rewritten 2026-09-28 in this site's own words (it was the parent build's text).
      Same slug, so every link to it still lands.
    */
    slug: 'how-ordering-and-payment-works',
    title: 'How to Order Root Bark Here, and How Payment Works',
    metaTitle: 'How to Order Root Bark Here, and How Payment Works',
    metaDesc:
      'Ordering here: send an order request, a person checks it, then you pay by Cash App, Chime, Apple Cash or Bitcoin. No card form and no card details, ever.',
    summary:
      'You order here by sending a request, not a payment. A person checks the stock and your address, then emails payment details for the method you chose: Cash App, Chime, Apple Cash or Bitcoin. Once payment arrives, the bark is weighed, nitrogen-sealed and shipped from California with tracking.',
    body: [
      'Ordering root bark here takes one step more than a card checkout, and that step is a person. This is how it works from cart to doorstep.',
      '## Five steps, start to finish',
      '1. **Choose a cut and a size.** Every root bark comes in 1/4, 1/3, 1/2 and 1 lb, and the price for the size you pick is the price you are quoted.\n2. **Send the order request.** At checkout you give your delivery address and the way you would like to pay. Nothing is charged.\n3. **A person checks it.** We confirm the stock and the address, then email you payment details for your chosen method, with your Order ID.\n4. **Pay off the site.** Send the payment with your Order ID as the reference, and tell us it has gone.\n5. **We ship.** Once the payment is confirmed, the order is weighed, packed in a double-sealed, smell-proof bag flushed with nitrogen to keep the bark fresh, and shipped from California, and the tracking number follows.',
      '## Ways to pay',
      'Cash App, Chime, Apple Cash and Bitcoin. Bitcoin orders take a discount off the items, shown next to the payment choice at checkout. The payment details you receive belong to your order alone and are never printed on this website.',
      'A note on names: we take Apple Cash, the person-to-person transfer in Apple Wallet, and not Apple Pay. Apple Pay runs on the card networks and needs a card processor, which this site does not have.',
      '## Why there is no card form',
      'Because a card form is the one thing on a shop that is worth attacking. With no processor behind this site, there are no card numbers here to leak in a breach. The cost is a short wait while a person checks your order; what you get is a checkout with nothing in it to steal.',
      '## How long it takes',
      'Payment details usually follow your request the same day. Delivery time depends on how far the parcel travels from California, so we confirm a window with your order rather than printing one here. Parcel orders from 100 dollars ship free.',
      '## Changing or cancelling',
      'Anything can be changed or cancelled free of charge until the order is packed. Tell us and it is done; if you have already paid and it has not shipped, the payment is refunded in full.',
      '## Keeping yourself safe',
      'We only ask for payment after you have placed an order, and only by email from our own company address with your Order ID in it. We never ask for payment in a text from an unknown number, never ask you to pay a different amount than your order shows, and never ask for a card number. If anything looks otherwise, stop and contact us before sending money.',
    ],
    authorSlug: 'editorial-team',
    publishedAt: '2026-08-15',
    updatedAt: '2026-09-28',
    clusterSlugs: ['the-three-cuts-of-mimosa-root-bark', 'buying-by-the-pound-and-what-it-saves'],
    recommendedProductSlugs: ['mimosa-hostilis-root-bark-powder', 'shredded-mimosa-hostilis-root-bark', 'whole-mimosa-hostilis-root-bark'],
    // The site's own bark photograph (2026-09-28): the sample fallback files do not exist in storage.
    heroImageKey: 'media/13e51ff90939ef04b0db2d7956e35fc9.jpg',
    isPublished: true,
  },
]

export const POSTS: readonly Post[] = [
  {
    slug: 'natural-dyeing-with-mimosa-hostilis',
    // Owner-generated image. The authored post wins over its Post row, so the key lives here.
    heroImageKey: 'media/fdc5f5132e38a860951d1d9c46b3b836.jpg',
    title: 'Natural Dyeing With Mimosa Root Bark, Start to Finish',
    summary:
      'One bath, start to finish: scour the fibre, mordant it with alum at twelve per cent of its dry weight, soak the bark overnight, hold the pot at eighty degrees for an hour, and let it cool with the fibre in it. Everything else in this section is a variation on those five steps.',
    body: [
      'This is the whole process in one place, in the order you will actually do it. Each step links to the article that goes deeper, so you can follow this page for a first bath and come back for the detail afterwards.',
      '## Before you start: the four numbers',
      '| What | Figure | Of what |',
      '| --- | --- | --- |',
      '| Alum | 10 to 15% | Dry weight of the fibre |',
      '| Bark | 50 to 100% | Dry weight of the fibre |',
      '| Temperature | 80°C / 175°F | Never a boil |',
      '| Time at temperature | About 1 hour | Then cool in the pot |',
      'Weigh the fibre **dry, before it is wetted**. Wet wool holds several times its weight in water, and a damp weighing makes both percentages wrong at once.',
      '## Step 1 — Scour',
      'Wash the fibre in hot water with a pH-neutral detergent to take off spinning oil, lanolin and sizing, then rinse and keep it wet. Colour cannot reach fibre that water cannot wet, and most patchy results people blame on the bark start here.',
      '## Step 2 — Mordant',
      'Dissolve alum at about twelve per cent of the dry fibre weight in a jug of very hot water until the water is clear, stir it into the pot, then add the wet fibre. Raise the heat slowly to just under a simmer, hold for an hour, turn it off and let it cool in the pot — overnight if you can.',
      'The one thing to get right is that the alum is fully dissolved before the fibre goes in. An undissolved crystal mordants the spot it rests against far more heavily than everything around it, and the bath afterwards shows it as a hard-edged pale patch. Full method in [mordanting wool before a bark bath](/blog/mordanting-wool-before-a-bark-bath).',
      '## Step 3 — Load the bath',
      'Weigh the bark against the same dry fibre weight — half for a mid shade, the full weight for a deep one — put it in a mesh bag, cover it with cool water and leave it overnight. See [how much bark per pound of fibre](/blog/weighing-bark-against-fibre) and [cold soak or straight to heat](/blog/cold-soak-or-straight-to-heat).',
      'The next day bring the pot up slowly to about 80°C and hold it there for an hour. Then lift the bag out, or strain, before any fibre goes near it — loose material against wool leaves specks that will not rinse out of the plies. See [filtering a bark bath](/blog/filtering-a-bark-bath-without-losing-the-colour).',
      '## Step 4 — Dye',
      'Enter the wet, mordanted fibre into the strained bath, bring it back to temperature gently, and hold it for forty-five minutes to an hour. Turn the fibre once or twice; do not stir it. Wool at temperature plus agitation is how felting starts.',
      'Then turn the heat off and leave the fibre in the pot to cool. The colour keeps going in as the bath falls, and an overnight cool is the cheapest depth available.',
      '**Do not let it boil.** This is the one fault that cannot be corrected: a rolling boil takes the purple to brown in minutes and no amount of cooling brings it back. See [keeping a bark bath purple](/blog/keeping-a-bark-bath-purple).',
      '## Step 5 — Rinse and dry',
      'Rinse in water of roughly the same temperature as the fibre — sudden changes felt wool — until it runs clear, wash once with a pH-neutral detergent, rinse again, and dry out of direct sun. Judge the colour dry: wet fibre reads one to two shades darker than it will end up.',
      '## Then, one variable at a time',
      '- **[pH](/blog/using-ph-to-steer-the-shade)** — acid warms the shade towards red, alkali cools it towards violet and grey. Keep wool between pH 5 and 8.\n- **[Iron](/blog/iron-as-a-modifier-how-far-to-go)** — one to two per cent takes purple to slate. It works in seconds, so dip rather than simmer.\n- **[A second bath](/blog/getting-a-second-and-third-bath-from-one-batch)** — the spent bark gives a lighter shade, which is how a graded set of skeins comes from one batch.\n- **[Plant fibres](/blog/wool-silk-cotton-and-linen-in-the-same-bath)** — cotton and linen need a tannin step as well as alum, and still land paler and browner.',
      'Changing two things at once teaches nothing about which one moved the colour. See [the eight faults that spoil a first bath](/blog/the-faults-that-spoil-a-first-bath).',
      '## Keep a journal',
      'Fibre and its dry weight, alum percentage, bark weight and cut, temperature, time, water, and the batch code on the bag. Bark from different harvests differs and so does tap water, so the notebook is the only way a shade you liked comes back. It is also what makes a [fastness test](/blog/does-the-colour-last-testing-light-and-washing) worth running.',
      '## Safety, briefly',
      'Gloves, and a fitted mask when weighing or milling powder — see [working safely with fine milled bark](/blog/working-safely-with-fine-milled-bark). Dedicated pots and spoons, never used for food afterwards. Spent bark goes on the compost; keep iron and mordant baths out of the food area and dispose of them per local guidance.',
      '## What this material is not',
      'A raw botanical material for dyeing, soap making and craft work. It is not food, it is not a supplement, and it is not for human consumption.',
    ],
    category: 'dyeing',
    authorSlug: 'editorial-team',
    publishedAt: '2026-09-27',
    updatedAt: '2026-09-27',
    pillarSlug: 'what-is-mimosa-hostilis-root-bark',
    recommendedProductSlugs: ['mimosa-hostilis-root-bark-powder', 'shredded-mimosa-hostilis-root-bark', 'whole-mimosa-hostilis-root-bark'],
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
    // Unpublished 2026-09-28: parent-build text on a withdrawn line or an unconfirmed claim.
    isPublished: false,
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
    // Unpublished 2026-09-28: parent-build text on a withdrawn line or an unconfirmed claim.
    isPublished: false,
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
    // Unpublished 2026-09-28: parent-build text on a withdrawn line or an unconfirmed claim.
    isPublished: false,
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
    recommendedProductSlugs: ['mimosa-hostilis-root-bark-powder', 'sassafras-root-bark'],
    // Unpublished 2026-09-28: parent-build text on a withdrawn line or an unconfirmed claim.
    isPublished: false,
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
    recommendedProductSlugs: ['mimosa-hostilis-root-bark-powder', 'sassafras-root-bark'],
    // Unpublished 2026-09-28: parent-build text on a withdrawn line or an unconfirmed claim.
    isPublished: false,
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
