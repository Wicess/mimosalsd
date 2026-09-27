'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { getAdminIdentity } from '@/lib/admin/auth'
import { canAccessAdminPath } from '@/lib/admin/areas'
import { recordAdminAction } from '@/lib/admin/audit'
import { db } from '@/lib/db/client'

export type ReviewActionState = { error?: string; ok?: boolean }

const schema = z.object({
  id: z.string().min(1).max(60),
  decision: z.enum(['APPROVED', 'REJECTED']),
})

/**
 * Approve or reject a review.
 *
 * Re-checks both the session and the AREA grant — a server action is a public HTTP
 * endpoint, and the button living behind a filtered sidebar says nothing about who is
 * calling it.
 */
export async function moderateReview(
  _previous: ReviewActionState,
  formData: FormData,
): Promise<ReviewActionState> {
  const identity = await getAdminIdentity()
  if (!identity) return { error: 'Not signed in.' }
  if (!canAccessAdminPath(identity.role, identity.adminAreas, '/admin/reviews')) {
    return { error: 'You do not have access to review moderation.' }
  }

  const parsed = schema.safeParse({
    id: formData.get('id'),
    decision: formData.get('decision'),
  })
  if (!parsed.success) return { error: 'Invalid request.' }

  const before = await db.review.findUnique({ where: { id: parsed.data.id } })

  const after = await db.review.update({
    where: { id: parsed.data.id },
    data: {
      moderationStatus: parsed.data.decision,
      moderatedBy: identity.email,
      moderatedAt: new Date(),
    },
  })

  /*
    A published review is published COPY, and copy on this site carries the same
    health-claim exposure as an advertisement (CLAUDE.md rule 5). The decision to
    let one through is therefore an editorial act, and the trail records the body
    that was approved rather than only the verdict.
  */
  await recordAdminAction({
    entityType: 'Review',
    entityId: parsed.data.id,
    action: parsed.data.decision === 'APPROVED' ? 'PUBLISH' : 'UNPUBLISH',
    actor: identity,
    before,
    after,
    reason: `Moderated to ${parsed.data.decision}`,
  })

  revalidatePath('/admin/reviews')
  revalidatePath('/admin')
  return { ok: true }
}
