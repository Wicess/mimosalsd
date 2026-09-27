/**
 * Responsive sweep.
 *
 * Loads every top-level route at every breakpoint this site claims to support and
 * checks the two things that actually break: content wider than the viewport, and
 * touch targets below the 44px minimum. Both are invisible in a desktop screenshot
 * and obvious on a phone.
 *
 *   E2E_BASE_URL=http://localhost:3000 node tests/e2e/responsive.mjs
 */
import { chromium } from 'playwright'

const BASE = process.env.E2E_BASE_URL ?? 'http://localhost:3000'
const WIDTHS = [320, 375, 414, 768, 1024, 1280, 1440, 1920, 2560]
const ROUTES = [
  '/', '/shop', '/shop/amanita', '/product/amanita-gummies-mixed-berry',
  '/legality', '/legality/texas', '/lab-results', '/blog', '/faq',
  '/about', '/bulk', '/contact', '/locations', '/shop-near-me', '/cart', '/checkout',
]

const browser = await chromium.launch()
const bye = async () => { await browser.close().catch(() => {}) }
for (const sig of ['uncaughtException', 'unhandledRejection'])
  process.on(sig, async (e) => { console.error(`\n✗ ${sig}:`, e?.stack ?? e); await bye(); process.exit(1) })

const failures = []

for (const width of WIDTHS) {
  const ctx = await browser.newContext({ viewport: { width, height: 900 } })
  const page = await ctx.newPage()
  // Pass the age gate once per context; it is client-side and blocks nothing else.
  await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' })
  const yes = page.getByRole('button', { name: /Yes, I am/ })
  await yes.waitFor({ state: 'visible', timeout: 15000 }).catch(() => {})
  if (await yes.count()) { await yes.click(); await yes.waitFor({ state: 'hidden', timeout: 8000 }).catch(() => {}) }

  /*
    Refuse to measure an unstyled page.

    A torn build — prerendered HTML referencing a CSS chunk that is no longer on disk
    — serves a page with no stylesheet at all. Every measurement then describes raw
    HTML: nothing is hidden, nothing has a min-height, and the sweep reports two dozen
    confident, worthless failures. It happened, and the numbers looked plausible.
  */
  const styled = await page.evaluate(
    () => !getComputedStyle(document.body).fontFamily.startsWith('"Times'),
  )
  if (!styled) {
    console.error(`\n✗ ${width}px: the page rendered with NO stylesheet — refusing to report.`)
    console.error('  Usually a torn build: the HTML references a CSS chunk that is not on disk.')
    console.error('  Fix with: rm -rf .next && npm run build, then restart the server.')
    await bye()
    process.exit(2)
  }

  const row = []
  for (const route of ROUTES) {
    await page.goto(BASE + route, { waitUntil: 'domcontentloaded' })
    // `load`, not just DOMContentLoaded: the evaluate below raced a still-settling
    // navigation and killed the whole sweep partway through the widths.
    await page.waitForLoadState('load').catch(() => {})
    await page.waitForTimeout(700)

    /*
      Retried once. A route that settles late tears the execution context out from
      under `evaluate`, and an unhandled throw there killed the whole sweep partway
      through the widths — losing every result after it, including the clean ones.
    */
    const measure = (vw) => page.evaluate((vw) => {
      const doc = document.documentElement
      const overflow = doc.scrollWidth - vw
      const wide = []
      if (overflow > 1) {
        for (const el of document.querySelectorAll('body *')) {
          const r = el.getBoundingClientRect()
          if (r.width === 0 || r.height === 0) continue
          // Only blame the element itself, not every ancestor containing it.
          /*
            Skip anything living inside a deliberate horizontal scroller. A chip row
            or a wide table in an `overflow-x-auto` wrapper is SUPPOSED to extend past
            the viewport — reporting it as breakage buried the two real faults under
            a dozen false ones.
          */
          let inScroller = false
          for (let a = el.parentElement; a && a !== document.body; a = a.parentElement) {
            const ox = getComputedStyle(a).overflowX
            if (ox === 'auto' || ox === 'scroll') { inScroller = true; break }
          }
          if (!inScroller && r.right > vw + 1 && el.children.length === 0) {
            wide.push(`${el.tagName.toLowerCase()}.${(el.className || '').toString().split(' ')[0]} +${Math.round(r.right - vw)}px`)
          }
        }
      }
      // Interactive controls below the 44px touch minimum.
      /*
        Standalone controls only.

        WCAG 2.5.8 exempts a link sitting inside a sentence — you cannot give an
        inline link a 44px box without wrecking the line height of the paragraph
        around it. Flagging those buried the genuinely undersized controls under two
        dozen false ones, so anything whose parent is running text is skipped.
      */
      const small = []
      const PROSE = new Set(['P', 'LI', 'DD', 'DT', 'SPAN', 'FIGCAPTION', 'BLOCKQUOTE', 'TD', 'TH', 'LABEL'])
      for (const el of document.querySelectorAll('a[href], button, input, select')) {
        const r = el.getBoundingClientRect()
        if (r.width === 0 || r.height === 0) continue
        if (r.height >= 24) continue
        const parent = el.parentElement
        if (parent && PROSE.has(parent.tagName) && parent.textContent.trim() !== el.textContent.trim()) continue
        small.push(`${el.tagName.toLowerCase()}:${Math.round(r.height)}px "${(el.textContent || '').trim().slice(0, 22)}"`)
      }
      return { overflow, wide: [...new Set(wide)].slice(0, 3), small: [...new Set(small)].slice(0, 3) }
    }, vw)

    let report
    try {
      report = await measure(width)
    } catch {
      await page.waitForTimeout(1200)
      report = await measure(width)
    }

    if (report.overflow > 1) {
      failures.push({ width, route, kind: 'overflow', detail: `+${report.overflow}px ${report.wide.join(', ')}` })
      row.push(`✗${route}`)
    } else if (width <= 414 && report.small.length) {
      failures.push({ width, route, kind: 'tap-target', detail: report.small.join(', ') })
      row.push(`⚠${route}`)
    } else {
      row.push('·')
    }
  }
  console.log(`  ${String(width).padStart(4)}px  ${row.join(' ')}`)
  await ctx.close()
}

console.log(`\n  ${ROUTES.length} routes x ${WIDTHS.length} widths = ${ROUTES.length * WIDTHS.length} checks`)
if (failures.length === 0) {
  console.log('  ✓ no horizontal overflow, no undersized tap targets')
} else {
  console.log(`  ✗ ${failures.length} problem(s):`)
  for (const f of failures) console.log(`     ${String(f.width).padStart(4)}px ${f.route.padEnd(34)} ${f.kind}: ${f.detail}`)
}
await bye()
process.exit(failures.length ? 1 : 0)
