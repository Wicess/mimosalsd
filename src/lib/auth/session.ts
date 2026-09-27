import 'server-only'
import { cookies } from 'next/headers'

/**
 * Session abstraction.
 *
 * Same pluggable-provider shape as the catalogue and orders. Auth.js with a magic-link
 * provider and the Prisma adapter drops in behind this interface at the point the
 * database exists — nothing in the account UI needs to change.
 *
 * Until then `getSession()` returns null and the account area invites a guest lookup,
 * which is a genuinely useful path in its own right: most customers here check out as
 * guests and want to track one order, not manage a profile.
 */
export interface Session {
  readonly userId: string
  readonly email: string
  readonly name?: string
}

export interface SessionProvider {
  getSession(): Promise<Session | null>
}

export const SESSION_COOKIE = 'session'

class NullSessionProvider implements SessionProvider {
  async getSession(): Promise<Session | null> {
    // Reads the cookie so the shape is exercised, but never mints a session — a
    // provider that "worked" without a real identity check would be worse than none.
    await cookies()
    return null
  }
}

let provider: SessionProvider = new NullSessionProvider()

export function setSessionProvider(next: SessionProvider): void {
  provider = next
}

export function resetSessionProvider(): void {
  provider = new NullSessionProvider()
}

export function getSession(): Promise<Session | null> {
  return provider.getSession()
}
