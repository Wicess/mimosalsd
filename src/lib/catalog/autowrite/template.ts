import type { ProductLine } from '@/lib/compliance/types'
import { BRAND } from '@/lib/brand'
import { sizeOptions } from '@/lib/catalog/sizing'
import { formatCents } from '@/lib/utils'
import { clampTitle, descriptionFrom, metaDescription } from './copy'
import { factsFor } from './facts'
import type { ContentFaq, ContentSection, LinkTarget, WrittenCopy } from './types'

/**
 * ─────────────────────────────────────────────────────────────────────────────
 *  THE BUILT-IN WRITER: every part of a product page, from the facts alone.
 *
 *  Used when the Claude writer is not configured, or when it fails or is refused by
 *  the compliance lexicon, so posting a product never waits on anything. It says
 *  only what LINE_FACTS, the owner's notes and the price support, and links only to
 *  the pages it is given.
 *
 *  Pure, so what it writes is tested without a network or a database.
 * ─────────────────────────────────────────────────────────────────────────────
 */

export interface WriteInput {
  readonly name: string
  readonly line: ProductLine
  readonly categoryName: string
  readonly categoryPath: string
  /** For a category with its own facts (see factsFor). */
  readonly categorySlug?: string
  /** The product's own slug, for a product whose facts are its own (see factsFor). */
  readonly productSlug?: string
  /** The price of a pound, or of one unit for a disposable. */
  readonly priceCents: number
  /** Facts only the owner knows: origin, flavour, cut. May be empty. */
  readonly notes: string
  readonly imageCount: number
  readonly links: {
    readonly related: readonly LinkTarget[]
    readonly guides: readonly LinkTarget[]
    readonly labResults: string
    readonly legality: string
    readonly shipping: string
    readonly faq: string
  }
}

const link = (target: LinkTarget) => `[${target.label}](${target.path})`
const sentence = (text: string) => (/[.!?]$/.test(text.trim()) ? text.trim() : `${text.trim()}.`)

export function writeFromTemplate(input: WriteInput, now = new Date()): WrittenCopy {
  const facts = factsFor(input.line, input.categorySlug, input.productSlug)
  const byPound = facts.soldBy === 'lb'
  const labTested = facts.labTested !== false
  const tested = facts.testedBy === 'lab' ? 'Every batch is lab-tested before it is offered for sale' : 'Every batch is tested by a third-party laboratory'
  const sizes = byPound ? sizeOptions({ poundPriceCents: input.priceCents, defaultKey: 'f4' }) : []
  const price = formatCents(input.priceCents)
  const notes = input.notes.trim() ? sentence(input.notes) : ''
  const guide = input.links.guides[0]
  const related = input.links.related.slice(0, 3)
  const categoryLink = `[${input.categoryName}](${input.categoryPath})`
  // A product that is not what its category is named after says so, rather than
  // claiming to be "part of" a range it is not part of.
  const categorySentence = facts.categoryNote
    ? facts.categoryNote.replace('{category}', categoryLink)
    : `It is part of our ${categoryLink} range.`

  const sizeLine = byPound
    ? `${input.name} is sold by the pound, at ${price} a pound. ${sizes.map((s) => `${s.label} is ${formatCents(s.priceCents)}`).join(', ')}. Each size has one fixed price: what you see is what you pay for it.`
    : `${input.name} is ${price} per unit, and the total is that price times how many you order. There are no price ranges and no bulk tiers.`

  const sections: ContentSection[] = [
    {
      heading: `What ${input.name} is`,
      paragraphs: [
        [...facts.whatItIs, notes].filter(Boolean).join(' '),
        `${categorySentence}${guide ? ` For the background, read ${link(guide)}.` : ''}`,
      ].filter(Boolean),
    },
    {
      heading: input.line === 'VAPE' ? 'Who it is for' : 'What it is used for',
      paragraphs: [facts.uses.join(' ')],
    },
    { heading: byPound ? 'Sizes and price' : 'Price', paragraphs: [sizeLine] },
    {
      heading: labTested ? 'Testing, packaging and delivery' : 'Packaging and delivery',
      paragraphs: [
        labTested
          ? `${tested}, and a certified copy of the report goes to verified buyers who ask for it: see [lab results](${input.links.labResults}).`
          : '',
        input.line === 'VAPE'
          ? `It ships with a PACT Act compliant carrier, packed in plain, double-sealed packaging. Read the [shipping policy](${input.links.shipping}).`
          : `Every order is packed in double-sealed, smell-proof packaging and shipped with USPS, UPS or a local agency, free on orders from ${formatCents(BRAND.freeShippingThresholdCents)}. Read the [shipping policy](${input.links.shipping}).`,
      ].filter(Boolean),
    },
    {
      heading: input.line === 'MIMOSA_HOSTILIS' ? 'What it is not' : 'Good to know',
      paragraphs: [`${facts.goodToKnow.join(' ')} Questions? The [FAQ](${input.links.faq}) answers the common ones.`],
    },
  ]
  if (related.length) {
    // "in this range" would claim kinship a product with its own facts does not have.
    const also = facts.categoryNote ? 'Also in this category' : 'Also in this range'
    sections.push({ heading: 'Related products', paragraphs: [`${also}: ${related.map(link).join(', ')}.`] })
  }

  const faqs: ContentFaq[] = [
    ...(byPound
      ? [
          { question: `How much is ${input.name}?`, answer: `${price} a pound. A 1/4 lb is ${formatCents(sizes[0]!.priceCents)}, 1/3 lb is ${formatCents(sizes[1]!.priceCents)} and 1/2 lb is ${formatCents(sizes[2]!.priceCents)}.` },
          { question: `What sizes does ${input.name} come in?`, answer: '1/4 lb, 1/3 lb, 1/2 lb and 1 lb, each at one fixed price.' },
        ]
      : [{ question: `How much is ${input.name}?`, answer: `${price} per unit. Two cost ${formatCents(input.priceCents * 2)}, three cost ${formatCents(input.priceCents * 3)}.` }]),
    ...(labTested
      ? [
          {
            question: `Is ${input.name} lab tested?`,
            answer: `Yes. ${tested}, and a certified copy of the report is sent to verified buyers on request — see [lab results](${input.links.labResults}).`,
          },
        ]
      : []),
  ]

  // The line's first fact, else the owner's notes, else nothing: never a sentence the data does not support.
  const opening = facts.whatItIs[0] ?? (notes ? notes : '')
  const shortDescription = byPound
    ? `${input.name}: ${opening} Sold by the pound at ${price} a pound, from 1/4 lb.`.replace(/\s+/g, ' ')
    : `${input.name}: ${opening} ${price} per unit, 21+ only.`.replace(/\s+/g, ' ')

  /*
    The search title is the product and what it is, and nothing else. No price (it
    changes, and a frozen price in a meta tag becomes false silently), no pipes, no
    brand suffix — this site deliberately spends the whole title on the product.
  */
  const metaTitle = clampTitle(`${input.name}, ${facts.titleSuffix ?? input.categoryName}`)

  return {
    shortDescription: shortDescription.slice(0, 300),
    description: descriptionFrom(sections),
    content: {
      sections,
      advantages: facts.advantages,
      faqs,
      sources: facts.sources,
    },
    seo: {
      metaTitle,
      /*
        Description leads with what the thing IS — the first line fact, which is the
        sentence an answer engine lifts — then the facts that stay true across a price
        change: how it is sold, how it is tested, who it is for.
      */
      metaDescription: metaDescription(
        [
          opening,
          byPound
            ? 'Sold by the pound in quarter, third, half and full pound sizes.'
            : 'Sold by the unit to adults 21 and over.',
          labTested
            ? `${facts.testedBy === 'lab' ? 'Lab tested' : 'Third-party lab tested'} by batch, certificate on request.`
            : '',
          byPound ? 'Packed in the United States.' : '',
        ]
          .filter(Boolean)
          .join(' '),
      ),
      keywords: [input.name, input.categoryName, byPound ? `${input.name} per pound` : `${input.name} price`, `buy ${input.name}`],
    },
    imageAlts: Array.from({ length: input.imageCount }, (_, i) =>
      input.imageCount > 1 ? `${input.name}, photo ${i + 1} of ${input.imageCount}` : input.name,
    ),
    writer: 'template',
    writtenAt: now.toISOString(),
  }
}
