import { describe, expect, it } from 'vitest'
import { clientIpFrom, normaliseIp } from '@/lib/security/client-ip'

describe('normaliseIp', () => {
  it('keeps a plain IPv4 address as it is', () => {
    expect(normaliseIp('203.0.113.7')).toBe('203.0.113.7')
    expect(normaliseIp('  203.0.113.7  ')).toBe('203.0.113.7')
  })

  /*
    The blocklist is exact-match. Two spellings of one IPv6 address that did not
    normalise to the same string would make a block silently do nothing.
  */
  it('gives every spelling of an IPv6 address one form', () => {
    const canonical = '2001:db8::1'
    for (const spelling of ['2001:DB8:0:0:0:0:0:1', '2001:db8:0::1', '[2001:db8::1]', '2001:0db8::0001']) {
      expect(normaliseIp(spelling)).toBe(canonical)
    }
  })

  it('treats an IPv4-mapped IPv6 address as the IPv4 address it is', () => {
    expect(normaliseIp('::ffff:203.0.113.7')).toBe('203.0.113.7')
    expect(normaliseIp('::FFFF:203.0.113.7')).toBe('203.0.113.7')
  })

  it('refuses anything that is not exactly one address', () => {
    for (const bad of [
      '',
      'localhost',
      '256.1.1.1',
      '01.2.3.4', // leading zero: octal to some parsers, decimal to others
      '0x7f.0.0.1',
      '203.0.113.0/24', // ranges are deliberately not supported
      '203.0.113.7, 198.51.100.1',
      'fe80::1%eth0',
    ]) {
      expect(normaliseIp(bad), bad).toBeNull()
    }
  })
})

describe('clientIpFrom', () => {
  const h = (init: Record<string, string>) => new Headers(init)

  it('takes the first x-forwarded-for entry, which is the connecting client', () => {
    expect(clientIpFrom(h({ 'x-forwarded-for': '203.0.113.7, 10.0.0.1' }))).toBe('203.0.113.7')
  })

  it('falls back to x-real-ip', () => {
    expect(clientIpFrom(h({ 'x-real-ip': '2001:DB8::7' }))).toBe('2001:db8::7')
  })

  it('returns null when there is no usable address', () => {
    expect(clientIpFrom(h({}))).toBeNull()
    expect(clientIpFrom(h({ 'x-forwarded-for': 'unknown' }))).toBeNull()
  })
})
