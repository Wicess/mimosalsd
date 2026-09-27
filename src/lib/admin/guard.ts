import 'server-only'
import { getAdminIdentity } from './auth'
import { canAccessAdminPath } from './areas'

/**
 * Authorisation guard for admin server actions.
 *
 * Every admin mutation calls this. The proxy already guards page NAVIGATION, but a
 * server action is a separate public HTTP endpoint — it is reachable directly, and the
 * fact that its button only renders on a page the user can see says nothing about who
 * is invoking it. Guarding navigation and not guarding the action is the most common
 * way an RBAC system turns out to be decorative.
 */
export type GuardResult =
  | { ok: true; identity: NonNullable<Awaited<ReturnType<typeof getAdminIdentity>>> }
  | { ok: false; error: string }

/**
 * Signed in, with no area requirement.
 *
 * For actions that operate on the CALLER'S OWN account rather than on a section of
 * the panel. Gating "change my password" behind the settings area would mean a STAFF
 * user granted only /admin/orders could never rotate their own credential — which
 * turns a routine hygiene task into a request to somebody else, and the usual outcome
 * of that is a shared password nobody rotates.
 *
 * It is not a weaker check. It still resolves the identity through `getAdminIdentity`,
 * which refuses a disabled account; it simply asks a different question.
 */
export async function requireSignedIn(): Promise<GuardResult> {
  const identity = await getAdminIdentity()
  if (!identity) return { ok: false, error: 'Not signed in.' }
  return { ok: true, identity }
}

export async function requireArea(path: string): Promise<GuardResult> {
  const identity = await getAdminIdentity()
  if (!identity) return { ok: false, error: 'Not signed in.' }
  if (!canAccessAdminPath(identity.role, identity.adminAreas, path)) {
    return { ok: false, error: 'You do not have access to this area.' }
  }
  return { ok: true, identity }
}
