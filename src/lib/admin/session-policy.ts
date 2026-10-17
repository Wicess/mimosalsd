/**
 * How long an admin sign-in lasts, shared by the code that issues the session
 * (lib/admin/auth.ts) and the proxy that checks and renews it. No server-only
 * imports, so the proxy can read it.
 *
 * Owner, 2026-10-17: "once I log in on a device I should not need to log in again;
 * tapping an ntfy notification should take me straight to the admin panel."
 *
 *  - The session lasts 90 days and RENEWS itself: any admin page opened more than a
 *    day after the session was last renewed gets a fresh 90 days. A device in use
 *    stays signed in; one left alone for 90 days has to sign in again.
 *  - The cookie is SameSite=Lax, not Strict. Strict cookies are not sent when the
 *    admin page is opened from outside the site (a tap on an ntfy notification opens
 *    it from another app), so every notification landed on the sign-in page. Lax
 *    still withholds the cookie from cross-site form posts, and Next checks the
 *    origin of every server action as well.
 *
 * To sign every device out at once, rotate ADMIN_SESSION_SECRET: every outstanding
 * session stops verifying. Signing out on a device clears that device.
 */
export const ADMIN_SESSION_COOKIE = 'admin_session'
export const ADMIN_SESSION_TTL_MS = 90 * 24 * 60 * 60 * 1000
/** Renew at most once a day per device, so renewal is not a cookie write on every click. */
export const ADMIN_SESSION_RENEW_AFTER_MS = 24 * 60 * 60 * 1000

export function adminSessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    maxAge: Math.floor(ADMIN_SESSION_TTL_MS / 1000),
    path: '/',
  }
}
