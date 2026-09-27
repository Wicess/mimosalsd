import 'server-only'
import { cookies } from 'next/headers'
import { TEAM_KIND } from './activity'
import { isVisitorId, VISITOR_COOKIE, VISITOR_MAX_AGE } from './cookie'
import { recordActivity } from './record-activity'

/**
 * Mark this browser as the team's, at admin sign-in, so its visits to the shop show
 * "Team" in the visitor list rather than passing for a customer's.
 *
 * A browser that has never opened the shop has no visitor id yet; it is given one
 * here, the same kind the proxy hands out, so its first visit arrives already marked.
 * Only a server action may call this: it sets a cookie. Never fails a sign-in.
 */
export async function markTeamBrowser(): Promise<void> {
  try {
    const store = await cookies()
    let visitorId = store.get(VISITOR_COOKIE)?.value
    if (!isVisitorId(visitorId)) {
      visitorId = crypto.randomUUID()
      store.set(VISITOR_COOKIE, visitorId, {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        maxAge: VISITOR_MAX_AGE,
        path: '/',
      })
    }
    await recordActivity(TEAM_KIND, { visitorId, path: '/admin/login' })
  } catch {
    // Marking is a nicety; signing in is not.
  }
}
