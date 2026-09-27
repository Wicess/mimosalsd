import { readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  COMPANY_EMAIL_TOKEN,
  DEFAULT_COMPANY_EMAIL,
  fillCompanyEmail,
  normaliseCompanyEmail,
} from '@/lib/site/company-email'
import { FAQ_ITEMS } from '@/lib/content/faq'
import { POLICIES } from '@/lib/content/policies'
import {
  bulkEnquiryAcknowledgementEmail,
  bulkEnquiryNotificationEmail,
  contactAcknowledgementEmail,
  contactNotificationEmail,
} from '@/lib/mail/templates'

/**
 * The owner's rule: the company has ONE email address, contact@mimosalsd.com, set in
 * the admin and used everywhere. These tests hold the rule in place — including the
 * one that fails the build if anybody writes another address into the code.
 */

vi.mock('@/lib/site/company-email.server', () => ({
  getCompanyEmail: async () => 'owner@example.com',
}))
vi.mock('@/lib/db/client', () => ({ db: { notificationLog: { create: vi.fn() } } }))

describe('the company email', () => {
  it('defaults to contact@mimosalsd.com', () => {
    expect(DEFAULT_COMPANY_EMAIL).toBe('contact@mimosalsd.com')
  })

  it('accepts a real address, trimmed and lower-cased', () => {
    expect(normaliseCompanyEmail('  Contact@MIMOSALSD.com ')).toBe('contact@mimosalsd.com')
    expect(normaliseCompanyEmail('first.last+shop@mail.example.co.uk')).toBe('first.last+shop@mail.example.co.uk')
  })

  it('refuses anything that could break a page, a header or a mailto link', () => {
    for (const bad of [
      '',
      'sales',
      'sales@',
      'a@b',
      'a b@example.com',
      '<x>@example.com',
      'a"b@example.com',
      "a'b@example.com",
      'a&b@example.com',
      'x@example.com\nBcc: z@example.com',
      `${'x'.repeat(250)}@example.com`,
      42,
      null,
    ]) {
      expect(normaliseCompanyEmail(bad), String(bad)).toBeNull()
    }
  })

  it('fills the token into strings, arrays and plain objects, and leaves the rest alone', () => {
    const when = new Date(0)
    const filled = fillCompanyEmail(
      { to: COMPANY_EMAIL_TOKEN, body: [`Write to ${COMPANY_EMAIL_TOKEN}.`], n: 3, when },
      'a@b.com',
    )
    expect(filled).toEqual({ to: 'a@b.com', body: ['Write to a@b.com.'], n: 3, when })
    expect(filled.when).toBe(when)
  })
})

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = path.join(dir, entry)
    if (statSync(full).isDirectory()) return sourceFiles(full)
    return /\.(ts|tsx)$/.test(entry) ? [full] : []
  })
}

describe('nothing on the site uses another address', () => {
  const src = path.resolve(__dirname, '../../src')
  const files = sourceFiles(src)

  it('never names any @mimosalsd.com address other than sales@', () => {
    const others: string[] = []
    for (const file of files) {
      for (const match of readFileSync(file, 'utf8').matchAll(/[a-z0-9._%+-]+@mimosalsd\.com/gi)) {
        if (match[0].toLowerCase() !== 'contact@mimosalsd.com') others.push(`${path.relative(src, file)}: ${match[0]}`)
      }
    }
    expect(others).toEqual([])
    expect(readFileSync(path.join(src, 'lib/brand.ts'), 'utf8')).toContain("email: 'contact@mimosalsd.com'")
  })

  it('reads the address from the one source, never a per-role field', () => {
    const offenders = files.filter((file) => /BRAND\.email\.\w/.test(readFileSync(file, 'utf8')))
    expect(offenders.map((f) => path.relative(src, f))).toEqual([])
  })
})

describe('copy written ahead of time carries the token', () => {
  it('in the FAQ, and no literal address', () => {
    const text = JSON.stringify(FAQ_ITEMS)
    expect(text).toContain(COMPANY_EMAIL_TOKEN)
    expect(text).not.toMatch(/@mimosalsd\.com/)
  })

  it('in the policies, and no literal address', () => {
    const text = JSON.stringify(POLICIES)
    expect(text.split(COMPANY_EMAIL_TOKEN).length - 1).toBeGreaterThanOrEqual(2)
    expect(text).not.toMatch(/@mimosalsd\.com/)
  })
})

describe('email templates', () => {
  const contact = {
    name: 'Dana Whitfield',
    email: 'dana@example.com',
    topic: 'order' as const,
    message: 'Where is my order?',
  }
  const bulk = {
    name: 'Sam Reed',
    email: 'sam@example.com',
    phone: '555-0100',
    volume: '50 – 200 units',
    categories: [],
    products: [],
  }

  it('send every enquiry to the company inbox, and reply from it', () => {
    expect(contactNotificationEmail(contact).to).toBe(COMPANY_EMAIL_TOKEN)
    expect(contactAcknowledgementEmail(contact).replyTo).toBe(COMPANY_EMAIL_TOKEN)
    expect(bulkEnquiryNotificationEmail(bulk).to).toBe(COMPANY_EMAIL_TOKEN)
    expect(bulkEnquiryAcknowledgementEmail(bulk).replyTo).toBe(COMPANY_EMAIL_TOKEN)
  })

  it('leave no token behind once the address is filled in', () => {
    for (const mail of [
      contactNotificationEmail(contact),
      contactAcknowledgementEmail(contact),
      bulkEnquiryNotificationEmail(bulk),
      bulkEnquiryAcknowledgementEmail(bulk),
    ]) {
      const filled = fillCompanyEmail(mail, 'owner@example.com')
      expect(JSON.stringify(filled)).not.toContain(COMPANY_EMAIL_TOKEN)
    }
  })

  it('carry the address in the footer of every HTML email', () => {
    expect(contactAcknowledgementEmail(contact).html).toContain(`mailto:${COMPANY_EMAIL_TOKEN}`)
  })
})

describe('the mailer fills in the address set in the admin', () => {
  const saved = { ...process.env }
  beforeEach(() => {
    delete process.env.BREVO_API_KEY
  })
  afterEach(() => {
    process.env = { ...saved }
    vi.restoreAllMocks()
  })

  it('in every field of the message, extra headers included', async () => {
    const { resolveCompanyEmail } = await import('@/lib/mail/mailer')
    const resolved = await resolveCompanyEmail({
      to: COMPANY_EMAIL_TOKEN,
      replyTo: COMPANY_EMAIL_TOKEN,
      subject: `For ${COMPANY_EMAIL_TOKEN}`,
      text: `Questions: ${COMPANY_EMAIL_TOKEN}`,
      html: `<a href="mailto:${COMPANY_EMAIL_TOKEN}">${COMPANY_EMAIL_TOKEN}</a>`,
      headers: { 'List-Unsubscribe': `<mailto:${COMPANY_EMAIL_TOKEN}>` },
    })
    expect(JSON.stringify(resolved)).not.toContain(COMPANY_EMAIL_TOKEN)
    expect(resolved.to).toBe('owner@example.com')
    expect(resolved.headers?.['List-Unsubscribe']).toBe('<mailto:owner@example.com>')
  })

  it('for a caller holding the provider directly, as the contact and bulk forms do', async () => {
    const { getMailProvider, resetMailProvider } = await import('@/lib/mail/mailer')
    resetMailProvider()
    const log = vi.spyOn(console, 'info').mockImplementation(() => {})
    await getMailProvider().send({ to: COMPANY_EMAIL_TOKEN, subject: 'Hi', text: 'Hello' })
    expect(log.mock.calls.flat().join(' ')).toContain('to=owner@example.com')
  })
})

describe('ntfy', () => {
  const saved = { ...process.env }
  afterEach(() => {
    process.env = { ...saved }
    vi.unstubAllGlobals()
  })

  it('sends every push at maximum priority, so the phone keeps alerting until tapped', async () => {
    process.env.NTFY_URL = 'https://ntfy.example.com'
    process.env.NTFY_TOPIC_ORDERS = 'orders-topic'
    const fetch = vi.fn<(url: string, init?: RequestInit) => Promise<Response>>(async () => new Response('ok'))
    vi.stubGlobal('fetch', fetch)
    const { notify } = await import('@/lib/notify/ntfy')
    await notify({ topic: 'orders-new', title: 'New order', body: 'SG-1001' })
    const init = fetch.mock.calls[0]?.[1] as RequestInit | undefined
    expect((init?.headers as Record<string, string>).Priority).toBe('urgent')
  })
})
