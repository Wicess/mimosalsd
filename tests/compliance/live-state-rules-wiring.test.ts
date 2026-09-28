import { readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * The storefront must decide and display shipping eligibility on the LIVE state
 * rules. It did not: the rules were swapped in from instrumentation.ts, whose
 * bundle has its own copy of the rule module, so the cart, checkout and state
 * pages ran on the seed while the admin table said otherwise (75 of 153 rules
 * apart on 2026-09-11). This test pins the fix in place.
 */
const root = path.resolve(__dirname, '../..')
const read = (file: string) => readFileSync(path.join(root, file), 'utf8')

/** The body of a named function, braces balanced, so a call elsewhere in the file does not count. */
function bodyOf(source: string, signature: RegExp): string {
  const match = signature.exec(source)
  if (!match) throw new Error(`function not found: ${signature}`)
  const open = source.indexOf('{', source.indexOf(')', match.index))
  let depth = 0
  for (let i = open; i < source.length; i++) {
    if (source[i] === '{') depth++
    else if (source[i] === '}' && --depth === 0) return source.slice(open, i + 1)
  }
  throw new Error(`unbalanced braces after ${signature}`)
}

const CALL = 'await ensureLiveStateRules()'

const ENTRY_POINTS: ReadonlyArray<readonly [string, RegExp, string]> = [
  ['src/app/actions/checkout.ts', /export async function submitOrder\(/, 'checkout, where eligibility is enforced'],
  ['src/lib/catalog/live-cart.ts', /export async function resolveCartLive\(/, 'the cart and the checkout page'],
  ['src/lib/catalog/merged.ts', /async function mergedCatalog\(/, 'every product list filtered by state'],
  ['src/app/(site)/where-we-ship/page.tsx', /export default async function LegalityHubPage\(/, 'the legality hub'],
  ['src/app/(site)/where-we-ship/[state]/page.tsx', /async function StateBody\(/, 'each state page'],
  ['src/app/(site)/where-we-ship/[state]/page.tsx', /export async function generateMetadata\(/, "each state page's metadata"],
  ['src/app/(site)/shop-near-me/page.tsx', /export default async function ShopNearMePage\(/, 'shop near me'],
  ['src/app/(site)/locations/[city]/page.tsx', /async function LocationBody\(/, 'location pages'],
  ['src/components/commerce/category-about.tsx', /export async function CategoryAboutBand\(/, "the category About band's shipping facts"],
  ['src/app/llms.txt/route.ts', /async function buildLlmsTxt\(/, "llms.txt's per-state legality lines"],
  ['src/app/sitemap.ts', /export default async function sitemap\(/, "the sitemap's legality lastmod dates"],
]

describe('the storefront reads the live state rules', () => {
  it.each(ENTRY_POINTS)('%s loads them before use (%s)', (file, signature) => {
    expect(bodyOf(read(file), signature)).toContain(CALL)
  })

  it('publishes an admin edit everywhere: invalidates the cache, then reloads', () => {
    const source = read('src/app/actions/admin-state-rules.ts')
    expect(source).toContain('updateTag(STATE_RULES_TAG)')
    expect(source).toContain(CALL)
  })

  it('never sets the rules per instance from anywhere else', () => {
    // setStateRuleProvider in a request path is the per-instance pattern that let
    // one server enforce an edit while the rest kept the old rules.
    const allowed = new Set([
      'src/lib/compliance/state-rules.ts',
      'src/lib/compliance/live-state-rules.ts',
    ])
    const offenders: string[] = []
    const walk = (dir: string) => {
      for (const name of readdirSync(path.join(root, dir))) {
        const rel = path.join(dir, name)
        if (statSync(path.join(root, rel)).isDirectory()) walk(rel)
        else if (/\.(ts|tsx)$/.test(name) && !allowed.has(rel) && read(rel).includes('setStateRuleProvider(')) {
          offenders.push(rel)
        }
      }
    }
    walk('src')
    expect(offenders).toEqual([])
  })

  it('no longer relies on instrumentation to install providers', () => {
    expect(read('src/instrumentation.ts')).not.toMatch(/bootstrap|setStateRuleProvider|setOrderProvider/)
  })
})
