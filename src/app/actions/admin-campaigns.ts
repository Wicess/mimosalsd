'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { requireArea } from '@/lib/admin/guard'
import { recordAdminAction } from '@/lib/admin/audit'
import { db } from '@/lib/db/client'
import { readCampaignForm, scanCampaign } from '@/lib/mail/campaign'
import { sendShift, sendTest } from '@/lib/mail/blast'
import type { CrudState } from '@/app/actions/admin-crud'

/**
 * ─────────────────────────────────────────────────────────────────────────────
 *  EMAIL BLAST ADMINISTRATION.
 *
 *  A blast is editable while it is a DRAFT and frozen from the first send: the
 *  people who have already had it received exactly that text, and editing it
 *  afterwards would make the record describe a message nobody got. A different
 *  message is a different blast.
 *
 *  Every save stores the lexicon's findings, and every send re-checks the copy
 *  (lib/mail/blast.ts) rather than trusting a scan from when it was saved.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const LIST = '/admin/campaigns'
const fail = (error: string): CrudState => ({ error })

function flagsOf(subject: string, body: string) {
  const scan = scanCampaign(subject, body)
  return scan.matches.map((m) => ({ term: m.term, severity: m.severity, reason: m.reason }))
}

export async function createCampaign(_prev: CrudState, formData: FormData): Promise<CrudState> {
  const guard = await requireArea(LIST)
  if (!guard.ok) return fail(guard.error)
  const form = readCampaignForm(formData)
  if (!form.ok) return fail(form.error)

  const created = await db.emailCampaign.create({
    data: {
      ...form.value,
      segment: 'NEWSLETTER',
      status: 'DRAFT',
      complianceFlags: flagsOf(form.value.subject, form.value.body),
    },
    select: { id: true },
  })
  await recordAdminAction({
    entityType: 'EmailCampaign',
    entityId: created.id,
    action: 'CREATE',
    actor: guard.identity,
    after: form.value,
  })
  revalidatePath(LIST)
  redirect(`${LIST}/${created.id}`)
}

export async function updateCampaign(_prev: CrudState, formData: FormData): Promise<CrudState> {
  const guard = await requireArea(LIST)
  if (!guard.ok) return fail(guard.error)
  const id = String(formData.get('id') ?? '')
  const form = readCampaignForm(formData)
  if (!form.ok) return fail(form.error)

  const before = await db.emailCampaign.findUnique({
    where: { id },
    select: { status: true, name: true, subject: true, body: true },
  })
  if (!before) return fail('That blast no longer exists.')
  if (before.status !== 'DRAFT') {
    return fail('This blast has already gone to people, so its text is fixed. Start a new blast instead.')
  }

  // Conditional on still being a draft: a shift that started a moment ago wins.
  const updated = await db.emailCampaign.updateMany({
    where: { id, status: 'DRAFT' },
    data: { ...form.value, complianceFlags: flagsOf(form.value.subject, form.value.body) },
  })
  if (updated.count === 0) return fail('This blast started sending, so its text is now fixed.')

  await recordAdminAction({
    entityType: 'EmailCampaign',
    entityId: id,
    action: 'UPDATE',
    actor: guard.identity,
    before: { name: before.name, subject: before.subject, body: before.body },
    after: form.value,
  })
  revalidatePath(`${LIST}/${id}`)
  return { ok: 'Saved.' }
}

export async function deleteCampaign(formData: FormData): Promise<void> {
  const guard = await requireArea(LIST)
  if (!guard.ok) return
  const id = String(formData.get('id') ?? '')
  // Drafts only: a sent blast is the record of what people received.
  const { count } = await db.emailCampaign.deleteMany({ where: { id, status: 'DRAFT' } })
  if (count === 0) return
  await recordAdminAction({
    entityType: 'EmailCampaign',
    entityId: id,
    action: 'DELETE',
    actor: guard.identity,
    reason: 'Draft deleted',
  })
  revalidatePath(LIST)
  redirect(LIST)
}

export async function sendCampaignTest(_prev: CrudState, formData: FormData): Promise<CrudState> {
  const guard = await requireArea(LIST)
  if (!guard.ok) return fail(guard.error)
  const id = String(formData.get('id') ?? '')
  const result = await sendTest(id, guard.identity.email)
  await recordAdminAction({
    entityType: 'EmailCampaign',
    entityId: id,
    action: result.ok ? 'PUBLISH' : 'PUBLISH_BLOCKED',
    actor: guard.identity,
    reason: result.ok ? `Test sent to ${guard.identity.email}` : result.problems.join(' '),
  })
  return result.ok ? { ok: `A test is on its way to ${guard.identity.email}.` } : fail(result.problems.join(' '))
}

export async function sendCampaignShift(_prev: CrudState, formData: FormData): Promise<CrudState> {
  const guard = await requireArea(LIST)
  if (!guard.ok) return fail(guard.error)
  const id = String(formData.get('id') ?? '')
  const outcome = await sendShift(id)

  await recordAdminAction({
    entityType: 'EmailCampaign',
    entityId: id,
    action: outcome.kind === 'sent' ? 'PUBLISH' : 'PUBLISH_BLOCKED',
    actor: guard.identity,
    reason:
      outcome.kind === 'sent'
        ? `Shift sent: ${outcome.accepted} accepted, ${outcome.failed} failed, ${outcome.remaining} remaining`
        : outcome.kind === 'refused'
          ? outcome.problems.join(' ')
          : `Not sent: ${outcome.kind}`,
  })
  revalidatePath(`${LIST}/${id}`)
  revalidatePath(LIST)

  switch (outcome.kind) {
    case 'sent':
      return {
        ok:
          `Sent to ${outcome.accepted} ${outcome.accepted === 1 ? 'person' : 'people'}` +
          (outcome.failed ? `, ${outcome.failed} failed` : '') +
          (outcome.remaining ? `. ${outcome.remaining} still to go.` : '. Everyone has it now.'),
      }
    case 'refused':
      return fail(outcome.problems.join(' '))
    case 'busy':
      return fail('A shift is already sending. Give it a minute, then reload.')
    case 'finished':
      return fail('Everyone on the list has already had this blast.')
    case 'missing':
      return fail('That blast no longer exists.')
  }
}
