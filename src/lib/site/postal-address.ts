import { BRAND } from '@/lib/brand'

/**
 * The business's postal address, for the footer of every marketing email.
 *
 * CAN-SPAM requires a valid physical postal address — a street address, a USPS box
 * or a registered private mailbox — in every commercial email, so blasts refuse to
 * send without one. It used to live only in src/lib/brand.ts, which meant the owner
 * could not send a single blast without a developer editing code. It is set in
 * Admin → Settings now, like the company email, and read from one place.
 *
 * Nothing here invents one. Until an address is saved, the default is whatever
 * brand.ts holds — empty — and blasts keep refusing, which is the lawful outcome.
 *
 * Pure, so tests and client code can use it.
 */

export const POSTAL_ADDRESS_KEY = 'company.postalAddress'

/** Used until an address is saved in the admin, and wherever the database cannot be reached. */
export const DEFAULT_POSTAL_ADDRESS: string = BRAND.postalAddress

export const POSTAL_ADDRESS_LIMITS = { min: 10, max: 200 } as const

/*
  A US ZIP: five digits, optionally ZIP+4. The shop is US-only (CLAUDE.md rule 14),
  and requiring one is what turns "TBD", "123" or "coming soon" into an error at the
  keyboard rather than a false statement at the bottom of an email to the whole list.
*/
const ZIP = /\b\d{5}(?:-\d{4})?\b/

const hasControlCharacter = (value: string) =>
  [...value].some((char) => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127)

/**
 * One line, as it appears in an email footer — or null when it could not be a real
 * address. A pasted multi-line address is joined with commas.
 */
export function normalisePostalAddress(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const value = raw
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+/g, ' ').trim().replace(/,+$/, ''))
    .filter(Boolean)
    .join(', ')
  if (value.length < POSTAL_ADDRESS_LIMITS.min || value.length > POSTAL_ADDRESS_LIMITS.max) return null
  if (hasControlCharacter(value)) return null
  if (!/[a-z]/i.test(value) || !ZIP.test(value)) return null
  return value
}
