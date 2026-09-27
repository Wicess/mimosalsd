import { BRAND } from '@/lib/brand'

/**
 * The company's email address. There is exactly ONE.
 *
 * The owner's rule (2026-09-11): the whole business has a single address,
 * sales@snypegate.com, and every place the site shows, links, routes or replies from
 * an email uses it. The site used to carry orders@, support@ and wholesale@ — role
 * addresses that were never real mailboxes, so anything sent to them was lost.
 *
 * It is set in Admin → Settings and read from one place. Pages and routes read it with
 * `getCompanyEmail()` (company-email.server.ts); copy written ahead of time — email
 * templates, the FAQ, the policies — carries `COMPANY_EMAIL_TOKEN` where the address
 * goes, and the token is filled in at the moment the copy is rendered or sent.
 *
 * This file is pure so client components, the proxy and tests can use it.
 */

export const COMPANY_EMAIL_KEY = 'company.email'

/** Cache tag for everything read from site settings. Saving a setting invalidates it. */
export const SITE_SETTINGS_TAG = 'site-settings'

/** Used until an address is saved in the admin, and wherever the database cannot be reached. */
export const DEFAULT_COMPANY_EMAIL: string = BRAND.email

/** Written into prepared copy where the address goes; replaced when the copy is used. */
export const COMPANY_EMAIL_TOKEN = '[[company-email]]'

/*
 * Deliberately narrower than RFC 5321: letters, digits and . _ % + - before the @, a
 * normal domain after it. Nothing that needs escaping in HTML, a header or a mailto
 * link can pass, which is what lets the address be dropped into all three raw.
 */
const EMAIL_PATTERN =
  /^[a-z0-9](?:[a-z0-9._%+-]{0,62}[a-z0-9])?@(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,24}$/

/** A usable address, trimmed and lower-cased — or null. */
export function normaliseCompanyEmail(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const value = raw.trim().toLowerCase()
  return value.length <= 254 && EMAIL_PATTERN.test(value) ? value : null
}

/**
 * Fill the address into anything written with the token: a string, or arrays and
 * plain objects of strings, however deeply nested. Anything else passes through.
 */
export function fillCompanyEmail<T>(value: T, email: string): T {
  if (typeof value === 'string') return value.replaceAll(COMPANY_EMAIL_TOKEN, email) as T
  if (Array.isArray(value)) return value.map((entry) => fillCompanyEmail(entry, email)) as T
  if (value !== null && typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype) {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [key, fillCompanyEmail(entry, email)]),
    ) as T
  }
  return value
}
