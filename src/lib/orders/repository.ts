import { randomBytes, randomUUID } from 'node:crypto'
import type { Order, OrderEvent, OrderStatus } from './types'

/**
 * Order repository.
 *
 * Database-backed whenever DATABASE_URL is set, in-memory otherwise (see `current`
 * below for why that is chosen here and not at boot). Same pluggable-provider shape
 * as the catalogue and the state rules; `setOrderProvider` exists for tests.
 */
export interface OrderProvider {
  create(order: Order): Promise<Order>
  findByToken(token: string): Promise<Order | undefined>
  findByNumber(orderNumber: string): Promise<Order | undefined>
  appendEvent(token: string, event: OrderEvent, nextStatus?: OrderStatus): Promise<Order | undefined>
  list(): Promise<readonly Order[]>
}

export function createInMemoryOrders(): OrderProvider {
  const byToken = new Map<string, Order>()

  return {
    async create(order) {
      byToken.set(order.orderToken, order)
      return order
    },
    async findByToken(token) {
      return byToken.get(token)
    },
    async findByNumber(orderNumber) {
      return [...byToken.values()].find((o) => o.orderNumber === orderNumber)
    },
    async appendEvent(token, event, nextStatus) {
      const existing = byToken.get(token)
      if (!existing) return undefined
      // Events are append-only. The array is rebuilt, never mutated in place.
      const updated: Order = {
        ...existing,
        status: nextStatus ?? existing.status,
        events: [...existing.events, event],
      }
      byToken.set(token, updated)
      return updated
    },
    async list() {
      return [...byToken.values()]
    },
  }
}

/**
 * Which store orders go to, decided HERE, in whichever bundle asks.
 *
 * It used to be decided in instrumentation.ts, which called setOrderProvider() at
 * boot. But instrumentation is compiled as its own bundle with its own copy of
 * this module, so it set the provider on a copy nothing else reads. In a
 * production build every order went to the in-memory store above: the customer
 * got an order page and a confirmation email, the operator got an alert, and the
 * order was never written to the database and was gone on the next restart or
 * serverless instance. Verified against a local database: the order's status
 * page rendered, the Order table was empty, and after a restart the page 404'd.
 *
 * So the choice is lazy and local. The first call in any bundle picks the
 * database when DATABASE_URL is set, and memory otherwise (tests, and a checkout
 * with no database). An explicit setOrderProvider(), which tests use, always wins.
 */
let provider: OrderProvider | undefined
let choosing: Promise<OrderProvider> | undefined

async function current(): Promise<OrderProvider> {
  if (provider) return provider
  choosing ??= (async () => {
    if (!process.env.DATABASE_URL) return createInMemoryOrders()
    const { createPrismaOrderProvider } = await import('./prisma-provider')
    return createPrismaOrderProvider()
  })()
  const chosen = await choosing
  // A setOrderProvider() that landed while this was loading takes precedence.
  provider ??= chosen
  return provider
}

export function setOrderProvider(next: OrderProvider): void {
  provider = next
}

export function resetOrderProvider(): void {
  provider = createInMemoryOrders()
}

export const orders = {
  create: async (order: Order) => (await current()).create(order),
  findByToken: async (token: string) => (await current()).findByToken(token),
  findByNumber: async (n: string) => (await current()).findByNumber(n),
  appendEvent: async (token: string, event: OrderEvent, nextStatus?: OrderStatus) =>
    (await current()).appendEvent(token, event, nextStatus),
  list: async () => (await current()).list(),
}

/**
 * 32 bytes of CSPRNG entropy, base64url.
 *
 * This token is the ONLY thing protecting an order's contents and payment
 * instructions — there is no login on this path. A sequential id or a timestamp
 * would make every customer's order enumerable.
 */
export function generateOrderToken(): string {
  return randomBytes(32).toString('base64url')
}

export function generateOrderId(): string {
  return randomUUID()
}

/**
 * Crockford's base-32 alphabet: the digits and capital letters without I, L, O and
 * U. A customer reads this ID aloud to support and types it into a payment note, and
 * those are the four characters people misread as 1, 1, 0 and V.
 */
export const ORDER_ID_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'

/**
 * The Order ID: the one reference a customer sees, quotes and puts in a payment note,
 * shaped `YYYYMM-XXXXXX` (e.g. `202609-K7Q4M9`).
 *
 * The suffix is random so order volume is not disclosed. It was six hex characters,
 * which is 16.7 million IDs a month: at a few thousand orders the chance of two
 * orders drawing the same ID reaches the percent range, and the database's unique
 * index would then fail the second order's checkout. Base-32 gives 1.07 billion a
 * month, and checkout retries on the rare collision (see `isUniqueViolation`).
 *
 * Old hex IDs are still valid: every hex digit is also in this alphabet, so a
 * lookup that accepts the new shape accepts the old one too.
 */
export function generateOrderNumber(now = new Date()): string {
  const y = now.getUTCFullYear()
  const m = String(now.getUTCMonth() + 1).padStart(2, '0')
  // 256 is a multiple of 32, so taking each byte modulo 32 introduces no bias.
  const suffix = Array.from(randomBytes(6), (byte) => ORDER_ID_ALPHABET[byte % 32]).join('')
  return `${y}${m}-${suffix}`
}

/** True for anything shaped like an Order ID, old hex ones included. Case-insensitive. */
export const ORDER_ID_PATTERN = /^\d{6}-[0-9A-HJKMNP-TV-Z]{6}$/i
