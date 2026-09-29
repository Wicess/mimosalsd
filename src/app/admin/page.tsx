import { Suspense } from 'react'
import { db } from '@/lib/db/client'

import { formatCents } from '@/lib/utils'
import { netRevenueAllTime } from '@/lib/analytics/queries'
import { FlaskIcon } from '@/components/ui/icon'

function Stat({
  label,
  value,
  hint,
  tone,
}: {
  label: string
  value: string | number
  hint?: string
  tone?: 'warning' | 'danger'
}) {
  return (
    <div
      className={`rounded-lg border p-3 md:p-4 ${
        tone === 'danger'
          ? 'border-transparent bg-danger-bg text-danger-fg'
          : tone === 'warning'
            ? 'border-transparent bg-warning-bg text-warning-fg'
            : 'border-border bg-surface'
      }`}
    >
      <p className="text-[10.5px] tracking-wide uppercase opacity-75 md:text-xs">{label}</p>
      <p className="tabular mt-1 text-xl font-semibold md:text-2xl">{value}</p>
      {hint && <p className="mt-1 text-[11px] leading-snug opacity-80 md:text-xs">{hint}</p>}
    </div>
  )
}

async function Overview() {
  const [
    pendingOrders,
    claimedOrders,
    paidOrders,
    products,
    unreadThreads,
    batches,
    pendingReviews,
  ] = await Promise.all([
    db.order.count({ where: { status: 'PENDING_VERIFICATION' } }),
    db.order.count({ where: { status: 'PAYMENT_CLAIMED' } }),
    db.order.count({ where: { status: 'PAID' } }),
    db.product.count({ where: { isActive: true } }),
    db.supportThread.count({ where: { unreadForAdmin: { gt: 0 } } }),
    db.labBatch.count({ where: { isPublished: true } }),
    db.review.count({ where: { moderationStatus: 'PENDING' } }),
  ])

  // Confirmed payments less refunds — the rule the customer and analytics pages use.
  const netRevenue = await netRevenueAllTime()

  return (
    <>
      {/* What needs a human right now, ordered by urgency. */}
      <section>
        <h2 className="font-display text-xl text-foreground">Needs attention</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Stat
            label="Payments claimed"
            value={claimedOrders}
            hint="Customer says they paid — verify receipt"
            {...(claimedOrders > 0 ? { tone: 'warning' as const } : {})}
          />
          <Stat
            label="Awaiting verification"
            value={pendingOrders}
            hint="New order requests"
            {...(pendingOrders > 0 ? { tone: 'warning' as const } : {})}
          />
          <Stat
            label="Reviews to moderate"
            value={pendingReviews}
            hint="A health claim in a review is an FDA problem"
          />
          <Stat
            label="Unread conversations"
            value={unreadThreads}
            hint="Customers waiting for a reply in Messages"
            {...(unreadThreads > 0 ? { tone: 'warning' as const } : {})}
          />
        </div>
      </section>

      <section className="mt-8">
        <h2 className="font-display text-xl text-foreground">State of the shop</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Stat
            label="Net revenue"
            value={formatCents(netRevenue)}
            hint="All time: confirmed payments, less refunds"
          />
          {/* Orders sitting in PAID: the money is in and nothing has been packed yet. */}
          <Stat label="Ready to pack" value={paidOrders} hint="Paid, not yet packed" />
          <Stat label="Active products" value={products} />
          <Stat label="Published batches" value={batches} />
        </div>
      </section>

      <section className="mt-8">
        <div className="flex items-center gap-2">
          <FlaskIcon className="size-5 text-foreground-muted" />
          <h2 className="font-display text-xl text-foreground">Quick links</h2>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {[
            ['/admin/orders', 'Order queue'],
            ['/admin/messages', 'Messages'],
            ['/admin/visitors', 'Visitors'],
            ['/lab-results', 'Lab results (public)'],
            ['/where-we-ship', 'Where we ship (public)'],
          ].map(([href, label]) => (
            <a
              key={href}
              href={href}
              className="inline-flex min-h-11 items-center rounded-md border border-border-strong bg-surface px-3 text-sm text-foreground hover:bg-surface-sunken"
            >
              {label}
            </a>
          ))}
        </div>
      </section>
    </>
  )
}

export default function AdminOverviewPage() {
  return (
    <main className="w-full px-4 py-8 md:px-8 2xl:px-12">
      <h1 className="font-display text-3xl text-foreground">Overview</h1>
      <div className="mt-6">
        <Suspense
          fallback={<div className="min-h-[70vh] animate-pulse rounded-lg bg-surface-sunken" aria-hidden />}
        >
          <Overview />
        </Suspense>
      </div>
    </main>
  )
}
