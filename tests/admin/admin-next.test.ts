import { describe, expect, it } from 'vitest'
import { safeAdminNext } from '@/lib/admin/areas'

describe('safeAdminNext — where sign-in may send the operator', () => {
  it('follows a notification link into the admin', () => {
    expect(safeAdminNext('/admin/orders/202609-K7Q4M9/payment', 'SUPERADMIN', [])).toBe('/admin/orders/202609-K7Q4M9/payment')
    expect(safeAdminNext('/admin/messages?thread=cmtz4abc123def', 'ADMIN', [])).toBe('/admin/messages?thread=cmtz4abc123def')
  })

  it.each([
    ['an external URL', 'https://evil.example/admin'],
    ['a protocol-relative URL', '//evil.example/admin'],
    ['a backslash trick', '/admin\\@evil.example'],
    ['a path outside the admin', '/order/abc'],
    ['a look-alike prefix', '/administrator'],
    ['the sign-in page itself', '/admin/login'],
    ['nothing', undefined],
  ])('refuses %s', (_label, value) => {
    expect(safeAdminNext(value as string | undefined, 'SUPERADMIN', [])).toBeUndefined()
  })

  it('refuses an area the operator is not granted', () => {
    expect(safeAdminNext('/admin/orders/202609-K7Q4M9', 'STAFF', ['messages'])).toBeUndefined()
  })
})
