/**
 * What the automatic writer produces for a posted product (owner, 2026-09-14): the
 * words, the search and share metadata, and the image descriptions, from a name, a
 * price, a category and photos. Stored on the product's document and rendered by the
 * product page. Pure types, shared by the server writer and the page.
 */

export interface ContentSection {
  readonly heading: string
  /** Paragraphs. Links are written [text](target), and only to allowed targets. */
  readonly paragraphs: readonly string[]
}

export interface ContentFaq {
  readonly question: string
  readonly answer: string
}

export interface ContentSource {
  readonly label: string
  readonly url: string
}

export interface ProductContent {
  readonly sections: readonly ContentSection[]
  /** Short, factual reasons to buy it here. Never a health claim. */
  readonly advantages: readonly string[]
  readonly faqs: readonly ContentFaq[]
  /** Outside sources, from the checked list only. */
  readonly sources: readonly ContentSource[]
}

export interface ProductSeo {
  /** At most 60 characters, for the search result and the browser tab. */
  readonly metaTitle: string
  /** 70 to 160 characters, for the search result snippet and the share card. */
  readonly metaDescription: string
  readonly keywords: readonly string[]
}

export type Writer = 'claude' | 'template'

export interface WrittenCopy {
  readonly shortDescription: string
  /** The sections as plain paragraphs, links reduced to their text: for search and feeds. */
  readonly description: string
  readonly content: ProductContent
  readonly seo: ProductSeo
  /** One per photo, in order. */
  readonly imageAlts: readonly string[]
  /** [label, value] pairs found by researching this exact product; absent when nothing was researched. */
  readonly specs?: readonly (readonly [string, string])[]
  readonly writer: Writer
  readonly writtenAt: string
}

/** An internal page the writer may link to. */
export interface LinkTarget {
  readonly label: string
  readonly path: string
}
