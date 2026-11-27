import { describe, expect, it } from 'vitest'
import {
  checkAnyPhone,
  checkEmail,
  checkUsPhone,
  validateCheckoutFields,
  validateContactFields,
} from '@/lib/forms/fields'

const filledCheckout = {
  email: 'dyer@example.com',
  phone: '(555) 123-4567',
  firstName: 'Ada',
  lastName: 'Lovelace',
  addressLine1: '1 Main St',
  city: 'Norco',
  stateCode: 'CA',
  postalCode: '92860',
  intendedUseConfirmed: 'on',
}

describe('checkUsPhone', () => {
  it('accepts a 10-digit number in any common format', () => {
    for (const ok of ['5551234567', '(555) 123-4567', '555-123-4567', '+1 555 123 4567', '1-555-123-4567', '555.123.4567']) {
      expect(checkUsPhone(ok), ok).toBeNull()
    }
  })
  it('says what is wrong when it is not', () => {
    expect(checkUsPhone('')).toMatch(/Enter your phone number/)
    expect(checkUsPhone('555-1234')).toMatch(/10-digit/)
    expect(checkUsPhone('call me maybe')).toMatch(/numbers only/)
    expect(checkUsPhone('(055) 123-4567')).toMatch(/area code/)
  })
})

describe('checkAnyPhone', () => {
  it('accepts international numbers and refuses fragments', () => {
    expect(checkAnyPhone('+44 20 7946 0958')).toBeNull()
    expect(checkAnyPhone('(555) 123-4567')).toBeNull()
    expect(checkAnyPhone('12345')).toMatch(/full phone number/)
    expect(checkAnyPhone('')).toMatch(/Enter your phone number/)
  })
})

describe('checkEmail', () => {
  it('accepts a normal address, trimmed', () => {
    expect(checkEmail('  dyer@example.com ')).toBeNull()
  })
  it('refuses empty and malformed ones with a direction', () => {
    expect(checkEmail('')).toMatch(/Enter your email/)
    expect(checkEmail('dyer@example')).toMatch(/like name@example.com/)
    expect(checkEmail('dyer example.com')).toMatch(/like name@example.com/)
  })
})

describe('validateCheckoutFields', () => {
  it('passes a complete form', () => {
    expect(validateCheckoutFields(filledCheckout, { requiresIntendedUse: true })).toEqual({})
  })
  it('names every missing field, including phone and email', () => {
    const empty = Object.fromEntries(Object.keys(filledCheckout).map((k) => [k, ''])) as typeof filledCheckout
    expect(Object.keys(validateCheckoutFields(empty, { requiresIntendedUse: true })).sort()).toEqual(
      ['addressLine1', 'city', 'email', 'firstName', 'intendedUseConfirmed', 'lastName', 'phone', 'postalCode', 'stateCode'].sort(),
    )
  })
  it('asks for the intended-use box only when the cart needs it', () => {
    const unticked = { ...filledCheckout, intendedUseConfirmed: '' }
    expect(validateCheckoutFields(unticked, { requiresIntendedUse: false })).toEqual({})
    expect(validateCheckoutFields(unticked, { requiresIntendedUse: true })).toHaveProperty('intendedUseConfirmed')
  })
  it('checks the ZIP format', () => {
    expect(validateCheckoutFields({ ...filledCheckout, postalCode: '9286' }, { requiresIntendedUse: false })).toHaveProperty('postalCode')
    expect(validateCheckoutFields({ ...filledCheckout, postalCode: '92860-1234' }, { requiresIntendedUse: false })).toEqual({})
  })
})

describe('validateContactFields', () => {
  it('requires a phone number alongside name, email and message', () => {
    const errors = validateContactFields({ name: 'Ada', email: 'dyer@example.com', phone: '', message: 'How much is a pound of powder?' })
    expect(Object.keys(errors)).toEqual(['phone'])
  })
})
