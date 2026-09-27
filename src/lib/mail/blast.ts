import 'server-only'
import { db } from '@/lib/db/client'
import { linkSecret, unsubscribeLinks } from '@/lib/newsletter/unsubscribe'
import { getCompanyEmail } from '@/lib/site/company-email.server'
import { getPostalAddress } from '@/lib/site/postal-address.server'
import { campaignEmail, sendProblems } from './campaign'
import { getMailProvider } from './mailer'

/**
 * ─────────────────────────────────────────────────────────────────────────────
 *  SENDING A BLAST — in shifts, resumable, never twice to one person.
 *
 *  WHAM's design: the operator composes once, then sends to the list in shifts
 *  (100 at a time — Brevo's free plan allows 300 a day), one click per shift, and
 *  each shift carries on exactly where the last one stopped.
 *
 *  ── The record of who has had it ───────────────────────────────────────────
 *  NotificationLog, the table every email already logs to: one row per
 *  recipient per blast, topic `campaign:<id>`. The row is written BEFORE the
 *  email goes out and marked successful after. A crash between the two leaves a
 *  row saying "failed", so that person is skipped rather than mailed twice:
 *  at-most-once, which is the right way round for marketing mail.
 *
 *  ── One shift at a time ────────────────────────────────────────────────────
 *  A shift claims the blast by moving it to SENDING with a conditional update,
 *  so two operators clicking at once cannot both send. A shift that dies
 *  mid-send leaves SENDING behind; after ten minutes the next click takes over.
 *
 *  Only active subscribers are mailed, most recent first, as in WHAM.
 * ─────────────────────────────────────────────────────────────────────────────
 */

export const SHIFT_SIZE = 100
const STALE_LOCK_MS = 10 * 60 * 1000

export const campaignTopic = (campaignId: string) => `campaign:${campaignId}`

export type CampaignStatus = 'DRAFT' | 'IN_PROGRESS' | 'SENDING' | 'SENT'

export function mailConfigured(): boolean {
  return getMailProvider().name !== 'console'
}

/** Subscribers this blast has not been attempted to, most recent first. */
async function unsent(campaignId: string, limit?: number) {
  const [subscribers, attempts] = await Promise.all([
    db.newsletterSubscriber.findMany({
      where: { isActive: true },
      select: { id: true, email: true },
      orderBy: { createdAt: 'desc' },
    }),
    db.notificationLog.findMany({ where: { topic: campaignTopic(campaignId) }, select: { target: true } }),
  ])
  const done = new Set(attempts.map((a) => a.target?.toLowerCase()))
  const pending = subscribers.filter((s) => !done.has(s.email.toLowerCase()))
  return limit === undefined ? pending : pending.slice(0, limit)
}

export interface CampaignProgress {
  /** Active subscribers right now. */
  readonly mailable: number
  /** Accepted by the mail service. Not proof of delivery: there are no bounce reports. */
  readonly accepted: number
  readonly failed: number
  readonly remaining: number
}

export async function campaignProgress(campaignId: string): Promise<CampaignProgress> {
  const [mailable, accepted, failed, pending] = await Promise.all([
    db.newsletterSubscriber.count({ where: { isActive: true } }),
    db.notificationLog.count({ where: { topic: campaignTopic(campaignId), success: true } }),
    db.notificationLog.count({ where: { topic: campaignTopic(campaignId), success: false } }),
    unsent(campaignId),
  ])
  return { mailable, accepted, failed, remaining: pending.length }
}

export type ShiftOutcome =
  | { readonly kind: 'sent'; readonly accepted: number; readonly failed: number; readonly remaining: number }
  | { readonly kind: 'refused'; readonly problems: readonly string[] }
  | { readonly kind: 'busy' | 'finished' | 'missing' }

export async function sendShift(campaignId: string): Promise<ShiftOutcome> {
  const claimed = await db.emailCampaign.updateMany({
    where: {
      id: campaignId,
      OR: [
        { status: { in: ['DRAFT', 'IN_PROGRESS'] } },
        { status: 'SENDING', updatedAt: { lt: new Date(Date.now() - STALE_LOCK_MS) } },
      ],
    },
    data: { status: 'SENDING' },
  })
  if (claimed.count === 0) {
    const current = await db.emailCampaign.findUnique({ where: { id: campaignId }, select: { status: true } })
    if (!current) return { kind: 'missing' }
    return { kind: current.status === 'SENT' ? 'finished' : 'busy' }
  }

  let accepted = 0
  let failed = 0
  let everSent = false
  try {
    const campaign = await db.emailCampaign.findUniqueOrThrow({ where: { id: campaignId } })
    everSent = (await db.notificationLog.count({ where: { topic: campaignTopic(campaignId) } })) > 0
    const secret = linkSecret()
    const recipients = await unsent(campaignId, SHIFT_SIZE)
    const postalAddress = await getPostalAddress()
    const problems = sendProblems({
      subject: campaign.subject,
      body: campaign.body,
      postalAddress,
      mailConfigured: mailConfigured(),
      recipients: recipients.length,
    })
    if (!secret) problems.push('ADMIN_SESSION_SECRET is not set, so unsubscribe links cannot be signed.')
    if (problems.length > 0 || !secret) return { kind: 'refused', problems }

    const provider = getMailProvider()
    const contactEmail = await getCompanyEmail()
    for (const recipient of recipients) {
      const message = campaignEmail({
        to: recipient.email,
        subject: campaign.subject,
        body: campaign.body,
        unsubscribe: unsubscribeLinks(recipient.id, secret),
        postalAddress,
        contactEmail,
      })
      // Claimed first, so a crash after the send cannot lead to a second one.
      const log = await db.notificationLog.create({
        data: {
          channel: `EMAIL:${provider.name}`,
          topic: campaignTopic(campaignId),
          subject: message.subject,
          target: recipient.email,
          success: false,
          error: 'sending',
        },
      })
      everSent = true
      try {
        await provider.send(message)
        await db.notificationLog.update({ where: { id: log.id }, data: { success: true, error: null } })
        accepted += 1
      } catch (error) {
        await db.notificationLog.update({
          where: { id: log.id },
          data: { error: (error instanceof Error ? error.message : String(error)).slice(0, 500) },
        })
        failed += 1
      }
    }
    const remaining = (await unsent(campaignId)).length
    return { kind: 'sent', accepted, failed, remaining }
  } finally {
    // Always release the claim, and record where the blast now stands.
    const progress = await campaignProgress(campaignId).catch(() => null)
    const status: CampaignStatus = !everSent ? 'DRAFT' : progress?.remaining === 0 ? 'SENT' : 'IN_PROGRESS'
    await db.emailCampaign.update({
      where: { id: campaignId },
      data: {
        status,
        ...(progress
          ? { recipients: progress.accepted + progress.failed, delivered: progress.accepted, failed: progress.failed }
          : {}),
        ...(status === 'SENT' ? { sentAt: new Date() } : {}),
      },
    })
  }
}

/** One copy to the operator, marked [Test]. Not counted against the list. */
export async function sendTest(
  campaignId: string,
  to: string,
): Promise<{ ok: true } | { ok: false; problems: readonly string[] }> {
  const campaign = await db.emailCampaign.findUnique({ where: { id: campaignId } })
  if (!campaign) return { ok: false, problems: ['That blast no longer exists.'] }
  const secret = linkSecret()
  const postalAddress = await getPostalAddress()
  const problems = sendProblems(
    { subject: campaign.subject, body: campaign.body, postalAddress, mailConfigured: mailConfigured(), recipients: 1 },
    { test: true },
  )
  if (!secret) problems.push('ADMIN_SESSION_SECRET is not set, so unsubscribe links cannot be signed.')
  if (problems.length > 0 || !secret) return { ok: false, problems }

  const provider = getMailProvider()
  const message = campaignEmail({
    to,
    subject: campaign.subject,
    body: campaign.body,
    // A test recipient is not a subscriber; its opt-out link says so when opened.
    unsubscribe: unsubscribeLinks('test', secret),
    postalAddress,
    contactEmail: await getCompanyEmail(),
    test: true,
  })
  try {
    await provider.send(message)
  } catch (error) {
    return { ok: false, problems: [`The mail service refused it: ${error instanceof Error ? error.message : String(error)}`] }
  }
  await db.notificationLog
    .create({
      data: {
        channel: `EMAIL:${provider.name}`,
        topic: `campaign-test:${campaignId}`,
        subject: message.subject,
        target: to,
        success: true,
      },
    })
    .catch(() => {})
  return { ok: true }
}
