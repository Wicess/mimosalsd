import type { UsJurisdictionCode } from '@/lib/compliance/types'

/**
 * ─────────────────────────────────────────────────────────────────────────────
 *  PHYSICAL LOCATIONS
 *
 *  This is the half of local SEO that is genuinely local, and it is what makes
 *  same-day delivery a real promise rather than a marketing claim.
 *
 *  TWO RULES, both non-negotiable:
 *
 *  1. A page exists ONLY for a location that physically exists. Inventing locations
 *     to farm "[product] in [city]" queries is precisely the doorway pattern Google
 *     penalises, and it is also fraud.
 *
 *  2. NAP (name, address, phone) must match the Google Business Profile
 *     byte-for-byte. NAP inconsistency is the most common local-SEO killer, and it is
 *     entirely self-inflicted.
 *
 *  `isPublished` defaults to false. A location does not go live until its address is
 *  real, its GBP is claimed, and the two agree.
 * ─────────────────────────────────────────────────────────────────────────────
 */

export interface OpeningHours {
  readonly day: 'Mo' | 'Tu' | 'We' | 'Th' | 'Fr' | 'Sa' | 'Su'
  readonly opens: string
  readonly closes: string
}

export interface Location {
  readonly slug: string
  readonly name: string
  readonly addressLine1: string
  readonly addressLine2?: string
  readonly city: string
  readonly stateCode: UsJurisdictionCode
  readonly postalCode: string
  readonly phone: string
  readonly email?: string
  readonly latitude: number
  readonly longitude: number
  readonly hours: readonly OpeningHours[]
  /** Genuinely city-specific. Template filler here is what makes a doorway page. */
  readonly cityContent: string
  readonly isPickupPoint: boolean
  readonly offersSameDay: boolean
  readonly sameDayZips: readonly string[]
  readonly sameDayCutoff?: string
  readonly googlePlaceId?: string
  readonly isPublished: boolean
}

/**
 * PLACEHOLDER — deliberately unpublished.
 *
 * Replace with real addresses, phone numbers, hours and ZIP coverage, then set
 * isPublished. Until then nothing renders publicly, nothing enters the sitemap, and
 * the same-day promise is never shown.
 */
export const LOCATIONS: readonly Location[] = [
  {
    slug: 'austin-tx',
    name: 'Austin',
    addressLine1: 'PENDING — real street address required',
    city: 'Austin',
    stateCode: 'TX',
    postalCode: '78701',
    phone: 'PENDING',
    latitude: 30.2672,
    longitude: -97.7431,
    hours: [
      { day: 'Mo', opens: '10:00', closes: '18:00' },
      { day: 'Tu', opens: '10:00', closes: '18:00' },
      { day: 'We', opens: '10:00', closes: '18:00' },
      { day: 'Th', opens: '10:00', closes: '18:00' },
      { day: 'Fr', opens: '10:00', closes: '18:00' },
      { day: 'Sa', opens: '11:00', closes: '16:00' },
    ],
    cityContent: '',
    isPickupPoint: true,
    offersSameDay: true,
    sameDayZips: ['78701', '78702', '78703', '78704', '78705'],
    sameDayCutoff: '14:00',
    isPublished: false,
  },
]

export function publishedLocations(): readonly Location[] {
  return LOCATIONS.filter((l) => l.isPublished)
}

export function getLocation(slug: string): Location | undefined {
  return LOCATIONS.find((l) => l.slug === slug)
}

/** Reasons a location is not yet fit to publish. Surfaced in the admin, not hidden. */
export function publishBlockers(location: Location): readonly string[] {
  const blockers: string[] = []
  if (location.addressLine1.includes('PENDING')) blockers.push('Street address is a placeholder.')
  if (location.phone === 'PENDING') blockers.push('Phone number is a placeholder.')
  if (!location.googlePlaceId) {
    blockers.push('No Google Business Profile claimed — NAP cannot be verified as consistent.')
  }
  if (location.cityContent.trim().split(/\s+/).filter(Boolean).length < 150) {
    blockers.push(
      'Under 150 words of genuinely city-specific content. Template filler here is what makes a doorway page.',
    )
  }
  return blockers
}

/**
 * Same-day eligibility for a ZIP.
 *
 * Returns a reason on refusal so the UI can be honest rather than silent. Showing a
 * same-day promise we cannot keep is worse than not offering it.
 */
export function sameDayFor(postalCode: string):
  | { eligible: true; location: Location; cutoff: string }
  | { eligible: false; reason: string } {
  const zip = postalCode.trim().slice(0, 5)
  if (!/^\d{5}$/.test(zip)) {
    return { eligible: false, reason: 'Enter a five-digit ZIP code.' }
  }
  const match = publishedLocations().find(
    (l) => l.offersSameDay && l.sameDayZips.includes(zip),
  )
  if (!match) {
    return {
      eligible: false,
      reason:
        'Same-day delivery is not available at your ZIP code yet. Standard shipping still applies.',
    }
  }
  return { eligible: true, location: match, cutoff: match.sameDayCutoff ?? '14:00' }
}

/** LocalBusiness JSON-LD. NAP here must match the Google Business Profile exactly. */
export function localBusinessJsonLd(location: Location, brandName: string, siteUrl: string) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Store',
    name: `${brandName} ${location.name}`,
    address: {
      '@type': 'PostalAddress',
      streetAddress: location.addressLine1,
      addressLocality: location.city,
      addressRegion: location.stateCode,
      postalCode: location.postalCode,
      addressCountry: 'US',
    },
    telephone: location.phone,
    geo: {
      '@type': 'GeoCoordinates',
      latitude: location.latitude,
      longitude: location.longitude,
    },
    openingHoursSpecification: location.hours.map((h) => ({
      '@type': 'OpeningHoursSpecification',
      dayOfWeek: h.day,
      opens: h.opens,
      closes: h.closes,
    })),
    url: `${siteUrl.replace(/\/$/, '')}/locations/${location.slug}`,
  }
}
