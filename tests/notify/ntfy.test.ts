import { describe, expect, it } from 'vitest'
import { headerSafe } from '@/lib/notify/ntfy'

/**
 * Regression cover for a bug the error reporter found in production code on its first
 * live push: an em-dash in a notification title made `fetch` throw, and the alert was
 * lost silently. Header values must be a ByteString.
 */
describe('headerSafe', () => {
  it('folds the typographic characters that break fetch', () => {
    expect(headerSafe('FATAL in action — /checkout')).toBe('FATAL in action - /checkout')
    expect(headerSafe('Order ‘cancelled’')).toBe("Order 'cancelled'")
    expect(headerSafe('Loading…')).toBe('Loading...')
  })

  it('keeps Latin-1 accents, which headers accept', () => {
    // Folding these would mangle real customer and product names for no reason.
    expect(headerSafe('Café Crème')).toBe('Café Crème')
  })

  it('replaces anything else above Latin-1 rather than throwing', () => {
    expect(headerSafe('alert ✓ 中')).toBe('alert ? ?')
  })

  it('produces a value fetch will accept as a header', () => {
    const folded = headerSafe('FATAL — ✓ 中 …')
    expect(() => new Headers({ Title: folded })).not.toThrow()
    expect([...folded].every((c) => c.charCodeAt(0) <= 0xff)).toBe(true)
  })

  it('leaves a plain ASCII title untouched', () => {
    expect(headerSafe('Order 202609-A1B2C3 received')).toBe('Order 202609-A1B2C3 received')
  })
})
