import { describe, expect, it } from 'vitest'
import { generateOrderNumber, ORDER_ID_ALPHABET, ORDER_ID_PATTERN } from '@/lib/orders/repository'
import { isUniqueViolation } from '@/lib/db/errors'

describe('Order ID', () => {
  it('is YYYYMM- plus six Crockford base-32 characters', () => {
    const id = generateOrderNumber(new Date('2026-09-13T12:00:00Z'))
    expect(id).toMatch(/^202609-[0-9A-HJKMNP-TV-Z]{6}$/)
    expect(ORDER_ID_PATTERN.test(id)).toBe(true)
  })

  it('never uses the characters people misread: I, L, O, U', () => {
    const ids = Array.from({ length: 4000 }, () => generateOrderNumber())
    for (const id of ids) expect(id.slice(7)).not.toMatch(/[ILOU]/)
    expect(ORDER_ID_ALPHABET).toHaveLength(32)
    expect(new Set(ORDER_ID_ALPHABET).size).toBe(32)
  })

  it('uses the whole alphabet, so the space is 32^6 rather than a subset', () => {
    const seen = new Set<string>()
    for (let i = 0; i < 4000; i++) for (const ch of generateOrderNumber().slice(7)) seen.add(ch)
    expect(seen.size).toBe(32)
  })

  /*
    Six Crockford characters are 32^6 ≈ 1.07 billion IDs a month. Twenty thousand
    draws repeat one about 17% of the time (the birthday problem), which is what the
    retry on a unique violation in checkout is for — so "never repeats" was a coin
    that failed one run in six. What is checked is that repeats are as rare as
    uniform randomness makes them: about 0.19 expected here, and more than five would
    happen by chance about once in twenty million runs.
  */
  it('repeats no more often than uniform randomness would', () => {
    const draws = 20000
    const ids = new Set(Array.from({ length: draws }, () => generateOrderNumber()))
    expect(draws - ids.size).toBeLessThanOrEqual(5)
  })

  it('still accepts the old six-hex-character IDs, and lowercase typing', () => {
    expect(ORDER_ID_PATTERN.test('202608-A1B2C3')).toBe(true)
    expect(ORDER_ID_PATTERN.test('202609-k7q4m9')).toBe(true)
  })

  it('rejects anything else', () => {
    for (const bad of ['202609-K7Q4M', '202609-K7Q4M9X', '2026-K7Q4M9', '202609_K7Q4M9', '202609-K7Q4MO', '']) {
      expect(ORDER_ID_PATTERN.test(bad)).toBe(false)
    }
  })

  it('recognises a unique-index refusal, and nothing else, as a collision', () => {
    expect(isUniqueViolation({ code: 'P2002' })).toBe(true)
    expect(isUniqueViolation({ code: 'P2021' })).toBe(false)
    expect(isUniqueViolation(new Error('boom'))).toBe(false)
    expect(isUniqueViolation(null)).toBe(false)
  })
})
