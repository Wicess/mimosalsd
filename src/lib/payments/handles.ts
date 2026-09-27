import 'server-only'
import { db } from '@/lib/db/client'
import type { PaymentMethod } from '@/lib/orders/types'

/**
 * ─────────────────────────────────────────────────────────────────────────────
 *  PAYMENT HANDLE POOL — server-only. Read this before changing it.
 *
 *  Handles are NEVER rendered into a public page, a product page, or any HTML
 *  served before an order exists. They are resolved here, on the server, and only
 *  for a request that already carries a valid order token.
 *
 *  Why this matters commercially: scrapers harvest payment handles from static
 *  pages within days, the receiving accounts get frozen for ToS violations on
 *  regulated goods, and revenue stops with no error message anywhere to explain
 *  why. Rotation plus burn-tracking is what makes that recoverable instead of fatal.
 *
 *  `import 'server-only'` makes accidentally importing this into a client component
 *  a BUILD error rather than a silent leak.
 * ─────────────────────────────────────────────────────────────────────────────
 */

export interface PaymentHandle {
  readonly id: string
  readonly method: PaymentMethod
  readonly handle: string
  readonly label?: string
  readonly isActive: boolean
  readonly burnedAt?: string
}

/**
 * Seeded from the environment so real handles never enter version control.
 * Format: `PAYMENT_HANDLES_CASHAPP="$handle1,$handle2"`
 */
function fromEnv(method: PaymentMethod, key: string): PaymentHandle[] {
  const raw = process.env[key]
  if (!raw) return []
  return raw
    .split(',')
    .map((h) => h.trim())
    .filter(Boolean)
    .map((handle, i) => ({
      id: `${method.toLowerCase()}-${i}`,
      method,
      handle,
      isActive: true,
    }))
}

function envPool(): PaymentHandle[] {
  return [
    ...fromEnv('CASHAPP', 'PAYMENT_HANDLES_CASHAPP'),
    ...fromEnv('CHIME', 'PAYMENT_HANDLES_CHIME'),
    ...fromEnv('APPLE_CASH', 'PAYMENT_HANDLES_APPLE_CASH'),
  ]
}

/**
 * The pool as an operator manages it, in Admin → Payments.
 *
 * This read is why that page exists. It used to resolve from the environment only,
 * while the admin added, listed and burned rows in a table that nothing ever read:
 * an operator who put their real Cash App handle in the pool watched it appear in
 * the list and reasonably believed customers were being given it. They were not —
 * and burning a compromised handle changed nothing at all, which is the failure
 * this whole module exists to prevent.
 *
 * The table wins over the environment because it is the only one of the two that
 * can express a burn: an env var has no burnedAt and no reason.
 *
 * Deliberately not cached. A burned handle has to stop being issued on the very
 * next request rather than when a cache lapses, and the page that asks for this has
 * already opened the connection to read the order.
 */
async function storedPool(): Promise<PaymentHandle[]> {
  // Columns named one by one: a bare findMany selects every column Prisma knows
  // about, so a deploy landing before its migration would break the order page.
  const rows = await db.paymentHandle.findMany({
    where: { isActive: true, burnedAt: null },
    select: { id: true, method: true, handle: true, label: true },
    orderBy: { createdAt: 'asc' },
  })
  return rows.map((row) => ({
    id: row.id,
    method: row.method as PaymentMethod,
    handle: row.handle,
    ...(row.label ? { label: row.label } : {}),
    isActive: true,
  }))
}

/** Every handle that may be issued: the admin's pool, or the environment if it is empty. */
export async function activeHandles(): Promise<PaymentHandle[]> {
  try {
    const stored = await storedPool()
    if (stored.length > 0) return stored
  } catch {
    /*
      The database is unreachable. Fall through to the environment rather than
      throw: some deployments still carry handles there, and an order page that
      cannot name a handle already says the team will email the details, which is
      a far better outcome for a customer than an error page.
    */
  }
  return envPool().filter((handle) => handle.isActive && !handle.burnedAt)
}

/**
 * Pick a handle for an order. Deterministic on the order token so a customer who
 * refreshes the instructions page sees the SAME handle — a rotating handle across
 * refreshes reads as a scam, and support cannot reconcile which account was paid.
 *
 * Pure: the pool is an argument, so which handle an order gets can be tested
 * exhaustively without a database anywhere near it.
 */
export function pickHandle(
  method: PaymentMethod,
  orderToken: string,
  pool: readonly PaymentHandle[],
): PaymentHandle | undefined {
  const candidates = pool.filter((h) => h.method === method && h.isActive && !h.burnedAt)
  if (candidates.length === 0) return undefined
  let hash = 0
  for (let i = 0; i < orderToken.length; i++) {
    hash = (hash * 31 + orderToken.charCodeAt(i)) >>> 0
  }
  return candidates[hash % candidates.length]
}

/** The handle this order is to be paid to, or undefined when the pool is empty. */
export async function resolveHandle(
  method: PaymentMethod,
  orderToken: string,
): Promise<PaymentHandle | undefined> {
  return pickHandle(method, orderToken, await activeHandles())
}

export async function hasConfiguredHandles(method: PaymentMethod): Promise<boolean> {
  return (await activeHandles()).some((handle) => handle.method === method)
}

/**
 * Bitcoin is the one method that can be genuinely automated: a unique address per
 * order, a BIP-21 URI for the QR, a quote locked for 15 minutes, and auto-advance on
 * confirmations. Wired to BTCPay Server or an xpub derivation in the ops step; the
 * shape is fixed here so checkout can render against it now.
 */
export interface BitcoinPaymentRequest {
  readonly address: string
  readonly amountSats: bigint
  readonly bip21: string
  readonly quoteLockedUntil: string
}

export function buildBip21(address: string, amountBtc: string, label: string): string {
  return `bitcoin:${address}?amount=${amountBtc}&label=${encodeURIComponent(label)}`
}
