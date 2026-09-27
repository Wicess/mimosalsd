import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

/*
  ── WHY THIS TEST EXISTS ────────────────────────────────────────────────────

  "All 50 states and the District of Columbia" was written into seven places while
  it was true. On 2026-09-17 the vape line was closed in twenty-five states, and in
  that moment the FAQ was telling customers "every product in our catalogue is
  currently available in all 51 US jurisdictions, with no excluded states", the site
  description said the same, and the share card rendered it on every pasted link.

  Nothing broke. No test failed. The copy simply became false and stayed that way,
  which is the exact failure the search guidelines name as the most expensive one:
  copy written once from facts that later change, with no gate re-reading it.

  So this is the gate. A blanket availability claim may not be hardcoded anywhere in
  the source; availability is computed from `state_rules` at render time, per line
  and per address. Where a claim is scoped to a single product line whose rules are
  genuinely unrestricted, the line must be named in the same sentence.
*/

const SRC = join(process.cwd(), 'src')

/**
 * A line may carry the phrase when somebody has looked at it and written down why —
 * a computed conditional, or a sentence about carrier footprint rather than about
 * what a product line may be sent. The marker goes on the line or just above it.
 */
const ALLOW = 'availability-allow'

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) return sourceFiles(full)
    return /\.tsx?$/.test(entry) ? [full] : []
  })
}

/** A blanket claim: every jurisdiction, with nothing narrowing it. */
const BLANKET = /\ball\s+(?:50|fifty)\s+states\b|\ball\s+51\s+(?:US\s+)?jurisdictions\b/i
/** Naming a single product line is what makes such a sentence checkable. */
const SCOPED = /mimosa|root bark|botanical|sassafras/i

describe('availability is never a hardcoded blanket claim', () => {
  const offenders: string[] = []

  for (const file of sourceFiles(SRC)) {
    const text = readFileSync(file, 'utf8')
    // Comments explain; they do not claim. Strip them before looking for a claim.
    const lines = text.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' ')).split('\n')
    lines.forEach((line, i) => {
      if (!BLANKET.test(line)) return
      const trimmed = line.trim()
      if (trimmed.startsWith('//')) return
      if (SCOPED.test(line)) return
      // The marker applies to the statement it introduces, so look back a few lines.
      // Read from the ORIGINAL text, because the marker lives in a stripped comment.
      const raw = text.split('\n')
      const window = raw.slice(Math.max(0, i - 6), i + 1).join('\n')
      if (window.includes(ALLOW)) return
      offenders.push(`${file.replace(process.cwd() + '/', '')}:${i + 1}  ${trimmed.slice(0, 90)}`)
    })
  }

  it('finds no unscoped "all 50 states" claim in the source', () => {
    expect(offenders, offenders.join('\n')).toEqual([])
  })

  it('scans a meaningful number of files, so a broken glob cannot pass silently', () => {
    expect(sourceFiles(SRC).length).toBeGreaterThan(100)
  })
})
