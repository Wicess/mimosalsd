'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { getAdminIdentity } from '@/lib/admin/auth'
import { canAccessAdminPath } from '@/lib/admin/areas'
import { recordAdminAction } from '@/lib/admin/audit'
import { db } from '@/lib/db/client'

export type ErrorActionState = { error?: string; ok?: boolean }

const schema = z.object({
  id: z.string().min(1).max(60),
  action: z.enum(['resolve', 'reopen']),
})

/**
 * Mark an error dealt with, or put it back.
 *
 * Resolving does NOT delete the row and does not reset `count`. The history of a bug —
 * when it first appeared, how many times it fired — is the most useful thing about it
 * the second time it happens, and it happens a second time more often than not.
 *
 * A recurrence re-opens the row automatically (see `persist` in report-error.ts), so
 * ticking something off is a statement about the present, not a promise about the
 * future. That is deliberate: an error someone resolved last week which is firing
 * again right now must not stay hidden.
 *
 * Re-checks the session and the area grant. A server action is a public HTTP endpoint,
 * and the button living behind a filtered sidebar says nothing about who is calling it.
 */
export async function resolveError(
  _previous: ErrorActionState,
  formData: FormData,
): Promise<ErrorActionState> {
  const identity = await getAdminIdentity()
  if (!identity) return { error: 'Not signed in.' }
  if (!canAccessAdminPath(identity.role, identity.adminAreas, '/admin/errors')) {
    return { error: 'You do not have access to the error log.' }
  }

  const parsed = schema.safeParse({
    id: formData.get('id'),
    action: formData.get('action'),
  })
  if (!parsed.success) return { error: 'Invalid request.' }

  const resolving = parsed.data.action === 'resolve'

  await db.errorLog.update({
    where: { id: parsed.data.id },
    data: resolving
      ? { resolvedAt: new Date(), resolvedBy: identity.email }
      : { resolvedAt: null, resolvedBy: null },
  })

  /*
    No `before`/`after` rows here on purpose. An ErrorLog row carries a stack and a
    redacted context blob, and copying that whole payload into the audit table on
    every resolve would duplicate the largest rows in the database to record a
    one-bit change. The reason line says which way the bit went.
  */
  await recordAdminAction({
    entityType: 'ErrorLog',
    entityId: parsed.data.id,
    action: 'UPDATE',
    actor: identity,
    reason: resolving ? 'Marked resolved' : 'Reopened',
  })

  revalidatePath('/admin/errors')
  return { ok: true }
}
