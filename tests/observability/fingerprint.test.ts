import { describe, expect, it } from 'vitest'
import {
  describeThrown,
  fingerprintOf,
  normaliseMessage,
  redact,
} from '@/lib/observability/fingerprint'

/**
 * These two behaviours decide whether the error log is usable.
 *
 * Get grouping wrong and one bug becomes ten thousand rows, which is both a database
 * bill and a table nobody can read. Get redaction wrong and a Brevo key or a Neon
 * password is sitting in a table any STAFF user with the errors area can open.
 */

describe('redact', () => {
  it('strips a Brevo API key out of a message', () => {
    const message = 'Brevo responded 401: {"key":"xkeysib-e04d225ca298b085cf9ff7717fb181d9-5pIiR3apFypIsrBG"}'
    const cleaned = redact(message)
    expect(cleaned).not.toContain('5pIiR3apFypIsrBG')
    expect(cleaned).toContain('[redacted]')
  })

  it('strips a Neon password from a connection string but keeps the host', () => {
    const cleaned = redact(
      'connect failed: postgresql://neondb_owner:npg_SuperSecret123@ep-lingering-glade.aws.neon.tech/neondb',
    )
    expect(cleaned).not.toContain('npg_SuperSecret123')
    // The host is the diagnostic half. Redacting the whole URL would defeat the point.
    expect(cleaned).toContain('ep-lingering-glade.aws.neon.tech')
  })

  it('strips bearer tokens and api-key headers', () => {
    expect(redact('Authorization: Bearer abcdef0123456789abcdef')).not.toContain(
      'abcdef0123456789abcdef',
    )
    expect(redact('api-key: 8f3a9d2b7c1e4f6a8b0d')).not.toContain('8f3a9d2b7c1e4f6a8b0d')
  })

  it('strips a long hex run, which is always a key or a session blob', () => {
    const hex = 'a'.repeat(64)
    expect(redact(`session=${hex}`)).not.toContain(hex)
  })

  it('leaves an ordinary message untouched', () => {
    const message = 'Cannot read properties of undefined (reading name)'
    expect(redact(message)).toBe(message)
  })
})

describe('normaliseMessage', () => {
  it('collapses the identifiers that differ between occurrences of one bug', () => {
    const a = normaliseMessage('Order 202608-A1B2C3 not found for buyer@example.com')
    const b = normaliseMessage('Order 202609-D4E5F6 not found for other@example.com')
    expect(a).toBe(b)
  })

  it('keeps genuinely different messages apart', () => {
    expect(normaliseMessage('Order not found')).not.toBe(
      normaliseMessage('Payment handle exhausted'),
    )
  })
})

describe('fingerprintOf', () => {
  const base = { source: 'render', name: 'TypeError', message: 'x is not a function' }

  it('is stable for the same failure', () => {
    expect(fingerprintOf(base)).toBe(fingerprintOf({ ...base }))
  })

  it('groups the same bug across different ids', () => {
    expect(fingerprintOf({ ...base, message: 'Order abc123 missing' })).toBe(
      fingerprintOf({ ...base, message: 'Order zzz999 missing' }),
    )
  })

  it('separates the same message thrown from different sources', () => {
    // A mail failure and a render failure with identical text are different bugs and
    // need different urgency. Merging them would hide one behind the other.
    expect(fingerprintOf(base)).not.toBe(fingerprintOf({ ...base, source: 'mail' }))
  })

  it('separates the same error on different routes', () => {
    expect(fingerprintOf({ ...base, routePath: '/product/[slug]' })).not.toBe(
      fingerprintOf({ ...base, routePath: '/legality/[state]' }),
    )
  })

  it('produces a fixed-width hex key', () => {
    expect(fingerprintOf(base)).toMatch(/^[0-9a-f]{16}$/)
  })
})

describe('describeThrown', () => {
  it('reads name, message and stack off an Error', () => {
    const error = new TypeError('boom')
    const described = describeThrown(error)
    expect(described.name).toBe('TypeError')
    expect(described.message).toBe('boom')
    expect(described.stack).toContain('TypeError')
  })

  it('carries the Next digest through when there is one', () => {
    const error = Object.assign(new Error('server error'), { digest: '1234567890' })
    expect(describeThrown(error).digest).toBe('1234567890')
  })

  it('redacts a secret in the message and the stack', () => {
    const error = new Error('failed with xkeysib-e04d225ca298b085cf9ff7717fb181d9-abcdef')
    const described = describeThrown(error)
    expect(described.message).not.toContain('abcdef')
  })

  it('survives a thrown string, a thrown object and a thrown null', () => {
    // Nothing guarantees a throw is an Error, and the reporter must never be the thing
    // that throws while handling something that already did.
    expect(describeThrown('just a string').message).toBe('just a string')
    expect(describeThrown({ message: 'from an object' }).message).toBe('from an object')
    expect(describeThrown(null).name).toBe('UnknownError')
    expect(describeThrown(undefined).message).toBe('undefined')
  })

  it('survives a circular object without throwing', () => {
    const circular: Record<string, unknown> = { name: 'Weird' }
    circular.self = circular
    expect(() => describeThrown(circular)).not.toThrow()
    expect(describeThrown(circular).name).toBe('Weird')
  })
})
