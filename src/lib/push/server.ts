import { BRAND } from '@/lib/brand'
import { db } from '@/lib/db/client'
import { isUniqueViolation } from '@/lib/db/errors'
import { reportError } from '@/lib/observability/report-error'
import { absoluteUrl } from '@/lib/seo/routes'
import { encryptPayload, generateVapidKeys, vapidAuthorization, type VapidKeys } from '@/lib/push/crypto'
import { buildPayload, type PushMessage } from '@/lib/push/payload'

/**
 * ─────────────────────────────────────────────────────────────────────────────
 *  SENDING PUSH NOTIFICATIONS.
 *
 *  One request per subscribed browser, straight to its push service (Google,
 *  Apple, Mozilla, Microsoft), which wakes the phone and hands the message to our
 *  service worker even when the site is closed. That is the part that makes it
 *  behave like a messaging app: nothing of ours has to be running on the phone.
 *
 *  Database writes are batched per send, not per recipient: a broadcast to a
 *  thousand people is three statements, not a thousand.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const KEY_ID = 'vapid'
let cachedKeys: VapidKeys | null = null

/**
 * The site's VAPID key pair, created the first time anything asks for it.
 *
 * Two first requests at once both generate a pair; the primary key lets exactly
 * one insert win, and the loser reads the winner's back, so every subscriber is
 * always tied to the one stored pair.
 */
export async function vapidKeys(): Promise<VapidKeys> {
  if (cachedKeys) return cachedKeys
  const existing = await db.pushKey.findUnique({ where: { id: KEY_ID } })
  if (existing) {
    cachedKeys = { publicKey: existing.publicKey, privateKey: existing.privateKey }
    return cachedKeys
  }
  const fresh = generateVapidKeys()
  try {
    await db.pushKey.create({ data: { id: KEY_ID, ...fresh } })
    cachedKeys = fresh
  } catch (error) {
    if (!isUniqueViolation(error)) throw error
    const winner = await db.pushKey.findUniqueOrThrow({ where: { id: KEY_ID } })
    cachedKeys = { publicKey: winner.publicKey, privateKey: winner.privateKey }
  }
  return cachedKeys
}

/** For tests, which swap the database underneath. */
export function forgetCachedVapidKeys(): void {
  cachedKeys = null
}

type Transport = (endpoint: string, init: RequestInit) => Promise<Response>
let transport: Transport = (endpoint, init) => fetch(endpoint, init)

/** Tests replace the network; nothing else should. */
export function setPushTransport(next: Transport | null): void {
  transport = next ?? ((endpoint, init) => fetch(endpoint, init))
}

export interface SendOptions {
  /**
   * How long the push service keeps trying a phone that is off. A chat reply is
   * still worth a day later; an announcement three days.
   */
  readonly ttlSeconds: number
  /** `high` wakes a phone in battery saver, which is what a reply deserves. */
  readonly urgency: 'normal' | 'high'
}

type Target = { readonly id: string; readonly endpoint: string; readonly p256dh: string; readonly auth: string }
type Outcome = 'delivered' | 'gone' | 'failed'

/** A subscription is dropped after this many failures in a row. */
const MAX_FAILURES = 5

async function deliver(target: Target, payload: string, options: SendOptions, keys: VapidKeys): Promise<Outcome> {
  let body: Buffer
  try {
    body = encryptPayload({ p256dh: target.p256dh, auth: target.auth, plaintext: Buffer.from(payload) })
  } catch {
    // Keys a browser could never have produced. Nothing will ever reach it.
    return 'gone'
  }
  try {
    const response = await transport(target.endpoint, {
      method: 'POST',
      headers: {
        TTL: String(options.ttlSeconds),
        Urgency: options.urgency,
        'Content-Type': 'application/octet-stream',
        'Content-Encoding': 'aes128gcm',
        Authorization: vapidAuthorization({ endpoint: target.endpoint, keys, subject: `mailto:${BRAND.email}` }),
      },
      body: new Uint8Array(body),
      signal: AbortSignal.timeout(10_000),
    })
    // 404 and 410 are the push service saying the subscription is over: the app
    // was removed, notifications were switched off, or the browser was reset.
    if (response.status === 404 || response.status === 410) return 'gone'
    return response.ok ? 'delivered' : 'failed'
  } catch {
    return 'failed'
  }
}

export interface SendTally {
  readonly recipients: number
  readonly delivered: number
  readonly failed: number
  readonly removed: number
}

async function sendToTargets(targets: readonly Target[], message: PushMessage, options: SendOptions): Promise<SendTally> {
  if (targets.length === 0) return { recipients: 0, delivered: 0, failed: 0, removed: 0 }
  const keys = await vapidKeys()
  const payload = buildPayload(message, absoluteUrl('/'))

  const delivered: string[] = []
  const failed: string[] = []
  const gone: string[] = []
  // Twenty at a time: fast enough for a list in the thousands inside one request,
  // and gentle on the push services.
  let next = 0
  async function worker() {
    for (let target = targets[next++]; target; target = targets[next++]) {
      const outcome = await deliver(target, payload, options, keys)
      ;(outcome === 'delivered' ? delivered : outcome === 'gone' ? gone : failed).push(target.id)
    }
  }
  await Promise.all(Array.from({ length: Math.min(20, targets.length) }, worker))

  const now = new Date()
  await Promise.all([
    delivered.length
      ? db.pushSubscription.updateMany({ where: { id: { in: delivered } }, data: { lastSentAt: now, failures: 0 } })
      : null,
    failed.length
      ? db.pushSubscription.updateMany({ where: { id: { in: failed } }, data: { failures: { increment: 1 } } })
      : null,
    gone.length ? db.pushSubscription.deleteMany({ where: { id: { in: gone } } }) : null,
  ])
  if (failed.length) {
    await db.pushSubscription.deleteMany({ where: { id: { in: failed }, failures: { gte: MAX_FAILURES } } })
  }
  return { recipients: targets.length, delivered: delivered.length, failed: failed.length, removed: gone.length }
}

const TARGET_FIELDS = { id: true, endpoint: true, p256dh: true, auth: true } as const

/**
 * Notify one visitor on every device they subscribed from. Never throws: a
 * notification that cannot be sent must not fail the reply or the order it is
 * about.
 */
export async function sendPushToVisitor(
  visitorId: string | null | undefined,
  message: PushMessage,
  options: SendOptions = { ttlSeconds: 24 * 60 * 60, urgency: 'high' },
): Promise<SendTally> {
  const none = { recipients: 0, delivered: 0, failed: 0, removed: 0 }
  if (!visitorId) return none
  try {
    const targets = await db.pushSubscription.findMany({
      where: { visitorId },
      select: TARGET_FIELDS,
      orderBy: { lastSeenAt: 'desc' },
      take: 10,
    })
    return await sendToTargets(targets, message, options)
  } catch (error) {
    await reportError(error, { source: 'route', severity: 'WARN', routePath: 'lib/push/server', context: { stage: 'visitor' } })
    return none
  }
}

/**
 * Notify everyone who is subscribed, and record the send. Pages through the list
 * so memory stays flat however long it grows.
 */
export async function broadcastPush(message: PushMessage, sentBy: string): Promise<SendTally & { id: string }> {
  const options: SendOptions = { ttlSeconds: 3 * 24 * 60 * 60, urgency: 'normal' }
  const total = { recipients: 0, delivered: 0, failed: 0, removed: 0 }
  let cursor: string | undefined
  for (;;) {
    // `id > last` rather than Prisma's cursor: the last row of a page may be one
    // this very send just deleted, and a cursor on a deleted row returns nothing.
    const page = await db.pushSubscription.findMany({
      where: cursor ? { id: { gt: cursor } } : undefined,
      select: TARGET_FIELDS,
      orderBy: { id: 'asc' },
      take: 500,
    })
    if (page.length === 0) break
    const tally = await sendToTargets(page, message, options)
    total.recipients += tally.recipients
    total.delivered += tally.delivered
    total.failed += tally.failed
    total.removed += tally.removed
    cursor = page.at(-1)?.id
    if (page.length < 500) break
  }
  const row = await db.pushBroadcast.create({
    data: { title: message.title, body: message.body, url: message.url, sentBy, ...total },
    select: { id: true },
  })
  return { id: row.id, ...total }
}
