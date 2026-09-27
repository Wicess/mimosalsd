import { describe, expect, it } from 'vitest'
import {
  bulkEnquiryAcknowledgementEmail,
  bulkEnquiryNotificationEmail,
  type BulkEnquiry,
} from '@/lib/mail/templates'
import { COMPANY_EMAIL_TOKEN } from '@/lib/site/company-email'

const enquiry: BulkEnquiry = {
  name: 'Dana Whitfield',
  company: 'Riverbend Dyeworks',
  email: 'dana@example.com',
  phone: '(512) 555-0134',
  stateCode: 'Oregon',
  categories: ['Mimosa Hostilis Root Bark'],
  products: ['Mimosa Hostilis Root Bark Powder'],
  volume: '50 – 200 units',
  cadence: 'Quarterly',
  message: 'Do you quote on a standing quarterly order?',
}

describe('bulk enquiry email', () => {
  it('routes to the company inbox and replies to the enquirer', () => {
    // Hitting reply on the notification must reach the customer. Getting this
    // backwards turns every lead into a copy-and-paste step.
    const mail = bulkEnquiryNotificationEmail(enquiry)
    // The one company address, filled in by the mailer at send time.
    expect(mail.to).toBe(COMPANY_EMAIL_TOKEN)
    expect(mail.replyTo).toBe(enquiry.email)
  })

  it('carries the four things a quote actually needs', () => {
    const { text, html } = bulkEnquiryNotificationEmail(enquiry)
    for (const fragment of ['50 – 200 units', 'Quarterly', 'Oregon', 'Mimosa Hostilis Root Bark Powder']) {
      expect(text, fragment).toContain(fragment)
      expect(html, fragment).toContain(fragment)
    }
  })

  it('sends the enquirer their own selection back', () => {
    const mail = bulkEnquiryAcknowledgementEmail(enquiry)
    expect(mail.to).toBe(enquiry.email)
    expect(mail.replyTo).toBe(COMPANY_EMAIL_TOKEN)
    expect(mail.text).toContain('50 – 200 units')
    expect(mail.html).toContain('Riverbend Dyeworks')
  })

  it('keeps the enquirer copy free of contact details they already have', () => {
    // Echoing someone's own phone number back at them is noise, and it is one
    // more place the number exists if the mailbox is ever compromised.
    const mail = bulkEnquiryAcknowledgementEmail(enquiry)
    expect(mail.text).not.toContain('(512) 555-0134')
  })

  it('promises a reply and never a price', () => {
    // A number sent before a human has looked is a number we would have to walk
    // back, and the quote depends on the destination state.
    const mail = bulkEnquiryAcknowledgementEmail(enquiry)
    expect(mail.text).toContain('within one business day')
    expect(mail.text).not.toMatch(/\$\d/)
  })

  it('survives an enquiry with nothing optional filled in', () => {
    const bare: BulkEnquiry = {
      name: 'Sam',
      email: 'sam@example.com',
      phone: '5125550134',
      volume: 'Not sure yet',
      categories: [],
      products: [],
    }
    const mail = bulkEnquiryNotificationEmail(bare)
    expect(mail.subject).toContain('Sam')
    expect(mail.text).toContain('Not specified')
    expect(mail.html).toContain('Not specified')
  })
})
