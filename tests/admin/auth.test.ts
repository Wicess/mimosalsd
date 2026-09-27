import { afterEach, describe, expect, it, vi } from 'vitest'
import { createHmac } from 'node:crypto'
import { hashPassword, verifyPassword } from '@/lib/admin/password'

const SECRET = 'test-secret-at-least-thirty-two-characters-long'

function mint(expiresAt: number, secret = SECRET): string {
  const payload = Buffer.from(
    JSON.stringify({ issuedAt: Date.now(), expiresAt }),
  ).toString('base64url')
  const sig = createHmac('sha256', secret).update(payload).digest('base64url')
  return `${payload}.${sig}`
}

/**
 * Mirrors the check in src/proxy.ts.
 *
 * That check lives in the proxy because an earlier version lived in the admin layout
 * and did not work — every admin page returned 200 to an unauthenticated request,
 * because a layout render is shared across sibling routes and the redirect branch was
 * not re-evaluated per request. A layout is not a security boundary.
 */
function verify(token: string | undefined, secret = SECRET): boolean {
  if (!secret || secret.length < 32) return false
  if (!token) return false
  const [payload, signature] = token.split('.')
  if (!payload || !signature) return false
  const expected = createHmac('sha256', secret).update(payload).digest('base64url')
  const a = Buffer.from(signature)
  const b = Buffer.from(expected)
  if (a.length !== b.length || !a.equals(b)) return false
  try {
    const session = JSON.parse(Buffer.from(payload, 'base64url').toString()) as {
      expiresAt?: number
    }
    return typeof session.expiresAt === 'number' && Date.now() < session.expiresAt
  } catch {
    return false
  }
}

afterEach(() => vi.unstubAllEnvs())

describe('password hashing', () => {
  it('accepts the correct password', () => {
    const stored = hashPassword('a-strong-operator-password')
    expect(verifyPassword('a-strong-operator-password', stored)).toBe(true)
  })

  it('rejects a wrong password', () => {
    const stored = hashPassword('a-strong-operator-password')
    expect(verifyPassword('not-the-password', stored)).toBe(false)
  })

  it('salts, so identical passwords hash differently', () => {
    expect(hashPassword('same')).not.toBe(hashPassword('same'))
  })

  it('rejects a malformed stored hash rather than throwing', () => {
    for (const bad of ['', 'nosalt', ':', 'a:', ':b']) {
      expect(() => verifyPassword('x', bad)).not.toThrow()
      expect(verifyPassword('x', bad)).toBe(false)
    }
  })
})

describe('admin session verification', () => {
  it('accepts a validly signed, unexpired session', () => {
    expect(verify(mint(Date.now() + 60_000))).toBe(true)
  })

  it('rejects a missing or malformed token', () => {
    for (const bad of [undefined, '', 'nodot', 'a.b.c.d', '.sig', 'payload.']) {
      expect(verify(bad as string | undefined), String(bad)).toBe(false)
    }
  })

  it('rejects a token signed with a different secret', () => {
    const forged = mint(Date.now() + 60_000, 'a-completely-different-secret-value-here')
    expect(verify(forged)).toBe(false)
  })

  it('rejects a tampered payload', () => {
    const token = mint(Date.now() + 60_000)
    const [, sig] = token.split('.')
    const tampered = Buffer.from(
      JSON.stringify({ issuedAt: 0, expiresAt: Date.now() + 999_999_999 }),
    ).toString('base64url')
    expect(verify(`${tampered}.${sig}`)).toBe(false)
  })

  it('rejects an expired session even when the signature is valid', () => {
    expect(verify(mint(Date.now() - 1))).toBe(false)
  })

  it('rejects everything when the secret is too short to be safe', () => {
    expect(verify(mint(Date.now() + 60_000, 'short'), 'short')).toBe(false)
  })

  it('rejects a payload that is not JSON', () => {
    const payload = Buffer.from('not json at all').toString('base64url')
    const sig = createHmac('sha256', SECRET).update(payload).digest('base64url')
    expect(verify(`${payload}.${sig}`)).toBe(false)
  })
})
