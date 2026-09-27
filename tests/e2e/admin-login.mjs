import { readdirSync, existsSync } from 'node:fs'
import { chromium } from 'playwright'

// Supply credentials via env; never commit them.
//   ADMIN_EMAIL=... ADMIN_PASSWORD=... node tests/e2e/admin-login.mjs
const BASE = process.env.E2E_BASE_URL ?? 'http://localhost:3117'
const EMAIL = process.env.ADMIN_EMAIL ?? 'admin@psychadelic.local'
const PASSWORD = process.env.ADMIN_PASSWORD
if (!PASSWORD) {
  console.error('✗ set ADMIN_PASSWORD (and optionally ADMIN_EMAIL) before running this suite')
  process.exit(1)
}
const browser = await chromium.launch()
const bye = async () => { await browser.close().catch(() => {}) }
for (const s of ['uncaughtException','unhandledRejection','SIGINT','SIGTERM']) process.on(s, async () => { await bye(); process.exit(1) })
let pass = 0, fail = 0
const check = (ok, label) => { console.log(`  ${ok ? '✓' : '✗'} ${label}`); ok ? pass++ : fail++ }

const page = await browser.newPage()
await page.goto('${BASE}/admin/login', { waitUntil: 'domcontentloaded' })
check(await page.locator('text=only a username').isVisible(), 'login page states the email is only a username')

await page.fill('#email', EMAIL)
await page.fill('#password', PASSWORD)
await page.click('form button[type="submit"]')
/*
 * Poll until the URL actually LEAVES the login page.
 *
 * A glob of admin-star is wrong here: it also matches /admin/login, so waitForURL
 * resolves instantly and the assertion runs before the redirect lands — reporting a
 * working sign-in as broken. Wait for the condition you actually mean.
 */
const leftLogin = await page
  .waitForFunction(() => !location.pathname.startsWith('/admin/login'), null, { timeout: 30000 })
  .then(() => true, () => false)
check(leftLogin, `signed in (landed on ${new URL(page.url()).pathname})`)
check((await page.context().cookies()).some((c) => c.name === 'admin_session'), 'session cookie issued')

/*
 * Every admin route must render for a SUPERADMIN.
 *
 * Enumerated from disk, not hand-listed: a hardcoded list silently rots as routes are
 * renamed, and then reports the test's own stale guesses as application 404s.
 */
const routes = readdirSync('src/app/admin', { withFileTypes: true })
  .filter((e) => e.isDirectory() && e.name !== 'login' && !e.name.startsWith('_'))
  .map((e) => `/${e.name}`)
  .filter((r) => existsSync(`src/app/admin${r}/page.tsx`))
  .concat('')
  .sort()
let ok = 0
for (const r of routes) {
  const res = await page.goto(`${BASE}/admin${r}`, { waitUntil: 'domcontentloaded' })
  // A 200 alone proves nothing — a bounce to /admin/login is also a 200.
  const landed = new URL(page.url()).pathname
  if (res && res.status() === 200 && !landed.startsWith('/admin/login')) ok++
  else console.log(`      ! /admin${r} -> ${res && res.status()} at ${landed}`)
}
check(ok === routes.length, `all ${routes.length} admin routes render 200 (${ok}/${routes.length})`)

// Wrong password must still be refused.
const p2 = await browser.newContext().then(c => c.newPage())
await p2.goto('${BASE}/admin/login', { waitUntil: 'domcontentloaded' })
await p2.fill('#email', EMAIL)
await p2.fill('#password', 'wrong-password-here')
await p2.click('form button[type="submit"]')
await p2.waitForTimeout(2500)
check(p2.url().includes('/login'), 'wrong password is refused')

// Signed-out user must not reach the panel.
const p3 = await browser.newContext().then(c => c.newPage())
const res3 = await p3.goto('${BASE}/admin/orders', { waitUntil: 'domcontentloaded' })
check(p3.url().includes('/login'), `signed-out request redirects to login (${res3.status()})`)

console.log(`\n  ${pass} passed, ${fail} failed`)
await bye()
process.exit(fail ? 1 : 0)
