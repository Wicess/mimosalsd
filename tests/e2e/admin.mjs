import { chromium } from 'playwright'

import { readFileSync } from 'node:fs'
import { randomBytes } from 'node:crypto'

/*
 * Credentials come from scripts/e2e-accounts.ts, not from constants in this file.
 * Committed passwords for rows on the live auth database are a real way in, so the
 * accounts are created per run and deleted afterwards.
 */
const CREDS = (() => {
  try {
    return JSON.parse(readFileSync('.e2e-credentials.json', 'utf8'))
  } catch {
    console.error('✗ run `npm run e2e:accounts create` first')
    process.exit(1)
  }
})()


const BASE = process.env.E2E_BASE_URL ?? 'http://localhost:3117'
const pass = (m) => console.log('  ✓', m)
const fail = (m) => { console.log('  ✗', m); failures.push(m) }
const failures = []

const browser = await chromium.launch({ args: ['--no-sandbox'] })

/*
 * Always close the browser, including on an unhandled throw or a signal.
 *
 * Without this, a suite that failed part-way left its Chromium processes running.
 * Repeated runs accumulated 40+ of them, exhausted swap, and started OOM-killing the
 * dev server — which then looked like application instability rather than test
 * cleanup. A leaked browser is a slow-motion outage.
 */
const shutdown = async (code) => {
  await browser.close().catch(() => {})
  process.exit(code)
}
process.on('uncaughtException', async (e) => {
  console.error('\n✗ uncaught:', e.message)
  await shutdown(1)
})
process.on('unhandledRejection', async (e) => {
  console.error('\n✗ unhandled rejection:', e instanceof Error ? e.message : String(e))
  await shutdown(1)
})
for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => shutdown(130))

/**
 * Wait for expected text rather than sleeping a fixed interval.
 *
 * Fixed sleeps produced false failures once the database held real demo data and
 * actions took longer — including one that reported an unconfirmed status change as
 * ACCEPTED when the assertion simply ran before the server replied. A test that cries
 * wolf about a compliance guard is worse than no test.
 */
async function seesText(scope, text, timeout = 20000) {
  const deadline = Date.now() + timeout
  while (Date.now() < deadline) {
    const body = await scope.textContent().catch(() => '')
    if (body && body.includes(text)) return true
    await new Promise((r) => setTimeout(r, 250))
  }
  return false
}

async function newPage() {
  const ctx = await browser.newContext()
  const page = await ctx.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(e.message))
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })
  return { page, ctx, errors }
}

async function signIn(page, email, password) {
  await page.goto(`${BASE}/admin/login`, { waitUntil: 'networkidle' })
  await page.fill('input[name="email"]', email)
  await page.fill('input[name="password"]', password)
  await Promise.all([
    page.waitForURL((u) => !u.pathname.endsWith('/login'), { timeout: 15000 }),
    page.click('main button[type="submit"]'),
  ])
}

// ── 1. Sign-in ──────────────────────────────────────────────────────────────
console.log('\n1. Authentication')
{
  const { page, ctx } = await newPage()
  await page.goto(`${BASE}/admin/login`, { waitUntil: 'networkidle' })
  await page.fill('input[name="email"]', CREDS.owner.email)
  await page.fill('input[name="password"]', 'wrong-password')
  await page.click('main button[type="submit"]')
  await page.waitForTimeout(2500)
  const err = await page.textContent('body')
  err.includes('Incorrect email or password')
    ? pass('wrong password rejected with a vague message')
    : fail('wrong password not rejected')
  await ctx.close()
}
{
  const { page, ctx } = await newPage()
  await signIn(page, CREDS.owner.email, CREDS.owner.password)
  page.url().includes('/admin') ? pass('correct credentials sign in') : fail('sign-in failed')
  await ctx.close()
}

// ── 2. Every page renders with no console errors ────────────────────────────
console.log('\n2. Page rendering (SUPERADMIN)')
const ROUTES = [
  '/admin', '/admin/analytics', '/admin/orders', '/admin/payments', '/admin/products',
  '/admin/categories', '/admin/customers', '/admin/cart-activity', '/admin/state-rules',
  '/admin/lab-batches', '/admin/reviews', '/admin/reports', '/admin/locations',
  '/admin/content', '/admin/announcements', '/admin/newsletter', '/admin/campaigns',
  '/admin/links', '/admin/messages', '/admin/visitors', '/admin/settings', '/admin/team',
]
{
  const { page, ctx, errors } = await newPage()
  await signIn(page, CREDS.owner.email, CREDS.owner.password)
  let clean = 0
  for (const route of ROUTES) {
    errors.length = 0
    const res = await page.goto(BASE + route, { waitUntil: 'networkidle' })
    const h1 = await page.textContent('h1').catch(() => null)
    const real = errors.filter((e) => !/favicon|Download the React/i.test(e))
    if (res?.status() === 200 && h1 && real.length === 0) clean++
    else fail(`${route} — status ${res?.status()} h1="${h1}" errors=${real.slice(0, 1)}`)
  }
  clean === ROUTES.length && pass(`all ${ROUTES.length} pages render clean with an <h1>`)
  await ctx.close()
}

// ── 3. Write paths ──────────────────────────────────────────────────────────
console.log('\n3. Write operations')
{
  const { page, ctx } = await newPage()
  await signIn(page, CREDS.owner.email, CREDS.owner.password)
  const stamp = Date.now().toString().slice(-6)

  // Announcement
  await page.goto(`${BASE}/admin/announcements`, { waitUntil: 'networkidle' })
  await page.click('summary')
  await page.fill('input[name="title"]', `Test announcement ${stamp}`)
  await page.fill('textarea[name="body"]', 'Shipping is running one day behind this week.')
  await page.click('details form button[type="submit"]')
  ;(await seesText(page.locator('body'), `Test announcement ${stamp}`))
    ? pass('announcement created and listed')
    : fail('announcement not created')

  // Lexicon gate on an announcement
  await page.goto(`${BASE}/admin/announcements`, { waitUntil: 'networkidle' })
  await page.click('summary')
  await page.fill('input[name="title"]', 'Health claim test')
  await page.fill('textarea[name="body"]', 'This product will cure your anxiety completely.')
  await page.click('details form button[type="submit"]')
  ;(await seesText(page.locator('body'), 'compliance lexicon'))
    ? pass('announcement with a health claim is refused by the lexicon')
    : fail('lexicon did NOT block a health claim in an announcement')

  // Tracking link
  await page.goto(`${BASE}/admin/links`, { waitUntil: 'networkidle' })
  await page.click('summary')
  await page.fill('input[name="label"]', `Forum thread ${stamp}`)
  await page.fill('input[name="slug"]', `e2e-forum-${stamp}`)
  // A path on this site: the form refuses off-site targets (an open redirect otherwise).
  await page.fill('input[name="targetUrl"]', '/shop')
  // The platform picker defaults to its first choice; the source is the platform now.
  await page.click('details form button[type="submit"]')
  ;(await seesText(page.locator('body'), `e2e-forum-${stamp}`))
    ? pass('tracking link created')
    : fail('tracking link not created')

  // Setting
  await page.goto(`${BASE}/admin/settings`, { waitUntil: 'networkidle' })
  // The settings page has several panels now; open the generic one by name.
  await page.locator('summary', { hasText: '+ Add or update a setting' }).click()
  await page.fill('input[name="key"]', `test.setting.${stamp}`)
  await page.fill('input[name="label"]', 'Test setting')
  await page.fill('textarea[name="value"]', 'A harmless operational value.')
  // The OPEN panel's button: the closed panels above it have submit buttons too.
  await page.click('details[open] form button[type="submit"]')
  ;(await seesText(page.locator('body'), `test.setting.${stamp}`))
    ? pass('setting saved')
    : fail('setting not saved')

  // Payment handle
  await page.goto(`${BASE}/admin/payments`, { waitUntil: 'networkidle' })
  await page.click('summary')
  await page.fill('input[name="handle"]', `$test${stamp}`)
  await page.click('details form button[type="submit"]')
  ;(await seesText(page.locator('body'), `$test${stamp}`))
    ? pass('payment handle added to the pool')
    : fail('payment handle not added')

  // Team member
  await page.goto(`${BASE}/admin/team`, { waitUntil: 'networkidle' })
  await page.click('summary')
  await page.fill('input[name="email"]', `new${stamp}@psychadelic.invalid`)
  await page.fill('input[name="name"]', 'New Operator')
  // Random: a literal here would be a published password for a real, working account
  // if a run ever crashed before the cleanup sweep.
  await page.fill('input[name="password"]', randomBytes(18).toString('base64url'))
  await page.check('input[value="orders"]')
  await page.click('details form button[type="submit"]')
  ;(await seesText(page.locator('body'), `new${stamp}@psychadelic.invalid`))
    ? pass('team member created with an area grant')
    : fail('team member not created')

  // Short password refused
  await page.goto(`${BASE}/admin/team`, { waitUntil: 'networkidle' })
  await page.click('summary')
  await page.fill('input[name="email"]', `weak${stamp}@psychadelic.invalid`)
  await page.fill('input[name="name"]', 'Weak')
  await page.fill('input[name="password"]', 'short')
  await page.click('details form button[type="submit"]')
  ;(await seesText(page.locator('body'), 'at least 12 characters'))
    ? pass('short password refused')
    : fail('short password accepted')

  await ctx.close()
}

// ── 3b. State rules — the highest-consequence write in the panel ────────────
console.log('\n3b. State rules (compliance)')
{
  const { page, ctx } = await newPage()
  await signIn(page, CREDS.owner.email, CREDS.owner.password)
  await page.goto(`${BASE}/admin/state-rules?show=restricted`, { waitUntil: 'networkidle' })

  // Open the Louisiana / Amanita rule — the one real prohibition in the catalogue.
  await page.getByRole('button', { name: /Louisiana/ }).first().click()
  await page.waitForSelector('input[name="statuteCitation"]', { timeout: 15000 })

  // A restriction with no statute must be refused: an unsourced refusal reads as
  // arbitrary, and the legality page will not publish without one.
  // Scope to the form that actually holds the field. An unscoped `form` selector
  // matches the sidebar's sign-out form first, which silently signs the test out.
  const ruleForm = page.locator('form:has(input[name="statuteCitation"])').first()
  const citation = ruleForm.locator('input[name="statuteCitation"]')
  const original = await citation.inputValue()
  await citation.fill('')
  await ruleForm.locator('input[name="reason"]').fill('e2e: clearing the citation')
  await ruleForm.locator('button[type="submit"]').click()
  ;(await seesText(ruleForm, 'must cite the statute'))
    ? pass('a blocked rule with no statute citation is refused')
    : fail('a rule was saved without a statute citation')

  // Restore and save legitimately.
  // REGRESSION: after a refused submit React resets the form. A controlled <select>
  // used to fall back to its first option, silently turning BLOCKED into ALLOWED.
  // The status is now the site Select, which posts through a hidden input.
  const statusAfterRefusal = await ruleForm.locator('input[name="status"]').inputValue()
  statusAfterRefusal === 'BLOCKED'
    ? pass('status survives a refused submit (does not silently reset to ALLOWED)')
    : fail(`status reset to ${statusAfterRefusal} after a refused submit`)

  await citation.fill(original || 'La. R.S. 40:989.1 (Act No. 159 of 2005)')
  await ruleForm.locator('input[name="reason"]').fill('e2e: restoring the citation')
  await ruleForm.locator('button[type="submit"]').click()
  ;(await seesText(ruleForm, 'updated'))
    ? pass('a valid state-rule edit saves')
    : fail('valid state-rule edit did not save')

  // An unconfirmed status change must be refused server-side.
  await ruleForm.locator('[role="combobox"]').first().click()
  await page.getByRole('option', { name: 'Allowed', exact: true }).click()
  await ruleForm.locator('input[name="reason"]').fill('e2e: unconfirmed status change')
  await ruleForm.locator('button[type="submit"]').click()
  ;(await seesText(ruleForm, 'Tick the confirmation box'))
    ? pass('an unconfirmed status change is refused')
    : fail('an unconfirmed status change was accepted')
  await ctx.close()
}

// ── 4. RBAC through the real UI ─────────────────────────────────────────────
console.log('\n4. RBAC (STAFF with orders + compliance)')
{
  const { page, ctx } = await newPage()
  await signIn(page, CREDS.staff.email, CREDS.staff.password)

  for (const [route, allowed] of [
    ['/admin/orders', true], ['/admin/state-rules', true], ['/admin/reports', true],
    ['/admin/team', false], ['/admin/payments', false], ['/admin/analytics', false],
    ['/admin/settings', false],
  ]) {
    await page.goto(BASE + route, { waitUntil: 'networkidle' })
    const landed = new URL(page.url()).pathname
    const reached = landed === route
    reached === allowed
      ? pass(`${route} ${allowed ? 'reachable' : `refused (→ ${landed})`}`)
      : fail(`${route} expected ${allowed ? 'allow' : 'deny'}, landed on ${landed}`)
  }

  await page.goto(`${BASE}/admin/orders`, { waitUntil: 'networkidle' })
  const nav = await page.textContent('nav[aria-label="Admin"]')
  !nav.includes('Team & access') && !nav.includes('Settings')
    ? pass('sidebar hides ungranted areas')
    : fail('sidebar shows areas the user cannot reach')
  await ctx.close()
}

// ── 5. Sign out ─────────────────────────────────────────────────────────────
console.log('\n5. Sign out')
{
  const { page, ctx } = await newPage()
  await signIn(page, CREDS.owner.email, CREDS.owner.password)
  await page.goto(`${BASE}/admin`, { waitUntil: 'networkidle' })
  await page.click('button:has-text("Sign out")')
  await page.waitForTimeout(2000)
  await page.goto(`${BASE}/admin`, { waitUntil: 'networkidle' })
  new URL(page.url()).pathname.includes('login')
    ? pass('sign out clears the session')
    : fail('still signed in after sign out')
  await ctx.close()
}

await browser.close()
console.log(`\n${failures.length === 0 ? '✓ ALL CHECKS PASSED' : `✗ ${failures.length} FAILURE(S)`}`)
failures.forEach((f) => console.log('   -', f))
process.exit(failures.length === 0 ? 0 : 1)
