import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  generateOrderId,
  generateOrderNumber,
  generateOrderToken,
  orders,
  resetOrderProvider,
  setOrderProvider,
} from '@/lib/orders/repository'
import { PAYMENT_LABELS, PAYMENT_METHODS, type Order } from '@/lib/orders/types'
import { buildBip21, pickHandle, type PaymentHandle } from '@/lib/payments/handles'

beforeEach(() => resetOrderProvider())
afterEach(() => vi.unstubAllEnvs())

function makeOrder(over: Partial<Order> = {}): Order {
  const token = generateOrderToken()
  return {
    id: 'order-1',
    orderNumber: generateOrderNumber(new Date('2026-08-28')),
    orderToken: token,
    status: 'PENDING_VERIFICATION',
    email: 'buyer@example.com',
    phone: '+15125550123',
    firstName: 'Test',
    lastName: 'Buyer',
    addressLine1: '1 Main St',
    city: 'Austin',
    stateCode: 'TX',
    postalCode: '78701',
    items: [],
    shipments: [],
    subtotalCents: 4500,
    shippingCents: 795,
    paymentDiscountCents: 0,
    discountCents: 0,
    subscriberDiscountCents: 0,
    appDiscountCents: 0,
    totalCents: 5295,
    freeShippingApplied: false,
    preferredPaymentMethod: 'CASHAPP',
    attestations: [],
    events: [
      { type: 'CREATED', message: 'Order request received.', at: new Date().toISOString() },
    ],
    complianceSnapshot: {
      stateCode: 'TX',
      evaluatedAt: new Date().toISOString(),
      requiresAgeVerification: false,
      requiresAdultSignature: false,
    },
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 48 * 3600_000).toISOString(),
    ...over,
  }
}

describe('order tokens', () => {
  it('are long and unguessable', () => {
    const token = generateOrderToken()
    // 32 bytes of CSPRNG entropy, base64url — this token is the ONLY thing
    // protecting an order's contents and payment instructions.
    expect(token.length).toBeGreaterThanOrEqual(43)
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/)
  })

  it('are unique across many generations', () => {
    const tokens = new Set(Array.from({ length: 2000 }, generateOrderToken))
    expect(tokens.size).toBe(2000)
  })

  it('produce order numbers that do not disclose volume', () => {
    const a = generateOrderNumber(new Date('2026-08-28'))
    const b = generateOrderNumber(new Date('2026-08-28'))
    // Crockford base-32: no I, L, O or U, which are read as 1, 1, 0 and V.
    expect(a).toMatch(/^202608-[0-9A-HJKMNP-TV-Z]{6}$/)
    expect(a).not.toBe(b) // not sequential
  })
})

describe('order lifecycle', () => {
  it('creates and retrieves an order by token', async () => {
    const order = await orders.create(makeOrder())
    expect(await orders.findByToken(order.orderToken)).toEqual(order)
  })

  it('returns undefined for an unknown token rather than leaking anything', async () => {
    expect(await orders.findByToken('nope')).toBeUndefined()
  })

  it('appends events without mutating history', async () => {
    const order = await orders.create(makeOrder())
    const updated = await orders.appendEvent(
      order.orderToken,
      {
        type: 'PAYMENT_CLAIMED',
        message: 'Customer reported payment sent.',
        at: new Date().toISOString(),
        fromStatus: 'PENDING_VERIFICATION',
        toStatus: 'PAYMENT_CLAIMED',
      },
      'PAYMENT_CLAIMED',
    )
    expect(updated?.status).toBe('PAYMENT_CLAIMED')
    expect(updated?.events).toHaveLength(2)
    // The original CREATED event is still first and unchanged.
    expect(updated?.events[0]?.type).toBe('CREATED')
  })

  it('preserves the full event chain across several transitions', async () => {
    const order = await orders.create(makeOrder())
    for (const [type, status] of [
      ['PAYMENT_CLAIMED', 'PAYMENT_CLAIMED'],
      ['VERIFIED', 'PAID'],
      ['PACKED', 'PACKED'],
      ['SHIPPED', 'SHIPPED'],
    ] as const) {
      await orders.appendEvent(
        order.orderToken,
        { type, message: type, at: new Date().toISOString(), toStatus: status },
        status,
      )
    }
    const final = await orders.findByToken(order.orderToken)
    expect(final?.status).toBe('SHIPPED')
    expect(final?.events.map((e) => e.type)).toEqual([
      'CREATED', 'PAYMENT_CLAIMED', 'VERIFIED', 'PACKED', 'SHIPPED',
    ])
  })

  it('sets a 48-hour expiry so unpaid orders release inventory', () => {
    const order = makeOrder()
    const hours =
      (new Date(order.expiresAt).getTime() - new Date(order.createdAt).getTime()) / 3600_000
    expect(hours).toBeCloseTo(48, 0)
  })
})

describe('payment method labelling', () => {
  it('labels the wallet Apple Cash, never Apple Pay', () => {
    // Apple Pay needs an acquiring processor we deliberately do not have — that is
    // what keeps PCI scope at zero. A fake Apple Pay button is a trust liability.
    expect(PAYMENT_LABELS.APPLE_CASH).toBe('Apple Cash')
    expect(Object.values(PAYMENT_LABELS)).not.toContain('Apple Pay')
  })

  it('offers exactly the four supported methods', () => {
    expect([...PAYMENT_METHODS]).toEqual(['CASHAPP', 'CHIME', 'APPLE_CASH', 'BITCOIN'])
  })
})

describe('payment handle pool', () => {
  const handle = (id: string, h: string, over: Partial<PaymentHandle> = {}): PaymentHandle => ({
    id,
    method: 'CASHAPP',
    handle: h,
    isActive: true,
    ...over,
  })
  const four = ['$a', '$b', '$c', '$d'].map((h, i) => handle(`h${i}`, h))

  it('picks nothing from an empty pool', () => {
    expect(pickHandle('CASHAPP', generateOrderToken(), [])).toBeUndefined()
  })

  it('picks a handle of the method asked for', () => {
    const picked = pickHandle('CASHAPP', generateOrderToken(), [handle('h', '$acme'), handle('i', '$acme2')])
    expect(picked?.method).toBe('CASHAPP')
    expect(['$acme', '$acme2']).toContain(picked?.handle)
  })

  it('is stable for a given order across repeated views', () => {
    const token = generateOrderToken()
    // A handle that changed on refresh would read as a scam, and support could not
    // reconcile which account was actually paid.
    const first = pickHandle('CASHAPP', token, four)
    for (let i = 0; i < 20; i++) {
      expect(pickHandle('CASHAPP', token, four)?.handle).toBe(first?.handle)
    }
  })

  it('distributes across the pool for different orders', () => {
    const seen = new Set(
      Array.from({ length: 200 }, () => pickHandle('CASHAPP', generateOrderToken(), four)?.handle),
    )
    expect(seen.size).toBeGreaterThan(1)
  })

  it('never returns a handle for a method that has none', () => {
    expect(pickHandle('CHIME', generateOrderToken(), four)).toBeUndefined()
  })

  /*
    Burning is the whole point of the pool: once an account is frozen or scraped,
    the next customer's money must not be sent to it. A burned or disabled handle
    is never issued, whatever else is in the pool.
  */
  it('never issues a burned or disabled handle', () => {
    const burned = handle('b', '$burned', { burnedAt: '2026-09-01T00:00:00.000Z' })
    const off = handle('o', '$off', { isActive: false })
    for (let i = 0; i < 50; i++) {
      const picked = pickHandle('CASHAPP', generateOrderToken(), [burned, off, handle('g', '$good')])
      expect(picked?.handle).toBe('$good')
    }
    expect(pickHandle('CASHAPP', generateOrderToken(), [burned, off])).toBeUndefined()
  })

  it('builds a valid BIP-21 URI', () => {
    const uri = buildBip21('bc1qexampleaddress', '0.00123', 'Order 202608-ABC123')
    expect(uri).toMatch(/^bitcoin:bc1qexampleaddress\?amount=0\.00123&label=/)
    expect(uri).toContain('Order%20202608-ABC123')
  })
})

describe('order lookup and listing', () => {
  it('finds an order by its human-facing number', async () => {
    const order = await orders.create(makeOrder())
    expect((await orders.findByNumber(order.orderNumber))?.id).toBe(order.id)
    expect(await orders.findByNumber('202601-ZZZZZZ')).toBeUndefined()
  })

  it('lists created orders for the admin queue', async () => {
    await orders.create(makeOrder({ id: 'a' }))
    await orders.create(makeOrder({ id: 'b' }))
    expect(await orders.list()).toHaveLength(2)
  })

  it('returns undefined when appending to an order that does not exist', async () => {
    expect(
      await orders.appendEvent('missing', {
        type: 'X',
        message: 'x',
        at: new Date().toISOString(),
      }),
    ).toBeUndefined()
  })
})

describe('order id generation and provider swapping', () => {
  it('generates unique order ids', () => {
    const ids = new Set(Array.from({ length: 500 }, generateOrderId))
    expect(ids.size).toBe(500)
  })

  it('can swap in a different provider and reset back', async () => {
    // This is the seam a Prisma-backed provider plugs into at boot, with no page
    // or component touched.
    const captured: Order[] = []
    setOrderProvider({
      async create(order) {
        captured.push(order)
        return order
      },
      async findByToken() {
        return undefined
      },
      async findByNumber() {
        return undefined
      },
      async appendEvent() {
        return undefined
      },
      async list() {
        return captured
      },
    })

    const order = makeOrder()
    await orders.create(order)
    expect(captured).toHaveLength(1)
    expect(await orders.findByToken(order.orderToken)).toBeUndefined()

    resetOrderProvider()
    await orders.create(order)
    expect(await orders.findByToken(order.orderToken)).toBeDefined()
  })
})
