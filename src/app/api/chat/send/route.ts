import { NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db/client'
import {
  alertOperator,
  clientIp,
  ensureThread,
  isBlocked,
  postMessage,
  visitorId,
} from '@/lib/chat/core'
import { cleanBody } from '@/lib/chat/rules'
import { forCustomer } from '@/lib/chat/serialize'
import { WELCOME_MESSAGE } from '@/lib/chat/welcome'
import { reportError } from '@/lib/observability/report-error'

/**
 * A customer sends a chat message.
 *
 * Public and unauthenticated, because the people worth talking to have not signed in.
 * So it is defended the way WHAM's is — a rate limit and an IP block — with one
 * honest difference: WHAM's limiter runs on Upstash Redis and holds across every
 * instance, and this site has no Redis. The limit here is per server instance. It
 * stops a burst from one browser, which is the common case; a distributed flood
 * would need Redis, and the IP block is the backstop for a persistent one.
 */

const schema = z.object({
  body: z.string().max(8000),
  // Optional identity a customer may offer. Stored for the operator, NEVER used to
  // find a thread — see lib/chat/core.ts on why an unverified email is not a key.
  email: z.string().trim().toLowerCase().email().max(320).optional().or(z.literal('')),
  name: z.string().trim().max(80).optional(),
})

/** 20 messages a minute per visitor per instance — WHAM's figure. */
const LIMIT = 20
const WINDOW_MS = 60_000
const recent = new Map<string, number[]>()

function allow(key: string): boolean {
  const now = Date.now()
  const hits = (recent.get(key) ?? []).filter((t) => now - t < WINDOW_MS)
  if (hits.length >= LIMIT) {
    recent.set(key, hits)
    return false
  }
  hits.push(now)
  recent.set(key, hits)
  // Bounded, so a stream of distinct visitors cannot grow this without limit.
  if (recent.size > 5000) recent.delete(recent.keys().next().value as string)
  return true
}

export async function POST(request: Request) {
  const ip = await clientIp()
  if (await isBlocked(ip)) {
    // Deliberately bland. Telling a blocked sender they are blocked invites them to
    // change IP and try again.
    return NextResponse.json({ ok: false, error: 'Could not send that message.' }, { status: 403 })
  }

  const parsed = schema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: 'Could not read that message.' }, { status: 400 })
  }

  const body = cleanBody(parsed.data.body)
  if (!body) {
    return NextResponse.json({ ok: false, error: 'Type a message first.' }, { status: 422 })
  }

  const visitor = await visitorId(true)
  if (!visitor) {
    return NextResponse.json({ ok: false, error: 'Could not start a conversation.' }, { status: 500 })
  }
  if (!allow(`${visitor}:${ip ?? ''}`)) {
    return NextResponse.json(
      { ok: false, error: 'That is a lot of messages at once — give it a moment.' },
      { status: 429 },
    )
  }

  try {
    const thread = await ensureThread({
      visitor,
      email: parsed.data.email || null,
      name: parsed.data.name || null,
    })

    // Read BEFORE writing: an alert fires only when a thread goes from "nothing
    // waiting" to "something waiting". A customer typing five messages in a row is
    // one conversation needing attention, not five phone buzzes.
    const wasWaiting = thread.unreadForAdmin > 0

    const message = await postMessage({
      threadId: thread.id,
      fromCustomer: true,
      body,
      ip,
    })

    // The shop speaks first once, and never races a duplicate. Guarded by whether
    // the shop has ever spoken here — the same question as a flag, with no extra
    // column to keep in sync.
    const shopHasSpoken = await db.supportMessage.count({
      where: { threadId: thread.id, fromCustomer: false },
    })
    if (shopHasSpoken === 0) {
      await postMessage({
        threadId: thread.id,
        fromCustomer: false,
        body: WELCOME_MESSAGE,
        isSystem: true,
      }).catch(() => {
        // A missing greeting must never cost the customer their message.
      })
    }

    if (!wasWaiting) {
      await alertOperator({
        publicId: thread.publicId ?? 'SG-?',
        displayName: thread.displayName ?? 'Visitor',
        threadId: thread.id,
        preview: body.slice(0, 140),
      })
    }

    return NextResponse.json({ ok: true, message: forCustomer(message), publicId: thread.publicId })
  } catch (error) {
    await reportError(error, {
      source: 'route',
      severity: 'FATAL',
      routePath: '/api/chat/send',
      context: { stage: 'post-message' },
    })
    return NextResponse.json(
      { ok: false, error: 'That did not send. Please try again.' },
      { status: 500 },
    )
  }
}
