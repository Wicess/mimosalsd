import { timingSafeEqual } from 'node:crypto'
import { connection } from 'next/server'
import { blockedIpsCached } from '@/lib/security/blocked-ip-store'
import { BLOCKLIST_TOKEN_HEADER, blocklistToken } from '@/lib/security/blocklist'

/**
 * The blocked addresses, for the proxy and for nobody else.
 *
 * Answers only a request carrying the proxy's token (lib/security/blocklist.ts).
 * Anyone else gets a plain 404: the list is people's addresses, and a blocked
 * visitor should not be able to confirm they are on it.
 *
 * Served from the data cache, so the proxy's minute-by-minute refresh costs a
 * request, not a query. A real failure is not cached — it becomes a 503 here, and
 * the proxy keeps the list it already had.
 */
export async function GET(request: Request): Promise<Response> {
  // Request-time, so the build never needs the database for this.
  await connection()
  const headers = { 'cache-control': 'no-store' }

  const secret = process.env.ADMIN_SESSION_SECRET
  const given = Buffer.from(request.headers.get(BLOCKLIST_TOKEN_HEADER) ?? '')
  const expected = Buffer.from(secret && secret.length >= 32 ? blocklistToken(secret) : '')
  if (expected.length === 0 || given.length !== expected.length || !timingSafeEqual(given, expected)) {
    return new Response('Not found', { status: 404, headers })
  }

  try {
    return Response.json({ ips: await blockedIpsCached() }, { headers })
  } catch {
    return Response.json({ ips: null }, { status: 503, headers })
  }
}
