'use server'

import { ensureLiveStateRules } from '@/lib/compliance/live-state-rules'
import { revalidatePath, updateTag } from 'next/cache'
import { z } from 'zod'
import { requireArea } from '@/lib/admin/guard'
import { recordAdminAction } from '@/lib/admin/audit'
import { db } from '@/lib/db/client'
import { STATE_RULES_TAG } from '@/lib/compliance/prisma-state-rules'
import { getJurisdiction } from '@/lib/compliance/jurisdictions'
import { notify } from '@/lib/notify/ntfy'
import { absoluteUrl, url } from '@/lib/seo/routes'

export type RuleUpdateState = { error?: string; ok?: string }

/**
 * Edit a state rule.
 *
 * This is the promise the whole compliance architecture was built around: legality is
 * DATA, and an operator can change it in under a minute with no deploy. The cart and
 * the public legality page read the same row, so one edit moves both.
 *
 * Three things happen on every edit, and none of them are optional:
 *  1. the change is written to an immutable ComplianceAuditLog row (before/after)
 *  2. the in-memory rule snapshot is refreshed, so the cart sees it immediately
 *  3. the affected public pages are revalidated
 */
const schema = z.object({
  stateCode: z.string().length(2),
  productLine: z.enum(['MIMOSA_HOSTILIS', 'AMANITA', 'VAPE']),
  status: z.enum(['ALLOWED', 'RESTRICTED', 'BLOCKED']),
  statuteCitation: z.string().max(300).optional(),
  statuteUrl: z.string().url().max(500).optional().or(z.literal('')),
  notes: z.string().max(2000).optional(),
  minAge: z.coerce.number().int().min(18).max(21),
  requiresAdultSignature: z.coerce.boolean(),
  requiresProductDirectory: z.coerce.boolean(),
  watch: z.coerce.boolean(),
  reason: z.string().min(3).max(500),
  /** What the operator was shown. Guards against a silent client-side change. */
  originalStatus: z.enum(['ALLOWED', 'RESTRICTED', 'BLOCKED']).optional(),
  confirmStatusChange: z.coerce.boolean().optional(),
})

export async function updateStateRule(
  _previous: RuleUpdateState,
  formData: FormData,
): Promise<RuleUpdateState> {
  /*
    Was `isAuthenticated()` — "is somebody signed in" — which is the same defect the
    order-detail port found in `advanceOrder`: the check that guarded the write never
    asked WHO was writing, so every audit row below it was stamped `actorEmail: 'admin'`.
    On a table that decides what may lawfully ship where, "was this authorised" and
    "who authorised it" are not the same question.
  */
  const guard = await requireArea('/admin/state-rules')
  if (!guard.ok) return { error: guard.error }
  const { identity } = guard

  const raw = Object.fromEntries(formData.entries())
  const parsed = schema.safeParse({
    ...raw,
    requiresAdultSignature: raw.requiresAdultSignature === 'on',
    requiresProductDirectory: raw.requiresProductDirectory === 'on',
    watch: raw.watch === 'on',
    confirmStatusChange: raw.confirmStatusChange === 'on',
  })

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Check the values and try again.' }
  }
  const data = parsed.data

  const jurisdiction = getJurisdiction(data.stateCode)
  if (!jurisdiction) return { error: 'Unknown jurisdiction.' }

  // A restriction with no cited authority is exactly what the legality pages exist to
  // avoid, and the publication gate would reject it anyway. Refuse it at the source.
  if (data.status !== 'ALLOWED' && !data.statuteCitation?.trim()) {
    return { error: 'A restricted or blocked rule must cite the statute it relies on.' }
  }
  if (!data.notes?.trim() || data.notes.trim().length < 20) {
    return {
      error: 'Write a customer-facing explanation of at least 20 characters — it is shown at checkout and on the state page.',
    }
  }

  /*
   * A status change must be deliberate and confirmed.
   *
   * This exists because a UI defect once flipped Louisiana's Amanita rule from BLOCKED
   * to ALLOWED while the operator was only editing a citation: React reset the form
   * after a refused submit and a controlled <select> fell back to its first option.
   * The UI is fixed, but the server should not depend on the UI being correct for
   * something this consequential.
   */
  if (
    data.originalStatus &&
    data.originalStatus !== data.status &&
    !data.confirmStatusChange
  ) {
    return {
      error: `This would change ${jurisdiction.name} / ${data.productLine.replace(/_/g, ' ')} from ${data.originalStatus.toLowerCase()} to ${data.status.toLowerCase()}. Tick the confirmation box if that is intended.`,
    }
  }

  const before = await db.stateRule.findUnique({
    where: {
      stateCode_productLine: {
        stateCode: jurisdiction.code,
        productLine: data.productLine,
      },
    },
  })
  if (!before) return { error: 'No rule exists for that combination.' }

  const after = await db.stateRule.update({
    where: { id: before.id },
    data: {
      status: data.status,
      statuteCitation: data.statuteCitation?.trim() || null,
      statuteUrl: data.statuteUrl?.trim() || null,
      notes: data.notes.trim(),
      minAge: data.minAge,
      requiresAdultSignature: data.requiresAdultSignature,
      requiresProductDirectory: data.requiresProductDirectory,
      watch: data.watch,
      lastReviewedAt: new Date(),
    },
  })

  // Append-only. Who changed what, when, and why — reconstructable for a regulator.
  await recordAdminAction({
    entityType: 'StateRule',
    entityId: before.id,
    action: 'UPDATE',
    actor: identity,
    before,
    after,
    reason: data.reason,
  })

  // Publish the change everywhere: drop the cached rules (every instance and every
  // cached page that read them), then install the new ones here at once. Setting a
  // provider only in this instance, as this did before, left the rest on stale rules.
  updateTag(STATE_RULES_TAG)
  await ensureLiveStateRules()

  await notify({
    topic: 'errors',
    title: `State rule changed — ${jurisdiction.name} / ${data.productLine}`,
    body: `${before.status} → ${data.status}. Reason: ${data.reason}`,
    tags: ['scales'],
    clickUrl: absoluteUrl('/admin/state-rules'),
  })

  revalidatePath(url.legalityState(jurisdiction.slug))
  revalidatePath(url.legalityHub())
  revalidatePath('/admin/state-rules')
  revalidatePath('/shop')

  return { ok: `${jurisdiction.name} / ${data.productLine.replace(/_/g, ' ')} updated.` }
}
