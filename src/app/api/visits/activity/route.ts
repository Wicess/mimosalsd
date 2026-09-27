import { z } from 'zod'
import { CLIENT_ACTIVITY_KINDS } from '@/lib/visitors/activity'
import { recordActivity } from '@/lib/visitors/record-activity'

/**
 * The browser reports the two things only it can see: that the site was installed
 * as an app, and that reply notifications were allowed. Anything else is recorded
 * server-side by the action that did it, so it cannot be faked from here.
 *
 * It can only ever write for the visitor cookie the request carries, each kind is
 * recorded once per visitor, and the answer is the same whatever happened.
 */
const schema = z.object({ kind: z.enum(CLIENT_ACTIVITY_KINDS), path: z.string().max(200).optional() })

export async function POST(request: Request): Promise<Response> {
  const parsed = schema.safeParse(await request.json().catch(() => null))
  if (parsed.success) {
    await recordActivity(parsed.data.kind, { path: parsed.data.path ?? null })
  }
  return new Response(null, { status: 204, headers: { 'cache-control': 'no-store' } })
}
