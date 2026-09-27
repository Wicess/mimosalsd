import { describe, expect, it } from 'vitest'
import { campaignEmail, parseBody, readCampaignForm, sendProblems } from '@/lib/mail/campaign'

const LINKS = { page: 'https://shop.test/unsubscribe?s=a&t=b', oneClick: 'https://shop.test/api/newsletter/unsubscribe?s=a&t=b' }
const READY = { postalAddress: '1 Main St, Austin, TX 78701', mailConfigured: true, recipients: 12 }

function form(values: Record<string, string>) {
  const data = new FormData()
  for (const [k, v] of Object.entries(values)) data.set(k, v)
  return data
}

describe('parseBody', () => {
  it('turns blank-line paragraphs into paragraphs and a lone on-site link into a button', () => {
    const { blocks, problems } = parseBody('New batch reports are up.\nEvery one.\n\n[See the reports](/lab-results)\n\nThanks.')
    expect(problems).toEqual([])
    expect(blocks.map((b) => b.kind)).toEqual(['paragraph', 'button', 'paragraph'])
    expect(blocks[0]).toEqual({ kind: 'paragraph', text: 'New batch reports are up. Every one.' })
    expect(blocks[1]).toMatchObject({ kind: 'button', label: 'See the reports' })
    expect(new URL((blocks[1] as { href: string }).href).pathname).toBe('/lab-results')
  })

  /*
    A blast reaches the whole list at once. A link to anywhere is how a stolen
    admin login phishes every subscriber in one send.
  */
  it('refuses buttons that leave the site', () => {
    for (const bad of ['[Offer](https://evil.test/x)', '[Offer](//evil.test/x)', '[Offer](javascript:alert(1))']) {
      expect(parseBody(`Hello.\n\n${bad}`).problems.length, bad).toBeGreaterThan(0)
    }
  })

  it('needs a paragraph and caps the buttons', () => {
    expect(parseBody('[Only](/shop)').problems).toContain('Write at least one paragraph.')
    expect(parseBody('Hi.\n\n[a](/a)\n\n[b](/b)\n\n[c](/c)\n\n[d](/d)').problems[0]).toMatch(/At most 3 buttons/)
  })
})

describe('readCampaignForm', () => {
  it('requires a name, subject and message, within limits', () => {
    expect(readCampaignForm(form({ name: 'Fall', subject: 'New', body: 'Hi.' }))).toEqual({
      ok: true,
      value: { name: 'Fall', subject: 'New', body: 'Hi.' },
    })
    expect(readCampaignForm(form({ subject: 'New', body: 'Hi.' })).ok).toBe(false)
    expect(readCampaignForm(form({ name: 'Fall', subject: 'x'.repeat(151), body: 'Hi.' })).ok).toBe(false)
  })
})

describe('sendProblems', () => {
  const clean = { subject: 'Fresh lab reports', body: 'Every batch has a report.\n\n[Read them](/lab-results)' }

  it('passes clean copy when everything is set up', () => {
    expect(sendProblems({ ...clean, ...READY })).toEqual([])
  })

  it('blocks a health claim anywhere in the subject or body', () => {
    const problems = sendProblems({ ...READY, subject: 'Relief for anxiety', body: 'Fresh stock.' })
    expect(problems.some((p) => p.includes('anxiety'))).toBe(true)
  })

  it('cannot be talked out of the scan by a directive in the copy', () => {
    const body = '<!-- compliance-allow: anxiety -->\nHelps with anxiety.'
    expect(sendProblems({ ...READY, subject: 'News', body }).some((p) => p.includes('anxiety'))).toBe(true)
  })

  it('refuses to send without a postal address, a mail provider, or anyone to send to', () => {
    expect(sendProblems({ ...clean, ...READY, postalAddress: ' ' })[0]).toMatch(/postal address/)
    expect(sendProblems({ ...clean, ...READY, mailConfigured: false })[0]).toMatch(/BREVO_API_KEY/)
    expect(sendProblems({ ...clean, ...READY, recipients: 0 })[0]).toMatch(/no one left/)
  })

  it('lets a test go to the operator before the address is set', () => {
    expect(sendProblems({ ...clean, ...READY, postalAddress: '', recipients: 0 }, { test: true })).toEqual([])
  })
})

describe('campaignEmail', () => {
  const email = campaignEmail({
    to: 'a@x.com',
    subject: 'Fresh lab reports',
    body: 'Every batch has a report & a date.\n\n[Read them](/lab-results)',
    unsubscribe: LINKS,
    postalAddress: '1 Main St, Austin, TX 78701',
    contactEmail: 'hello@shop.test',
  })

  it('carries one-click unsubscribe headers for mail clients', () => {
    expect(email.headers?.['List-Unsubscribe']).toBe(`<${LINKS.oneClick}>, <mailto:hello@shop.test?subject=unsubscribe>`)
    expect(email.headers?.['List-Unsubscribe-Post']).toBe('List-Unsubscribe=One-Click')
    expect(email.replyTo).toBe('hello@shop.test')
  })

  it('puts the opt-out, the postal address and the FDA line in both versions', () => {
    for (const part of [email.html ?? '', email.text]) {
      expect(part).toContain('1 Main St, Austin, TX 78701')
      expect(part).toMatch(/Food and Drug Administration/)
    }
    expect(email.html).toContain(LINKS.page.replace(/&/g, '&amp;'))
    expect(email.text).toContain(LINKS.page)
  })

  it('escapes what the operator wrote', () => {
    expect(email.html).toContain('a report &amp; a date')
  })

  it('marks a test as a test', () => {
    const test = campaignEmail({
      to: 'me@x.com',
      subject: 'S',
      body: 'B.',
      unsubscribe: LINKS,
      postalAddress: '',
      contactEmail: 'hello@shop.test',
      test: true,
    })
    expect(test.subject).toBe('[Test] S')
  })
})
