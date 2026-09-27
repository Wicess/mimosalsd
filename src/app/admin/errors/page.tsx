import { db } from '@/lib/db/client'
import { AdminPage, Cell, DataTable, EmptyState, Row } from '@/components/admin/shell'
import { ErrorRowActions } from '@/components/admin/error-actions'
import { Badge } from '@/components/ui/badge'

export const metadata = {
  title: 'Error log',
}

/**
 * The error log.
 *
 * NOTE FOR ANYONE TEMPTED TO ADD A REFRESH: do not. No `setInterval`, no
 * `router.refresh()`, no SWR `refreshInterval`. This is a page an operator leaves open
 * all day, and Neon only suspends after ~5 minutes with ZERO queries — a poll here
 * would hold the database awake around the clock and bill for the privilege of showing
 * an unchanged table. Errors already push to ntfy the moment they happen; this page is
 * where you come to read them, not how you find out.
 */

const SEVERITY_TONE: Record<string, 'danger' | 'warning' | 'neutral'> = {
  FATAL: 'danger',
  ERROR: 'warning',
  WARN: 'neutral',
}

function when(date: Date): string {
  return date.toISOString().slice(0, 16).replace('T', ' ')
}

async function ErrorRows() {
  /*
   * Unresolved first, then most recent. Capped at 100 — an error log you have to
   * paginate to see the fire in is not doing its job, and the fingerprinting means
   * 100 rows is 100 distinct bugs, not 100 occurrences.
   */
  const rows = await db.errorLog.findMany({
    orderBy: [{ resolvedAt: { sort: 'asc', nulls: 'first' } }, { lastSeenAt: 'desc' }],
    take: 100,
  })

  if (rows.length === 0) {
    return (
      <EmptyState
        title="No errors recorded"
        hint="Every server render, route handler, Server Action, proxy hop and browser session reports here. An empty table means nothing has thrown."
      />
    )
  }

  return (
    <DataTable
      headers={['Severity', 'Where', 'Error', 'Count', 'First seen', 'Last seen', '']}
    >
      {rows.map((row) => (
        <Row key={row.id}>
          <Cell>
            <Badge tone={SEVERITY_TONE[row.severity] ?? 'neutral'}>{row.severity}</Badge>
            {row.resolvedAt ? (
              <span className="mt-1 block text-[11px] text-foreground-subtle">
                resolved{row.resolvedBy ? ` by ${row.resolvedBy}` : ''}
              </span>
            ) : null}
          </Cell>
          <Cell className="text-xs">
            <span className="block font-medium text-foreground">{row.source}</span>
            <span className="block text-foreground-muted">
              {row.routePath ?? row.requestPath ?? '—'}
            </span>
            {row.method ? (
              <span className="block text-foreground-subtle">{row.method}</span>
            ) : null}
          </Cell>
          <Cell className="max-w-md">
            <span className="block font-medium text-foreground">{row.name}</span>
            <span className="mt-0.5 block break-words text-xs text-foreground-muted">
              {row.message}
            </span>
            {row.digest ? (
              <span className="tabular mt-1 block text-[11px] text-foreground-subtle">
                digest {row.digest}
              </span>
            ) : null}
          </Cell>
          <Cell className="tabular text-foreground">{row.count}</Cell>
          <Cell className="tabular text-xs text-foreground-muted">
            {when(row.firstSeenAt)}
          </Cell>
          <Cell className="tabular text-xs text-foreground-muted">
            {when(row.lastSeenAt)}
          </Cell>
          <Cell>
            <ErrorRowActions id={row.id} resolved={Boolean(row.resolvedAt)} />
          </Cell>
        </Row>
      ))}
    </DataTable>
  )
}

export default function AdminErrorsPage() {
  return (
    <AdminPage
      title="Error log"
      description="One row per distinct failure, not per occurrence — a bug firing ten thousand times is one row with a count of ten thousand. Rows re-open automatically if the error happens again after being resolved. Stack traces and messages are redacted of credentials before they are stored."
    >
      <ErrorRows />
    </AdminPage>
  )
}
