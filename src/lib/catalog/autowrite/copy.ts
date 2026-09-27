import { clampDescription, sanitizeMeta } from '@/lib/seo/meta'
import type { ContentSection, WrittenCopy } from './types'

/**
 * Small, pure rules every piece of written copy passes through, whoever wrote it.
 */

const LINK = /\[([^\]]+)\]\(([^)\s]+)\)/g

/** Keep a link only when its target is one of ours to link to; otherwise keep its words. */
export function sanitizeLinks(text: string, allowed: ReadonlySet<string>): string {
  return text.replace(LINK, (_, label: string, target: string) => (allowed.has(target) ? `[${label}](${target})` : label))
}

/** The words, with links reduced to their text. */
export function plainText(text: string): string {
  return text.replace(LINK, '$1').replace(/\s+/g, ' ').trim()
}

/**
 * A title for the search result: whole words, no symbols, at most `max` characters.
 *
 * It used to break on a pipe, because titles were built as `Name | Price | Brand`.
 * They are not any more (see sanitizeMeta), so the only break is a space.
 */
export function clampTitle(title: string, max = 60): string {
  const clean = sanitizeMeta(title)
  if (clean.length <= max) return clean
  const cut = clean.slice(0, max + 1)
  const lastBreak = cut.lastIndexOf(' ')
  return (lastBreak > 20 ? cut.slice(0, lastBreak) : clean.slice(0, max)).replace(/[\s,;:—–-]+$/u, '')
}

export function metaDescription(text: string): string {
  return clampDescription(sanitizeMeta(plainText(text)), 160)
}

export function descriptionFrom(sections: readonly ContentSection[]): string {
  return sections.flatMap((s) => s.paragraphs.map(plainText)).join('\n\n')
}

/** Every word a customer can read, for the compliance lexicon. */
export function copyForLexicon(copy: WrittenCopy): string {
  return [
    copy.shortDescription,
    copy.seo.metaTitle,
    copy.seo.metaDescription,
    ...copy.content.sections.flatMap((s) => [s.heading, ...s.paragraphs.map(plainText)]),
    ...copy.content.advantages,
    ...copy.content.sources.map((source) => source.label),
    ...copy.content.faqs.flatMap((f) => [f.question, plainText(f.answer)]),
    ...copy.imageAlts,
    ...(copy.specs ?? []).flat(),
  ].join('\n')
}
