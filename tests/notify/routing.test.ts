import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { alertLines, notify, TOPIC_ENV, type NtfyTopic } from '@/lib/notify/ntfy'
import { messagesUrl, shouldAlertOperator } from '@/lib/chat/core'

vi.mock('@/lib/db/client', () => ({ db: {} }))
vi.mock('@/lib/observability/report-error', () => ({ reportError: vi.fn() }))

/**
 * The owner's split, 2026-09-13: the CHAT topic rings for conversations a person has
 * to answer, the ORDERS topic for everything else, operational alarms included.
 */
describe('which phone topic each notification rings', () => {
  it.each<[NtfyTopic, 'NTFY_TOPIC_ALERTS' | 'NTFY_TOPIC_ORDERS']>([
    ['chat-inbound', 'NTFY_TOPIC_ALERTS'], // live chat, contact form, bulk quote form
    ['orders-new', 'NTFY_TOPIC_ORDERS'],
    ['orders-paid', 'NTFY_TOPIC_ORDERS'],
    ['signups', 'NTFY_TOPIC_ORDERS'],
    ['errors', 'NTFY_TOPIC_ORDERS'], // site errors, failed admin sign-ins, state-rule changes
    ['stock-low', 'NTFY_TOPIC_ORDERS'],
  ])('%s → %s', (topic, env) => {
    expect(TOPIC_ENV[topic]).toBe(env)
  })
})

describe('notify', () => {
  beforeEach(() => {
    vi.stubEnv('NTFY_URL', 'https://ntfy.example.test/')
    vi.stubEnv('NTFY_TOPIC_ORDERS', 'orders-topic')
    vi.stubEnv('NTFY_TOPIC_ALERTS', 'chat-topic')
    vi.stubEnv('NTFY_TOKEN', 'tk_test')
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 200 })))
  })
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  const sent = () =>
    vi.mocked(globalThis.fetch).mock.calls.map(([url, init]) => ({
      url: String(url),
      headers: (init as RequestInit).headers as Record<string, string>,
      payload: JSON.parse(String((init as RequestInit).body)) as Record<string, unknown>,
    }))

  it('publishes a new order as JSON to the orders topic, at top priority, with buttons and the payment page as the tap target', async () => {
    await notify({
      topic: 'orders-new',
      title: 'New order 202609-K7Q4M9, $63.95',
      body: 'Customer: Dana Whitfield',
      tags: ['shopping_cart', 'order'],
      clickUrl: 'https://www.mimosalsd.com/admin/orders/202609-K7Q4M9/payment',
      actions: [{ label: 'Open order', url: 'https://www.mimosalsd.com/admin/orders/202609-K7Q4M9' }],
    })
    const { url, headers, payload } = sent()[0]!
    expect(url).toBe('https://ntfy.example.test')
    expect(headers.Authorization).toBe('Bearer tk_test')
    expect(payload).toMatchObject({
      topic: 'orders-topic',
      title: 'New order 202609-K7Q4M9, $63.95',
      message: 'Customer: Dana Whitfield',
      priority: 5,
      tags: ['shopping_cart', 'order'],
      click: 'https://www.mimosalsd.com/admin/orders/202609-K7Q4M9/payment',
      actions: [{ action: 'view', label: 'Open order', url: 'https://www.mimosalsd.com/admin/orders/202609-K7Q4M9', clear: true }],
    })
  })

  it('keeps a title with dashes and emoji intact, because JSON is UTF-8', async () => {
    await notify({ topic: 'chat-inbound', title: 'Chat \u2014 Zo\u00eb \u{1F338}', body: 'Hi' })
    expect(sent()[0]!.payload.title).toBe('Chat \u2014 Zo\u00eb \u{1F338}')
  })

  it('carries a photo as an attachment the phone shows inline', async () => {
    await notify({ topic: 'chat-inbound', title: 'Dana sent a photo', body: 'x', attach: { url: 'https://r2.example/p.jpg', filename: 'SG-1.jpg' } })
    expect(sent()[0]!.payload).toMatchObject({ attach: 'https://r2.example/p.jpg', filename: 'SG-1.jpg' })
  })

  it('posts chat to the chat topic, and a sign-up to the orders topic', async () => {
    await notify({ topic: 'chat-inbound', title: 'Chat', body: 'Hi' })
    await notify({ topic: 'signups', title: 'New subscriber', body: 'a@b.test' })
    expect(sent().map((s) => s.payload.topic)).toEqual(['chat-topic', 'orders-topic'])
  })

  it('retries when ntfy is slow or failing, and stops at the first success', async () => {
    vi.mocked(globalThis.fetch)
      .mockRejectedValueOnce(new Error('timeout'))
      .mockResolvedValueOnce(new Response('busy', { status: 503 }))
      .mockResolvedValueOnce(new Response('{}', { status: 200 }))
    expect(await notify({ topic: 'orders-new', title: 'New order', body: 'x' })).toBe(true)
    expect(globalThis.fetch).toHaveBeenCalledTimes(3)
  })

  it('does not retry a refusal that will not change, such as a bad token', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue(new Response('forbidden', { status: 403 }))
    expect(await notify({ topic: 'orders-new', title: 'New order', body: 'x' })).toBe(false)
    expect(globalThis.fetch).toHaveBeenCalledTimes(1)
  })
})

describe('alertLines', () => {
  it('writes labelled lines and leaves out the empty ones', () => {
    expect(alertLines([['Customer', 'Dana'], ['Phone', null], ['', 'Check the money arrived.'], ['Note', '  ']])).toBe(
      'Customer: Dana\nCheck the money arrived.',
    )
  })
})

describe('when a customer message rings the phone', () => {
  const now = Date.UTC(2026, 9, 17, 12)
  const ago = (minutes: number) => new Date(now - minutes * 60_000)
  it('always for a photo or a file, even with messages already unread', () => {
    expect(shouldAlertOperator({ hasAttachment: true, wasWaiting: true, previousCustomerAt: ago(0.1), now })).toBe(true)
  })
  it('for text when nothing was waiting', () => {
    expect(shouldAlertOperator({ hasAttachment: false, wasWaiting: false, previousCustomerAt: ago(1), now })).toBe(true)
  })
  it('not for the next line of a burst the owner has not read yet', () => {
    expect(shouldAlertOperator({ hasAttachment: false, wasWaiting: true, previousCustomerAt: ago(2), now })).toBe(false)
  })
  it('again once the customer comes back after five quiet minutes', () => {
    expect(shouldAlertOperator({ hasAttachment: false, wasWaiting: true, previousCustomerAt: ago(5), now })).toBe(true)
  })
})

describe('messagesUrl', () => {
  it('opens one conversation when there is one to open', () => {
    expect(messagesUrl('cmtz4abc123')).toBe('/admin/messages?thread=cmtz4abc123')
    expect(messagesUrl(undefined)).toBe('/admin/messages')
  })
})
