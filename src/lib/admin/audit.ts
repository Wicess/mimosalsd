import 'server-only'
import { db } from '@/lib/db/client'
import type { AdminIdentity } from './auth'

/**
 * ─────────────────────────────────────────────────────────────────────────────
 *  THE ADMIN AUDIT TRAIL — who did what, when, and to which record.
 *
 *  Before this existed, ONE of twenty-two admin mutations wrote an audit row.
 *  Someone could burn a payment handle, disable a colleague's account, change the
 *  price of every variant of a product or delete a subscriber, and the only trace
 *  was the changed row itself — which records the new value and nothing about who
 *  replaced the old one.
 *
 *  ── Why no new model ───────────────────────────────────────────────────────
 *  `ComplianceAuditLog` already had exactly the right columns: entity, action,
 *  before, after, actor, reason, timestamp. A second table with the same shape
 *  would mean two places to look when reconstructing an incident and two places
 *  to forget to write to. The name is narrower than the job it now does, and a
 *  rename is a migration on an append-only legal record — the cost is real and
 *  the benefit is a better noun. It stays.
 *
 *  ── Why this never throws ──────────────────────────────────────────────────
 *  By the time it is called the mutation has already committed. If the audit
 *  write fails, the choice is between losing the audit row and unwinding a change
 *  the operator has already been told succeeded. Losing the row is worse than it
 *  sounds and still better than the alternative, so the failure is swallowed here
 *  and reported through the error log instead of thrown at the caller.
 *
 *  That is the same trade `advanceOrder` makes when stamping payment verification,
 *  and it is deliberate in both places rather than incidental in either.
 *
 *  ── Why the actor is an identity, not a string ─────────────────────────────
 *  The two audit-trail defects found during the order-detail port were both of
 *  this shape: `actorEmail: 'admin'` written by code that had checked SOMEBODY was
 *  signed in without ever asking who. On the transition that confirms money
 *  arrived, "was this authorised" and "who authorised it" are not the same
 *  question. Taking an `AdminIdentity` makes the second one unskippable — there is
 *  no overload that accepts a literal.
 * ─────────────────────────────────────────────────────────────────────────────
 */

/**
 * What happened to the record.
 *
 * A closed set rather than a free string, so the log can be filtered and counted.
 * `PUBLISH_BLOCKED` predates this helper and is written when the lexicon refuses
 * copy — the one audit entry that records something NOT happening, which is the
 * entry a regulator asking "did you have a gate" most wants to see.
 */
export type AuditAction =
  | 'CREATE'
  | 'UPDATE'
  | 'DELETE'
  | 'PUBLISH'
  | 'UNPUBLISH'
  | 'PUBLISH_BLOCKED'
  | 'LOGIN'
  | 'LOGIN_FAILED'
  | 'LOGOUT'
  | 'RESET'
  | 'BURN'

/**
 * Keys whose VALUE must never reach the audit table.
 *
 * `before`/`after` are whole rows, captured generically so that adding a column to
 * a model does not silently drop it from the trail. The cost of that convenience is
 * that a secret added to a model would be captured just as automatically, so the
 * filter is a denylist applied at write time rather than a promise made at each
 * call site.
 *
 * `handle` is here for a reason particular to this business: payment handles are
 * server-only and issued from a rotating pool precisely so they cannot be scraped
 * and frozen (CLAUDE.md rule 7). A burned handle sitting in a log that an operator
 * can read is a slower version of the same leak.
 */
const REDACTED_KEYS = new Set([
  'passwordhash',
  'password',
  'secret',
  'token',
  'ordertoken',
  'sessiontoken',
  'apikey',
  'handle',
  'btcaddress',
])

const REDACTED = '[redacted]'

/**
 * Deep-copy a row for the trail, blanking anything sensitive and making it JSON-safe.
 *
 * Prisma hands back `Date`, `Decimal` and `BigInt` values. `BigInt` in particular
 * throws on `JSON.stringify` rather than degrading — `PaymentIntentRequest.btcAmountSats`
 * is a BigInt, so an un-normalised audit write on that model would fail at exactly
 * the moment it mattered.
 */
function sanitise(value: unknown, depth = 0): unknown {
  if (value === null || value === undefined) return null
  if (depth > 6) return REDACTED
  if (typeof value === 'bigint') return value.toString()
  if (value instanceof Date) return value.toISOString()
  if (Array.isArray(value)) return value.map((entry) => sanitise(entry, depth + 1))
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
      out[key] = REDACTED_KEYS.has(key.toLowerCase())
        ? REDACTED
        : sanitise(entry, depth + 1)
    }
    return out
  }
  if (typeof value === 'function' || typeof value === 'symbol') return REDACTED
  return value
}

export interface AuditEntry {
  /** The model, as written in the schema — "Product", "AdminUser", "PaymentHandle". */
  readonly entityType: string
  /** Primary key of the affected row, or a natural key where there is no row. */
  readonly entityId: string
  readonly action: AuditAction
  /** Who did it. Resolved through the guard, never a literal. */
  readonly actor: Pick<AdminIdentity, 'userId' | 'email'>
  /** The row before the change, where one existed. */
  readonly before?: unknown
  /** The row after the change, where one remains. */
  readonly after?: unknown
  /** Operator-supplied justification, or a short description of the action. */
  readonly reason?: string | null
}

/**
 * Append one row to the trail. Never throws; never blocks the caller's result.
 */
export async function recordAdminAction(entry: AuditEntry): Promise<void> {
  try {
    await db.complianceAuditLog.create({
      data: {
        entityType: entry.entityType,
        entityId: entry.entityId,
        action: entry.action,
        before: entry.before === undefined ? undefined : (sanitise(entry.before) as object),
        after: entry.after === undefined ? undefined : (sanitise(entry.after) as object),
        actorId: entry.actor.userId,
        actorEmail: entry.actor.email,
        reason: entry.reason?.trim() || null,
      },
    })
  } catch (error) {
    /*
      Reported, not rethrown, and reported through the same path as any other
      server fault so it surfaces on /admin/errors rather than only in a log
      nobody opens. An audit trail that silently stops writing is worse than one
      that was never claimed, so the failure has to be visible somewhere.
    */
    const { reportError } = await import('@/lib/observability/report-error')
    await reportError(error, {
      source: 'db',
      severity: 'ERROR',
      context: {
        audit: 'write failed',
        action: entry.action,
        entityType: entry.entityType,
        entityId: entry.entityId,
      },
    })
  }
}
