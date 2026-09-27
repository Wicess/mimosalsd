import { db } from '@/lib/db/client'
import { AdminPage, Cell, DataTable, EmptyState, Row, StatCard } from '@/components/admin/shell'
import {
  AddSubscriber,
  SubscriberDelete,
  SubscriberToggle,
} from '@/components/admin/subscriber-actions'

export const metadata = { title: 'Newsletter' }

/**
 * Subscriber management.
 *
 * NO AUTO-REFRESH, deliberately — see the note in /admin/errors. Neon only suspends
 * after ~5 minutes with zero queries, and this is a page an operator leaves open.
 *
 * Uses the shared DataTable, which renders a labelled card per record below `lg` and
 * a dense table above it. The actions therefore stay on screen on a phone instead of
 * sitting off the right edge of a sideways-scrolling row.
 */

const PAGE_SIZE = 100

function fmt(date: Date | null): string {
  return date ? date.toISOString().slice(0, 10) : '—'
}

type SearchParams = Promise<Record<string, string | string[] | undefined>>

// The query string is read here, inside AdminPage's Suspense, so the route does not block.
async function Subscribers({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams
  const raw = params.q
  const query = (Array.isArray(raw) ? raw[0] : raw)?.trim().slice(0, 200) ?? ''
  const where = query
    ? { email: { contains: query, mode: 'insensitive' as const } }
    : {}

  const [total, active, rows] = await Promise.all([
    db.newsletterSubscriber.count(),
    db.newsletterSubscriber.count({ where: { isActive: true } }),
    db.newsletterSubscriber.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: PAGE_SIZE,
    }),
  ])

  return (
    <>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        <StatCard label="Subscribers" value={total} />
        <StatCard label="Active" value={active} tone="success" />
        <StatCard label="Unsubscribed" value={total - active} />
      </div>

      <section className="mt-6 rounded-lg border border-border bg-surface p-4">
        <h2 className="text-sm font-medium text-foreground">Add by hand</h2>
        <div className="mt-3">
          <AddSubscriber />
        </div>
      </section>

      {/*
        Two rows on a phone, one from `md`. Four controls in a row needed 481px and
        pushed the whole page sideways; stacking all four wasted a screen. The search
        box and its button belong together, and the two exports belong together.
      */}
      <form className="mt-6 flex flex-col gap-2 md:flex-row md:items-center" role="search">
        <div className="flex gap-2 md:contents">
          <label htmlFor="q" className="sr-only">
            Search by email
          </label>
          <input
            id="q"
            name="q"
            type="search"
            defaultValue={query}
            placeholder="Search by email"
            className="min-h-11 flex-1 rounded-md border border-border-strong bg-surface px-3 text-sm text-foreground placeholder:text-foreground-subtle"
          />
          <button
            type="submit"
            className="min-h-11 rounded-md border border-border-strong bg-surface px-4 text-sm font-medium text-foreground hover:bg-surface-sunken"
          >
            Search
          </button>
        </div>
        <div className="flex items-center gap-3 md:contents">
          {/*
            Plain links, not fetches. The browser handles the download, the CSV never
            passes through React, and the endpoint re-checks auth on its own.
          */}
          <a
            href="/api/admin/subscribers?scope=active"
            className="inline-flex min-h-11 items-center justify-center rounded-md border border-border-strong bg-surface px-4 text-sm font-medium text-foreground hover:bg-surface-sunken"
          >
            Export active
          </a>
          <a
            href="/api/admin/subscribers?scope=all"
            className="inline-flex min-h-11 items-center justify-center text-sm text-foreground-muted underline underline-offset-4 hover:text-foreground"
          >
            Export all
          </a>
        </div>
      </form>

      {rows.length === 0 ? (
        <div className="mt-6">
          <EmptyState
            title={query ? `Nothing matching \u201c${query}\u201d` : 'No subscribers yet'}
            hint={
              query
                ? 'Clear the search to see the whole list.'
                : 'Sign-ups appear here from the footer and in-content forms.'
            }
          />
        </div>
      ) : (
        <div className="mt-6">
          <DataTable headers={['Email', 'Status', 'Source', 'Joined', '']}>
            {rows.map((s) => (
              <Row key={s.id}>
                <Cell className="break-all text-foreground">{s.email}</Cell>
                <Cell>
                  <span className={s.isActive ? 'text-success-fg' : 'text-foreground-muted'}>
                    {s.isActive ? 'active' : 'unsubscribed'}
                  </span>
                  {!s.isActive && (
                    <span className="tabular block text-xs text-foreground-subtle">
                      {fmt(s.unsubscribedAt)}
                    </span>
                  )}
                </Cell>
                <Cell className="text-foreground-muted">{s.source ?? '\u2014'}</Cell>
                <Cell className="tabular text-xs text-foreground-muted">
                  {fmt(s.createdAt)}
                </Cell>
                <Cell label="Actions">
                  <div className="flex flex-wrap items-center gap-3">
                    <SubscriberToggle id={s.id} active={s.isActive} />
                    <SubscriberDelete id={s.id} email={s.email} />
                  </div>
                </Cell>
              </Row>
            ))}
          </DataTable>

          {rows.length === PAGE_SIZE && (
            <p className="mt-3 text-xs text-foreground-subtle">
              Showing the {PAGE_SIZE} most recent. Search to narrow the list.
            </p>
          )}
        </div>
      )}
    </>
  )
}

export default function AdminNewsletterPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <AdminPage
      title="Newsletter"
      description="Consent-captured subscribers. Unsubscribing is reversible and keeps the record; erasing is permanent and is only for a deletion request."
    >
      <Subscribers searchParams={searchParams} />
    </AdminPage>
  )
}
