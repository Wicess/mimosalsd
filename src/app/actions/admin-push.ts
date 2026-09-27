'use server'

import { revalidatePath } from 'next/cache'
import { cookies } from 'next/headers'
import { z } from 'zod'
import { requireArea } from '@/lib/admin/guard'
import { recordAdminAction } from '@/lib/admin/audit'
import { scanText } from '@/lib/compliance/lexicon'
import { BODY_MAX, safePushPath, TITLE_MAX } from '@/lib/push/payload'
import { broadcastPush, sendPushToVisitor } from '@/lib/push/server'
import { absoluteUrl } from '@/lib/seo/routes'
import { isVisitorId, VISITOR_COOKIE } from '@/lib/visitors/cookie'

/**
 * ─────────────────────────────────────────────────────────────────────────────
 *  SENDING A PUSH NOTIFICATION FROM THE ADMIN.
 *
 *  A notification is the business speaking, on the lock screen of everyone who
 *  allowed it, so it goes through the same compliance lexicon as every other
 *  piece of copy (CLAUDE.md rule 4): a health claim is refused before anything
 *  is sent. Every send to everyone is written to the audit trail.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const PAGE = '/admin/notifications'

export type PushSendState = { ok?: string; error?: string }

const schema = z.object({
  title: z.string().trim().min(1, 'Give the notification a title.').max(TITLE_MAX, `Keep the title under ${TITLE_MAX} characters.`),
  body: z.string().trim().min(1, 'Write the message.').max(BODY_MAX, `Keep the message under ${BODY_MAX} characters.`),
  url: z.string().trim().max(500).optional(),
})

function read(formData: FormData) {
  const parsed = schema.safeParse({
    title: formData.get('title') ?? '',
    body: formData.get('body') ?? '',
    url: formData.get('url') ?? undefined,
  })
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Check the notification.' } as const
  const { title, body } = parsed.data
  const scan = scanText(`${title}\n${body}`, { honourDirectives: false })
  if (!scan.clean) {
    const terms = scan.blocking.map((m) => `“${m.term}”`).join(', ')
    return { error: `Not sent — the compliance lexicon blocks ${terms}. Rephrase without a health claim.` } as const
  }
  return { message: { title, body, url: safePushPath(parsed.data.url, absoluteUrl('/')) } } as const
}

/** To everyone who has notifications on. */
export async function sendPushToEveryone(_prev: PushSendState, formData: FormData): Promise<PushSendState> {
  const guard = await requireArea(PAGE)
  if (!guard.ok) return { error: guard.error }
  const input = read(formData)
  if ('error' in input) return { error: input.error }

  const result = await broadcastPush(input.message, guard.identity.email)
  await recordAdminAction({
    entityType: 'PushBroadcast',
    entityId: result.id,
    action: 'PUBLISH',
    actor: guard.identity,
    after: { ...input.message, recipients: result.recipients, delivered: result.delivered, failed: result.failed },
    reason: `Push to everyone: ${result.delivered} delivered, ${result.failed} failed, ${result.removed} removed`,
  })
  revalidatePath(PAGE)

  if (result.recipients === 0) return { error: 'Nobody has turned on notifications yet, so there was no one to send to.' }
  const people = (n: number) => `${n} ${n === 1 ? 'device' : 'devices'}`
  return {
    ok:
      `Sent to ${people(result.delivered)}.` +
      (result.failed ? ` ${people(result.failed)} could not be reached this time and will be retried on the next send.` : '') +
      (result.removed ? ` ${people(result.removed)} had switched notifications off and were removed.` : ''),
  }
}

/**
 * To this browser only: the devices that turned notifications on from the shop
 * in the same browser the admin is signed in on. How the owner checks what a
 * notification looks like before everyone gets it.
 */
export async function sendPushTest(_prev: PushSendState, formData: FormData): Promise<PushSendState> {
  const guard = await requireArea(PAGE)
  if (!guard.ok) return { error: guard.error }
  const input = read(formData)
  if ('error' in input) return { error: input.error }

  const visitor = (await cookies()).get(VISITOR_COOKIE)?.value
  const result = isVisitorId(visitor)
    ? await sendPushToVisitor(visitor, input.message, { ttlSeconds: 60 * 60, urgency: 'high' })
    : { recipients: 0, delivered: 0, failed: 0, removed: 0 }
  await recordAdminAction({
    entityType: 'PushBroadcast',
    entityId: 'test',
    action: result.delivered > 0 ? 'PUBLISH' : 'PUBLISH_BLOCKED',
    actor: guard.identity,
    after: input.message,
    reason: `Test push to the operator's own devices: ${result.delivered} of ${result.recipients} delivered`,
  })

  if (result.recipients === 0) {
    return {
      error:
        'This browser has not turned on notifications yet. Open the shop in this same browser (on your phone: the installed app), tap “Turn on” when asked, then send the test again.',
    }
  }
  return result.delivered > 0
    ? { ok: `Test sent. It should arrive on this device within a few seconds.` }
    : { error: 'The test could not be delivered to this device. Turn notifications off and on again, then retry.' }
}
