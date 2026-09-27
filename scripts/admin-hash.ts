#!/usr/bin/env tsx
/**
 * Generate the admin credential. `npm run admin:hash -- 'your password'`
 *
 * Prints the two environment values to set. The password itself is never written
 * anywhere — only its scrypt hash.
 */
import { randomBytes } from 'node:crypto'
import { hashPassword } from '../src/lib/admin/password'

const password = process.argv[2]
if (!password || password.length < 12) {
  console.error('Usage: npm run admin:hash -- "<password of at least 12 characters>"')
  process.exit(1)
}

console.log('\nAdd these to .env (and to your Vercel environment):\n')
console.log(`ADMIN_PASSWORD_HASH="${hashPassword(password)}"`)
console.log(`ADMIN_SESSION_SECRET="${randomBytes(32).toString('base64')}"`)
console.log('')
