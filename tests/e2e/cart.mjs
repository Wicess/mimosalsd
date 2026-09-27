/**
 * Cart drawer, card add-to-cart, and the PDP buy actions, driven through a real browser.
 *
 *   E2E_BASE_URL=http://localhost:3000 node tests/e2e/cart.mjs
 *
 * Every assertion waits for its condition. An earlier version of this file queried
 * straight after `networkidle` and reported zero add-to-cart buttons on a page that
 * had twenty — `networkidle` says the network settled, not that React has hydrated
 * and attached the client components.
 */
import { chromium } from 'playwright'

const BASE = process.env.E2E_BASE_URL ?? 'http://localhost:3000'
const OUT = process.env.SHOT
const browser = await chromium.launch()
const bye = async () => { await browser.close().catch(() => {}) }
/*
 * Print the reason before dying.
 *
 * This handler used to exit(1) silently, so a suite that crashed on its first step
 * looked identical to one that simply stopped — no error, no stack, nothing to act
 * on. A cleanup handler that swallows the failure it is cleaning up after is worse
 * than no handler.
 */
for (const sig of ['uncaughtException', 'unhandledRejection'])
  process.on(sig, async (err) => {
    console.error(`\n✗ ${sig}:`, err?.stack ?? err)
    await bye()
    process.exit(1)
  })
for (const sig of ['SIGINT', 'SIGTERM'])
  process.on(sig, async () => { await bye(); process.exit(1) })

let pass = 0
let fail = 0
const check = (ok, label) => { console.log(`  ${ok ? '✓' : '✗'} ${label}`); ok ? pass++ : fail++ }
/** Polls a predicate; only a genuine timeout fails. */
async function waitFor(fn, timeout = 20000) {
  const deadline = Date.now() + timeout
  for (;;) {
    if (await fn().catch(() => false)) return true
    if (Date.now() > deadline) return false
    await new Promise((r) => setTimeout(r, 200))
  }
}

/*
 * Assert on the picker itself, not on the words "ship to".
 *
 * A loose text match here reported the picker as still present because the panel copy
 * now reads "what we can ship to your address" — the test matched the replacement for
 * the thing it was checking had been removed. The widget was a labelled <select> whose
 * first option read "Select a state…", so look for that.
 */
const pickerGone = async (page) =>
  (await page.getByRole('combobox', { name: /ship to/i }).count()) === 0 &&
  (await page.locator('option', { hasText: 'Select a state' }).count()) === 0

const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
const page = await ctx.newPage()
const errors = []
page.on('pageerror', (e) => errors.push(e.message.slice(0, 140)))

const dismissAgeGate = async () => {
  const yes = page.getByRole('button', { name: /Yes, I am/ })
  await yes.waitFor({ state: 'visible', timeout: 8000 }).catch(() => {})
  if (await yes.count()) { await yes.click(); await yes.waitFor({ state: 'hidden', timeout: 8000 }).catch(() => {}) }
}

console.log('Shop grid')
await page.goto(`${BASE}/shop`, { waitUntil: 'domcontentloaded' })
await dismissAgeGate()

const addButtons = page.getByRole('button', { name: 'Add to cart' })
const chooseLinks = page.getByRole('link', { name: 'Choose options' })
// Wait for hydration: the client button only exists once React has attached.
await waitFor(async () => (await addButtons.count()) + (await chooseLinks.count()) > 0)
const nAdd = await addButtons.count()
const nChoose = await chooseLinks.count()
check(nAdd + nChoose > 0, `cards carry an action (${nAdd} add-to-cart, ${nChoose} choose-options)`)
check(await pickerGone(page), '"Ship to" picker removed')

console.log('\nDrawer')
await addButtons.first().click()
const drawer = page.getByRole('dialog', { name: 'Your cart' })
check(await drawer.waitFor({ state: 'visible', timeout: 20000 }).then(() => true, () => false),
  'adding from a card opens the drawer')
check(await waitFor(async () => /Subtotal/.test(await drawer.innerText())), 'drawer shows a subtotal')
check(await waitFor(async () => /Continue to order request/.test(await drawer.innerText())),
  'drawer offers the order request')
if (OUT) await page.screenshot({ path: `${OUT}/cart-01-drawer.png` })

await page.keyboard.press('Escape')
check(await drawer.waitFor({ state: 'hidden', timeout: 10000 }).then(() => true, () => false),
  'Escape closes the drawer')

// The badge is server-rendered, so it needs a navigation to appear.
await page.reload({ waitUntil: 'domcontentloaded' })
// `locator('header')` is a strict-mode violation here — pages have their own section
// header as well as the site banner — and the thrown error was being swallowed as a
// plain failure, reporting a working badge as missing.
check(await waitFor(async () => /Cart\s*[1-9]/.test(await page.getByRole('banner').innerText())),
  'header shows an item count')

console.log('\nProduct page')
await page.goto(`${BASE}/product/mhrb-powder`, { waitUntil: 'domcontentloaded' })
await dismissAgeGate()
const addBtn = page.getByRole('button', { name: 'Add to cart' }).first()
const buyNow = page.getByRole('button', { name: 'Buy now' }).first()
check(await addBtn.waitFor({ state: 'visible', timeout: 20000 }).then(() => true, () => false), 'Add to cart present')
check(await buyNow.waitFor({ state: 'visible', timeout: 20000 }).then(() => true, () => false), 'Buy now present')
check(await pickerGone(page), '"Ship to" picker removed')
if (OUT) await page.screenshot({ path: `${OUT}/cart-02-pdp.png` })

console.log('\nBuy now → order request')
await buyNow.click()
check(await waitFor(async () => new URL(page.url()).pathname.startsWith('/checkout'), 25000),
  `Buy now lands on checkout (${new URL(page.url()).pathname})`)
check(await waitFor(async () => /state/i.test(await page.locator('body').innerText())),
  'checkout still collects the destination state (no picker needed)')

console.log('\nLab report width')
await page.goto(`${BASE}/lab-results/AM-2026-0455`, { waitUntil: 'domcontentloaded' })
await dismissAgeGate()
const main = page.locator('main').first()
await main.waitFor({ state: 'visible', timeout: 15000 })
const width = (await main.boundingBox())?.width ?? 0
check(width > 1000, `lab report spans the screen (main is ${Math.round(width)}px of 1440)`)
if (OUT) await page.screenshot({ path: `${OUT}/cart-03-lab.png` })

console.log(errors.length ? `\n⚠ page errors: ${[...new Set(errors)].slice(0, 3).join(' | ')}` : '\n✓ no page errors')
console.log(`\n  ${pass} passed, ${fail} failed`)
await ctx.close()
await bye()
process.exit(fail ? 1 : 0)
