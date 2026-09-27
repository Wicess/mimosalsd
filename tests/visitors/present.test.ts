import { describe, expect, it } from 'vitest'
import { deviceOf, placeOf, regionName, sourceOf, stamp } from '@/lib/visitors/present'

describe('how a visitor reads in the admin', () => {
  // The owner's rule: written in full, no abbreviations — the state and the country by name.
  it('names the state and the country in full', () => {
    expect(placeOf({ country: 'US', region: 'TX', city: 'Austin' })).toBe('Austin, Texas, United States')
    expect(placeOf({ country: 'CA', region: 'ON', city: 'Toronto' })).toBe('Toronto, Ontario, Canada')
    expect(placeOf({ country: 'US', region: null, city: null })).toBe('United States')
    expect(placeOf({ country: null, region: null, city: null })).toBe('Unknown place')
  })

  it('reads a stored region key', () => {
    expect(regionName('US-OK')).toBe('Oklahoma')
    expect(regionName('CA-ON')).toBe('Ontario, Canada')
    expect(regionName('NG-LA')).toBe('Lagos, Nigeria')
    expect(regionName('nonsense')).toBe('nonsense')
  })

  it('prefers the campaign tag to the referring site, and says direct when there is neither', () => {
    expect(sourceOf({ utmSource: 'newsletter', referrer: 'google.com' })).toBe('newsletter (campaign)')
    expect(sourceOf({ utmSource: null, referrer: 'google.com' })).toBe('google.com')
    expect(sourceOf({ utmSource: null, referrer: null })).toBe('Direct')
  })

  it('writes device and time plainly', () => {
    expect(deviceOf({ device: 'mobile', browser: 'Safari', os: 'iOS' })).toBe('mobile · Safari · iOS')
    expect(deviceOf({ device: null, browser: null, os: null })).toBe('Unknown device')
    expect(stamp(new Date('2026-09-11T14:05:09Z'))).toBe('2026-09-11 14:05 UTC')
  })
})

describe('placeOf, in full', () => {
  it('writes the state, ZIP code and country out in full', async () => {
    const { placeOf, regionFullName, countryName } = await import('@/lib/visitors/present')
    expect(placeOf({ city: 'San Antonio', region: 'TX', country: 'US', postalCode: '78201' })).toBe('San Antonio, Texas 78201, United States')
    expect(placeOf({ city: 'Yaoundé', region: 'CE', country: 'CM' })).toBe('Yaoundé, Centre, Cameroon')
    expect(placeOf({ city: null, region: null, country: null })).toBe('Unknown place')
    expect(regionFullName('US', null)).toBeNull()
    expect(countryName('gb')).toBe('United Kingdom')
  })
})

describe('regions outside the US, in full (owner, 2026-09-14)', () => {
  it('names the subdivision Vercel reports, for any country', async () => {
    const { placeOf, regionFullName } = await import('@/lib/visitors/present')
    expect(placeOf({ city: 'Lagos', region: 'LA', country: 'NG', postalCode: '100001' })).toBe('Lagos, Lagos 100001, Nigeria')
    expect(placeOf({ city: 'Sao Paulo', region: 'SP', country: 'BR' })).toBe('Sao Paulo, São Paulo, Brazil')
    expect(placeOf({ city: 'London', region: 'ENG', country: 'GB' })).toBe('London, England, United Kingdom')
    expect(regionFullName('KE', '30')).toBe('Nairobi City')
    expect(regionFullName('in', 'mh')).toBe('Mahārāshtra')
  })

  it('keeps a code it cannot name rather than dropping it', async () => {
    const { regionFullName } = await import('@/lib/visitors/present')
    expect(regionFullName('NG', 'ZZ')).toBe('ZZ')
    expect(regionFullName(null, 'LA')).toBe('LA')
    expect(regionFullName('US', 'DC')).toBe('District of Columbia')
  })
})
