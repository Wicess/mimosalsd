import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'

/**
 * Password hashing. Pure, and deliberately free of `server-only` so the credential
 * generator script can use it — that script is a plain Node process, not an RSC.
 */

/** scrypt with a random salt, stored as `salt:hash`. */
export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex')
  const derived = scryptSync(password, salt, 64).toString('hex')
  return `${salt}:${derived}`
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, expected] = stored.split(':')
  if (!salt || !expected) return false
  const derived = scryptSync(password, salt, 64).toString('hex')
  // Constant-time comparison — a short-circuiting compare leaks the hash by timing.
  const a = Buffer.from(derived, 'hex')
  const b = Buffer.from(expected, 'hex')
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}
