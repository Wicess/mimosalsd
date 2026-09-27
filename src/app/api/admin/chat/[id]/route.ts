import { revalidateTag } from 'next/cache'
import { after, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db/client'
import { recordAdminAction } from '@/lib/admin/audit'
import { scanText } from '@/lib/compliance/lexicon'
import {
  checkOperatorReply,
  deleteThreads,
  markRead,
  postMessage,
  refreshThreadSummary,
} from '@/lib/chat/core'
import { cleanBody, isRecent, ONLINE_WINDOW_MS, TYPING_WINDOW_MS } from '@/lib/chat/rules'
import { forAdmin } from '@/lib/chat/serialize'
import { requireChatAdmin } from '@/lib/chat/admin-guard'
import { reportError } from '@/lib/observability/report-error'
import { staffReplyNotification } from '@/lib/push/customer'
import { sendPushToVisitor } from '@/lib/push/server'
import { BLOCKED_IPS_TAG } from '@/lib/security/blocked-ip-store'

/**
 * One conversation, from the operator's side.
 *
 * GET returns the messages with BOTH ticks — delivered and read — and the customer's
 * profile: who they are, what they have ordered, whether their IP is blocked. Opening
 * the conversation marks it read, which is what clears the inbox badge.
 *
 * POST is every operator action on the thread: reply, edit, remove, close, reopen,
 * block and unblock. DELETE removes the whole conversation (transcript kept in the
 * audit log — see deleteThreads).
 */

const PAGE = 100

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireChatAdmin()
  if (!guard.ok) return guard.response
  const { id } = await params

  const thread = await db.supportThread.findUnique({ where: { id } })
  if (!thread) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const since = new URL(request.url).searchParams.get('since')
  const sinceDate = since ? new Date(since) : null

  const [rows, orders, blocked] = await Promise.all([
    db.supportMessage.findMany({
      where: {
        threadId: id,
        ...(sinceDate && !Number.isNaN(sinceDate.getTime()) ? { createdAt: { gt: sinceDate } } : {}),
      },
      orderBy: { createdAt: sinceDate ? 'asc' : 'desc' },
      take: PAGE,
    }),
    /*
     * Orders by the thread's email, for the profile panel. Matching on an email the
     * customer typed is fine HERE — it is shown to an operator as a lead to check,
     * not used to grant anybody access to anything.
     */
    thread.email
      ? db.order.findMany({
          where: { email: thread.email },
          orderBy: { createdAt: 'desc' },
          take: 10,
          select: { orderNumber: true, status: true, totalCents: true, createdAt: true },
        })
      : Promise.resolve([]),
    thread.lastIp ? db.blockedIp.findUnique({ where: { ip: thread.lastIp } }) : Promise.resolve(null),
  ])

  // Opening the conversation is reading it — and when nothing is unread there is
  // nothing to stamp, so a poll of a quiet thread writes nothing at all.
  if (thread.unreadForAdmin > 0) await markRead(id, 'ADMIN')

  // Receipt movement on the operator's own recent replies, so a second tick appears
  // on a message sent minutes ago without refetching the whole thread.
  const receipts = sinceDate
    ? await db.supportMessage.findMany({
        where: { threadId: id, fromCustomer: false, isSystem: false },
        orderBy: { createdAt: 'desc' },
        take: 30,
        select: { id: true, body: true, deliveredAt: true, readAt: true, editedAt: true, deletedAt: true },
      })
    : []

  const typing = isRecent(thread.customerTypingAt, TYPING_WINDOW_MS)

  return NextResponse.json(
    {
      /*
       * `flags` names the lexicon terms a CUSTOMER message trips — "will this help my
       * depression?". Flagged, never blocked: a customer may ask anything. It is there
       * so the operator knows, before replying at speed, that the honest answer is
       * not a claim. Carried over from the page this inbox replaces.
       */
      messages: (sinceDate ? rows : rows.reverse()).map((m) => ({
        ...forAdmin(m),
        flags:
          m.fromCustomer && !m.deletedAt
            ? [
                ...new Set(
                  // Directives off, or a customer could hide a flag from the operator by
                  // typing a compliance-allow comment into their own message.
                  scanText(m.body, { includeWarnings: true, honourDirectives: false }).matches.map((x) => x.term),
                ),
              ]
            : [],
      })),
      // Also carries edits and removals, so a correction made in another operator's
      // tab lands here without a reload.
      receipts: receipts.map((r) => ({
        id: r.id,
        body: r.deletedAt ? '' : r.body,
        deliveredAt: r.deliveredAt?.toISOString() ?? null,
        readAt: r.readAt?.toISOString() ?? null,
        edited: Boolean(r.editedAt),
        deleted: Boolean(r.deletedAt),
      })),
      profile: {
        id: thread.id,
        publicId: thread.publicId,
        displayName: thread.displayName ?? thread.email ?? thread.publicId ?? 'Visitor',
        name: thread.name,
        email: thread.email,
        subject: thread.subject,
        isOpen: thread.isOpen,
        firstSeen: thread.createdAt.toISOString(),
        customerLastSeenAt: thread.customerLastSeenAt?.toISOString() ?? null,
        lastIp: thread.lastIp,
        blocked: Boolean(blocked),
        // "Active now" = their chat panel is open and polling. A closed panel polls
        // nothing, so this goes quiet within a minute of them leaving.
        online: isRecent(thread.customerLastSeenAt, ONLINE_WINDOW_MS),
        typing,
        typingText: typing ? thread.customerTypingText : null,
        orders: orders.map((o) => ({
          orderNumber: o.orderNumber,
          status: o.status,
          totalCents: o.totalCents,
          createdAt: o.createdAt.toISOString(),
        })),
      },
    },
    { headers: { 'Cache-Control': 'no-store' } },
  )
}

const actionSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('reply'), body: z.string().max(8000) }),
  z.object({ action: z.literal('edit'), messageId: z.string().min(1).max(60), body: z.string().max(8000) }),
  z.object({ action: z.literal('close') }),
  z.object({ action: z.literal('reopen') }),
  z.object({ action: z.literal('block'), reason: z.string().max(300).optional() }),
  z.object({ action: z.literal('unblock') }),
  z.object({ action: z.literal('delete'), messageId: z.string().min(1).max(60) }),
])

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireChatAdmin()
  if (!guard.ok) return guard.response
  const { identity } = guard
  const { id } = await params

  const parsed = actionSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ ok: false, error: 'Invalid request.' }, { status: 400 })

  const thread = await db.supportThread.findUnique({ where: { id } })
  if (!thread) return NextResponse.json({ ok: false, error: 'Not found.' }, { status: 404 })

  const input = parsed.data
  try {
    switch (input.action) {
      case 'reply': {
        const body = cleanBody(input.body)
        if (!body) return NextResponse.json({ ok: false, error: 'Type a reply first.' }, { status: 422 })
        // The business is speaking in writing. Health claims are blocked sitewide.
        const gate = checkOperatorReply(body)
        if (!gate.ok) return NextResponse.json({ ok: false, error: gate.error }, { status: 422 })
        const message = await postMessage({
          threadId: id,
          fromCustomer: false,
          body,
          authorName: identity.name || identity.email,
        })
        // To their lock screen too, if they turned notifications on. After the
        // response: the operator's reply appears at once, the push follows.
        after(() => sendPushToVisitor(thread.visitorId, staffReplyNotification({ body })))
        return NextResponse.json({ ok: true, message: forAdmin(message) })
      }

      case 'close':
      case 'reopen': {
        await db.supportThread.update({ where: { id }, data: { isOpen: input.action === 'reopen' } })
        return NextResponse.json({ ok: true })
      }

      case 'block': {
        if (!thread.lastIp) {
          return NextResponse.json(
            { ok: false, error: 'No IP recorded for this visitor yet — they have not sent a message.' },
            { status: 409 },
          )
        }
        await db.blockedIp.upsert({
          where: { ip: thread.lastIp },
          create: {
            ip: thread.lastIp,
            reason: input.reason?.trim() || null,
            threadId: thread.id,
            publicId: thread.publicId,
            createdBy: identity.email,
          },
          update: { reason: input.reason?.trim() || null, createdBy: identity.email },
        })
        // The sitewide list the proxy reads. expire: 0, so the next read is fresh
        // rather than stale-while-revalidate; updateTag is for server actions only.
        revalidateTag(BLOCKED_IPS_TAG, { expire: 0 })
        // As in WHAM, blocking closes the conversation too.
        await db.supportThread.update({ where: { id }, data: { isOpen: false } })
        await recordAdminAction({
          entityType: 'BlockedIp',
          entityId: thread.lastIp,
          action: 'CREATE',
          actor: identity,
          reason: `Blocked from chat (${thread.publicId ?? thread.id})${input.reason ? ` — ${input.reason}` : ''}`,
        })
        return NextResponse.json({ ok: true })
      }

      case 'unblock': {
        if (thread.lastIp) {
          await db.blockedIp.deleteMany({ where: { ip: thread.lastIp } })
          revalidateTag(BLOCKED_IPS_TAG, { expire: 0 })
          await recordAdminAction({
            entityType: 'BlockedIp',
            entityId: thread.lastIp,
            action: 'DELETE',
            actor: identity,
            reason: `Unblocked from chat (${thread.publicId ?? thread.id})`,
          })
        }
        return NextResponse.json({ ok: true })
      }

      case 'edit': {
        const body = cleanBody(input.body)
        if (!body) return NextResponse.json({ ok: false, error: 'A message cannot be empty.' }, { status: 422 })
        // A correction is still the business speaking in writing.
        const gate = checkOperatorReply(body)
        if (!gate.ok) return NextResponse.json({ ok: false, error: gate.error }, { status: 422 })
        const message = await operatorMessage(id, input.messageId)
        if (!message) return NextResponse.json({ ok: false, error: 'Not found.' }, { status: 404 })
        const updated = await db.supportMessage.update({
          where: { id: message.id },
          data: { body, editedAt: new Date() },
        })
        await refreshThreadSummary(id)
        await recordAdminAction({
          entityType: 'SupportMessage',
          entityId: message.id,
          action: 'UPDATE',
          actor: identity,
          before: { body: message.body },
          after: { body },
          reason: 'Edited in chat',
        })
        return NextResponse.json({ ok: true, message: forAdmin(updated) })
      }

      case 'delete': {
        /*
         * Only what the BUSINESS said, as in WHAM, where the menu is on the owner's own
         * messages. A customer's words are theirs and stay in the record.
         *
         * Soft delete: it vanishes from both sides of the conversation, and the text is
         * kept in the audit log.
         */
        const message = await operatorMessage(id, input.messageId)
        if (!message) return NextResponse.json({ ok: false, error: 'Not found.' }, { status: 404 })
        await db.supportMessage.update({ where: { id: message.id }, data: { deletedAt: new Date() } })
        await refreshThreadSummary(id)
        await recordAdminAction({
          entityType: 'SupportMessage',
          entityId: message.id,
          action: 'DELETE',
          actor: identity,
          before: { body: message.body, attachment: message.attachmentName },
          reason: 'Removed from chat',
        })
        return NextResponse.json({ ok: true })
      }
    }
  } catch (error) {
    await reportError(error, {
      source: 'route',
      severity: 'ERROR',
      routePath: '/api/admin/chat/[id]',
      context: { action: input.action },
    })
    return NextResponse.json({ ok: false, error: 'That did not work. It has been logged.' }, { status: 500 })
  }
}

/** One of the operator's own live messages in this thread — the only kind that can be edited or removed. */
function operatorMessage(threadId: string, messageId: string) {
  return db.supportMessage.findFirst({
    where: { id: messageId, threadId, fromCustomer: false, isSystem: false, deletedAt: null },
    select: { id: true, body: true, attachmentName: true },
  })
}

/** Delete the whole conversation. The transcript is kept in the audit log. */
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireChatAdmin()
  if (!guard.ok) return guard.response
  const { id } = await params
  try {
    const deleted = await deleteThreads([id], guard.identity)
    if (deleted === 0) return NextResponse.json({ ok: false, error: 'Not found.' }, { status: 404 })
    return NextResponse.json({ ok: true })
  } catch (error) {
    await reportError(error, {
      source: 'route',
      severity: 'ERROR',
      routePath: '/api/admin/chat/[id]',
      context: { action: 'delete-thread' },
    })
    return NextResponse.json({ ok: false, error: 'That did not work. It has been logged.' }, { status: 500 })
  }
}
