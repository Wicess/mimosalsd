import 'server-only'
import sharp from 'sharp'
import type { ProductLine } from '@/lib/compliance/types'
import { scanText } from '@/lib/compliance/lexicon'
import { listMergedProducts } from '@/lib/catalog/merged'
import { listAllGuides, listAllPosts } from '@/lib/content/merged-content'
import { reportError } from '@/lib/observability/report-error'
import { url } from '@/lib/seo/routes'
import { claudeWriterConfigured, writeWithClaude, type ClaudePhoto } from './claude'
import { copyForLexicon } from './copy'
import { factsFor } from './facts'
import { researchProduct } from './research'
import { writeFromTemplate, type WriteInput } from './template'
import type { WrittenCopy } from './types'

export { claudeWriterConfigured } from './claude'
export type { ClaudePhoto } from './claude'
export type { WriteInput } from './template'

/**
 * ─────────────────────────────────────────────────────────────────────────────
 *  WRITING A PRODUCT PAGE AUTOMATICALLY (owner, 2026-09-14).
 *
 *  The owner posts a name, a price, a category and photos. This writes the rest:
 *  the description in sections, the short description, the advantages, the FAQs,
 *  the outside sources, the internal links, the search title and description, and
 *  one description per photo.
 *
 *  Two writers, one standard. The built-in writer is instant and always available;
 *  the Claude writer, when ANTHROPIC_API_KEY is set, writes a richer, original page
 *  from the same facts and looks at the photos. Whichever writes it, the copy is
 *  run through the compliance lexicon before anyone can see it, and Claude's copy
 *  that fails is rewritten once with the reason, then abandoned for the built-in
 *  copy. Nothing unchecked is ever published.
 * ─────────────────────────────────────────────────────────────────────────────
 */

/** The blocking lexicon terms in a piece of copy, for this product line. Empty when clean. */
export function lexiconRefusals(copy: WrittenCopy, line: ProductLine): string[] {
  const scan = scanText(copyForLexicon(copy), { productLines: [line], honourDirectives: false })
  return [...new Set(scan.blocking.map((m) => m.term))]
}

/**
 * The pages a product in this line may link to: its category, guides, sibling products,
 * and the site's help pages.
 *
 * `productSlug` is the product's own slug. It keeps the product out of its own related
 * list, and it selects the product's facts, so a product with its own guides and posts
 * (see factsFor) links to those rather than to its line's.
 */
export async function productLinks(line: ProductLine, categorySlug: string, productSlug?: string): Promise<WriteInput['links']> {
  const facts = factsFor(line, categorySlug, productSlug)
  const excludeSlug = productSlug
  const [products, guides, posts] = await Promise.all([
    listMergedProducts({ categorySlug }).catch(() => []),
    listAllGuides().catch(() => []),
    listAllPosts().catch(() => []),
  ])
  return {
    related: products
      .filter((p) => p.slug !== excludeSlug)
      .slice(0, 4)
      .map((p) => ({ label: p.name, path: url.product(p.slug) })),
    guides: [
      ...facts.guideSlugs
        .map((slug) => guides.find((g) => g.slug === slug))
        .filter((g) => g !== undefined)
        .map((g) => ({ label: g.title, path: url.guide(g.slug) })),
      ...facts.postSlugs
        .map((slug) => posts.find((p) => p.slug === slug))
        .filter((p) => p !== undefined)
        .map((p) => ({ label: p.title, path: url.blogPost(p.slug) })),
    ],
    labResults: url.labResults(),
    legality: url.legalityHub(),
    shipping: url.policy('shipping'),
    faq: url.faq(),
  }
}

/** Photos, small enough to show Claude: the longest edge at 1024px, as JPEG. */
export async function photosForClaude(images: readonly Uint8Array[]): Promise<ClaudePhoto[]> {
  const out: ClaudePhoto[] = []
  for (const bytes of images.slice(0, 6)) {
    try {
      const small = await sharp(bytes).rotate().resize(1024, 1024, { fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 80 }).toBuffer()
      out.push({ data: small.toString('base64') })
    } catch {
      // A photo that cannot be read is left out of what Claude sees; it is still on the page.
    }
  }
  return out
}

/** The built-in writer's copy: instant, and the page's copy until Claude's replaces it. */
export function quickCopy(input: WriteInput): WrittenCopy {
  return writeFromTemplate(input)
}

/**
 * Claude's copy for a product, checked. Null when Claude is not configured, failed,
 * refused, or twice wrote something the lexicon refuses: the caller keeps what it has.
 */
export async function claudeCopy(input: WriteInput, photos: readonly ClaudePhoto[]): Promise<WrittenCopy | null> {
  if (!claudeWriterConfigured()) return null
  try {
    // Research once; both attempts write from the same notes. A failed search still leaves a page to write.
    const research = await researchProduct(input).catch(() => null)
    const first = await writeWithClaude(input, photos, undefined, research)
    if (!first) return null
    const refused = lexiconRefusals(first, input.line)
    if (refused.length === 0) return first
    const second = await writeWithClaude(input, photos, `these terms are not allowed: ${refused.join(', ')}`, research)
    return second && lexiconRefusals(second, input.line).length === 0 ? second : null
  } catch (error) {
    await reportError(error, { source: 'action', severity: 'WARN', context: { stage: 'claude-product-writer', product: input.name } }).catch(() => undefined)
    return null
  }
}
