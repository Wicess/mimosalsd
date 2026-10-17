import 'server-only'
import { randomUUID } from 'node:crypto'
import { cookies, headers } from 'next/headers'
import { db } from '@/lib/db/client'
import { scanText } from '@/lib/compliance/lexicon'
import { alertLines, notify } from '@/lib/notify/ntfy'
import { recordAdminAction } from '@/lib/admin/audit'
import type { AdminIdentity } from '@/lib/admin/auth'
import { reportError } from '@/lib/observability/report-error'
import { clientIpFrom } from '@/lib/security/client-ip'
// One cookie for chat, the contact form and visit tracking, so all share one identity.
import { isVisitorId, VISITOR_COOKIE, VISITOR_MAX_AGE } from '@/lib/visitors/cookie'
import { deleteObject } from '@/lib/storage/r2'
import { absoluteUrl } from '@/lib/seo/routes'
import { cleanBody, deriveDisplayName, newPublicId, previewLine } from './rules'

/**
 * Live chat — the server side.
 *
 * Ported from WHAM's `lib/chat.ts` onto the existing SupportThread / SupportMessage
 * tables, so the contact form, bulk enquiries and live chat are one inbox.
 *
 * ── THE ONE DELIBERATE DEPARTURE FROM WHAM ──────────────────────────────────
 *
 * WHAM finds a thread by user id, then EMAIL, then session. That is safe there
 * because WHAM's email comes from a VERIFIED sign-in. This site has no customer
 * sign-in yet, so an email typed into the chat is unverified — and looking a thread
 * up by it would let anyone read a stranger's conversation by typing their address.
 *
 * So a thread is found by the visitor cookie ONLY: httpOnly, an unguessable UUID,
 * and proof that this is the same browser. An email the customer gives is stored so
 * the operator knows who they are talking to, and never used to retrieve anything.
 * When verified customer accounts exist, a verified id can be added as a lookup key.
 */

/** Read the visitor id, optionally minting one. Only a Server Action or route may mint. */
export async function visitorId(create: boolean): Promise<string | null> {
  const store = await cookies()
  const existing = store.get(VISITOR_COOKIE)?.value
  if (isVisitorId(existing)) return existing
  if (!create) return null
  const minted = randomUUID()
  store.set(VISITOR_COOKIE, minted, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: VISITOR_MAX_AGE,
    path: '/',
  })
  return minted
}

/**
 * The caller's IP, canonical, from the platform header. Only ever used for
 * blocking — and canonical so it matches the sitewide blocklist exactly.
 */
export async function clientIp(): Promise<string | null> {
  return clientIpFrom(await headers())
}

export async function isBlocked(ip: string | null): Promise<boolean> {
  if (!ip) return false
  const row = await db.blockedIp.findUnique({ where: { ip }, select: { ip: true } })
  return Boolean(row)
}

/** This visitor's thread, without creating one. See the module note on email. */
export async function findThread(visitor: string | null) {
  if (!visitor) return null
  return db.supportThread.findFirst({
    where: { visitorId: visitor },
    orderBy: { lastMessageAt: 'desc' },
  })
}

async function reservePublicId(): Promise<string> {
  for (let attempt = 0; attempt < 6; attempt++) {
    const candidate = newPublicId()
    const taken = await db.supportThread.findUnique({
      where: { publicId: candidate },
      select: { id: true },
    })
    if (!taken) return candidate
  }
  // 30^5 is ~24 million. Six collisions in a row means something is wrong; fall back
  // to something guaranteed unique rather than loop.
  return `SG-${Date.now().toString(36).toUpperCase().slice(-6)}`
}

/**
 * Find or create this visitor's thread, then backfill whatever identity has been
 * learned since. Learning an email is the moment "Visitor SG-7K3M9" becomes a person.
 */
export async function ensureThread(input: {
  readonly visitor: string
  readonly email?: string | null
  readonly name?: string | null
}) {
  const email = input.email?.trim().toLowerCase() || null
  const name = input.name?.trim() || null
  const existing = await findThread(input.visitor)

  if (existing) {
    const patch: { email?: string; name?: string; displayName?: string; publicId?: string } = {}
    if (!existing.email && email) patch.email = email
    if (!existing.name && name) patch.name = name
    if (!existing.publicId) patch.publicId = await reservePublicId()
    if (patch.email || patch.name || !existing.displayName) {
      patch.displayName = deriveDisplayName({
        name: patch.name ?? existing.name,
        email: patch.email ?? existing.email,
        publicId: patch.publicId ?? existing.publicId,
      })
    }
    if (Object.keys(patch).length === 0) return existing
    return db.supportThread.update({ where: { id: existing.id }, data: patch })
  }

  const publicId = await reservePublicId()
  return db.supportThread.create({
    data: {
      visitorId: input.visitor,
      publicId,
      email,
      name,
      displayName: deriveDisplayName({ name, email, publicId }),
    },
  })
}

/**
 * A NEW thread for a form enquiry — contact or bulk — with its first message.
 *
 * Forms open a fresh thread per enquiry (each has its own subject), but they must
 * arrive exactly as a chat does: with a quotable reference, a display name, the IP a
 * block would act on, an inbox preview and an unread badge. They used to be written
 * with two bare inserts, which left all of that empty — an enquiry with no badge is
 * one the operator does not see.
 */
export async function createThread(input: {
  readonly visitor: string
  readonly email: string | null
  readonly name: string | null
  readonly subject: string
  readonly body: string
  readonly ip: string | null
}) {
  const email = input.email?.trim().toLowerCase() || null
  const name = input.name?.trim() || null
  const publicId = await reservePublicId()
  const thread = await db.supportThread.create({
    data: {
      visitorId: input.visitor,
      publicId,
      email,
      name,
      subject: input.subject,
      displayName: deriveDisplayName({ name, email, publicId }),
    },
  })
  await postMessage({
    threadId: thread.id,
    fromCustomer: true,
    body: input.body,
    authorName: name,
    ip: input.ip,
  })
  return thread
}

/**
 * Append a message AND update the thread's summary in one transaction.
 *
 * The interactive form, as WHAM settled on: the inbox can then never show a preview
 * that disagrees with the last message, and an unread badge can never drift from
 * the messages behind it.
 */
export async function postMessage(input: {
  readonly threadId: string
  readonly fromCustomer: boolean
  readonly body: string
  readonly authorName?: string | null
  readonly isSystem?: boolean
  readonly attachment?: { key: string; contentType: string; name: string } | null
  readonly ip?: string | null
}) {
  const now = new Date()
  return db.$transaction(async (tx) => {
    const created = await tx.supportMessage.create({
      data: {
        threadId: input.threadId,
        fromCustomer: input.fromCustomer,
        body: input.body,
        authorName: input.authorName ?? null,
        isSystem: input.isSystem ?? false,
        attachmentKey: input.attachment?.key ?? null,
        attachmentType: input.attachment?.contentType ?? null,
        attachmentName: input.attachment?.name ?? null,
        createdAt: now,
      },
    })
    await tx.supportThread.update({
      where: { id: input.threadId },
      data: {
        /*
          A system message (the automatic welcome) does not become the preview. It is
          posted a moment after the customer's first message, and it replaced what they
          had asked, so the operator's inbox showed the shop's own greeting instead of
          the customer's question. The conversation's time and preview stay the
          customer's and the operator's.
        */
        ...(input.isSystem
          ? {}
          : {
              lastMessageAt: now,
              lastMessageText: previewLine(input.body, input.attachment?.contentType),
              lastSender: input.fromCustomer ? 'CUSTOMER' : 'ADMIN',
            }),
        // A reply on a closed thread reopens it.
        isOpen: true,
        ...(input.fromCustomer
          ? {
              unreadForAdmin: { increment: 1 },
              // Sending clears their own typing state.
              customerTypingAt: null,
              customerTypingText: null,
              ...(input.ip ? { lastIp: input.ip } : {}),
            }
          : input.isSystem
            ? {}
            : { unreadForCustomer: { increment: 1 } }),
      },
    })
    return created
  })
}

/**
 * The other side's messages reached this side's device. One tick.
 * Reaching a device is not the same as having been looked at.
 */
export async function markDelivered(threadId: string, recipient: 'CUSTOMER' | 'ADMIN') {
  await db.supportMessage.updateMany({
    where: { threadId, fromCustomer: recipient === 'ADMIN', deliveredAt: null },
    data: { deliveredAt: new Date() },
  })
}

/** Clear one side's unread counter and stamp the other side's messages read. */
export async function markRead(threadId: string, reader: 'CUSTOMER' | 'ADMIN') {
  const otherIsCustomer = reader === 'ADMIN'
  await db.$transaction(async (tx) => {
    const now = new Date()
    await tx.supportMessage.updateMany({
      where: { threadId, fromCustomer: otherIsCustomer, readAt: null },
      data: { readAt: now },
    })
    // Read implies delivered; a message can never be read but undelivered.
    await tx.supportMessage.updateMany({
      where: { threadId, fromCustomer: otherIsCustomer, deliveredAt: null },
      data: { deliveredAt: now },
    })
    await tx.supportThread.update({
      where: { id: threadId },
      data:
        reader === 'ADMIN'
          ? { unreadForAdmin: 0, adminLastSeenAt: now }
          : { unreadForCustomer: 0, customerLastSeenAt: now },
    })
  })
}

/**
 * How often a customer's "seen" stamp is actually WRITTEN while their chat is open:
 * an open panel polls every 3 seconds, and stamping each poll would be a write every
 * 3 seconds for nothing — the playbook's rule: throttle the write frequency, never
 * drop the data.
 */
const PRESENCE_WRITE_EVERY_MS = 15_000

/**
 * The customer's open panel polled. Read receipts only when there is something
 * unread; otherwise just keep their presence fresh, and only when it is going stale.
 *
 * Without this, an open chat panel ran a three-statement transaction every three
 * seconds for the whole time it was open, to stamp nothing.
 */
export async function customerViewing(thread: {
  readonly id: string
  readonly unreadForCustomer: number
  readonly customerLastSeenAt: Date | null
}): Promise<void> {
  if (thread.unreadForCustomer > 0) {
    await markRead(thread.id, 'CUSTOMER')
    return
  }
  const seen = thread.customerLastSeenAt?.getTime() ?? 0
  if (Date.now() - seen < PRESENCE_WRITE_EVERY_MS) return
  await db.supportThread.update({ where: { id: thread.id }, data: { customerLastSeenAt: new Date() } })
}


/**
 * Compliance gate on what the BUSINESS writes.
 *
 * A customer may ask anything — "will this help with my depression?" is a real
 * message already in this inbox — and their words are theirs. An operator's reply is
 * the business speaking in writing, and CLAUDE.md rule 4 blocks health claims
 * sitewide. WHAM sells THC and has no such gate; this site cannot ship without one.
 */
export function checkOperatorReply(body: string): { ok: true } | { ok: false; error: string } {
  // Directives OFF: a `compliance-allow` comment typed into the reply must not be able
  // to switch off the block on the very message it sits in. Ignoring them can only
  // add blocks, never remove one.
  const scan = scanText(body, { honourDirectives: false })
  if (scan.clean) return { ok: true }
  const terms = scan.blocking.map((m) => `“${m.term}”`).join(', ')
  return {
    ok: false,
    error: `Not sent — the compliance lexicon blocks ${terms} in a reply. Answer without making a health claim, e.g. “We can’t advise on medical use.”`,
  }
}

/**
 * Whether a customer's message rings the owner's phone.
 *
 * It used to ring only when nothing was already unread, so a customer who wrote "hi"
 * and then sent a photo of their payment rang once, for the "hi" (2026-10-17: the
 * owner never heard about the photo). Now:
 *
 *  - a photo or a file ALWAYS rings: it is usually a receipt or a product question;
 *  - text rings when nothing was waiting, as before;
 *  - and again when the customer has been quiet for five minutes, so a conversation
 *    the owner has not opened yet still announces that the customer is back.
 *
 * A burst of typed lines still rings once.
 */
export const REALERT_AFTER_MS = 5 * 60_000

export function shouldAlertOperator(input: {
  readonly hasAttachment: boolean
  readonly wasWaiting: boolean
  /** The customer's previous message in this thread, before the one just sent. */
  readonly previousCustomerAt: Date | null
  readonly now?: number
}): boolean {
  if (input.hasAttachment) return true
  if (!input.wasWaiting) return true
  if (!input.previousCustomerAt) return true
  return (input.now ?? Date.now()) - input.previousCustomerAt.getTime() >= REALERT_AFTER_MS
}

/** When the customer last wrote in this thread. Read BEFORE posting the new message. */
export async function lastCustomerMessageAt(threadId: string): Promise<Date | null> {
  const row = await db.supportMessage.findFirst({
    where: { threadId, fromCustomer: true, deletedAt: null },
    orderBy: { createdAt: 'desc' },
    select: { createdAt: true },
  })
  return row?.createdAt ?? null
}

/**
 * Push the owner a new-message alert, carrying what they need to answer from the
 * lock screen: who, their email, what they sent and its reference. A photo comes with
 * the image itself, through a link that works for a day. Tapping opens the
 * conversation; the buttons open it or the customer's orders.
 */
export async function alertOperator(input: {
  readonly publicId: string
  readonly displayName: string
  readonly preview: string
  /** Opens this conversation directly when the notification is tapped. */
  readonly threadId?: string
  readonly email?: string | null
  /** What arrived. `photo` and `pdf` change the icon; a photo is shown inline. */
  readonly kind?: 'text' | 'photo' | 'pdf'
  /** The stored photo, so the alert can show it. */
  readonly attachmentKey?: string
}): Promise<void> {
  const kind = input.kind ?? 'text'
  let attach: { url: string; filename: string } | undefined
  if (kind === 'photo' && input.attachmentKey) {
    try {
      const { signedUrl } = await import('@/lib/storage/r2')
      attach = { url: await signedUrl(input.attachmentKey, 24 * 60 * 60), filename: `${input.publicId}.jpg` }
    } catch {
      // The alert still goes, without the picture.
    }
  }
  const chat = absoluteUrl(messagesUrl(input.threadId))
  await notify({
    topic: 'chat-inbound',
    title:
      kind === 'photo'
        ? `${input.displayName} sent a photo`
        : kind === 'pdf'
          ? `${input.displayName} sent a PDF`
          : `New message from ${input.displayName}`,
    body: alertLines([
      ['', input.preview || (kind === 'text' ? 'New message' : '')],
      ['Email', input.email ?? null],
      ['Chat', input.publicId],
    ]),
    tags: [kind === 'photo' ? 'camera' : kind === 'pdf' ? 'page_facing_up' : 'speech_balloon', 'chat'],
    clickUrl: chat,
    actions: [{ label: 'Open chat and reply', url: chat }],
    ...(attach ? { attach } : {}),
  })
}

/** The admin inbox, opened on one conversation when there is one to open. */
export function messagesUrl(threadId?: string | null): string {
  return threadId ? `/admin/messages?thread=${encodeURIComponent(threadId)}` : '/admin/messages'
}

/**
 * Re-derive the inbox preview after a message was edited or removed.
 *
 * `postMessage` keeps the summary exact on the way in; this keeps it exact when the
 * newest message changes afterwards, so the list never previews words that are no
 * longer in the conversation. `lastMessageAt` is left alone — correcting a typo
 * must not float a thread to the top of the inbox.
 */
export async function refreshThreadSummary(threadId: string): Promise<void> {
  const latest = await db.supportMessage.findFirst({
    where: { threadId, deletedAt: null },
    orderBy: { createdAt: 'desc' },
    select: { body: true, attachmentType: true, fromCustomer: true },
  })
  await db.supportThread.update({
    where: { id: threadId },
    data: {
      lastMessageText: latest ? previewLine(latest.body, latest.attachmentType) : null,
      lastSender: latest ? (latest.fromCustomer ? 'CUSTOMER' : 'ADMIN') : null,
    },
  })
}

/**
 * Delete whole conversations — WHAM's "Delete conversation", with the record kept.
 *
 * The rows go, so the inbox is clean and the customer's next message starts a fresh
 * thread. What was SAID does not go: the full transcript is written to the
 * compliance audit log first. This business answers questions like "will this help
 * my depression?" in writing, and the proof that it answered them properly must
 * outlive an operator tidying the inbox.
 *
 * Attachments ARE removed from storage. A customer's photo is as private as the
 * conversation it was sent in, and once nobody can open the conversation there is
 * no reason to keep holding it. The audit entry records which files existed.
 */
export async function deleteThreads(
  ids: readonly string[],
  actor: Pick<AdminIdentity, 'userId' | 'email'>,
): Promise<number> {
  const threads = await db.supportThread.findMany({
    where: { id: { in: [...ids] } },
    include: { messages: { orderBy: { createdAt: 'asc' } } },
  })

  for (const thread of threads) {
    await recordAdminAction({
      entityType: 'SupportThread',
      entityId: thread.id,
      action: 'DELETE',
      actor,
      before: {
        publicId: thread.publicId,
        displayName: thread.displayName,
        email: thread.email,
        subject: thread.subject,
        createdAt: thread.createdAt,
        messages: thread.messages.map((m) => ({
          from: m.isSystem ? 'SYSTEM' : m.fromCustomer ? 'CUSTOMER' : 'ADMIN',
          author: m.authorName,
          body: m.body,
          at: m.createdAt,
          attachment: m.attachmentName,
          removedAt: m.deletedAt,
        })),
      },
      reason: `Conversation deleted (${thread.publicId ?? thread.id}, ${thread.messages.length} messages)`,
    })
  }

  const found = threads.map((t) => t.id)
  if (found.length === 0) return 0
  // Messages cascade with their thread.
  await db.supportThread.deleteMany({ where: { id: { in: found } } })

  const keys = threads.flatMap((t) => t.messages.map((m) => m.attachmentKey).filter((k): k is string => Boolean(k)))
  const results = await Promise.allSettled(keys.map((key) => deleteObject(key)))
  const failed = results.filter((r) => r.status === 'rejected').length
  if (failed > 0) {
    // The rows are gone either way; an orphaned private object is a cleanup job,
    // not a reason to fail the delete. Reported so it is not silent.
    await reportError(new Error(`${failed} chat attachment(s) not removed from storage`), {
      source: 'route',
      severity: 'WARN',
      context: { stage: 'deleteThreads', failed, total: keys.length },
    })
  }
  return found.length
}

export { cleanBody }
