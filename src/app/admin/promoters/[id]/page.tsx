import Link from 'next/link'
import { notFound } from 'next/navigation'
import { AdminPage, StatCard } from '@/components/admin/shell'
import { CrudPanel, Field, InlineAction, TextArea } from '@/components/admin/forms'
import { NumberTable } from '@/components/admin/figures'
import { Badge } from '@/components/ui/badge'
import { MigrationNotice } from '@/components/admin/migration-notice'
import { whenMigrated } from '@/lib/db/migrated'
import { assignLink, togglePromoter, updatePromoter } from '@/app/actions/admin-promoters'
import { canAccessAdminPath } from '@/lib/admin/areas'
import { getAdminSession } from '@/lib/admin/auth'
import { netCents } from '@/lib/customers/summary'
import { ATTRIBUTION_WINDOW_DAYS } from '@/lib/promoters/attribution'
import {
  creditedOrders,
  linkOrderCounts,
  promoterById,
  promoterTotals,
  unownedLinks,
} from '@/lib/promoters/queries'
import { orderStatusLabel } from '@/lib/orders/status-tone'
import { formatCents } from '@/lib/utils'
import { Select as SiteSelect } from '@/components/ui/select'

export const metadata = { title: 'Promoter' }

function Panel({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-border bg-surface p-4 sm:p-5">
      <h2 className="font-display text-lg text-foreground">{title}</h2>
      {hint ? <p className="mt-1 text-xs leading-relaxed text-foreground-muted">{hint}</p> : null}
      <div className="mt-4">{children}</div>
    </section>
  )
}

async function Promoter({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const data = await whenMigrated(async () => {
    const promoter = await promoterById(id)
    if (!promoter) return null
    const [totals, orders, spare, perLink] = await Promise.all([
      promoterTotals(),
      creditedOrders(id),
      unownedLinks(),
      linkOrderCounts(),
    ])
    return { promoter, totals, orders, spare, perLink }
  })
  if (!data.migrated) {
    return (
      <MigrationNotice
        migration="0013_promoters"
        what="Promoters and the credit for the orders their links bring in need tables the database has not got yet."
      />
    )
  }
  if (!data.value) notFound()
  const { promoter, totals, orders, spare, perLink } = data.value
  const session = await getAdminSession()
  const mine = totals.get(id)
  const canOrders = canAccessAdminPath(session?.role, session?.adminAreas ?? [], '/admin/orders')

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-baseline gap-3">
        <p className="font-display text-xl text-foreground">{promoter.name}</p>
        <span className="text-sm text-foreground-muted">{promoter.slug}</span>
        {promoter.archived ? <Badge tone="neutral">archived</Badge> : null}
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Links" value={mine?.links ?? 0} />
        <StatCard label="Clicks" value={mine?.clicks ?? 0} hint="people, not link previews" />
        <StatCard
          label="Orders"
          value={mine?.paidOrders ?? 0}
          hint={mine && mine.orders > mine.paidOrders ? `of ${mine.orders} placed` : 'payment confirmed'}
        />
        <StatCard label="Net revenue" value={formatCents(mine?.netCents ?? 0)} hint="less refunds" />
      </div>

      <Panel
        title="Their links"
        hint={`A click on one of these credits this promoter with any order placed in the next ${ATTRIBUTION_WINDOW_DAYS} days.`}
      >
        {promoter.links.length === 0 ? (
          <p className="text-sm text-foreground-muted">
            None yet. Create one under{' '}
            <Link href="/admin/links" className="underline underline-offset-4">
              Tracking links
            </Link>
            , then assign it below.
          </p>
        ) : (
          <NumberTable
            headers={['Link', 'Clicks', 'Paid orders', '']}
            rows={promoter.links.map((link) => ({
              key: link.id,
              cells: [
                <span key="l">
                  <span className="tabular text-foreground">/r/{link.slug}</span>
                  <span className="block text-xs text-foreground-muted">
                    {link.label}
                    {link.isActive ? '' : ' · off'}
                  </span>
                </span>,
                link.clicks,
                perLink.get(link.slug)?.paidOrders ?? 0,
                <InlineAction
                  key="a"
                  action={assignLink}
                  label="Unassign"
                  fields={{ linkId: link.id, promoterId: '' }}
                />,
              ],
            }))}
          />
        )}

        {spare.length > 0 ? (
          <form action={assignLink} className="mt-4 flex flex-wrap items-end gap-2">
            <input type="hidden" name="promoterId" value={promoter.id} />
            <label className="block text-sm">
              <span className="font-medium text-foreground">Assign an existing link</span>
              <SiteSelect
                name="linkId"
                defaultValue={spare[0]?.id ?? ''}
                placeholder="Choose a link"
                options={spare.map((link) => ({ value: link.id, label: `/r/${link.slug} — ${link.label}` }))}
                className="mt-1 min-w-64"
              />
            </label>
            <button
              type="submit"
              className="min-h-11 rounded-md border border-border-strong bg-surface px-4 text-sm font-medium text-foreground hover:bg-surface-sunken"
            >
              Assign
            </button>
          </form>
        ) : null}
      </Panel>

      <Panel
        title="Orders credited"
        hint="Stamped on the order when it was placed, so it stays put if a link is later renamed or reassigned."
      >
        {orders.length === 0 ? (
          <p className="text-sm text-foreground-muted">No orders have followed their links yet.</p>
        ) : (
          <NumberTable
            headers={['Order', 'Placed', 'Status', 'Net']}
            rows={orders.map((order) => ({
              key: order.id,
              cells: [
                canOrders ? (
                  <Link
                    key="o"
                    href={`/admin/orders/${order.orderNumber}`}
                    prefetch={false}
                    className="tabular text-foreground underline underline-offset-4"
                  >
                    {order.orderNumber}
                  </Link>
                ) : (
                  <span key="o" className="tabular text-foreground">
                    {order.orderNumber}
                  </span>
                ),
                order.createdAt.toISOString().slice(0, 10),
                orderStatusLabel(order.status),
                formatCents(netCents(order)),
              ],
            }))}
          />
        )}
      </Panel>

      <Panel title="Details">
        <CrudPanel summary="Edit this promoter" action={updatePromoter}>
          <input type="hidden" name="id" value={promoter.id} />
          <Field label="Name" name="name" required defaultValue={promoter.name} />
          <Field label="Handle" name="slug" required defaultValue={promoter.slug} />
          <Field label="Email" name="email" type="email" defaultValue={promoter.email ?? ''} />
          <TextArea label="Notes" name="notes" rows={3} defaultValue={promoter.notes ?? ''} />
        </CrudPanel>
        <div className="mt-2">
          <InlineAction
            action={togglePromoter}
            label={promoter.archived ? 'Restore' : 'Archive'}
            fields={{ id: promoter.id }}
            confirm={
              promoter.archived
                ? undefined
                : 'Archive this promoter? Their links keep working and orders already credited stay credited.'
            }
          />
        </div>
      </Panel>
    </div>
  )
}

export default function AdminPromoterPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <AdminPage
      title="Promoter"
      description="Their links, the clicks on them, and the orders that followed."
      actions={
        <Link
          href="/admin/promoters"
          className="inline-flex min-h-11 items-center rounded-md border border-border-strong bg-surface px-3 text-sm font-medium text-foreground hover:bg-surface-sunken"
        >
          All promoters
        </Link>
      }
    >
      <Promoter params={params} />
    </AdminPage>
  )
}
