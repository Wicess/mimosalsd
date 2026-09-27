import 'server-only'
import Anthropic from '@anthropic-ai/sdk'
import type { WriteInput } from './template'
import type { ContentSource } from './types'

/**
 * ─────────────────────────────────────────────────────────────────────────────
 *  RESEARCH BEFORE WRITING (owner, 2026-09-15): look the specific product up on the
 *  web, so its page carries its real specifications and flavour, not just what its
 *  category has in common.
 *
 *  One Claude call with the web search tool. What comes back is NOT copy: it is a
 *  set of notes — specifications, flavour and aroma, the maker's own description of
 *  the device or material — each tied to the page it came from. The writer then
 *  writes the page from those notes (lib/catalog/autowrite/claude.ts).
 *
 *  ── What is trusted ────────────────────────────────────────────────────────
 *  Only addresses the search tool actually returned count as sources. The model
 *  is asked to cite them, but a URL it names that no search returned is dropped,
 *  so a page can never cite an address somebody imagined.
 *
 *  ── What is not researched ─────────────────────────────────────────────────
 *  Effects, dosing, potency as a promise, health claims and how a product makes
 *  anyone feel are left out on purpose. The compliance rules forbid them on every
 *  selling page, and the lexicon would refuse the copy anyway; notes that carried
 *  them would only waste the writer's attempt.
 *
 *  Structured output is a separate, second call (the writer's), because web search
 *  answers carry citations and citations cannot be combined with an output schema.
 * ─────────────────────────────────────────────────────────────────────────────
 */

export interface ProductResearch {
  /** Plain-text notes for the writer: facts, each followed by the URL it came from. */
  readonly notes: string
  /** Every page the search returned, which the writer may cite. */
  readonly sources: readonly ContentSource[]
}

const MAX_CONTINUATIONS = 3

const SYSTEM = `You research one specific retail product on the web for a shop that is about to write its product page. Search for the exact product by name and brand, and prefer the maker's own site, authorised retailers and detailed product listings.

Collect only facts that a page can state as fact:
- specifications: device type, capacity, battery, puff count or usage life, charging port, dimensions, materials, strain type or cultivar name as the maker labels it, ingredients the maker lists, pack contents, country of manufacture, and anything similar the maker publishes;
- flavour and aroma, as the maker or retailers describe them: the flavour name, its taste notes and scent;
- what the maker says distinguishes the design: the look, the feel in the hand, the draw, the finish.

Leave out, completely: effects, how it makes anyone feel, dosing, strength or potency as a selling point, health or medical claims, comparisons with controlled substances, and anything about using it that is not taste, aroma or the device itself. Leave out prices and stock, which the shop sets.

If sources disagree, say so. If you cannot find this exact product, say that plainly and do not substitute a similar one.

Write your answer as short plain-text notes, one fact per line, each ending with the URL it came from in parentheses. No markdown headings.`

type BetaBlock = Anthropic.Beta.BetaContentBlock

/** Every URL the web search tool returned in these blocks. */
function searchedSources(blocks: readonly BetaBlock[]): ContentSource[] {
  const out: ContentSource[] = []
  for (const block of blocks) {
    if (block.type !== 'web_search_tool_result') continue
    // A failed search carries an error object, not a list of results.
    if (!Array.isArray(block.content)) continue
    for (const result of block.content) {
      if (result.type === 'web_search_result' && /^https?:\/\//.test(result.url)) {
        out.push({ label: (result.title || new URL(result.url).hostname).slice(0, 200), url: result.url.slice(0, 500) })
      }
    }
  }
  return out
}

function textOf(blocks: readonly BetaBlock[]): string {
  return blocks
    .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('')
    .trim()
}

/**
 * Keep the notes and the sources the search really returned, deduplicated; drop any
 * note line that names a URL no search returned. Pure, so it is tested without a network.
 */
export function acceptResearch(notes: string, searched: readonly ContentSource[]): ProductResearch | null {
  const byUrl = new Map<string, ContentSource>()
  for (const source of searched) if (!byUrl.has(source.url)) byUrl.set(source.url, source)
  const lines = notes
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => {
      const urls = line.match(/https?:\/\/[^\s)]+/g) ?? []
      return urls.every((url) => byUrl.has(url))
    })
  if (lines.length === 0 || byUrl.size === 0) return null
  return { notes: lines.join('\n').slice(0, 12000), sources: [...byUrl.values()].slice(0, 10) }
}

/** Research this product on the web. Null when there is no key, nothing reliable was found, or the call fails. */
export async function researchProduct(input: WriteInput): Promise<ProductResearch | null> {
  if (!process.env.ANTHROPIC_API_KEY) return null
  const client = new Anthropic({ timeout: 180_000, maxRetries: 1 })
  const question = [
    `Product: ${input.name}`,
    `Shop category: ${input.categoryName}`,
    `Owner's notes: ${input.notes.trim() || '(none)'}`,
  ].join('\n')

  const messages: Anthropic.Beta.BetaMessageParam[] = [{ role: 'user', content: question }]
  const blocks: BetaBlock[] = []
  for (let turn = 0; turn <= MAX_CONTINUATIONS; turn++) {
    const response = await client.beta.messages.create({
      model: 'claude-opus-5',
      max_tokens: 16000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      thinking: { type: 'adaptive' },
      output_config: { effort: 'medium' },
      system: SYSTEM,
      tools: [{ type: 'web_search_20260209', name: 'web_search', max_uses: 5 }],
      messages,
    })
    if (response.stop_reason === 'refusal') return null
    blocks.push(...response.content)
    // A long search can pause; send the turn back and the server resumes where it stopped.
    if (response.stop_reason !== 'pause_turn') break
    messages.push({ role: 'assistant', content: response.content })
  }

  return acceptResearch(textOf(blocks), searchedSources(blocks))
}
