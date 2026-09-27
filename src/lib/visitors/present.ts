import { jurisdictionName } from '@/lib/compliance/jurisdictions'
import type { UsJurisdictionCode } from '@/lib/compliance/types'
import { subdivisionName } from '@/lib/geo/subdivisions'

/**
 * How a visitor record reads in the admin. Shared by the list and the detail page
 * so a place or a source is never spelled two ways.
 */

interface Place {
  readonly country: string | null
  readonly region: string | null
  readonly city: string | null
  readonly postalCode?: string | null
}

const COUNTRY_NAMES = (() => {
  try {
    return new Intl.DisplayNames(['en'], { type: 'region' })
  } catch {
    return null
  }
})()

/** A two-letter country code as its English name: "US" → "United States". */
export function countryName(code: string | null | undefined): string | null {
  if (!code) return null
  try {
    return COUNTRY_NAMES?.of(code.toUpperCase()) ?? code
  } catch {
    return code
  }
}

/**
 * The state, province or region, written out in full: "Texas", "Lagos", "Ontario",
 * "São Paulo".
 *
 * US states (and DC and the territories) come from the jurisdiction list the rest of
 * the site uses. Everywhere else the host's ISO 3166-2 code is looked up in the
 * subdivision table (lib/geo/subdivisions.ts). A code that is in neither stays as
 * given rather than disappearing, so a place is never silently less precise.
 */
export function regionFullName(country: string | null | undefined, region: string | null | undefined): string | null {
  if (!region) return null
  if (country === 'US') {
    const state = jurisdictionName(region as UsJurisdictionCode)
    if (state && state !== region) return state
  }
  return subdivisionName(country, region) ?? region
}

/** Written out in full, no abbreviations: "San Antonio, Texas 78201, United States". */
export function placeOf(v: Place): string {
  const region = regionFullName(v.country, v.region)
  const regionAndZip = [region, v.postalCode].filter(Boolean).join(' ')
  const parts = [v.city, regionAndZip, countryName(v.country)]
  return parts.filter(Boolean).join(', ') || 'Unknown place'
}

/** The local time where they are, from the IANA time zone the lookup gave. */
export function localTimeIn(timezone: string | null | undefined, at: Date = new Date()): string | null {
  if (!timezone) return null
  try {
    return new Intl.DateTimeFormat('en-US', { timeZone: timezone, hour: 'numeric', minute: '2-digit', timeZoneName: 'long' }).format(at)
  } catch {
    return null
  }
}

/**
 * A stored region key as a name: "US-TX" → "Texas"; outside the US the country is
 * added, because "Lagos" alone in a list of states does not say where it is:
 * "NG-LA" → "Lagos, Nigeria".
 */
export function regionName(key: string): string {
  const cut = key.indexOf('-')
  if (cut < 1) return key
  const country = key.slice(0, cut)
  const region = key.slice(cut + 1)
  const name = regionFullName(country, region) ?? region
  return country === 'US' ? name : [name, countryName(country)].filter(Boolean).join(', ')
}

export function deviceOf(v: {
  readonly device: string | null
  readonly browser: string | null
  readonly os: string | null
}): string {
  return [v.device, v.browser, v.os].filter(Boolean).join(' · ') || 'Unknown device'
}

export function sourceOf(v: { readonly utmSource: string | null; readonly referrer: string | null }): string {
  if (v.utmSource) return `${v.utmSource} (campaign)`
  return v.referrer ?? 'Direct'
}

export function stamp(date: Date): string {
  return `${date.toISOString().slice(0, 16).replace('T', ' ')} UTC`
}
