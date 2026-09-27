import 'server-only'
import { cookies } from 'next/headers'
import { db } from '@/lib/db/client'
import { reportError } from '@/lib/observability/report-error'
import { HUMAN_KIND, ONCE_PER_VISITOR, TEAM_KIND, type ActivityKind } from './activity'
import { isVisitorId, VISITOR_COOKIE } from './cookie'

/**
 * Record something the current visitor just did. Called from the server action or
 * route that did it, after it succeeded.
 *
 * It must never cost the customer anything: no visitor cookie means nothing is
 * recorded, and any failure — including the table not existing yet on a database
 * that has not had migration 0015 — is reported and swallowed. A cart add that fails
 * because the activity log is down would be a bug of the worst kind.
 */
export async function recordActivity(
  kind: ActivityKind | typeof TEAM_KIND | typeof HUMAN_KIND,
  { detail, path, visitorId }: { detail?: string | null; path?: string | null; visitorId?: string | null } = {},
): Promise<void> {
  try {
    const visitor = visitorId ?? (await cookies()).get(VISITOR_COOKIE)?.value
    if (!isVisitorId(visitor)) return
    if (kind === TEAM_KIND || kind === HUMAN_KIND || ONCE_PER_VISITOR.has(kind)) {
      const already = await db.visitorActivity.findFirst({
        where: { visitorId: visitor, kind },
        select: { id: true },
      })
      if (already) return
    }
    await db.visitorActivity.create({
      data: {
        visitorId: visitor,
        kind,
        detail: detail ? detail.slice(0, 200) : null,
        path: path ? path.slice(0, 200) : null,
      },
    })
  } catch (error) {
    await reportError(error, { source: 'action', context: { stage: 'record-activity', kind } }).catch(() => undefined)
  }
}
