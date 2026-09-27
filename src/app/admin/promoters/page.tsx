import Link from 'next/link'
import { AdminPage, Cell, DataTable, EmptyState, Row } from '@/components/admin/shell'
import { CrudPanel, Field, InlineAction, TextArea } from '@/components/admin/forms'
import { Badge } from '@/components/ui/badge'
import { MigrationNotice } from '@/components/admin/migration-notice'
import { whenMigrated } from '@/lib/db/migrated'
import { createPromoter, togglePromoter } from '@/app/actions/admin-promoters'
import { listPromoters, promoterTotals } from '@/lib/promoters/queries'
import { formatCents } from '@/lib/utils'

export const metadata = { title: 'Promoters' }

type SearchParams = Promise<Record<string, string | string[] | undefined>>

async function Promoters({ searchParams }: { searchParams: SearchParams }) {
  const archived = (await searchParams).show === 'archived'
  const data = await whenMigrated(() => Promise.all([listPromoters(archived), promoterTotals()]))
  if (!data.migrated) {
    return (
      <MigrationNotice
        migration="0013_promoters"
        what="Promoters and the credit for the orders their links bring in need tables the database has not got yet."
      />
    )
  }
  const [promoters, totals] = data.value

  return (
    <>
      <CrudPanel summary="Add a promoter" action={createPromoter}>
        <Field label="Name" name="name" required placeholder="Dana at Herbal Notes" />
        <Field
          label="Handle"
          name="slug"
          required
          placeholder="herbal-notes"
          hint="Lowercase, for your own reference and for naming their links."
        />
        <Field label="Email" name="email" type="email" hint="Optional. Only so you can reach them." />
        <TextArea label="Notes" name="notes" rows={3} hint="Optional: what was agreed, and when." />
      </CrudPanel>

      <div className="mb-4 flex flex-wrap gap-2">
        {[
          ['active', 'Active'],
          ['archived', 'Archived'],
        ].map(([value, label]) => (
          <Link
            key={value}
            href={value === 'archived' ? '?show=archived' : '/admin/promoters'}
            prefetch={false}
            aria-current={(value === 'archived') === archived ? 'page' : undefined}
            className={`inline-flex min-h-11 items-center rounded-md border px-3 text-sm ${
              (value === 'archived') === archived
                ? 'border-primary bg-primary-muted text-primary'
                : 'border-border-strong bg-surface text-foreground hover:bg-surface-sunken'
            }`}
          >
            {label}
          </Link>
        ))}
      </div>

      {promoters.length === 0 ? (
        <EmptyState
          title={archived ? 'Nobody archived' : 'No promoters yet'}
          hint="Add one, then give them a tracking link. Orders placed within thirty days of a click on it are credited to them."
        />
      ) : (
        <DataTable headers={['Promoter', 'Links', 'Clicks', 'Orders', 'Net revenue', '']}>
          {promoters.map((promoter) => {
            const totalsFor = totals.get(promoter.id)
            return (
              <Row key={promoter.id}>
                <Cell>
                  <Link
                    href={`/admin/promoters/${promoter.id}`}
                    prefetch={false}
                    className="font-medium text-foreground underline underline-offset-4"
                  >
                    {promoter.name}
                  </Link>
                  <span className="mt-0.5 block text-xs text-foreground-muted">
                    {promoter.slug}
                    {promoter.email ? ` · ${promoter.email}` : ''}
                  </span>
                  {promoter.archived ? (
                    <span className="mt-1 inline-block">
                      <Badge tone="neutral">archived</Badge>
                    </span>
                  ) : null}
                </Cell>
                <Cell className="tabular text-foreground">{totalsFor?.links ?? 0}</Cell>
                <Cell className="tabular text-foreground">{totalsFor?.clicks ?? 0}</Cell>
                <Cell className="tabular text-foreground">
                  {totalsFor?.paidOrders ?? 0}
                  {totalsFor && totalsFor.orders > totalsFor.paidOrders ? (
                    <span className="block text-xs text-foreground-muted">of {totalsFor.orders} placed</span>
                  ) : null}
                </Cell>
                <Cell className="tabular font-medium text-foreground">
                  {formatCents(totalsFor?.netCents ?? 0)}
                </Cell>
                <Cell>
                  <InlineAction
                    action={togglePromoter}
                    label={promoter.archived ? 'Restore' : 'Archive'}
                    fields={{ id: promoter.id }}
                  />
                </Cell>
              </Row>
            )
          })}
        </DataTable>
      )}
    </>
  )
}

export default function AdminPromotersPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <AdminPage
      title="Promoters"
      description="People who send us customers. Each holds tracking links; an order placed within thirty days of a click on one is credited to them. No money is handled here — this site takes no payments — so these are the figures a payment is agreed from, not a payout."
    >
      <Promoters searchParams={searchParams} />
    </AdminPage>
  )
}
