import { createECDH, randomBytes, randomUUID } from 'node:crypto'
import { PrismaClient } from '@prisma/client'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * Sending payment details, end to end against a REAL Postgres: the order moves on,
 * the handle joins the pool, the payment request is written, the invoice is drawn
 * (really, with next/og) and posted into the customer's chat, and the email goes
 * with the image attached, all in one call, the way the owner's Send button does it.
 *
 * Skipped unless TEST_DATABASE_URL points at a disposable local database with the
 * current schema. It REFUSES any host but this machine: `.env` is production.
 * Storage and ntfy are replaced; nothing leaves the machine.
 */
const url = process.env.TEST_DATABASE_URL
if (url && !/@(127\.0\.0\.1|localhost)(:\d+)?\//.test(url)) {
  throw new Error('TEST_DATABASE_URL must be a local database; refusing to run against ' + url.replace(/:[^:@/]+@/, ':***@'))
}
const local = url ? new PrismaClient({ datasourceUrl: url }) : null
vi.mock('@/lib/db/client', () => ({ db: local }))

const stored: { key: string; bytes: number }[] = []
let storageFails = false
vi.mock('@/lib/storage/r2', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/storage/r2')>()),
  putObject: vi.fn(async (key: string, body: Uint8Array) => {
    if (storageFails) throw new Error('R2 is down')
    stored.push({ key, bytes: body.byteLength })
  }),
}))
vi.mock('@/lib/notify/ntfy', () => ({ notify: vi.fn(async () => true), headerSafe: (v: string) => v, TOPIC_ENV: {} }))
const reported: unknown[] = []
vi.mock('@/lib/observability/report-error', () => ({
  reportError: vi.fn(async (error: unknown) => {
    reported.push(error)
  }),
}))

const { setMailProvider } = await import('@/lib/mail/mailer')
const { createPrismaOrderProvider } = await import('@/lib/orders/prisma-provider')
const { generateOrderNumber, generateOrderToken, orders, setOrderProvider } = await import('@/lib/orders/repository')
const { issuePaymentDetails } = await import('@/lib/payments/issue')
const { chatThreadForOrder, linkOrderToChat, sendReceivedInvoice } = await import('@/lib/invoices/deliver')
const { postMessage } = await import('@/lib/chat/core')
const { setPushTransport } = await import('@/lib/push/server')
type Order = import('@/lib/orders/types').Order
type EmailMessage = import('@/lib/mail/mailer').EmailMessage

const sent: EmailMessage[] = []
const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47]

function makeOrder(over: Partial<Order> = {}): Order {
  return {
    id: randomUUID(),
    orderNumber: generateOrderNumber(),
    orderToken: generateOrderToken(),
    status: 'PENDING_VERIFICATION',
    email: `buyer-${randomUUID().slice(0, 8)}@example.test`,
    phone: '+15125550123',
    firstName: 'Dana',
    lastName: 'Whitfield',
    addressLine1: '2140 Riverside Drive',
    city: 'Portland',
    stateCode: 'OR',
    postalCode: '97205',
    items: [
      {
        productSlug: 'mhrb-powder',
        variantId: 'mhrb-powder-f20',
        productName: 'Mimosa Hostilis Root Bark Powder',
        variantName: '50g',
        productLine: 'MIMOSA_HOSTILIS',
        fulfillmentChannel: 'PARCEL',
        unitPriceCents: 2800,
        quantity: 2,
        lineTotalCents: 5600,
      },
    ],
    shipments: [],
    subtotalCents: 5600,
    shippingCents: 795,
    paymentDiscountCents: 0,
    discountCents: 0,
    subscriberDiscountCents: 0,
    appDiscountCents: 0,
    totalCents: 6395,
    freeShippingApplied: false,
    preferredPaymentMethod: 'CASHAPP',
    attestations: [],
    events: [{ type: 'CREATED', message: 'Order request received.', at: new Date().toISOString(), toStatus: 'PENDING_VERIFICATION' }],
    complianceSnapshot: { stateCode: 'OR', evaluatedAt: new Date().toISOString(), requiresAgeVerification: false, requiresAdultSignature: false },
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 48 * 3600_000).toISOString(),
    ...over,
  } as Order
}

async function placeWithChat(over: Partial<Order> = {}) {
  const order = makeOrder(over)
  await orders.create(order)
  const thread = await local!.supportThread.create({
    data: { visitorId: randomUUID(), publicId: `SG-${randomUUID().slice(0, 6)}`, email: order.email, displayName: 'Dana W.' },
  })
  await linkOrderToChat(order.id, thread.id)
  return { order, threadId: thread.id }
}

describe.skipIf(!local)('sending payment details, against Postgres', () => {
  beforeAll(async () => {
    await local!.$connect()
    setOrderProvider(createPrismaOrderProvider())
    setMailProvider({ name: 'capture', send: async (m) => void sent.push(m) })
  })
  afterAll(async () => {
    await local?.$disconnect()
  })
  beforeEach(() => {
    sent.length = 0
    stored.length = 0
    reported.length = 0
    storageFails = false
  })

  it('verifies the order and sends Cash App details to chat and email at once, with the invoice', async () => {
    const { order, threadId } = await placeWithChat()
    const result = await issuePaymentDetails({
      orderNumber: order.orderNumber,
      method: 'CASHAPP',
      payTo: 'SnypeGateTest',
      payToName: 'SnypeGate LLC',
      actorEmail: 'owner@example.test',
    })
    expect(result).toMatchObject({ ok: true, reissued: false, chat: 'sent', email: 'sent', invoiceAttached: true })

    const row = await local!.order.findUnique({
      where: { orderNumber: order.orderNumber },
      include: { paymentRequest: { include: { handle: true } }, events: { orderBy: { createdAt: 'asc' } } },
    })
    expect(row!.status).toBe('AWAITING_PAYMENT')
    expect(row!.paymentRequest).toMatchObject({ method: 'CASHAPP', amountCents: 6395 })
    expect(row!.paymentRequest!.handle).toMatchObject({ handle: '$SnypeGateTest', label: 'SnypeGate LLC' })
    const verified = row!.events.find((e) => e.type === 'AWAITING_PAYMENT')
    expect(verified).toMatchObject({ fromStatus: 'PENDING_VERIFICATION', toStatus: 'AWAITING_PAYMENT', actorEmail: 'owner@example.test' })
    expect(verified!.message).toContain('$SnypeGateTest')
    expect(row!.events.some((e) => e.type === 'INVOICE_SENT')).toBe(true)

    // The invoice image was drawn and stored privately.
    expect(stored).toHaveLength(1)
    expect(stored[0]!.key).toMatch(new RegExp(`^private/invoices/${order.orderNumber}/payment-\\d+\\.png$`))

    // Posted into the customer's own chat, with the image and the instructions as text.
    const messages = await local!.supportMessage.findMany({ where: { threadId } })
    expect(messages).toHaveLength(1)
    expect(messages[0]).toMatchObject({ fromCustomer: false, attachmentKey: stored[0]!.key, attachmentType: 'image/png' })
    expect(messages[0]!.body).toContain('Send to: $SnypeGateTest (SnypeGate LLC)')
    expect(messages[0]!.body).toContain(`Order ID: ${order.orderNumber}`)
    const thread = await local!.supportThread.findUnique({ where: { id: threadId } })
    expect(thread!.unreadForCustomer).toBe(1)

    // And emailed, with the same image attached.
    expect(sent).toHaveLength(1)
    expect(sent[0]!.to).toBe(order.email)
    expect(sent[0]!.text).toContain('$SnypeGateTest')
    expect(sent[0]!.attachments).toHaveLength(1)
    expect(sent[0]!.attachments![0]!.name).toBe(`Invoice ${order.orderNumber}.png`)
    expect([...sent[0]!.attachments![0]!.content.slice(0, 4)]).toEqual(PNG_SIGNATURE)
  }, 120_000)

  it("also reaches the customer's phone when they turned notifications on", async () => {
    const { order, threadId } = await placeWithChat()
    const thread = await local!.supportThread.findUniqueOrThrow({ where: { id: threadId } })
    const phone = createECDH('prime256v1')
    phone.generateKeys()
    const endpoint = `https://web.push.apple.com/${randomUUID()}`
    await local!.pushSubscription.create({
      data: { endpoint, p256dh: phone.getPublicKey().toString('base64url'), auth: randomBytes(16).toString('base64url'), visitorId: thread.visitorId },
    })
    const pushed: { endpoint: string; headers: Record<string, string> }[] = []
    setPushTransport(async (to, init) => {
      pushed.push({ endpoint: to, headers: init.headers as Record<string, string> })
      return new Response(null, { status: 201 })
    })
    try {
      await issuePaymentDetails({ orderNumber: order.orderNumber, method: 'CHIME', payTo: 'snypegate-pay', actorEmail: 'owner@example.test' })
    } finally {
      setPushTransport(null)
    }
    expect(pushed).toHaveLength(1)
    expect(pushed[0]).toMatchObject({ endpoint, headers: { Urgency: 'high' } })
    expect((await local!.pushSubscription.findUniqueOrThrow({ where: { endpoint } })).lastSentAt).not.toBeNull()
    await local!.pushSubscription.deleteMany({ where: { endpoint } })
  }, 120_000)

  it('sending again re-issues without moving the order, and counts the handle use', async () => {
    const { order } = await placeWithChat()
    const first = await issuePaymentDetails({ orderNumber: order.orderNumber, method: 'CASHAPP', payTo: '$ReissueTest', actorEmail: 'o@x.test' })
    expect(first.ok).toBe(true)
    const again = await issuePaymentDetails({ orderNumber: order.orderNumber, method: 'CASHAPP', payTo: '$ReissueTest', actorEmail: 'o@x.test' })
    expect(again).toMatchObject({ ok: true, reissued: true })
    const row = await local!.order.findUnique({ where: { orderNumber: order.orderNumber }, include: { events: true, paymentRequest: { include: { handle: true } } } })
    expect(row!.status).toBe('AWAITING_PAYMENT')
    expect(row!.events.filter((e) => e.type === 'PAYMENT_DETAILS_REISSUED')).toHaveLength(1)
    expect(row!.paymentRequest!.handle!.timesIssued).toBeGreaterThanOrEqual(2)
  }, 120_000)

  it('Bitcoin: refuses an address with a bad checksum and writes nothing', async () => {
    const { order } = await placeWithChat({ preferredPaymentMethod: 'BITCOIN' })
    const result = await issuePaymentDetails({
      orderNumber: order.orderNumber,
      method: 'BITCOIN',
      payTo: 'bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t5',
      btcAmount: '0.001',
      actorEmail: 'o@x.test',
    })
    expect(result).toMatchObject({ ok: false, field: 'payTo' })
    const row = await local!.order.findUnique({ where: { orderNumber: order.orderNumber }, include: { paymentRequest: true } })
    expect(row!.status).toBe('PENDING_VERIFICATION')
    expect(row!.paymentRequest).toBeNull()
    expect(sent).toHaveLength(0)
  })

  it('Bitcoin: stores the address, amount and quote, and emails the BTC amount', async () => {
    const { order } = await placeWithChat({ preferredPaymentMethod: 'BITCOIN' })
    const result = await issuePaymentDetails({
      orderNumber: order.orderNumber,
      method: 'BITCOIN',
      payTo: 'bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4',
      btcAmount: '0.00106584',
      btcRateUsd: 60000,
      btcQuoteMinutes: 60,
      actorEmail: 'o@x.test',
    })
    expect(result).toMatchObject({ ok: true, chat: 'sent', email: 'sent' })
    const request = await local!.paymentIntentRequest.findFirst({ where: { order: { orderNumber: order.orderNumber } } })
    expect(request).toMatchObject({ method: 'BITCOIN', btcAddress: 'bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4', handleId: null })
    expect(request!.btcAmountSats).toBe(106584n)
    const minutes = (request!.expiresAt.getTime() - request!.btcQuoteLockedAt!.getTime()) / 60000
    expect(Math.round(minutes)).toBe(60)
    expect(sent[0]!.text).toContain('0.00106584 BTC')
    expect(sent[0]!.text).toContain('Bitcoin network only')
  }, 120_000)

  it('will not switch an order to or from Bitcoin, because the discount is in the total', async () => {
    const { order } = await placeWithChat({ preferredPaymentMethod: 'CASHAPP' })
    const toBtc = await issuePaymentDetails({ orderNumber: order.orderNumber, method: 'BITCOIN', payTo: 'bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4', btcAmount: '0.001', actorEmail: 'o@x.test' })
    expect(toBtc).toMatchObject({ ok: false, field: 'method' })
    const { order: btc } = await placeWithChat({ preferredPaymentMethod: 'BITCOIN' })
    const fromBtc = await issuePaymentDetails({ orderNumber: btc.orderNumber, method: 'CHIME', payTo: '$Chime', actorEmail: 'o@x.test' })
    expect(fromBtc).toMatchObject({ ok: false, field: 'method' })
  })

  it('may switch between Cash App, Chime and Apple Cash, and records the new method', async () => {
    const { order } = await placeWithChat({ preferredPaymentMethod: 'CASHAPP' })
    const result = await issuePaymentDetails({ orderNumber: order.orderNumber, method: 'APPLE_CASH', payTo: '512 555 0134', actorEmail: 'o@x.test' })
    expect(result.ok).toBe(true)
    const row = await local!.order.findUnique({ where: { orderNumber: order.orderNumber }, include: { paymentRequest: { include: { handle: true } } } })
    expect(row!.preferredPaymentMethod).toBe('APPLE_CASH')
    expect(row!.paymentRequest!.handle!.handle).toBe('(512) 555-0134')
  }, 120_000)

  it('refuses a burned handle', async () => {
    await local!.paymentHandle.upsert({
      where: { method_handle: { method: 'CHIME', handle: '$BurnedTest' } },
      create: { method: 'CHIME', handle: '$BurnedTest', burnedAt: new Date(), burnReason: 'account frozen' },
      update: { burnedAt: new Date(), burnReason: 'account frozen' },
    })
    const { order } = await placeWithChat({ preferredPaymentMethod: 'CHIME' })
    const result = await issuePaymentDetails({ orderNumber: order.orderNumber, method: 'CHIME', payTo: '$BurnedTest', actorEmail: 'o@x.test' })
    expect(result).toMatchObject({ ok: false })
    expect((result as { error: string }).error).toMatch(/burned \(account frozen\)/)
    expect((await local!.order.findUnique({ where: { orderNumber: order.orderNumber } }))!.status).toBe('PENDING_VERIFICATION')
  })

  it('refuses an order the customer has already paid or claimed', async () => {
    const { order } = await placeWithChat({ status: 'PAYMENT_CLAIMED' })
    const result = await issuePaymentDetails({ orderNumber: order.orderNumber, method: 'CASHAPP', payTo: '$Late', actorEmail: 'o@x.test' })
    expect(result).toMatchObject({ ok: false })
  })

  it('with no chat on file, still emails, and says so', async () => {
    const order = makeOrder()
    await orders.create(order)
    const result = await issuePaymentDetails({ orderNumber: order.orderNumber, method: 'CASHAPP', payTo: '$NoChat', actorEmail: 'o@x.test' })
    expect(result).toMatchObject({ ok: true, chat: 'no-chat', email: 'sent', invoiceAttached: true })
  }, 120_000)

  it('if the invoice cannot be stored, the details still go to chat and email as text, and it is reported', async () => {
    storageFails = true
    const { order, threadId } = await placeWithChat()
    const result = await issuePaymentDetails({ orderNumber: order.orderNumber, method: 'CASHAPP', payTo: '$NoImage', actorEmail: 'o@x.test' })
    expect(result).toMatchObject({ ok: true, chat: 'sent', email: 'sent', invoiceAttached: false })
    const messages = await local!.supportMessage.findMany({ where: { threadId } })
    expect(messages[0]!.attachmentKey).toBeNull()
    expect(messages[0]!.body).toContain('$NoImage')
    expect(sent[0]!.attachments).toBeUndefined()
    expect(reported.length).toBeGreaterThan(0)
  }, 120_000)

  it('renews a reservation that has lapsed', async () => {
    const { order } = await placeWithChat({ expiresAt: new Date(Date.now() - 3600_000).toISOString() })
    const result = await issuePaymentDetails({ orderNumber: order.orderNumber, method: 'CASHAPP', payTo: '$Renew', actorEmail: 'o@x.test' })
    expect(result.ok).toBe(true)
    const row = await local!.order.findUnique({ where: { orderNumber: order.orderNumber }, include: { events: true } })
    expect(row!.expiresAt!.getTime()).toBeGreaterThan(Date.now() + 47 * 3600_000)
    expect(row!.events.find((e) => e.type === 'AWAITING_PAYMENT')!.message).toMatch(/Reservation renewed/)
  }, 120_000)
})

describe.skipIf(!local)('the order and its chat, against Postgres', () => {
  beforeAll(async () => {
    await local!.$connect()
    setOrderProvider(createPrismaOrderProvider())
  })

  it('finds the linked conversation, and forgets it once the thread is deleted', async () => {
    const { order, threadId } = await placeWithChat()
    expect(await chatThreadForOrder(order.id)).toBe(threadId)
    await local!.supportThread.delete({ where: { id: threadId } })
    expect(await chatThreadForOrder(order.id)).toBeNull()
  })

  it('posts the RECEIVED invoice into the chat when an order is placed', async () => {
    const { order, threadId } = await placeWithChat()
    await sendReceivedInvoice(order, threadId, 'Cash App')
    const messages = await local!.supportMessage.findMany({ where: { threadId } })
    expect(messages).toHaveLength(1)
    expect(messages[0]!.attachmentKey).toMatch(new RegExp(`^private/invoices/${order.orderNumber}/received-\\d+\\.png$`))
    expect(messages[0]!.body).toContain(`Order ID: ${order.orderNumber}`)
    const events = await local!.orderEvent.findMany({ where: { orderId: order.id, type: 'INVOICE_SENT' } })
    expect(events).toHaveLength(1)
  }, 120_000)

  it("a system message does not replace the customer's message as the inbox preview", async () => {
    const thread = await local!.supportThread.create({ data: { visitorId: randomUUID(), publicId: `SG-${randomUUID().slice(0, 6)}` } })
    await postMessage({ threadId: thread.id, fromCustomer: true, body: 'Do you ship to Texas?' })
    await postMessage({ threadId: thread.id, fromCustomer: false, isSystem: true, body: 'Welcome to SnypeGate.' })
    const after = await local!.supportThread.findUnique({ where: { id: thread.id } })
    expect(after!.lastMessageText).toBe('Do you ship to Texas?')
    expect(after!.lastSender).toBe('CUSTOMER')
    expect(after!.unreadForCustomer).toBe(0)
  })
})
