'use server'

import { headers } from 'next/headers'
import { revalidatePath, updateTag } from 'next/cache'
import { requireArea } from '@/lib/admin/guard'
import { recordAdminAction } from '@/lib/admin/audit'
import { db } from '@/lib/db/client'
import { BLOCKED_IPS_TAG } from '@/lib/security/blocked-ip-store'
import { clientIpFrom, normaliseIp } from '@/lib/security/client-ip'
import type { CrudState } from '@/app/actions/admin-crud'

/**
 * ─────────────────────────────────────────────────────────────────────────────
 *  BLOCKED ADDRESSES — added and removed by hand.
 *
 *  One exact address per entry, no ranges. A range blocks strangers along with the
 *  person meant, and on this site a stranger is a customer who could not order.
 *  An address is still shared by everyone behind it (a household, an office, a
 *  phone carrier), which is why the refusal page tells them how to reach us.
 *
 *  Every change is audited, a block requires a reason, and the proxy picks the
 *  change up within about a minute (lib/security/blocklist.ts).
 * ─────────────────────────────────────────────────────────────────────────────
 */

const ADMIN_PATH = '/admin/visitors/blocked'

const ok = (message: string): CrudState => ({ ok: message })
const fail = (error: string): CrudState => ({ error })

export async function blockIp(_prev: CrudState, formData: FormData): Promise<CrudState> {
  const guard = await requireArea(ADMIN_PATH)
  if (!guard.ok) return fail(guard.error)

  const ip = normaliseIp(String(formData.get('ip') ?? ''))
  if (!ip) {
    return fail('That is not an IP address. Enter one address, such as 203.0.113.7 or 2001:db8::7.')
  }

  const reason = String(formData.get('reason') ?? '').trim()
  if (reason.length < 3) {
    return fail('Say why. A block with no reason is the one nobody can review later.')
  }
  if (reason.length > 500) return fail('Keep the reason under 500 characters.')

  // The admin stays reachable from a blocked address, so this is not a lockout —
  // but the shop would refuse the operator, which is never what was meant.
  if (ip === clientIpFrom(await headers())) {
    return fail('That is the address you are using right now. The shop would refuse you.')
  }

  const existing = await db.blockedIp.findUnique({ where: { ip }, select: { reason: true } })
  await db.blockedIp.upsert({
    where: { ip },
    create: { ip, reason, createdBy: guard.identity.email },
    update: { reason, createdBy: guard.identity.email },
  })
  await recordAdminAction({
    entityType: 'BlockedIp',
    entityId: ip,
    action: existing ? 'UPDATE' : 'CREATE',
    actor: guard.identity,
    ...(existing ? { before: { reason: existing.reason } } : {}),
    after: { reason },
    reason,
  })

  updateTag(BLOCKED_IPS_TAG)
  revalidatePath(ADMIN_PATH)
  return ok(
    existing
      ? `${ip} was already blocked. The reason is updated.`
      : `${ip} is blocked. Every page will refuse it within about a minute.`,
  )
}

export async function unblockIp(formData: FormData): Promise<void> {
  const guard = await requireArea(ADMIN_PATH)
  if (!guard.ok) return

  // The stored spelling, exactly, from the row's own form: rows written before
  // addresses were normalised must still be removable.
  const ip = String(formData.get('ip') ?? '').trim()
  if (!ip || ip.length > 64) return

  const { count } = await db.blockedIp.deleteMany({ where: { ip } })
  if (count === 0) return

  await recordAdminAction({
    entityType: 'BlockedIp',
    entityId: ip,
    action: 'DELETE',
    actor: guard.identity,
    reason: 'Unblocked from the blocked-addresses page',
  })

  updateTag(BLOCKED_IPS_TAG)
  revalidatePath(ADMIN_PATH)
}
