import Link from 'next/link'
import { AdminPage, Cell, DataTable, EmptyState, Row } from '@/components/admin/shell'
import { jurisdictionName } from '@/lib/compliance/jurisdictions'
import type { UsJurisdictionCode } from '@/lib/compliance/types'
import { recentCustomerOrders } from '@/lib/customers/queries'
import { groupByCustomer, summariseCustomer } from '@/lib/customers/summary'
import { formatCents } from '@/lib/utils'

export const metadata = { title: 'Customers' }

const LIMIT = 100

type SearchParams = Promise<Record<string, string | string[] | undefined>>

async function Customers({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams
  const query = typeof params.q === 'string' ? params.q.trim().slice(0, 200) : ''

  // Customers are derived from orders rather than kept as a separate list: a guest
  // checkout is the norm here, so an "accounts" table would show almost nobody.
  const orders = await recentCustomerOrders({ query, limit: LIMIT })

  const customers = [...groupByCustomer(orders).values()]
    .flatMap((group) => {
      // Rows arrive oldest first. The first order is the customer's anchor — it never
      // changes, so a customer's link survives their next order. The latest carries
      // the name and state they use now.
      const first = group[0]
      const latest = group.at(-1)
      if (!first || !latest) return []
      return [{ anchor: first.orderNumber, latest, summary: summariseCustomer(group) }]
    })
    .sort(
      (a, b) => (b.summary.lastOrderAt?.getTime() ?? 0) - (a.summary.lastOrderAt?.getTime() ?? 0),
    )

  return (
    <>
      <form method="get" role="search" className="mb-5 flex flex-wrap items-end gap-2">
        <label className="block min-w-0 flex-1 text-sm sm:max-w-sm">
          <span className="font-medium text-foreground">Find a customer</span>
          <input
            type="search"
            name="q"
            defaultValue={query}
            placeholder="Email or name"
            maxLength={200}
            className="mt-1 block min-h-11 w-full rounded-md border border-border-strong bg-surface px-3 text-sm text-foreground"
          />
        </label>
        <button
          type="submit"
          className="min-h-11 rounded-md border border-border-strong bg-surface px-4 text-sm font-medium text-foreground hover:bg-surface-sunken"
        >
          Search
        </button>
        {query ? (
          <Link
            href="/admin/customers"
            className="inline-flex min-h-11 items-center px-2 text-sm text-foreground-muted underline underline-offset-4 hover:text-foreground"
          >
            Clear
          </Link>
        ) : null}
      </form>

      {customers.length === 0 ? (
        query ? (
          <EmptyState title="No customer matches that" hint="Search matches any part of an email address or name." />
        ) : (
          <EmptyState title="No customers yet" hint="They appear here after their first order." />
        )
      ) : (
        <>
          <p className="mb-4 text-sm text-foreground-muted" aria-live="polite">
            {customers.length} customer{customers.length === 1 ? '' : 's'}
            {query ? ` matching “${query}”` : ', most recent first'}
            {customers.length === LIMIT ? ` — the ${LIMIT} most recent. Search to reach older ones.` : ''}
          </p>

          <DataTable headers={['Customer', 'State', 'Orders', 'Net spend', 'Last order']}>
            {customers.map(({ anchor, latest, summary }) => (
              <Row key={anchor}>
                <Cell>
                  {/*
                    No prefetch: a hundred links on a dynamic route would be a hundred
                    server requests every time this table is looked at.
                  */}
                  <Link
                    href={`/admin/customers/${anchor}`}
                    prefetch={false}
                    className="font-medium text-foreground underline underline-offset-4"
                  >
                    {latest.firstName} {latest.lastName}
                  </Link>
                  <span className="mt-0.5 block text-xs break-all text-foreground-muted">
                    {latest.email}
                  </span>
                </Cell>
                <Cell className="text-foreground-muted">
                  {jurisdictionName(latest.stateCode as UsJurisdictionCode)}
                </Cell>
                <Cell className="tabular text-foreground">
                  {summary.paid} paid
                  {summary.placed > summary.paid ? (
                    <span className="block text-xs text-foreground-muted">of {summary.placed} placed</span>
                  ) : null}
                </Cell>
                <Cell className="tabular font-medium text-foreground">
                  {formatCents(summary.netCents)}
                  {summary.refundedCents > 0 ? (
                    <span className="block text-xs font-normal text-foreground-muted">
                      {formatCents(summary.refundedCents)} refunded
                    </span>
                  ) : null}
                </Cell>
                <Cell className="tabular text-xs text-foreground-muted">
                  {summary.lastOrderAt?.toISOString().slice(0, 10) ?? '—'}
                </Cell>
              </Row>
            ))}
          </DataTable>
        </>
      )}
    </>
  )
}

export default function AdminCustomersPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <AdminPage
      title="Customers"
      description="Derived from orders — guest checkout is the norm here, so an accounts table would show almost nobody. Spellings of one email address count as one customer. Net spend is confirmed payments minus refunds; an order that was never paid is not money."
    >
      <Customers searchParams={searchParams} />
    </AdminPage>
  )
}
