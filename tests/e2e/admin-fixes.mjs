/**
 * Regression tests for the three admin defects, exercised against real demo data.
 *
 *   npm run db:demo && npm run test:e2e:fixes
 */
import { chromium } from 'playwright'

import { readFileSync } from 'node:fs'

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

/*
 * Poll for the expected text instead of sleeping a fixed interval.
 *
 * These assertions used `waitForTimeout(3000)` then read the DOM once. On a loaded
 * machine the server action had not rendered yet, so the suite reported working
 * behaviour as broken — including a false "an unconfirmed status change was accepted",
 * which is alarming and wrong. Poll for the condition; only a real timeout fails.
 */
async function seesText(scope, text, timeout = 20000) {
  const deadline = Date.now() + timeout
  for (;;) {
    const body = await scope.textContent().catch(() => '')
    if (body && body.includes(text)) return true
    if (Date.now() > deadline) return false
    await new Promise((r) => setTimeout(r, 250))
  }
}

const failures = []
const pass = (m) => console.log('  ✓', m)
const fail = (m) => { console.log('  ✗', m); failures.push(m) }

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

async function session() {
  const ctx = await browser.newContext()
  const page = await ctx.newPage()
  return { page, ctx }
}
async function signIn(page) {
  await page.goto(`${BASE}/admin/login`, { waitUntil: 'networkidle' })
  await page.fill('input[name="email"]', CREDS.owner.email)
  await page.fill('input[name="password"]', CREDS.owner.password)
  await Promise.all([
    page.waitForURL((u) => !u.pathname.endsWith('/login'), { timeout: 20000 }),
    page.click('main button[type="submit"]'),
  ])
}

// ── FIX 1: the age gate must never appear over the admin panel ──────────────
console.log('\nFIX 1 — age gate does not block the admin panel')
{
  const { page, ctx } = await session()
  await signIn(page)

  for (const route of ['/admin', '/admin/orders', '/admin/state-rules', '/admin/reviews']) {
    await page.goto(BASE + route, { waitUntil: 'networkidle' })
    // Give the deferred UI every chance to mount before declaring it absent.
    await page.waitForTimeout(2500)
    const gate = await page.locator('[role="dialog"]').count()
    const header = await page.locator('a[href="/shop/mimosa-hostilis"]').count()
    const footer = await page.getByText('Developed by').count()
    gate === 0 && header === 0 && footer === 0
      ? pass(`${route} — no age gate, no storefront header or footer`)
      : fail(`${route} — dialog=${gate} header=${header} footer=${footer}`)
  }

  // The admin must remain clickable: exercise a real control.
  await page.goto(`${BASE}/admin/orders`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(2500)
  const btn = page.locator('main button[type="submit"]').first()
  await btn.click({ timeout: 8000 }).then(
    () => pass('admin controls are clickable — nothing intercepts pointer events'),
    (e) => fail(`admin control not clickable: ${String(e).slice(0, 90)}`),
  )
  await ctx.close()
}

// ── The storefront must STILL have its chrome ───────────────────────────────
console.log('\n       …and the storefront still has its own chrome')
{
  const { page, ctx } = await session()
  await page.goto(`${BASE}/shop`, { waitUntil: 'networkidle' })
  await page
    .locator('[role="dialog"]')
    .first()
    .waitFor({ state: 'visible', timeout: 20000 })
    .catch(() => {})
  const gate = await page.locator('[role="dialog"]').count()
  const footer = await page.getByText('Developed by').count()
  gate === 1 ? pass('storefront still shows the age gate') : fail(`storefront age gate count = ${gate}`)
  footer >= 1 ? pass('storefront still shows the footer') : fail('storefront footer missing')
  await ctx.close()
}

// ── FIX 2: a database blip must not sign an operator out ────────────────────
console.log('\nFIX 2 — identity falls back to the signed session')
{
  const { page, ctx } = await session()
  await signIn(page)
  const landed = new URL(page.url()).pathname
  landed.startsWith('/admin') && !landed.includes('login')
    ? pass(`sign-in lands on ${landed} (previously bounced back to /login)`)
    : fail(`sign-in landed on ${landed}`)

  // Ten consecutive authenticated requests: any transient identity failure that
  // still redirected would show up as a bounce to /admin/login.
  let bounced = 0
  for (let i = 0; i < 10; i++) {
    await page.goto(`${BASE}/admin/orders`, { waitUntil: 'networkidle' })
    if (new URL(page.url()).pathname.includes('login')) bounced++
  }
  bounced === 0
    ? pass('10 consecutive authenticated requests, zero spurious sign-outs')
    : fail(`${bounced}/10 requests bounced to the login page`)

  // A write action must not sign the operator out either.
  await page.goto(`${BASE}/admin/announcements`, { waitUntil: 'networkidle' })
  await page.click('summary')
  await page.fill('input[name="title"]', 'Fix-check announcement')
  await page.fill('textarea[name="body"]', 'A perfectly ordinary operational notice for testing.')
  await page.click('details form button[type="submit"]')
  // Wait for proof the write landed. A bare sleep would pass even if nothing happened.
  const wrote = await seesText(page.locator('body'), 'Fix-check announcement')
  wrote && !new URL(page.url()).pathname.includes('login')
    ? pass('a write action does not sign the operator out')
    : fail(wrote ? 'submitting a form signed the operator out' : 'the write never landed')
  await ctx.close()
}

// ── FIX 3: a refused submit must not silently change a rule's status ────────
console.log('\nFIX 3 — status survives a refused submit; changes need confirming')
{
  const { page, ctx } = await session()
  await signIn(page)
  await page.goto(`${BASE}/admin/state-rules?show=restricted`, { waitUntil: 'networkidle' })
  await page.getByRole('button', { name: /Louisiana/ }).first().click()
  // The status is the site Select: a combobox button plus a hidden input it posts through.
  await page.waitForSelector('input[name="status"]', { state: 'attached' })

  const form = page.locator('form:has(input[name="status"])').first()
  const statusEl = form.locator('input[name="status"]')
  const citation = form.locator('input[name="statuteCitation"]')

  const before = await statusEl.inputValue()
  before === 'BLOCKED'
    ? pass('Louisiana / Amanita opens as BLOCKED')
    : fail(`opened as ${before}, expected BLOCKED`)

  // Force a refusal by clearing the citation.
  const original = await citation.inputValue()
  await citation.fill('')
  await form.locator('input[name="reason"]').fill('regression: clearing the citation')
  await form.locator('button[type="submit"]').click()
  ;(await seesText(form, 'must cite the statute'))
    ? pass('a blocked rule with no citation is refused')
    : fail('a rule was accepted without a citation')

  const after = await statusEl.inputValue()
  after === 'BLOCKED'
    ? pass('status is STILL BLOCKED after the refusal (was silently becoming ALLOWED)')
    : fail(`status became ${after} after a refused submit`)

  // Restore, and confirm the save succeeds without touching status.
  await citation.fill(original || 'La. R.S. 40:989.1 (Act No. 159 of 2005)')
  await form.locator('input[name="reason"]').fill('regression: restoring the citation')
  await form.locator('button[type="submit"]').click()
  ;(await seesText(form, 'updated'))
    ? pass('a valid edit saves')
    : fail('valid edit did not save')

  // Server-side guard: an unconfirmed status change must be refused.
  await form.locator('[role="combobox"]').first().click()
  await page.getByRole('option', { name: 'Allowed', exact: true }).click()
  await form.locator('input[name="reason"]').fill('regression: unconfirmed status change')
  await form.locator('button[type="submit"]').click()
  ;(await seesText(form, 'Tick the confirmation box'))
    ? pass('an unconfirmed status change is refused server-side')
    : fail('an unconfirmed status change was accepted')

  await ctx.close()
}

// ── The rule must be untouched afterwards ───────────────────────────────────
console.log('\n       …and Louisiana is still BLOCKED afterwards')
{
  const { page, ctx } = await session()
  await page.goto(`${BASE}/legality/louisiana`, { waitUntil: 'networkidle' })
  const body = await page.textContent('body')
  body.includes('cannot be shipped to Louisiana')
    ? pass('the public legality page still says Amanita cannot ship to Louisiana')
    : fail('the public legality page no longer blocks Amanita in Louisiana')
  await ctx.close()
}

await browser.close()
console.log(`\n${failures.length === 0 ? '✓ ALL REGRESSION CHECKS PASSED' : `✗ ${failures.length} FAILURE(S)`}`)
failures.forEach((f) => console.log('   -', f))
process.exit(failures.length === 0 ? 0 : 1)
