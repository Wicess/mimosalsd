import 'server-only'
import { db } from '@/lib/db/client'

/**
 * Customer reads for the admin panel. Customers are derived from orders — guest
 * checkout is the norm, so there is no accounts table to read instead.
 *
 * Grouping happens in SQL on `lower(trim(email))`, never with Prisma's
 * `mode: 'insensitive'`. On PostgreSQL that compiles to ILIKE, which reads `_` and
 * `%` as wildcards — and an underscore is ordinary in an email address, so
 * "jo_n@x.com" would pull in "join@x.com"'s orders. Raw SQL is the exact comparison.
 * Every value is a bound parameter via the tagged template; nothing is interpolated.
 */

const ORDER_FIELDS = {
  id: true,
  orderNumber: true,
  email: true,
  phone: true,
  firstName: true,
  lastName: true,
  addressLine1: true,
  addressLine2: true,
  city: true,
  stateCode: true,
  postalCode: true,
  status: true,
  totalCents: true,
  discountCents: true,
  couponCode: true,
  preferredPaymentMethod: true,
  createdAt: true,
  refunds: { select: { amountCents: true } },
} as const

async function ordersByIds(ids: readonly string[]) {
  if (ids.length === 0) return []
  return db.order.findMany({
    where: { id: { in: [...ids] } },
    select: ORDER_FIELDS,
    // Oldest first: a customer's first order is their stable anchor (see the page).
    orderBy: { createdAt: 'asc' },
  })
}

export type CustomerOrderRow = Awaited<ReturnType<typeof ordersByIds>>[number]

/**
 * The orders of the `limit` most recently active customers, optionally narrowed to
 * those whose email or name contains `query`. `strpos` rather than LIKE, so a search
 * containing `_` or `%` means those characters and not "anything".
 */
export async function recentCustomerOrders({
  query = '',
  limit = 100,
}: { query?: string; limit?: number } = {}): Promise<CustomerOrderRow[]> {
  const needle = query.trim().toLowerCase()
  const rows = await db.$queryRaw<{ id: string }[]>`
    SELECT id FROM "Order"
    WHERE lower(trim(email)) IN (
      SELECT lower(trim(email)) FROM "Order"
      WHERE ${needle}::text = ''
         OR strpos(lower(email), ${needle}::text) > 0
         OR strpos(lower("firstName" || ' ' || "lastName"), ${needle}::text) > 0
      GROUP BY 1
      ORDER BY max("createdAt") DESC
      LIMIT ${limit}::int
    )`
  return ordersByIds(rows.map((row) => row.id))
}

/** Every order placed under the same address as `orderNumber`'s, oldest first. */
export async function customerOrdersFor(orderNumber: string): Promise<CustomerOrderRow[]> {
  const rows = await db.$queryRaw<{ id: string }[]>`
    SELECT o.id FROM "Order" o
    JOIN "Order" anchor ON lower(trim(anchor.email)) = lower(trim(o.email))
    WHERE anchor."orderNumber" = ${orderNumber}`
  return ordersByIds(rows.map((row) => row.id))
}

export interface CustomerContact {
  readonly threads: readonly {
    publicId: string | null
    subject: string | null
    isOpen: boolean
    lastMessageAt: Date
  }[]
  readonly newsletter: { isActive: boolean; confirmedAt: Date | null } | null
}

/** Conversations and newsletter status under the same address. */
export async function customerContact(email: string): Promise<CustomerContact> {
  const [threads, subscribers] = await Promise.all([
    db.$queryRaw<CustomerContact['threads'][number][]>`
      SELECT "publicId", subject, "isOpen", "lastMessageAt" FROM "SupportThread"
      WHERE lower(trim(email)) = lower(trim(${email}))
      ORDER BY "lastMessageAt" DESC
      LIMIT 10`,
    db.$queryRaw<{ isActive: boolean; confirmedAt: Date | null }[]>`
      SELECT "isActive", "confirmedAt" FROM "NewsletterSubscriber"
      WHERE lower(trim(email)) = lower(trim(${email}))
      LIMIT 1`,
  ])
  return { threads, newsletter: subscribers[0] ?? null }
}
