import type { UsJurisdictionCode } from './types'

/**
 * The 50 states + DC. US market only — there is no international commerce in this build.
 * `slug` is the canonical URL segment for /legality/[state] and must never change once
 * published (Step 3 URL taxonomy).
 */
export interface Jurisdiction {
  readonly code: UsJurisdictionCode
  readonly name: string
  readonly slug: string
  readonly isState: boolean
}

export const JURISDICTIONS: readonly Jurisdiction[] = [
  { code: 'AL', name: 'Alabama', slug: 'alabama', isState: true },
  { code: 'AK', name: 'Alaska', slug: 'alaska', isState: true },
  { code: 'AZ', name: 'Arizona', slug: 'arizona', isState: true },
  { code: 'AR', name: 'Arkansas', slug: 'arkansas', isState: true },
  { code: 'CA', name: 'California', slug: 'california', isState: true },
  { code: 'CO', name: 'Colorado', slug: 'colorado', isState: true },
  { code: 'CT', name: 'Connecticut', slug: 'connecticut', isState: true },
  { code: 'DE', name: 'Delaware', slug: 'delaware', isState: true },
  { code: 'DC', name: 'District of Columbia', slug: 'district-of-columbia', isState: false },
  { code: 'FL', name: 'Florida', slug: 'florida', isState: true },
  { code: 'GA', name: 'Georgia', slug: 'georgia', isState: true },
  { code: 'HI', name: 'Hawaii', slug: 'hawaii', isState: true },
  { code: 'ID', name: 'Idaho', slug: 'idaho', isState: true },
  { code: 'IL', name: 'Illinois', slug: 'illinois', isState: true },
  { code: 'IN', name: 'Indiana', slug: 'indiana', isState: true },
  { code: 'IA', name: 'Iowa', slug: 'iowa', isState: true },
  { code: 'KS', name: 'Kansas', slug: 'kansas', isState: true },
  { code: 'KY', name: 'Kentucky', slug: 'kentucky', isState: true },
  { code: 'LA', name: 'Louisiana', slug: 'louisiana', isState: true },
  { code: 'ME', name: 'Maine', slug: 'maine', isState: true },
  { code: 'MD', name: 'Maryland', slug: 'maryland', isState: true },
  { code: 'MA', name: 'Massachusetts', slug: 'massachusetts', isState: true },
  { code: 'MI', name: 'Michigan', slug: 'michigan', isState: true },
  { code: 'MN', name: 'Minnesota', slug: 'minnesota', isState: true },
  { code: 'MS', name: 'Mississippi', slug: 'mississippi', isState: true },
  { code: 'MO', name: 'Missouri', slug: 'missouri', isState: true },
  { code: 'MT', name: 'Montana', slug: 'montana', isState: true },
  { code: 'NE', name: 'Nebraska', slug: 'nebraska', isState: true },
  { code: 'NV', name: 'Nevada', slug: 'nevada', isState: true },
  { code: 'NH', name: 'New Hampshire', slug: 'new-hampshire', isState: true },
  { code: 'NJ', name: 'New Jersey', slug: 'new-jersey', isState: true },
  { code: 'NM', name: 'New Mexico', slug: 'new-mexico', isState: true },
  { code: 'NY', name: 'New York', slug: 'new-york', isState: true },
  { code: 'NC', name: 'North Carolina', slug: 'north-carolina', isState: true },
  { code: 'ND', name: 'North Dakota', slug: 'north-dakota', isState: true },
  { code: 'OH', name: 'Ohio', slug: 'ohio', isState: true },
  { code: 'OK', name: 'Oklahoma', slug: 'oklahoma', isState: true },
  { code: 'OR', name: 'Oregon', slug: 'oregon', isState: true },
  { code: 'PA', name: 'Pennsylvania', slug: 'pennsylvania', isState: true },
  { code: 'RI', name: 'Rhode Island', slug: 'rhode-island', isState: true },
  { code: 'SC', name: 'South Carolina', slug: 'south-carolina', isState: true },
  { code: 'SD', name: 'South Dakota', slug: 'south-dakota', isState: true },
  { code: 'TN', name: 'Tennessee', slug: 'tennessee', isState: true },
  { code: 'TX', name: 'Texas', slug: 'texas', isState: true },
  { code: 'UT', name: 'Utah', slug: 'utah', isState: true },
  { code: 'VT', name: 'Vermont', slug: 'vermont', isState: true },
  { code: 'VA', name: 'Virginia', slug: 'virginia', isState: true },
  { code: 'WA', name: 'Washington', slug: 'washington', isState: true },
  { code: 'WV', name: 'West Virginia', slug: 'west-virginia', isState: true },
  { code: 'WI', name: 'Wisconsin', slug: 'wisconsin', isState: true },
  { code: 'WY', name: 'Wyoming', slug: 'wyoming', isState: true },
] as const

const BY_CODE = new Map(JURISDICTIONS.map((j) => [j.code, j]))
const BY_SLUG = new Map(JURISDICTIONS.map((j) => [j.slug, j]))

export function getJurisdiction(code: string): Jurisdiction | undefined {
  return BY_CODE.get(code.toUpperCase() as UsJurisdictionCode)
}

export function getJurisdictionBySlug(slug: string): Jurisdiction | undefined {
  return BY_SLUG.get(slug.toLowerCase())
}

export function jurisdictionName(code: UsJurisdictionCode): string {
  return BY_CODE.get(code)?.name ?? code
}
