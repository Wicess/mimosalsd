import { createHmac } from 'node:crypto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { ADMIN_SESSION_COOKIE, ADMIN_SESSION_TTL_MS, adminSessionCookieOptions } from '@/lib/admin/session-policy'

vi.mock('@/lib/visitors/track', () => ({ trackVisit: vi.fn() }))

const SECRET = 's'.repeat(40)
const DAY = 24 * 60 * 60 * 1000

function token(session: Record<string, unknown>, secret = SECRET): string {
  const payload = Buffer.from(JSON.stringify(session)).toString('base64url')
  return `${payload}.${createHmac('sha256', secret).update(payload).digest('base64url')}`
}
function request(cookie?: string) {
  return new NextRequest('https://www.mimosalsd.com/admin/orders', {
    headers: cookie ? { cookie: `${ADMIN_SESSION_COOKIE}=${cookie}` } : {},
  })
}
const read = (t: string) => JSON.parse(Buffer.from(t.split('.')[0]!, 'base64url').toString()) as Record<string, unknown>

describe('admin sessions stay signed in while used (owner, 2026-10-17)', () => {
  beforeEach(() => vi.stubEnv('ADMIN_SESSION_SECRET', SECRET))
  afterEach(() => vi.unstubAllEnvs())

  it('lasts 90 days and is Lax, so a tap on a notification from another app carries it', () => {
    expect(ADMIN_SESSION_TTL_MS).toBe(90 * DAY)
    expect(adminSessionCookieOptions()).toMatchObject({ sameSite: 'lax', httpOnly: true, maxAge: 90 * 24 * 60 * 60 })
  })

  it('renews a session that is more than a day old, keeping who it is and what it may do', async () => {
    const { renewedAdminToken } = await import('@/proxy')
    const session = { userId: 'u1', email: 'o@x.test', role: 'SUPERADMIN', adminAreas: [], issuedAt: 1, expiresAt: Date.now() + ADMIN_SESSION_TTL_MS - 2 * DAY }
    const renewed = renewedAdminToken(request(token(session)))
    expect(renewed).not.toBeNull()
    const next = read(renewed!)
    expect(next).toMatchObject({ userId: 'u1', email: 'o@x.test', role: 'SUPERADMIN', issuedAt: 1 })
    expect(next.expiresAt as number).toBeGreaterThan(Date.now() + ADMIN_SESSION_TTL_MS - 60_000)
  })

  it('leaves a session renewed today alone', async () => {
    const { renewedAdminToken } = await import('@/proxy')
    expect(renewedAdminToken(request(token({ role: 'SUPERADMIN', expiresAt: Date.now() + ADMIN_SESSION_TTL_MS - 1000 })))).toBeNull()
  })

  it('never renews an expired, missing or forged session', async () => {
    const { renewedAdminToken } = await import('@/proxy')
    expect(renewedAdminToken(request())).toBeNull()
    expect(renewedAdminToken(request(token({ role: 'SUPERADMIN', expiresAt: Date.now() - 1 })))).toBeNull()
    expect(renewedAdminToken(request(token({ role: 'SUPERADMIN', expiresAt: Date.now() + DAY }, 'x'.repeat(40))))).toBeNull()
  })
})
