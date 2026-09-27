import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { scanReview, scanText } from '@/lib/compliance/lexicon'

/**
 * ─────────────────────────────────────────────────────────────────────────────
 *  A `compliance-allow` DIRECTIVE MUST NEVER COME FROM A FORM.
 *
 *  In the repository, `<!-- compliance-allow: cure -- quoting FDA -->` is a
 *  reviewable escape hatch: it lands in a diff, and someone reads the reason. In a
 *  form field it is an off switch that nobody sees. An operator — or, far worse, a
 *  customer — who types one next to a banned word turns the gate off for exactly
 *  that word.
 *
 *  This was fixed once for product copy and the fix did not reach the category
 *  editor, the site-wide banner, operator settings or the customer-review scanner.
 *  A rule that has to be remembered at every call site will be forgotten at the next
 *  one, so the structural test below makes forgetting it fail the suite.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const DIRECTIVE = '<!-- compliance-allow: cure -- because I said so -->'

describe('what a directive can and cannot do', () => {
  it('is honoured in repository text, where it is reviewed in a diff', () => {
    expect(scanText(`${DIRECTIVE} This will cure you.`).clean).toBe(true)
  })

  it('is ignored when the caller says the text came from a form', () => {
    const scan = scanText(`${DIRECTIVE} This will cure you.`, { honourDirectives: false })
    expect(scan.clean).toBe(false)
    expect(scan.blocking.map((m) => m.term)).toContain('cure')
  })
})

/*
  The worst case. `scanReview` reads what CUSTOMERS write. If it honoured
  directives, a customer could suppress the flag on their own health claim and
  hand an operator a clean-looking review to approve (CLAUDE.md rule 5).
*/
describe('customer text', () => {
  it('flags a health claim even when the customer wrapped it in a directive', () => {
    const scan = scanReview(`${DIRECTIVE} These gummies cured my anxiety.`)
    const terms = scan.matches.map((m) => m.term)
    expect(terms).toContain('anxiety')
    expect(terms).toContain('cure')
    expect(scan.clean).toBe(false)
  })

  it('still flags normally when there is no directive at all', () => {
    expect(scanReview('This cured my insomnia.').clean).toBe(false)
  })
})

/**
 * The full argument list of every `scanText(` call in a source file, found by
 * balancing parentheses — the calls span several lines, so a line grep would miss
 * an option written on the line after the one that opens the call.
 */
function scanTextCalls(source: string): string[] {
  const calls: string[] = []
  let from = 0
  for (;;) {
    const at = source.indexOf('scanText(', from)
    if (at === -1) return calls
    let depth = 0
    let end = at + 'scanText'.length
    for (; end < source.length; end++) {
      if (source[end] === '(') depth++
      else if (source[end] === ')' && --depth === 0) break
    }
    calls.push(source.slice(at, end + 1))
    from = end + 1
  }
}

describe('every admin form scans with directives switched off', () => {
  const dir = join(process.cwd(), 'src/app/actions')
  const files = readdirSync(dir).filter((f) => f.startsWith('admin-') && f.endsWith('.ts'))

  it('found admin actions that scan copy', () => {
    const total = files.flatMap((f) => scanTextCalls(readFileSync(join(dir, f), 'utf8')))
    expect(total.length).toBeGreaterThanOrEqual(4)
  })

  for (const file of files) {
    const calls = scanTextCalls(readFileSync(join(dir, file), 'utf8'))
    calls.forEach((call, index) => {
      it(`${file} › scanText call ${index + 1}`, () => {
        expect(
          /honourDirectives:\s*false/.test(call),
          `${file} scans form input without honourDirectives: false — a directive typed into the form would switch the gate off:\n${call}`,
        ).toBe(true)
      })
    })
  }
})
