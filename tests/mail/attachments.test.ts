import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/** The invoice image rides on the payment-details email. Brevo takes it base64 in `attachment`. */
const create = vi.fn().mockResolvedValue({})
vi.mock('@/lib/db/client', () => ({ db: { notificationLog: { create } } }))

const { resetMailProvider, sendEmail } = await import('@/lib/mail/mailer')

function jsonBody(): Record<string, unknown> {
  const call = vi.mocked(globalThis.fetch).mock.calls[0]
  return JSON.parse(String((call?.[1] as RequestInit).body))
}

beforeEach(() => {
  resetMailProvider()
  process.env.BREVO_API_KEY = 'xkeysib-test'
  process.env.EMAIL_FROM = 'Snypegate <sales@snypegate.com>'
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{"messageId":"<1@brevo>"}', { status: 201 })))
})
afterEach(() => {
  vi.unstubAllGlobals()
  delete process.env.BREVO_API_KEY
  delete process.env.EMAIL_FROM
})

describe('email attachments', () => {
  it('sends each attachment to Brevo as a name and base64 content', async () => {
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
    const ok = await sendEmail({
      to: 'buyer@example.com',
      subject: 'Order ID 202609-K7Q4M9 — your Cash App payment details',
      text: 'Pay $63.95 with Cash App.',
      attachments: [{ name: 'Invoice 202609-K7Q4M9.png', content: png }],
    })
    expect(ok).toBe(true)
    expect(jsonBody().attachment).toEqual([{ name: 'Invoice 202609-K7Q4M9.png', content: Buffer.from(png).toString('base64') }])
  })

  it('sends no attachment field when there is nothing attached', async () => {
    await sendEmail({ to: 'buyer@example.com', subject: 'Order received', text: 'Thanks for your order, we will be in touch.' })
    expect(jsonBody()).not.toHaveProperty('attachment')
  })
})
