import { createDecipheriv, createECDH, createHmac, randomBytes, randomUUID } from 'node:crypto'
import { PrismaClient } from '@prisma/client'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * Push notifications against a REAL Postgres: subscribing from the browser, then
 * sending to one visitor and to everyone, with the push services replaced by a
 * recorder that DECRYPTS each message the way a phone would. Passing means the
 * phone gets the words we sent, not merely that a request went out.
 *
 * Skipped unless TEST_DATABASE_URL points at a disposable local database. It
 * REFUSES any host but this machine: `.env` is production.
 */
const url = process.env.TEST_DATABASE_URL
if (url && !/@(127\.0\.0\.1|localhost)(:\d+)?\//.test(url)) {
  throw new Error('TEST_DATABASE_URL must be a local database; refusing to run against ' + url.replace(/:[^:@/]+@/, ':***@'))
}
const local = url ? new PrismaClient({ datasourceUrl: url }) : null
vi.mock('@/lib/db/client', () => ({ db: local }))

let cookieVisitor: string | undefined
vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: () => (cookieVisitor ? { value: cookieVisitor } : undefined),
    set: (_name: string, value: string) => {
      cookieVisitor = value
    },
  }),
  headers: async () => new Headers(),
}))
vi.mock('@/lib/observability/report-error', () => ({ reportError: vi.fn(async () => {}) }))

const { GET, POST, DELETE } = await import('@/app/api/push/subscribe/route')
const { broadcastPush, forgetCachedVapidKeys, sendPushToVisitor, setPushTransport, vapidKeys } = await import('@/lib/push/server')

/** A pretend phone: a real P-256 key pair and auth secret, able to decrypt what it receives. */
function makePhone() {
  const ecdh = createECDH('prime256v1')
  ecdh.generateKeys()
  const auth = randomBytes(16)
  const endpoint = `https://fcm.googleapis.com/fcm/send/${randomUUID()}`
  const hmac = (key: Uint8Array, ...parts: Uint8Array[]) => {
    const mac = createHmac('sha256', key)
    for (const part of parts) mac.update(part)
    return mac.digest()
  }
  const hkdf = (salt: Uint8Array, ikm: Uint8Array, info: Uint8Array, length: number) =>
    hmac(hmac(salt, ikm), info, Uint8Array.of(1)).subarray(0, length)
  return {
    endpoint,
    subscription: { endpoint, keys: { p256dh: ecdh.getPublicKey().toString('base64url'), auth: auth.toString('base64url') } },
    decrypt(body: Buffer): unknown {
      const salt = body.subarray(0, 16)
      const idLength = body[20]!
      const senderPublic = body.subarray(21, 21 + idLength)
      const secret = ecdh.computeSecret(senderPublic)
      const ikm = hkdf(auth, secret, Buffer.concat([Buffer.from('WebPush: info\0'), ecdh.getPublicKey(), senderPublic]), 32)
      const cek = hkdf(salt, ikm, Buffer.from('Content-Encoding: aes128gcm\0'), 16)
      const nonce = hkdf(salt, ikm, Buffer.from('Content-Encoding: nonce\0'), 12)
      const record = body.subarray(21 + idLength)
      const decipher = createDecipheriv('aes-128-gcm', cek, nonce)
      decipher.setAuthTag(record.subarray(record.length - 16))
      const plain = Buffer.concat([decipher.update(record.subarray(0, record.length - 16)), decipher.final()])
      expect(plain.at(-1)).toBe(2)
      return JSON.parse(plain.subarray(0, -1).toString())
    },
  }
}

type Sent = { endpoint: string; headers: Record<string, string>; body: Buffer }
let sent: Sent[] = []
let reply: (endpoint: string) => number = () => 201

function request(method: string, body?: unknown, headers: Record<string, string> = {}) {
  return new Request('https://www.mimosalsd.com/api/push/subscribe', {
    method,
    headers: { 'content-type': 'application/json', origin: 'https://www.mimosalsd.com', ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
}

describe.skipIf(!local)('push notifications (local Postgres)', () => {
  beforeAll(async () => {
    await local!.pushKey.deleteMany()
  })
  beforeEach(async () => {
    await local!.pushSubscription.deleteMany()
    await local!.pushBroadcast.deleteMany()
    cookieVisitor = randomUUID()
    sent = []
    reply = () => 201
    setPushTransport(async (endpoint, init) => {
      sent.push({ endpoint, headers: init.headers as Record<string, string>, body: Buffer.from(init.body as Uint8Array) })
      return new Response(null, { status: reply(endpoint) })
    })
  })
  afterAll(async () => {
    setPushTransport(null)
    // Leave nothing behind: a local site started on this database afterwards would
    // otherwise try to notify 1,200 pretend phones.
    await local?.pushSubscription.deleteMany({ where: { endpoint: { startsWith: 'https://fcm.googleapis.com/fcm/send/' } } })
    await local?.pushBroadcast.deleteMany({ where: { sentBy: 'owner@mimosalsd.com' } })
    await local?.$disconnect()
  })

  it('creates the key pair once, even when two requests ask at the same moment', async () => {
    await local!.pushKey.deleteMany()
    forgetCachedVapidKeys()
    const [a, b] = await Promise.all([vapidKeys(), (forgetCachedVapidKeys(), vapidKeys())])
    expect(await local!.pushKey.count()).toBe(1)
    const stored = await local!.pushKey.findUniqueOrThrow({ where: { id: 'vapid' } })
    forgetCachedVapidKeys()
    expect((await vapidKeys()).publicKey).toBe(stored.publicKey)
    expect([a.publicKey, b.publicKey]).toContain(stored.publicKey)
    const response = await GET()
    expect(await response.json()).toEqual({ publicKey: stored.publicKey })
  })

  it('saves a subscription against the visitor cookie, once per phone', async () => {
    const phone = makePhone()
    expect((await POST(request('POST', { ...phone.subscription, installed: true, platform: 'ios' }))).status).toBe(200)
    expect((await POST(request('POST', phone.subscription))).status).toBe(200)
    const rows = await local!.pushSubscription.findMany()
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ endpoint: phone.endpoint, visitorId: cookieVisitor, installed: true })
  })

  it('refuses another site, an unknown push host and a malformed body', async () => {
    const phone = makePhone()
    expect((await POST(request('POST', phone.subscription, { origin: 'https://evil.test' }))).status).toBe(403)
    expect(
      (await POST(request('POST', { ...phone.subscription, endpoint: 'https://169.254.169.254/latest' }))).status,
    ).toBe(422)
    expect((await POST(request('POST', { endpoint: phone.endpoint }))).status).toBe(422)
    expect(await local!.pushSubscription.count()).toBe(0)
  })

  it('swaps a rotated subscription for the new one, and forgets one on request', async () => {
    const before = makePhone()
    const after = makePhone()
    await POST(request('POST', before.subscription))
    await POST(request('POST', { ...after.subscription, replaces: before.endpoint }))
    expect((await local!.pushSubscription.findMany()).map((r) => r.endpoint)).toEqual([after.endpoint])
    expect((await DELETE(request('DELETE', { endpoint: after.endpoint }))).status).toBe(204)
    expect(await local!.pushSubscription.count()).toBe(0)
  })

  it('delivers an encrypted message that only that phone can read', async () => {
    const phone = makePhone()
    const other = makePhone()
    await POST(request('POST', phone.subscription))
    const visitor = cookieVisitor
    cookieVisitor = randomUUID()
    await POST(request('POST', other.subscription))

    const tally = await sendPushToVisitor(visitor, {
      title: 'New reply from MIMOSALSD',
      body: 'Your parcel left this morning.',
      url: '/account/chat',
      tag: 'chat-reply',
    })
    expect(tally).toEqual({ recipients: 1, delivered: 1, failed: 0, removed: 0 })
    expect(sent).toHaveLength(1)
    const [message] = sent
    expect(message!.endpoint).toBe(phone.endpoint)
    expect(message!.headers).toMatchObject({ TTL: '86400', Urgency: 'high', 'Content-Encoding': 'aes128gcm' })
    expect(message!.headers.Authorization).toMatch(/^vapid t=.+, k=/)
    expect(phone.decrypt(message!.body)).toEqual({
      title: 'New reply from MIMOSALSD',
      body: 'Your parcel left this morning.',
      url: '/account/chat',
      tag: 'chat-reply',
    })
    expect(() => other.decrypt(message!.body)).toThrow()
    const row = await local!.pushSubscription.findUniqueOrThrow({ where: { endpoint: phone.endpoint } })
    expect(row.lastSentAt).not.toBeNull()
  })

  it('sends nothing for a visitor with no subscription, and never throws', async () => {
    expect(await sendPushToVisitor(randomUUID(), { title: 'x', body: 'y', url: '/' })).toMatchObject({ recipients: 0 })
    expect(await sendPushToVisitor(null, { title: 'x', body: 'y', url: '/' })).toMatchObject({ recipients: 0 })
    expect(sent).toHaveLength(0)
  })

  it('removes a phone the push service says is gone, and one that keeps failing', async () => {
    const gone = makePhone()
    const flaky = makePhone()
    await POST(request('POST', gone.subscription))
    await POST(request('POST', flaky.subscription))
    reply = (endpoint) => (endpoint === gone.endpoint ? 410 : 500)

    const first = await sendPushToVisitor(cookieVisitor, { title: 'x', body: 'y', url: '/' })
    expect(first).toEqual({ recipients: 2, delivered: 0, failed: 1, removed: 1 })
    expect((await local!.pushSubscription.findMany()).map((r) => [r.endpoint, r.failures])).toEqual([[flaky.endpoint, 1]])

    for (let i = 0; i < 4; i++) await sendPushToVisitor(cookieVisitor, { title: 'x', body: 'y', url: '/' })
    expect(await local!.pushSubscription.count()).toBe(0)
  })

  it('a success clears earlier failures', async () => {
    const phone = makePhone()
    await POST(request('POST', phone.subscription))
    reply = () => 500
    await sendPushToVisitor(cookieVisitor, { title: 'x', body: 'y', url: '/' })
    reply = () => 201
    await sendPushToVisitor(cookieVisitor, { title: 'x', body: 'y', url: '/' })
    expect((await local!.pushSubscription.findFirstOrThrow()).failures).toBe(0)
  })

  it('broadcasts to everyone across pages of the list, and records how it went', async () => {
    const phone = makePhone()
    await POST(request('POST', phone.subscription))
    // 1,200 more subscriptions, so the send has to page past 500 twice.
    const template = makePhone().subscription.keys
    await local!.pushSubscription.createMany({
      data: Array.from({ length: 1200 }, (_, i) => ({
        endpoint: `https://fcm.googleapis.com/fcm/send/bulk-${String(i).padStart(4, '0')}`,
        p256dh: template.p256dh,
        auth: template.auth,
      })),
    })
    // Every fifth one is gone, including rows at the edge of a page.
    reply = (endpoint) => (/bulk-\d{3}[05]$/.test(endpoint) ? 410 : 201)

    const result = await broadcastPush({ title: 'Restocked', body: 'Amanita is back.', url: '/shop' }, 'owner@mimosalsd.com')
    // Other integration files share this database and may add a row of their own
    // mid-test, so the counts are checked for this test's own endpoints.
    const ours = (endpoint: string) => endpoint.startsWith('https://fcm.googleapis.com/fcm/send/')
    expect(result.recipients).toBeGreaterThanOrEqual(1201)
    expect(result.removed).toBe(240)
    expect(result.delivered).toBe(result.recipients - 240)
    expect(new Set(sent.map((s) => s.endpoint).filter(ours)).size).toBe(1201)
    expect(sent.find((s) => s.endpoint === phone.endpoint)!.headers).toMatchObject({ Urgency: 'normal', TTL: '259200' })
    expect(phone.decrypt(sent.find((s) => s.endpoint === phone.endpoint)!.body)).toEqual({
      title: 'Restocked',
      body: 'Amanita is back.',
      url: '/shop',
    })
    expect(await local!.pushSubscription.count({ where: { endpoint: { startsWith: 'https://fcm.googleapis.com/fcm/send/' } } })).toBe(961)
    const log = await local!.pushBroadcast.findUniqueOrThrow({ where: { id: result.id } })
    expect(log).toMatchObject({ title: 'Restocked', recipients: result.recipients, delivered: result.delivered, removed: 240, sentBy: 'owner@mimosalsd.com' })
  }, 60_000)
})
