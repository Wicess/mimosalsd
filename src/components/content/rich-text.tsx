import { Fragment } from 'react'

/**
 * ─────────────────────────────────────────────────────────────────────────────
 *  INLINE LINKS AND EMPHASIS IN EDITORIAL BODY TEXT (owner, 2026-09-17).
 *
 *  The blog renderer parsed three things: a "## " heading, a list of "- " lines, and
 *  a paragraph. Everything else was printed verbatim — so `[root bark](/product/x)`
 *  inside an article appeared on the page as literal square brackets and a path.
 *
 *  That made contextual linking impossible, which is the whole mechanism behind the
 *  brief for these articles: a reader who has just read how much bark a pound of wool
 *  needs should be able to reach the bark from that sentence, not only from a strip
 *  at the end.
 *
 *  ── WHY THE ALLOWLIST IS A PREFIX CHECK AND NOT A SANITISER ────────────────
 *
 *  Article bodies are written in the admin panel, so this text is operator input, and
 *  operator input eventually contains a mistake or a paste from somewhere else. Rather
 *  than try to neutralise a bad href, this renders a link ONLY when the target begins
 *  with one of a few known internal path prefixes. Anything else — an absolute URL, a
 *  protocol-relative `//host`, a `javascript:` scheme, a traversal — keeps its words
 *  and loses its link, which is the same trade `sanitizeLinks` makes for product copy.
 *
 *  ── CITATIONS (2026-09-18) ────────────────────────────────────────────────
 *
 *  External links used to be refused outright, and the articles cite 21 CFR 189.180,
 *  7 CFR 990.1, the PACT Act and ISO/IEC 17025 by name with nothing to click. A claim
 *  about federal law that a reader cannot check is weaker than one they can, and
 *  answer engines weigh a cited primary source heavily when choosing what to quote.
 *
 *  So an external link renders when — and only when — it is https and its host is a
 *  government or standards body on the list below: the primary sources for the
 *  regulatory and laboratory claims these articles make. Anything else still keeps its
 *  words and loses its link, exactly as before. A citation opens the source itself,
 *  never a site that merely talks about it.
 * ─────────────────────────────────────────────────────────────────────────────
 */

/** Primary sources an article may cite. A host matches itself or any subdomain. */
const CITABLE_HOSTS = [
  'ecfr.gov',
  'federalregister.gov',
  'govinfo.gov',
  'congress.gov',
  'fda.gov',
  'epa.gov',
  'usda.gov',
  'atf.gov',
  'usps.com',
  'dea.gov',
  'usdoj.gov',
  'cpsc.gov',
  'osha.gov',
  'nih.gov',
  'iso.org',
] as const

export function isCitableSource(target: string): boolean {
  let parsed: URL
  try {
    parsed = new URL(target)
  } catch {
    return false
  }
  if (parsed.protocol !== 'https:' || parsed.username || parsed.password || parsed.port) return false
  const host = parsed.hostname.toLowerCase()
  return CITABLE_HOSTS.some((h) => host === h || host.endsWith(`.${h}`))
}

/** Every citable source linked in a body, in order, once each — for Article `citation`. */
export function citationsIn(blocks: readonly string[]): string[] {
  const found = new Set<string>()
  for (const block of blocks) {
    for (const match of block.matchAll(TOKEN)) {
      const target = match[2]
      if (target && isCitableSource(target)) found.add(target)
    }
  }
  return [...found]
}

/** Internal destinations an article may link to. */
const ALLOWED_PREFIXES = [
  '/product/',
  '/shop/',
  '/shop',
  '/blog/',
  '/guides/',
  '/where-we-ship/',
  '/where-we-ship',
  '/policies/',
  '/lab-results/',
  '/lab-results',
  '/locations/',
  '/locations',
  '/faq',
  '/bulk',
  '/contact',
  '/about',
  '/shop-near-me',
] as const

export function isInternalPath(target: string): boolean {
  // A protocol-relative URL starts with "//" and is NOT internal, so test it first.
  if (target.startsWith('//')) return false
  if (!target.startsWith('/')) return false
  if (target.includes('..')) return false
  return ALLOWED_PREFIXES.some((p) => target === p || target.startsWith(p))
}

/** `[label](/path)` and `**bold**`, in one pass, with everything else left as text. */
const TOKEN = /\[([^\]\n]+)\]\(([^)\s]+)\)|\*\*([^*\n]+)\*\*/g

export function RichText({ text }: { text: string }) {
  const out: React.ReactNode[] = []
  let cursor = 0
  let key = 0

  for (const match of text.matchAll(TOKEN)) {
    const at = match.index ?? 0
    if (at > cursor) out.push(text.slice(cursor, at))
    cursor = at + match[0].length

    const [, label, target, bold] = match
    if (bold !== undefined) {
      out.push(
        <strong key={key++} className="font-semibold text-foreground">
          {bold}
        </strong>,
      )
      continue
    }
    if (label !== undefined && target !== undefined) {
      if (isInternalPath(target)) {
        out.push(
          <a
            key={key++}
            href={target}
            className="underline decoration-border underline-offset-4 transition-colors hover:decoration-foreground"
          >
            {label}
          </a>,
        )
      } else if (isCitableSource(target)) {
        out.push(
          <a
            key={key++}
            href={target}
            rel="noopener noreferrer"
            className="underline decoration-border underline-offset-4 transition-colors hover:decoration-foreground"
          >
            {label}
          </a>,
        )
      } else {
        // Keep the words, drop the link. A reader loses nothing; a crawler follows nothing.
        out.push(<Fragment key={key++}>{label}</Fragment>)
      }
    }
  }

  if (cursor < text.length) out.push(text.slice(cursor))
  return <>{out}</>
}
