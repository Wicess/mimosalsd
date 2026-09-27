#!/usr/bin/env tsx
/**
 * Provision throwaway admin accounts for the end-to-end suites.
 *
 *   npx tsx scripts/e2e-accounts.ts create   → writes .e2e-credentials.json
 *   npx tsx scripts/e2e-accounts.ts clean    → deletes the accounts and the file
 *
 * The suites used to sign in as fixed accounts with passwords committed to the repo.
 * Those rows lived on the same Neon database the real panel authenticates against, so
 * a published credential was a real way in. These are created per run with random
 * passwords and deleted afterwards; the credential file is gitignored.
 */
import 'dotenv/config'
import { randomBytes } from 'node:crypto'
import { writeFileSync, rmSync } from 'node:fs'
import { db } from '../src/lib/db/client'
import { hashPassword } from '../src/lib/admin/password'

const FILE = '.e2e-credentials.json'
/** Suffixed so a stray row is obviously test debris and never collides with a real one. */
const OWNER = 'e2e-owner@psychadelic.invalid'
const STAFF = 'e2e-staff@psychadelic.invalid'

async function create() {
  const creds = {
    owner: { email: OWNER, password: randomBytes(18).toString('base64url') },
    staff: { email: STAFF, password: randomBytes(18).toString('base64url') },
  }
  await db.adminUser.deleteMany({ where: { email: { in: [OWNER, STAFF] } } })
  await db.adminUser.create({
    data: {
      email: OWNER, name: 'E2E Owner', role: 'SUPERADMIN',
      passwordHash: hashPassword(creds.owner.password),
    },
  })
  await db.adminUser.create({
    data: {
      email: STAFF, name: 'E2E Staff', role: 'STAFF',
      adminAreas: ['orders', 'compliance'],
      passwordHash: hashPassword(creds.staff.password),
    },
  })
  writeFileSync(FILE, JSON.stringify(creds, null, 2))
  console.log(`✓ created ${OWNER} (SUPERADMIN) and ${STAFF} (STAFF: orders, compliance)`)
}

/*
 * Sweeps everything the suites create, not only the two accounts provisioned here.
 *
 * admin.mjs exercises the real "add team member" form, which leaves behind a WORKING
 * admin account whose password is written in the test file. Left unswept, every run
 * added another way into the live panel. The other rows are harmless but accumulate.
 */
async function clean() {
  const accounts = await db.adminUser.deleteMany({
    where: {
      OR: [{ email: { in: [OWNER, STAFF] } }, { email: { endsWith: '@psychadelic.invalid' } }],
    },
  })
  const announcements = await db.announcement.deleteMany({
    where: {
      OR: [
        { title: { startsWith: 'Test announcement ' } },
        { title: 'Fix-check announcement' },
        { title: { startsWith: 'Health claim ' } },
      ],
    },
  })
  const links = await db.trackingLink.deleteMany({ where: { slug: { startsWith: 'e2e-' } } })
  const settings = await db.setting.deleteMany({ where: { key: { startsWith: 'test.setting.' } } })
  const handles = await db.paymentHandle.deleteMany({ where: { handle: { startsWith: '$test' } } })

  rmSync(FILE, { force: true })
  console.log(
    `✓ swept ${accounts.count} account(s), ${announcements.count} announcement(s), ` +
      `${links.count} link(s), ${settings.count} setting(s), ${handles.count} handle(s)`,
  )
}

const cmd = process.argv[2]
const run = cmd === 'clean' ? clean : cmd === 'create' ? create : null
if (!run) {
  console.error('usage: e2e-accounts.ts <create|clean>')
  process.exit(1)
}
run()
  .then(() => db.$disconnect())
  .catch(async (e: Error) => {
    console.error('✗', e.message)
    await db.$disconnect()
    process.exit(1)
  })
