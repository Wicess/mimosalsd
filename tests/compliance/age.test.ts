import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  calculateAge,
  dateOfBirthSchema,
  isCrawler,
  meetsMinimumAge,
  StubAgeVerifier,
} from '@/lib/compliance/age'

const NOW = new Date('2026-08-28T12:00:00Z')

describe('age arithmetic', () => {
  it('calculates age correctly', () => {
    expect(calculateAge(new Date('2000-08-28'), NOW)).toBe(26)
  })

  it('does not credit a birthday that has not happened yet this year', () => {
    expect(calculateAge(new Date('2005-08-29'), NOW)).toBe(20)
    expect(calculateAge(new Date('2005-08-28'), NOW)).toBe(21)
  })

  it('gates on the exact 21st birthday', () => {
    expect(meetsMinimumAge(new Date('2005-08-28'), 21, NOW)).toBe(true)
    expect(meetsMinimumAge(new Date('2005-08-29'), 21, NOW)).toBe(false)
  })
})

describe('date of birth validation', () => {
  it('accepts a real date', () => {
    expect(dateOfBirthSchema.safeParse({ day: 28, month: 8, year: 2000 }).success).toBe(true)
  })

  it('rejects 31 February', () => {
    expect(dateOfBirthSchema.safeParse({ day: 31, month: 2, year: 2000 }).success).toBe(false)
  })

  it('rejects an out-of-range month', () => {
    expect(dateOfBirthSchema.safeParse({ day: 1, month: 13, year: 2000 }).success).toBe(false)
  })
})

describe('crawler pass-through', () => {
  it('recognises search crawlers so the age gate never hides content from them', () => {
    for (const ua of [
      'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
      'Mozilla/5.0 (compatible; bingbot/2.0)',
    ]) {
      expect(isCrawler(ua)).toBe(true)
    }
  })

  it('recognises AI crawlers — they are a primary growth channel here', () => {
    for (const ua of ['GPTBot/1.1', 'ClaudeBot/1.0', 'PerplexityBot/1.0', 'CCBot/2.0']) {
      expect(isCrawler(ua)).toBe(true)
    }
  })

  it('does not treat a real browser as a crawler', () => {
    expect(
      isCrawler('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15'),
    ).toBe(false)
  })

  it('handles a missing user agent', () => {
    expect(isCrawler(null)).toBe(false)
    expect(isCrawler(undefined)).toBe(false)
  })
})

describe('StubAgeVerifier', () => {
  const request = {
    firstName: 'Test',
    lastName: 'Buyer',
    dateOfBirth: new Date('1990-01-01'),
    addressLine1: '1 Main St',
    city: 'Austin',
    stateCode: 'TX',
    postalCode: '78701',
    minimumAge: 21,
  }

  it('passes an adult and records evidence', async () => {
    const record = await new StubAgeVerifier().verify(request)
    expect(record.result).toBe('PASS')
    expect(record.method).toBe('SELF_DECLARED_DOB')
    expect(record.verifiedAt).toBeInstanceOf(Date)
  })

  it('fails a minor', async () => {
    const record = await new StubAgeVerifier().verify({
      ...request,
      dateOfBirth: new Date('2010-01-01'),
    })
    expect(record.result).toBe('FAIL')
  })

  afterEach(() => vi.unstubAllEnvs())

  it('refuses to run in production rather than silently downgrading', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    await expect(new StubAgeVerifier().verify(request)).rejects.toThrow(/never run in production/)
  })
})
