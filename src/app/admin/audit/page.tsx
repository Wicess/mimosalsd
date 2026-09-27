import { db } from '@/lib/db/client'
import { AdminPage, Cell, DataTable, EmptyState, Row } from '@/components/admin/shell'
import { Badge } from '@/components/ui/badge'

export const metadata = {
  title: 'Audit trail',
}

/**
 * ─────────────────────────────────────────────────────────────────────────────
 *  THE AUDIT TRAIL — who changed what, across the whole panel.
 *
 *  A trail nobody can read is half a feature. Every admin mutation now writes a
 *  row, and this is where those rows are answerable: which operator, which record,
 *  what it looked like before, and why they said they were doing it.
 *
 *  NO AUTO-REFRESH, for the same reason `/admin/errors` says so in its own file.
 *  This is a page an operator leaves open while investigating something, and Neon
 *  suspends only after ~5 minutes with ZERO queries — a poll here would hold the
 *  database awake all day to redraw a table that changes when somebody clicks a
 *  button somewhere else.
 *
 *  READ-ONLY, and there is no action on this page by design. An append-only record
 *  with an edit button is not a record. Rows are never updated and never deleted;
 *  if one is wrong, the correction is another row.
 * ─────────────────────────────────────────────────────────────────────────────
 */

/**
 * How loudly each action reads.
 *
 * `PUBLISH_BLOCKED` is deliberately a warning rather than a neutral note: it is the
 * lexicon refusing copy an operator tried to publish, which is the entry a compliance
 * review most wants to find — and the one most easily lost in a wall of UPDATEs.
 * `BURN` and `DELETE` are irreversible. `LOGIN` with the bootstrap credential is
 * flagged by its reason line rather than its action, since it is an ordinary sign-in
 * that happens to have granted SUPERADMIN with no user record behind it.
 */
const ACTION_TONE: Record<string, 'danger' | 'warning' | 'success' | 'info' | 'neutral'> = {
  DELETE: 'danger',
  BURN: 'danger',
  PUBLISH_BLOCKED: 'warning',
  RESET: 'warning',
  UNPUBLISH: 'warning',
  CREATE: 'success',
  PUBLISH: 'success',
  LOGIN: 'info',
  LOGOUT: 'neutral',
  UPDATE: 'neutral',
}

function when(date: Date): string {
  return date.toISOString().slice(0, 16).replace('T', ' ')
}

/**
 * The fields that actually changed, as `name: old → new`.
 *
 * Dumping two whole JSON blobs into a table cell is how an audit log becomes
 * something nobody reads. Both rows are kept in the database — the full before and
 * after are there for an export or a regulator — but on screen the useful part is
 * the diff, and for most edits that is one or two lines out of thirty.
 */
function summariseChange(before: unknown, after: unknown): string[] {
  if (!before || !after || typeof before !== 'object' || typeof after !== 'object') {
    return []
  }

  const a = before as Record<string, unknown>
  const b = after as Record<string, unknown>
  const skip = new Set(['updatedAt', 'createdAt', 'id'])

  const changed: string[] = []
  for (const key of new Set([...Object.keys(a), ...Object.keys(b)])) {
    if (skip.has(key)) continue
    const from = JSON.stringify(a[key] ?? null)
    const to = JSON.stringify(b[key] ?? null)
    if (from === to) continue
    changed.push(`${key}: ${truncate(from)} → ${truncate(to)}`)
  }
  return changed
}

function truncate(value: string, max = 40): string {
  const clean = value.replace(/^"|"$/g, '')
  return clean.length > max ? `${clean.slice(0, max)}…` : clean
}

async function AuditRows() {
  /*
   * Most recent first, capped at 200.
   *
   * A cap rather than pagination, matching the error log. The question this page
   * answers is "what has been happening", and the answer is always near the top;
   * anything older than 200 entries is a database query, not a screen.
   */
  const rows = await db.complianceAuditLog.findMany({
    orderBy: { createdAt: 'desc' },
    take: 200,
  })

  if (rows.length === 0) {
    return (
      <EmptyState
        title="Nothing recorded yet"
        hint="Every admin mutation writes here — catalogue edits, state rules, payment handles, team changes, sign-ins, and any copy the compliance lexicon refused to publish."
      />
    )
  }

  return (
    <DataTable headers={['When', 'Action', 'Record', 'Operator', 'What changed', 'Reason']}>
      {rows.map((row) => {
        const changes = summariseChange(row.before, row.after)
        return (
          <Row key={row.id}>
            <Cell className="tabular whitespace-nowrap text-xs text-foreground-muted">
              {when(row.createdAt)}
            </Cell>
            <Cell>
              <Badge tone={ACTION_TONE[row.action] ?? 'neutral'}>{row.action}</Badge>
            </Cell>
            <Cell className="text-xs">
              <span className="block font-medium text-foreground">{row.entityType}</span>
              <span className="block break-all text-foreground-subtle">{row.entityId}</span>
            </Cell>
            <Cell className="text-xs break-words text-foreground-muted">
              {row.actorEmail ?? '—'}
            </Cell>
            <Cell className="max-w-sm text-xs">
              {changes.length === 0 ? (
                <span className="text-foreground-subtle">—</span>
              ) : (
                <ul className="space-y-0.5">
                  {changes.slice(0, 6).map((line) => (
                    <li key={line} className="break-words text-foreground-muted">
                      {line}
                    </li>
                  ))}
                  {changes.length > 6 && (
                    <li className="text-foreground-subtle">
                      +{changes.length - 6} more
                    </li>
                  )}
                </ul>
              )}
            </Cell>
            <Cell className="max-w-xs text-xs break-words text-foreground-muted">
              {row.reason ?? '—'}
            </Cell>
          </Row>
        )
      })}
    </DataTable>
  )
}

export default function AuditPage() {
  return (
    <AdminPage
      title="Audit trail"
      description="Every change made in this panel, in the order it happened. Append-only — entries are never edited or removed, so a mistake is corrected by a later entry rather than by rewriting this one."
    >
      <AuditRows />
    </AdminPage>
  )
}
