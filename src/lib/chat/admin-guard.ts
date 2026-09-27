import 'server-only'
import { NextResponse } from 'next/server'
import { getAdminIdentity, type AdminIdentity } from '@/lib/admin/auth'
import { canAccessAdminPath } from '@/lib/admin/areas'

/**
 * Every admin chat endpoint re-checks the session AND the messages-area grant.
 *
 * These are public HTTP endpoints serving customers' private conversations. The
 * inbox page living behind the admin layout says nothing about who is calling an API
 * route directly, and reading someone's messages is a separate grant from reading the
 * customer list for exactly that reason (see lib/admin/areas.ts).
 */
export async function requireChatAdmin(): Promise<
  { ok: true; identity: AdminIdentity } | { ok: false; response: NextResponse }
> {
  const identity = await getAdminIdentity()
  if (!identity) {
    return { ok: false, response: NextResponse.json({ error: 'Not signed in' }, { status: 401 }) }
  }
  if (!canAccessAdminPath(identity.role, identity.adminAreas, '/admin/messages')) {
    return { ok: false, response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
  }
  return { ok: true, identity }
}
