import { describe, expect, it } from 'vitest'
import {
  emailButton,
  emailHeading,
  emailParagraph,
  emailQuote,
  emailRow,
  emailShell,
} from '@/lib/mail/layout'
import { graphite, citron } from '@/lib/design/tokens'
import { contactAcknowledgementEmail, contactNotificationEmail } from '@/lib/mail/templates'
import { COMPANY_EMAIL_TOKEN } from '@/lib/site/company-email'

const shell = emailShell({ title: 'T', preheader: 'P', body: emailParagraph('body') })

describe('the email shell', () => {
  /*
   * The one place in the codebase allowed to hardcode a colour, because a mail
   * client has never heard of our stylesheet and a CSS custom property there
   * resolves to nothing. This is the guard that stops those literals drifting
   * away from the palette they were copied from.
   */
  it('uses the light-theme palette, not a colour of its own', () => {
    expect(shell).toContain(graphite[950]) // foreground
    expect(shell).toContain(graphite[200]) // border
    expect(shell).toContain(graphite[50]) // surface-sunken
    expect(shell).toContain(citron[300]) // accent
  })

  it('carries a preheader so the inbox preview is not the logo', () => {
    expect(shell).toContain('P')
    // Hidden in the body — it is for the list view, not the message.
    expect(shell).toMatch(/display:none;max-height:0/)
  })

  it('declares a light colour scheme and a fixed content column', () => {
    expect(shell).toContain('name="color-scheme" content="light"')
    expect(shell).toContain('width="600"')
  })

  it('carries the FDA disclaimer on every message', () => {
    expect(shell).toContain('have not been evaluated by the Food and Drug Administration')
  })

  it('escapes anything a sender controls', () => {
    const hostile = '<script>alert(1)</script>'
    expect(emailQuote(hostile)).not.toContain('<script>')
    expect(emailParagraph(hostile)).not.toContain('<script>')
    expect(emailHeading(hostile)).not.toContain('<script>')
    expect(emailRow('k', hostile)).not.toContain('<script>')
    expect(emailButton(hostile, 'https://example.com')).not.toContain('<script>')
    expect(emailQuote(hostile)).toContain('&lt;script&gt;')
  })

  it('inlines every style, because Gmail strips the head', () => {
    // A <style> block would be silently dropped in some clients, taking the
    // whole layout with it.
    expect(shell).not.toContain('<style')
  })
})

describe('contact email', () => {
  const enquiry = {
    name: 'Dana Whitfield',
    email: 'dana@example.com',
    topic: 'bulk' as const,
    message: 'Do you quote on 10kg of shredded bark to Oregon?',
  }

  it('sends the sender a copy of their own words', () => {
    const mail = contactAcknowledgementEmail(enquiry)
    expect(mail.to).toBe(enquiry.email)
    expect(mail.text).toContain(enquiry.message)
    expect(mail.html).toContain('Do you quote on 10kg')
  })

  it('routes every enquiry to the one company inbox', () => {
    const mail = contactNotificationEmail(enquiry)
    expect(mail.to).toBe(COMPANY_EMAIL_TOKEN)
  })

  it('sets reply-to so support answers the customer, not itself', () => {
    // Hitting reply on the notification must reach the customer. Getting this
    // backwards turns every enquiry into a copy-and-paste step.
    expect(contactNotificationEmail(enquiry).replyTo).toBe(enquiry.email)
    expect(contactAcknowledgementEmail(enquiry).replyTo).toBe(COMPANY_EMAIL_TOKEN)
  })

  it('says the same thing in both bodies', () => {
    const mail = contactAcknowledgementEmail(enquiry)
    expect(mail.text).toContain('within one business day')
    expect(mail.html).toContain('within one business day')
  })
})
