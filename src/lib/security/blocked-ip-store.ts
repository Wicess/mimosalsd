import 'server-only'
import { cacheTag } from 'next/cache'
import { db } from '@/lib/db/client'
import { normaliseIp } from './client-ip'

/**
 * Invalidated by every block and unblock — the admin actions with `updateTag`, the
 * chat route with `revalidateTag` — so the endpoint the proxy reads is never stale
 * by more than the proxy's own minute.
 */
export const BLOCKED_IPS_TAG = 'blocked-ips'

/**
 * Every blocked address, canonical, from the data cache until an edit invalidates
 * it. Canonical on the way out too, because rows written before addresses were
 * normalised would otherwise never match the canonical address the proxy compares.
 * A failure is thrown, and a thrown result is never cached: the next request retries.
 */
export async function blockedIpsCached(): Promise<string[]> {
  'use cache'
  cacheTag(BLOCKED_IPS_TAG)
  const rows = await db.blockedIp.findMany({ select: { ip: true } })
  return rows.map((row) => normaliseIp(row.ip) ?? row.ip)
}
