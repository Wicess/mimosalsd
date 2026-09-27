import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * The transport, not the templates.
 *
 * templates.ts is covered by its siblings here; what was never covered is the thing
 * that actually puts a message on the wire. Brevo's contract differs from the generic
 * one in three ways that each fail silently — a bespoke `api-key` header instead of a
 * bearer token, a split `sender` object instead of an RFC 5322 string, and a mandatory
 * `htmlContent`. Each returns a 4xx that reads like a credentials problem.
 */
const create = vi.fn().mockResolvedValue({})
vi.mock('@/lib/db/client', () => ({ db: { notificationLog: { create } } }))

const { getMailProvider, parseSender, resetMailProvider, sendEmail } = await import(
  '@/lib/mail/mailer'
)

const message = {
  to: 'buyer@example.com',
  subject: 'Order received',
  text: 'Thanks for your order.\n\nWe will be in touch.',
  html: '<p>Thanks for your order.</p>',
}

function jsonBody(): Record<string, unknown> {
  const call = vi.mocked(globalThis.fetch).mock.calls[0]
  return JSON.parse(String((call?.[1] as RequestInit).body))
}

beforeEach(() => {
  resetMailProvider()
  create.mockClear()
  process.env.BREVO_API_KEY = 'xkeysib-test'
  process.env.EMAIL_FROM = 'Snypegate <sales@snypegate.com>'
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue(new Response('{"messageId":"<1@brevo>"}', { status: 201 })),
  )
})

afterEach(() => {
  vi.unstubAllGlobals()
  delete process.env.BREVO_API_KEY
  delete process.env.EMAIL_FROM
})

describe('parseSender', () => {
  it('splits an RFC 5322 display name from the address', () => {
    expect(parseSender('Snypegate <sales@snypegate.com>')).toEqual({
      name: 'Snypegate',
      email: 'sales@snypegate.com',
    })
  })

  it('accepts a bare address and sends without a display name', () => {
    expect(parseSender('sales@snypegate.com')).toEqual({ email: 'sales@snypegate.com' })
  })

  it('strips quotes around a display name', () => {
    // `"Snypegate, Inc." <a@b.com>` is legal RFC 5322. Passing the quotes through
    // would put them inside Brevo's `name` field and into the rendered From line.
    expect(parseSender('"Snypegate, Inc." <sales@snypegate.com>')).toEqual({
      name: 'Snypegate, Inc.',
      email: 'sales@snypegate.com',
    })
  })

  it('clamps a display name to the 70 characters Brevo accepts', () => {
    const name = parseSender(`${'a'.repeat(200)} <sales@snypegate.com>`)?.name
    expect(name).toHaveLength(70)
  })

  it('rejects a value with no address rather than sending from nowhere', () => {
    expect(parseSender('')).toBeUndefined()
    expect(parseSender('Snypegate')).toBeUndefined()
  })
})

describe('Brevo transport', () => {
  it('posts to Brevo with the api-key header, not a bearer token', async () => {
    await sendEmail(message)
    const [url, init] = vi.mocked(globalThis.fetch).mock.calls[0] as [string, RequestInit]
    expect(url).toBe('https://api.brevo.com/v3/smtp/email')
    expect(init.method).toBe('POST')
    const headers = init.headers as Record<string, string>
    expect(headers['api-key']).toBe('xkeysib-test')
    expect(headers.Authorization).toBeUndefined()
  })

  it('sends the parsed sender object and both content fields', async () => {
    await sendEmail(message)
    expect(jsonBody()).toMatchObject({
      sender: { name: 'Snypegate', email: 'sales@snypegate.com' },
      to: [{ email: 'buyer@example.com' }],
      subject: 'Order received',
      textContent: message.text,
      htmlContent: message.html,
    })
  })

  it('synthesises htmlContent when a caller supplies text only', async () => {
    // Brevo rejects a send with no htmlContent. `EmailMessage.html` is optional, so
    // without this fallback an all-text message 400s.
    await sendEmail({ to: 'a@b.com', subject: 'Hi', text: 'One.\n\nTwo.' })
    const html = String(jsonBody().htmlContent)
    expect(html).toContain('<p>One.</p>')
    expect(html).toContain('<p>Two.</p>')
  })

  it('escapes HTML in a synthesised body', async () => {
    await sendEmail({ to: 'a@b.com', subject: 'Hi', text: 'Tom & <script>alert(1)</script>' })
    const html = String(jsonBody().htmlContent)
    expect(html).toContain('Tom &amp; &lt;script&gt;')
    expect(html).not.toContain('<script>')
  })

  it('maps replyTo into Brevo’s object form and omits it otherwise', async () => {
    await sendEmail({ ...message, replyTo: 'ops@snypegate.com' })
    expect(jsonBody().replyTo).toEqual({ email: 'ops@snypegate.com' })

    resetMailProvider()
    vi.mocked(globalThis.fetch).mockClear()
    await sendEmail(message)
    expect(jsonBody()).not.toHaveProperty('replyTo')
  })

  it('never throws into the request path when Brevo rejects the send', async () => {
    // An order confirmation that cannot be delivered must not take down checkout.
    vi.mocked(globalThis.fetch).mockResolvedValue(
      new Response('{"code":"unauthorized"}', { status: 401 }),
    )
    await expect(sendEmail(message)).resolves.toBe(false)
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ channel: 'EMAIL:brevo', success: false }),
      }),
    )
  })

  it('logs a successful send against the brevo channel', async () => {
    await expect(sendEmail(message)).resolves.toBe(true)
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          channel: 'EMAIL:brevo',
          target: 'buyer@example.com',
          success: true,
        }),
      }),
    )
  })
})

describe('console fallback', () => {
  it('falls back when the API key is missing, without calling Brevo', async () => {
    delete process.env.BREVO_API_KEY
    resetMailProvider()
    expect(getMailProvider().name).toBe('console')
    await expect(sendEmail(message)).resolves.toBe(true)
    expect(globalThis.fetch).not.toHaveBeenCalled()
  })

  it('falls back when EMAIL_FROM is unparseable', async () => {
    // A key with no usable sender would 400 on every send. Better to log locally.
    process.env.EMAIL_FROM = 'not-an-address'
    resetMailProvider()
    expect(getMailProvider().name).toBe('console')
  })
})
