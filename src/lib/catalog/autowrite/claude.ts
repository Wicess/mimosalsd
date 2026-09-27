import 'server-only'
import Anthropic from '@anthropic-ai/sdk'
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod'
import * as z from 'zod/v4'
import { LEXICON } from '@/lib/compliance/lexicon'
import { BRAND } from '@/lib/brand'
import { sizeOptions } from '@/lib/catalog/sizing'
import { formatCents } from '@/lib/utils'
import { clampTitle, descriptionFrom, metaDescription, sanitizeLinks } from './copy'
import { factsFor, LAB_FACT, LAB_FACT_UNNAMED, SITE_FACTS } from './facts'
import type { ProductResearch } from './research'
import type { WriteInput } from './template'
import type { WrittenCopy } from './types'

/**
 * ─────────────────────────────────────────────────────────────────────────────
 *  THE CLAUDE WRITER (owner, 2026-09-14): a detailed, original product page from a
 *  name, a price, a category and the photos.
 *
 *  Claude writes from the same grounded facts as the built-in writer, sees the
 *  photos (so the image descriptions describe what is actually in them), may link
 *  only to the pages it is given and cite only the checked sources. What comes back
 *  is checked again here: links and sources outside those lists are removed, and
 *  lengths are enforced. The compliance lexicon then runs over every word in
 *  lib/catalog/autowrite/index.ts before any of it is published.
 *
 *  Needs ANTHROPIC_API_KEY. Without it, or on any failure or refusal, the caller
 *  keeps the built-in writer's copy.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const Output = z.object({
  shortDescription: z.string(),
  metaTitle: z.string(),
  metaDescription: z.string(),
  keywords: z.array(z.string()),
  sections: z.array(z.object({ heading: z.string(), paragraphs: z.array(z.string()) })),
  advantages: z.array(z.string()),
  faqs: z.array(z.object({ question: z.string(), answer: z.string() })),
  sourceUrls: z.array(z.string()),
  imageAlts: z.array(z.string()),
  specs: z.array(z.object({ label: z.string(), value: z.string() })),
})

export interface ClaudePhoto {
  /** Base64 JPEG, already downscaled. */
  readonly data: string
}

export function claudeWriterConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY)
}

const SYSTEM = `You write product pages for ${BRAND.name}, a United States online shop. Your pages must rank in search engines and be quoted accurately by AI answer engines, so they are specific, factual, well structured and genuinely useful to a buyer.

How to write:
- Write original, detailed prose for this specific product: what it is, its flavour and aroma, its design and specifications, the sizes and prices, testing, packaging and delivery, and what a buyer should know. Use the product name naturally.
- Write with real enthusiasm and finesse. Bring the flavour, the aroma, the look and feel of the device or material and its craftsmanship to life in vivid, sensory, confident language, so a reader can almost taste and hold it. Warmth is welcome; exaggeration is not.
- Every factual statement must come from the facts, the research notes, the owner's notes or what is visible in the photos. Never invent origins, strains, flavours, specifications, test results, awards, reviews, statistics or comparisons.
- Enthusiasm stops at taste, aroma, design and quality. Never describe effects, how it makes anyone feel, a high, relaxation, energy, dosing, strength or potency, or any health outcome. For anything sold as not for human consumption, never describe taste or use at all.
- specs: the specifications the research notes state for this exact product, as short label and value pairs (for example Capacity / 2 g, Battery / 280 mAh rechargeable, Flavor / Mango). Empty when the notes give none. Never a price, never potency as a selling point.
- Put the most important answer first in each section, in plain sentences an answer engine can quote.
- Link to internal pages only with markdown links [words](path), using only the paths you are given, where they genuinely help the reader. Link each page at most once.
- Cite outside sources only by returning their exact URLs, chosen from the list you are given, where they support what the page says.
- FAQs answer real buyer questions about this product: price, what it is, its flavour and specifications, testing, packaging. Answers are one to three sentences.
- Advantages are short, factual reasons to buy it here, taken from the facts. Never a health or effect claim.
- metaTitle: at most 60 characters, the product name first. metaDescription: 120 to 155 characters, with the price.
- shortDescription: one or two sentences, under 280 characters.
- imageAlts: one per photo, in order, each describing what that photo shows in under 120 characters, naming the product.
- Write in American English. No exclamation marks. No unverifiable superlatives such as best, number one or strongest, and never potent.

Compliance rules override everything else. Break none of them.`

export async function writeWithClaude(
  input: WriteInput,
  photos: readonly ClaudePhoto[],
  feedback?: string,
  research?: ProductResearch | null,
): Promise<WrittenCopy | null> {
  if (!claudeWriterConfigured()) return null
  const facts = factsFor(input.line, input.categorySlug, input.productSlug)
  const byPound = facts.soldBy === 'lb'
  const sizes = byPound ? sizeOptions({ poundPriceCents: input.priceCents, defaultKey: 'f4' }) : []
  const banned = LEXICON.filter((e) => e.severity === 'BLOCK' && (!e.scope || e.scope.includes(input.line))).map((e) => e.term)

  const links = [
    { label: input.categoryName, path: input.categoryPath },
    ...input.links.guides,
    ...input.links.related,
    { label: 'Lab results', path: input.links.labResults },
    { label: 'Shipping policy', path: input.links.shipping },
    { label: 'FAQ', path: input.links.faq },
  ]

  const brief = [
    `Product name: ${input.name}`,
    `Category: ${input.categoryName}`,
    byPound
      ? `Price: ${formatCents(input.priceCents)} per pound. Sizes and fixed prices: ${sizes.map((s) => `${s.label} ${formatCents(s.priceCents)}`).join('; ')}.`
      : `Price: ${formatCents(input.priceCents)} per unit. The total is the price times the quantity.`,
    `Owner's notes: ${input.notes.trim() || '(none)'}`,
    `Photos attached: ${photos.length}`,
    '',
    'Facts about this product line:',
    ...[...facts.whatItIs, ...facts.uses, ...facts.goodToKnow].map((f) => `- ${f}`),
    '',
    'Facts true of every order on the site:',
    ...SITE_FACTS.filter((f) => facts.labTested !== false || f !== LAB_FACT)
      .map((f) => (f === LAB_FACT && facts.testedBy === 'lab' ? LAB_FACT_UNNAMED : f))
      .map((f) => `- ${f}`),
    '',
    'Advantages you may use:',
    ...facts.advantages.map((f) => `- ${f}`),
    '',
    'Compliance rules for this product line:',
    ...facts.rules.map((f) => `- ${f}`),
    `- Never use these words or terms anywhere: ${banned.join(', ')}.`,
    '',
    'Internal pages you may link to:',
    ...links.map((l) => `- ${l.label}: ${l.path}`),
    '',
    ...(research
      ? ['', 'Research notes on this exact product, from the web (use only these facts about it; each line names its source):', research.notes]
      : ['', 'Research notes: none. Do not state specifications or flavour beyond the facts above, and return specs empty.']),
    '',
    'Outside sources you may cite (return exact URLs in sourceUrls):',
    ...[...facts.sources, ...(research?.sources ?? [])].map((s) => `- ${s.label}: ${s.url}`),
    ...(feedback ? ['', `Your previous draft was refused by the compliance check: ${feedback}. Rewrite without those terms.`] : []),
  ].join('\n')

  const client = new Anthropic({ timeout: 180_000, maxRetries: 1 })
  const response = await client.beta.messages.parse({
    model: 'claude-opus-5',
    max_tokens: 16000,
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    thinking: { type: 'adaptive' },
    output_config: { effort: 'medium', format: betaZodOutputFormat(Output) },
    system: SYSTEM,
    messages: [
      {
        role: 'user',
        content: [
          ...photos.map((photo) => ({
            type: 'image' as const,
            source: { type: 'base64' as const, media_type: 'image/jpeg' as const, data: photo.data },
          })),
          { type: 'text' as const, text: brief },
        ],
      },
    ],
  })
  if (response.stop_reason === 'refusal' || !response.parsed_output) return null
  const out = response.parsed_output

  // Only the pages and sources it was given, whatever came back.
  const allowedPaths = new Set(links.map((l) => l.path))
  const sourceByUrl = new Map([...facts.sources, ...(research?.sources ?? [])].map((s) => [s.url, s]))
  const clean = (text: string) => sanitizeLinks(text.trim(), allowedPaths)
  const sections = out.sections
    .filter((s) => s.heading.trim() && s.paragraphs.some((p) => p.trim()))
    .slice(0, 8)
    .map((s) => ({ heading: s.heading.trim().slice(0, 90), paragraphs: s.paragraphs.map(clean).filter(Boolean).slice(0, 6) }))
  if (sections.length < 3) return null

  return {
    shortDescription: clean(out.shortDescription).replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').slice(0, 300),
    description: descriptionFrom(sections),
    content: {
      sections,
      advantages: out.advantages.map((a) => a.trim()).filter(Boolean).slice(0, 8),
      faqs: out.faqs
        .filter((f) => f.question.trim() && f.answer.trim())
        .slice(0, 8)
        .map((f) => ({ question: f.question.trim().slice(0, 200), answer: clean(f.answer).slice(0, 600) })),
      sources: [...new Set(out.sourceUrls)].map((url) => sourceByUrl.get(url)).filter((s) => s !== undefined),
    },
    seo: {
      metaTitle: clampTitle(out.metaTitle || input.name),
      metaDescription: metaDescription(out.metaDescription || out.shortDescription),
      keywords: out.keywords.map((k) => k.trim()).filter(Boolean).slice(0, 12),
    },
    imageAlts: Array.from({ length: photos.length }, (_, i) => (out.imageAlts[i]?.trim() || input.name).slice(0, 200)),
    // Specifications only come from research; without it the page states none it cannot support.
    ...(research
      ? {
          specs: out.specs
            .map((s) => [s.label.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').trim().slice(0, 60), s.value.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').trim().slice(0, 200)] as const)
            .filter(([label, value]) => label && value)
            .slice(0, 20),
        }
      : {}),
    writer: 'claude',
    writtenAt: new Date().toISOString(),
  }
}
