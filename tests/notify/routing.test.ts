import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { notify, TOPIC_ENV, type NtfyTopic } from '@/lib/notify/ntfy'
import { messagesUrl } from '@/lib/chat/core'

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

  it('posts a new order to the orders topic, at top priority, with the payment page as the tap target', async () => {
    await notify({
      topic: 'orders-new',
      title: 'New order — Order ID 202609-K7Q4M9 — $63.95',
      body: 'Dana Whitfield · Oregon · Cash App · 1 line(s)',
      clickUrl: 'https://www.mimosalsd.com/admin/orders/202609-K7Q4M9/payment',
    })
    const [url, init] = vi.mocked(globalThis.fetch).mock.calls[0] as [string, RequestInit]
    expect(url).toBe('https://ntfy.example.test/orders-topic')
    const headers = init.headers as Record<string, string>
    expect(headers.Priority).toBe('urgent')
    expect(headers.Click).toBe('https://www.mimosalsd.com/admin/orders/202609-K7Q4M9/payment')
    expect(headers.Authorization).toBe('Bearer tk_test')
  })

  it('posts chat to the chat topic, and a sign-up to the orders topic', async () => {
    await notify({ topic: 'chat-inbound', title: 'Chat — Dana', body: 'Hi' })
    await notify({ topic: 'signups', title: 'New newsletter subscriber', body: 'a@b.test' })
    const urls = vi.mocked(globalThis.fetch).mock.calls.map((c) => c[0])
    expect(urls).toEqual(['https://ntfy.example.test/chat-topic', 'https://ntfy.example.test/orders-topic'])
  })
})

describe('messagesUrl', () => {
  it('opens one conversation when there is one to open', () => {
    expect(messagesUrl('cmtz4abc123')).toBe('/admin/messages?thread=cmtz4abc123')
    expect(messagesUrl(undefined)).toBe('/admin/messages')
  })
})
