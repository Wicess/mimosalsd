import { describe, expect, it } from 'vitest'
import { CONTACT_PROMISE, formatPhone } from '@/lib/invoices/data'
import { newOrderAlertBody } from '@/lib/orders/new-order-alert'
import type { Order } from '@/lib/orders/types'

const order = {
  firstName: 'Dana',
  lastName: 'Whitfield',
  email: 'dana@example.test',
  phone: '5035550142',
  addressLine1: '1 Pine St',
  city: 'Portland',
  postalCode: '97201',
  items: [{ productName: 'Root Bark', variantName: '1 lb', quantity: 2, lineTotalCents: 6000 }],
  subtotalCents: 6000,
  shippingCents: 995,
  discountCents: 0,
  subscriberDiscountCents: 600,
  appDiscountCents: 0,
  paymentDiscountCents: 0,
  totalCents: 6395,
  preferredPaymentMethod: 'CASHAPP',
} as unknown as Order

describe('the new-order push', () => {
  it('leads with the phone number and lists the order', () => {
    const body = newOrderAlertBody(order, 'Oregon')
    expect(body.split('\n')[0]).toBe('Phone: (503) 555-0142')
    expect(body).toContain('2 x Root Bark (1 lb) - $60')
    expect(body).toContain('Ship to: 1 Pine St, Portland, Oregon 97201')
    expect(body).toContain('Discounts: -$6')
    expect(body).toContain('Total: $63.95')
  })

  it('keeps the phone number when a very long order is cut', () => {
    const long = { ...order, items: Array.from({ length: 200 }, () => order.items[0]!) } as Order
    const body = newOrderAlertBody(long, 'Oregon')
    expect(body.length).toBeLessThanOrEqual(3800)
    expect(body.startsWith('Phone: (503) 555-0142')).toBe(true)
  })
})

describe('what the invoice shows', () => {
  it('formats a US number and leaves anything else as typed', () => {
    expect(formatPhone('+1 (503) 555.0142')).toBe('(503) 555-0142')
    expect(formatPhone('+44 20 7946 0958')).toBe('+44 20 7946 0958')
  })

  it('names the app, SMS and email', () => {
    expect(CONTACT_PROMISE).toMatch(/MIMOSALSD app.*SMS.*email/)
  })
})
