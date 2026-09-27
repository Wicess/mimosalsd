import { NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db/client'
import { visitorId } from '@/lib/chat/core'
import { reportError } from '@/lib/observability/report-error'
import { isAllowedPushEndpoint, platformFromUserAgent } from '@/lib/push/payload'
import { vapidKeys } from '@/lib/push/server'

/**
 * Push subscriptions, from the browser.
 *
 *  GET     the public key a browser subscribes with
 *  POST    save (or refresh) this browser's subscription, tied to the visitor cookie
 *  DELETE  forget it
 *
 * The visitor cookie is how a chat reply finds the right phone, so a subscription
 * is only ever attached to the cookie the request itself carries, and only from
 * this site: a cross-site request is refused before anything is read.
 */
const NO_STORE = { 'cache-control': 'no-store' }

function sameSite(request: Request): boolean {
  const origin = request.headers.get('origin')
  if (!origin) return request.headers.get('sec-fetch-site') !== 'cross-site'
  try {
    return new URL(origin).host === new URL(request.url).host
  } catch {
    return false
  }
}

const base64url = z.string().regex(/^[A-Za-z0-9_-]+={0,2}$/)

const subscribeSchema = z.object({
  endpoint: z.string().max(1000).url(),
  keys: z.object({ p256dh: base64url.min(80).max(100), auth: base64url.min(16).max(40) }),
  installed: z.boolean().optional(),
  platform: z.enum(['ios', 'android', 'desktop']).optional(),
  /** The endpoint this one replaces, when the browser rotated its subscription. */
  replaces: z.string().max(1000).optional(),
})

export async function GET(): Promise<Response> {
  try {
    const { publicKey } = await vapidKeys()
    return NextResponse.json({ publicKey }, { headers: NO_STORE })
  } catch (error) {
    await reportError(error, { source: 'route', routePath: '/api/push/subscribe', context: { stage: 'key' } })
    return NextResponse.json({ error: 'Notifications are unavailable right now.' }, { status: 503, headers: NO_STORE })
  }
}

export async function POST(request: Request): Promise<Response> {
  if (!sameSite(request)) return NextResponse.json({ error: 'Forbidden.' }, { status: 403, headers: NO_STORE })
  const parsed = subscribeSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success || !isAllowedPushEndpoint(parsed.data.endpoint)) {
    return NextResponse.json({ error: 'Invalid subscription.' }, { status: 422, headers: NO_STORE })
  }
  const input = parsed.data
  try {
    const visitor = await visitorId(true)
    const platform = input.platform ?? platformFromUserAgent(request.headers.get('user-agent'))
    const now = new Date()
    await db.pushSubscription.upsert({
      where: { endpoint: input.endpoint },
      create: {
        endpoint: input.endpoint,
        p256dh: input.keys.p256dh,
        auth: input.keys.auth,
        visitorId: visitor,
        platform,
        installed: input.installed ?? false,
      },
      update: {
        p256dh: input.keys.p256dh,
        auth: input.keys.auth,
        ...(visitor ? { visitorId: visitor } : {}),
        platform,
        ...(input.installed ? { installed: true } : {}),
        lastSeenAt: now,
        failures: 0,
      },
    })
    if (input.replaces && input.replaces !== input.endpoint) {
      await db.pushSubscription.deleteMany({ where: { endpoint: input.replaces } })
    }
    return NextResponse.json({ ok: true }, { headers: NO_STORE })
  } catch (error) {
    await reportError(error, { source: 'route', routePath: '/api/push/subscribe', context: { stage: 'save' } })
    return NextResponse.json({ error: 'Could not turn on notifications. Please try again.' }, { status: 500, headers: NO_STORE })
  }
}

const unsubscribeSchema = z.object({ endpoint: z.string().max(1000) })

export async function DELETE(request: Request): Promise<Response> {
  if (!sameSite(request)) return NextResponse.json({ error: 'Forbidden.' }, { status: 403, headers: NO_STORE })
  const parsed = unsubscribeSchema.safeParse(await request.json().catch(() => null))
  if (parsed.success) {
    await db.pushSubscription.deleteMany({ where: { endpoint: parsed.data.endpoint } }).catch(() => null)
  }
  return new Response(null, { status: 204, headers: NO_STORE })
}
