/**
 * The rules for the fields a customer types into: checkout and the contact form.
 *
 * Owner, 2026-11-23: neither form may submit until the phone number, the email and
 * every other required field is filled in properly, with an error that says what to
 * do. These functions are that rule, ONCE: the forms run them in the browser before
 * submitting (so a mistake is caught without a round trip), and the server actions
 * run the same functions again (so a request that skips the browser is refused with
 * the same words). Each returns the message to show, or null when the value is fine.
 *
 * Plain functions with no imports, so they are safe in a client component and in a
 * server action alike.
 */

export type FieldErrors = Record<string, string>

const digitsOf = (value: string) => value.replace(/\D/g, '')

export function checkEmail(value: string): string | null {
  const v = value.trim()
  if (!v) return 'Enter your email address. We send your order details there.'
  if (v.length > 200) return 'That email address is too long.'
  // Deliberately loose: one @, something on both sides, a dot in the domain. The real
  // test is whether mail arrives; a stricter pattern only refuses unusual but valid ones.
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)) return 'Enter a valid email address, like name@example.com.'
  return null
}

/**
 * A US phone number: checkout delivers to US addresses only. Ten digits, an optional
 * leading 1, any spacing, brackets or dashes. Area codes never start with 0 or 1.
 */
export function checkUsPhone(value: string): string | null {
  const v = value.trim()
  if (!v) return 'Enter your phone number, so we can reach you about this order.'
  if (/[^\d\s()+.-]/.test(v)) return 'Use numbers only. Spaces, dashes and brackets are fine.'
  const d = digitsOf(v)
  const national = d.length === 11 && d.startsWith('1') ? d.slice(1) : d
  if (national.length !== 10) return 'Enter a 10-digit US phone number, like (555) 123-4567.'
  if (/^[01]/.test(national)) return 'That area code is not valid. Check the first three digits.'
  return null
}

/** Any phone number, for the contact form, which people may send from abroad. */
export function checkAnyPhone(value: string): string | null {
  const v = value.trim()
  if (!v) return 'Enter your phone number, so we can call you back if email does not reach you.'
  if (/[^\d\s()+.-]/.test(v)) return 'Use numbers only. Spaces, dashes, brackets and a leading + are fine.'
  const d = digitsOf(v)
  if (d.length < 7 || d.length > 15) return 'Enter a full phone number, with the area code (and the country code if outside the US).'
  return null
}

function required(value: string, message: string, min = 1): string | null {
  return value.trim().length >= min ? null : message
}

/** What checkout reads from its form, as strings ("" when a field is empty). */
export interface CheckoutFieldValues {
  readonly email: string
  readonly phone: string
  readonly firstName: string
  readonly lastName: string
  readonly addressLine1: string
  readonly city: string
  readonly stateCode: string
  readonly postalCode: string
  /** "on" when the box is ticked. */
  readonly intendedUseConfirmed: string
}

/** The order the fields appear in on the page: the first error is focused. */
export const CHECKOUT_FIELD_ORDER = [
  'email',
  'phone',
  'firstName',
  'lastName',
  'addressLine1',
  'city',
  'stateCode',
  'postalCode',
  'intendedUseConfirmed',
] as const

export function validateCheckoutFields(
  v: CheckoutFieldValues,
  { requiresIntendedUse }: { requiresIntendedUse: boolean },
): FieldErrors {
  const checks: [string, string | null][] = [
    ['email', checkEmail(v.email)],
    ['phone', checkUsPhone(v.phone)],
    ['firstName', required(v.firstName, 'Enter your first name.')],
    ['lastName', required(v.lastName, 'Enter your last name.')],
    ['addressLine1', required(v.addressLine1, 'Enter your street address, with the house or building number.', 3)],
    ['city', required(v.city, 'Enter your city or town.')],
    ['stateCode', /^[A-Z]{2}$/.test(v.stateCode.trim()) ? null : 'Choose the state we are delivering to.'],
    [
      'postalCode',
      /^\d{5}(-\d{4})?$/.test(v.postalCode.trim()) ? null : 'Enter a 5-digit ZIP code, like 90210.',
    ],
    [
      'intendedUseConfirmed',
      requiresIntendedUse && v.intendedUseConfirmed !== 'on'
        ? 'Tick the box to confirm the intended use of the botanical material in your order.'
        : null,
    ],
  ]
  return Object.fromEntries(checks.filter((c): c is [string, string] => c[1] !== null))
}

export interface ContactFieldValues {
  readonly name: string
  readonly email: string
  readonly phone: string
  readonly message: string
}

export const CONTACT_FIELD_ORDER = ['name', 'email', 'phone', 'message'] as const

export function validateContactFields(v: ContactFieldValues): FieldErrors {
  const checks: [string, string | null][] = [
    ['name', required(v.name, 'Tell us your name.', 2)],
    ['email', checkEmail(v.email)],
    ['phone', checkAnyPhone(v.phone)],
    ['message', required(v.message, 'Write your message: at least a sentence, so we can answer properly.', 10)],
  ]
  return Object.fromEntries(checks.filter((c): c is [string, string] => c[1] !== null))
}

/** The line above a form that refused to submit: how many fields need attention. */
export function fixFieldsMessage(count: number): string {
  return count === 1
    ? 'One field needs your attention before we can send this. It is marked in red below.'
    : `${count} fields need your attention before we can send this. They are marked in red below.`
}

/** Reads a form's fields as strings, for the validators above. */
export function formValues<K extends string>(form: HTMLFormElement, names: readonly K[]): Record<K, string> {
  const data = new FormData(form)
  return Object.fromEntries(names.map((n) => [n, String(data.get(n) ?? '')])) as Record<K, string>
}
