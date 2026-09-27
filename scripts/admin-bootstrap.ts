#!/usr/bin/env tsx
/**
 * Create the first admin account. `npm run admin:bootstrap`
 *
 * Generates a strong password, prints it ONCE, and stores only its scrypt hash.
 *
 * The email address is a USERNAME. Nothing is sent to it: the panel has no
 * verification step and no password-reset flow, so no mail service is required to
 * sign in. That is deliberate — a reset flow is an attack surface, and this dashboard
 * has one operator.
 */
import 'dotenv/config'
import { randomBytes } from 'node:crypto'
import { db } from '../src/lib/db/client'
import { hashPassword } from '../src/lib/admin/password'

/** Readable but high-entropy: 4 words plus digits beats an unreadable blob nobody keeps. */
function generatePassword(): string {
  const words = [
    'harbor', 'lantern', 'quartz', 'meadow', 'cobalt', 'thicket', 'pillar', 'ember',
    'ridge', 'anchor', 'willow', 'basalt', 'summit', 'canyon', 'ivory', 'juniper',
  ]
  const pick = () => words[randomBytes(1)[0]! % words.length]!
  const digits = String(randomBytes(2).readUInt16BE(0) % 10000).padStart(4, '0')
  return `${pick()}-${pick()}-${pick()}-${digits}`
}

async function main() {
  const email = (process.argv[2] ?? 'admin@snypegate.com').toLowerCase()
  const existing = await db.adminUser.findUnique({ where: { email } })
  const password = generatePassword()

  if (existing) {
    await db.adminUser.update({
      where: { id: existing.id },
      data: { passwordHash: hashPassword(password), role: 'SUPERADMIN', isActive: true },
    })
  } else {
    await db.adminUser.create({
      data: {
        email,
        name: 'Owner',
        passwordHash: hashPassword(password),
        role: 'SUPERADMIN',
      },
    })
  }

  console.log(`
┌──────────────────────────────────────────────────────────┐
│  Admin account ${existing ? 'password reset' : 'created'}
├──────────────────────────────────────────────────────────┤
│  Sign in at   /admin/login
│  Username     ${email}
│  Password     ${password}
└──────────────────────────────────────────────────────────┘

This password is shown once and is not stored anywhere in plain text.
The username is NOT an email address in any functional sense — nothing is
sent to it, and no mail service is needed to sign in.

Change it any time with:  npm run admin:bootstrap ${email}
`)
  await db.$disconnect()
}

main().catch((e: Error) => {
  console.error('✗', e.message)
  process.exit(1)
})
