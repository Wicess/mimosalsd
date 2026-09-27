import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

/*
  The owner describes the disposables as tested by second-party laboratories
  (2026-09-15), and the disposables category was written to say "lab-tested" for
  exactly that reason. Ten other places still said every batch went to an accredited
  third-party laboratory — the legal disclaimer, the shop, the bulk page, the brand
  line, llms.txt — which, on a site whose core line is disposables, is a claim about
  the disposables the owner has said is not true.

  So a sentence claiming third-party testing of EVERY batch or product must name the
  line it is about. The two files that hold per-line facts are exempt: every sentence
  in them already belongs to one line.
*/

const SRC = join(process.cwd(), 'src')
const PER_LINE = [join('lib', 'catalog', 'catalog.data.ts'), join('lib', 'catalog', 'autowrite', 'facts.ts'), join('lib', 'catalog', 'autowrite', 'template.ts')]

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) return sourceFiles(full)
    return /\.tsx?$/.test(entry) ? [full] : []
  })
}

const BLANKET = /\bevery (?:batch|product)\b[^.'"`]*\bthird-party\b|\bthird-party\b[^.'"`]*\bevery (?:batch|product)\b/i
const SCOPED = /botanical|mimosa|sassafras|root bark/i

describe('third-party testing is never claimed for every product at once', () => {
  it('finds no unscoped "every batch ... third-party" sentence', () => {
    const offenders: string[] = []
    for (const file of sourceFiles(SRC)) {
      if (PER_LINE.some((p) => file.endsWith(p))) continue
      readFileSync(file, 'utf8')
        .split('\n')
        .forEach((line, i) => {
          if (line.trim().startsWith('//') || line.trim().startsWith('*')) return
          if (BLANKET.test(line) && !SCOPED.test(line)) offenders.push(`${file.replace(SRC, 'src')}:${i + 1}`)
        })
    }
    expect(offenders, offenders.join('\n')).toEqual([])
  })
})
