import { z } from 'zod'
import { CLIENT_ACTIVITY_KINDS } from '@/lib/visitors/activity'
import { recordActivity } from '@/lib/visitors/record-activity'
import { cookies } from 'next/headers'
import { alertLines, notify } from '@/lib/notify/ntfy'
import { absoluteUrl } from '@/lib/seo/routes'
import { VISITOR_COOKIE } from '@/lib/visitors/cookie'

/*
  Someone subscribing to the shop's notifications, or installing it as an app, rings
  the owner (2026-10-17). Both are recorded once per visitor, so each person rings once.
*/
const ALERTS = {
  NOTIFICATIONS_ENABLED: { title: 'A visitor turned on notifications', tag: 'bell', what: 'Subscribed to reply and offer notifications' },
  APP_INSTALLED: { title: 'A visitor installed the app', tag: 'iphone', what: 'Added the shop to their home screen' },
} as const

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
    const recorded = await recordActivity(parsed.data.kind, { path: parsed.data.path ?? null })
    if (recorded) {
      const alert = ALERTS[parsed.data.kind]
      const visitor = (await cookies()).get(VISITOR_COOKIE)?.value
      const where = visitor ? absoluteUrl(`/admin/visitors/${encodeURIComponent(visitor)}`) : absoluteUrl('/admin/visitors')
      await notify({
        topic: 'signups',
        title: alert.title,
        body: alertLines([
          ['', alert.what],
          ['Page', parsed.data.path ?? null],
        ]),
        tags: [alert.tag, 'subscriber'],
        clickUrl: where,
        actions: [{ label: 'Open visitor', url: where }],
      })
    }
  }
  return new Response(null, { status: 204, headers: { 'cache-control': 'no-store' } })
}
