#!/usr/bin/env tsx
/**
 * CI compliance gate.
 *
 * Scans every content surface for banned terms and fails the build on a BLOCK match.
 * Run locally with `npm run compliance:scan`.
 *
 * Product-line scope is inferred from the file path, so a page about Mimosa Hostilis is
 * held to the MHRB rules while a general blog post is held only to the sitewide
 * health-claim rules.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import {
  formatScanResult,
  parseAllowDirectives,
  scanText,
} from '../src/lib/compliance/lexicon'
import type { ProductLine } from '../src/lib/compliance/types'

const ROOT = process.cwd()
/**
 * CLAUDE.md rule 4 says the lexicon gates "all copy, blog content, product
 * descriptions and customer reviews". It did not: every word of blog and guide prose
 * lives in `src/lib/content`, every state legality note in `src/lib/legality`, and
 * every product description in `src/lib/catalog` — none of which were being walked.
 * The largest body of customer-facing writing on the site was exempt from its own
 * gate. `src/lib/compliance` stays excluded below, since the lexicon necessarily
 * contains the terms it bans.
 */
const SCAN_DIRS = [
  'content',
  'src/app',
  'src/components',
  'src/lib/content',
  'src/lib/catalog',
  'src/lib/legality',
  'src/lib/locations',
  'emails',
  'prisma',
]
const SCAN_EXTENSIONS = ['.md', '.mdx', '.tsx', '.ts', '.json']

/** The lexicon itself and its tests necessarily contain the banned terms. */
const EXCLUDE = [
  'src/lib/compliance',
  'scripts/compliance-scan.ts',
  'node_modules',
  '.next',
  'tests',
]

/**
 * Scope resolution. Frontmatter is authoritative — an author who declares
 * `productLine: MIMOSA_HOSTILIS` gets the MHRB rules regardless of where the file
 * lives. The path heuristic is the fallback for files without frontmatter.
 */
/**
 * Comments are never shipped to a customer, so scanning them is pure noise — and
 * noise is what teaches authors to ignore the gate. Stripped for code files only;
 * Markdown "comments" are content and stay in scope.
 *
 * Replaced with equal-length whitespace so line numbers stay accurate.
 */
function stripCodeComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
    .replace(/(^|[^:])\/\/[^\n]*/g, (m, prefix: string) =>
      prefix + ' '.repeat(m.length - prefix.length),
    )
}

function inferProductLines(path: string, contents: string): ProductLine[] {
  const declared = /^\s*productLines?:\s*\[?([^\]\n]+)\]?\s*$/m.exec(contents)
  if (declared?.[1]) {
    const found = declared[1]
      .split(',')
      .map((v) => v.trim().replace(/['"]/g, '').toUpperCase())
      .filter((v): v is ProductLine =>
        v === 'MIMOSA_HOSTILIS' || v === 'AMANITA' || v === 'VAPE',
      )
    if (found.length > 0) return found
  }

  const p = path.toLowerCase()
  const lines: ProductLine[] = []
  if (p.includes('mimosa') || p.includes('mhrb') || p.includes('root-bark')) {
    lines.push('MIMOSA_HOSTILIS')
  }
  if (p.includes('amanita') || p.includes('muscaria') || p.includes('mushroom')) {
    lines.push('AMANITA')
  }
  if (p.includes('vape') || p.includes('disposable')) lines.push('VAPE')
  return lines
}

function* walk(dir: string): Generator<string> {
  let entries: string[]
  try {
    entries = readdirSync(dir)
  } catch {
    return
  }
  for (const entry of entries) {
    const full = join(dir, entry)
    const rel = relative(ROOT, full)
    if (EXCLUDE.some((e) => rel.startsWith(e))) continue
    if (statSync(full).isDirectory()) yield* walk(full)
    else if (SCAN_EXTENSIONS.some((ext) => entry.endsWith(ext))) yield full
  }
}

/** Guide and blog prose: the authored editorial content, and nothing that sells. */
function isEditorialPath(path: string): boolean {
  const normalised = path.replace(/\\/g, '/')
  return normalised.startsWith('src/lib/content/') || normalised.startsWith('content/')
}

function main(): void {
  let filesScanned = 0
  let blocking = 0
  let warnings = 0
  const reports: string[] = []

  for (const dir of SCAN_DIRS) {
    for (const file of walk(join(ROOT, dir))) {
      filesScanned++
      const raw = readFileSync(file, 'utf8')
      const isCode = /\.(ts|tsx)$/.test(file)
      const text = isCode ? stripCodeComments(raw) : raw
      const result = scanText(text, {
        productLines: inferProductLines(file, raw),
        // Guide and blog prose informs rather than sells: a controlled substance may be
        // named there when the same file says we do not sell it (lexicon.ts). Product,
        // category and page copy everywhere else is held to the full block.
        editorial: isEditorialPath(relative(ROOT, file)),
        // Directives are read from the RAW source: stripping comments would remove
        // the very directive that authorises a term.
        extraAllowedTerms: parseAllowDirectives(raw),
      })
      if (result.matches.length === 0) continue
      blocking += result.blocking.length
      warnings += result.warnings.length
      reports.push(formatScanResult(result, relative(ROOT, file)))
    }
  }

  console.log(`\nCompliance lexicon scan — ${filesScanned} file(s) scanned\n`)
  if (reports.length > 0) console.log(reports.join('\n\n') + '\n')

  if (blocking > 0) {
    console.error(
      `✗ FAILED — ${blocking} blocking term(s) found. See docs/01-COMPLIANCE-RESEARCH.md §1.\n` +
        `  If a term is a legitimate legal quotation, add an inline directive naming the\n` +
        `  term and the reason, e.g.  <!-- compliance-allow: extract -- quoting FDA -->\n`,
    )
    process.exit(1)
  }

  console.log(`✓ PASSED — no blocking terms. ${warnings} warning(s) to review.\n`)
}

main()
