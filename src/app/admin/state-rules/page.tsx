import { Suspense } from 'react'
import type { Prisma } from '@prisma/client'
import { db } from '@/lib/db/client'
import { jurisdictionName } from '@/lib/compliance/jurisdictions'
import type { UsJurisdictionCode } from '@/lib/compliance/types'
import { StateRuleEditor } from '@/components/admin/state-rule-editor'

async function Rules({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const params = await searchParams
  const filter = typeof params.show === 'string' ? params.show : 'restricted'

  const where: Prisma.StateRuleWhereInput =
    filter === 'all'
      ? {}
      : filter === 'watch'
        ? { watch: true }
        : { status: { in: ['BLOCKED', 'RESTRICTED'] } }

  const rows = await db.stateRule.findMany({
    where,
    orderBy: [{ stateCode: 'asc' }, { productLine: 'asc' }],
  })

  return (
    <>
      <div className="mb-5 flex flex-wrap gap-2">
        {[
          ['restricted', 'Restricted & blocked'],
          ['watch', 'On watch'],
          ['all', 'All 153'],
        ].map(([value, label]) => (
          <a
            key={value}
            href={`?show=${value}`}
            aria-current={filter === value ? 'page' : undefined}
            className={`inline-flex min-h-11 items-center rounded-md border px-3 text-sm ${
              filter === value
                ? 'border-primary bg-primary-muted text-primary'
                : 'border-border-strong bg-surface text-foreground hover:bg-surface-sunken'
            }`}
          >
            {label}
          </a>
        ))}
      </div>

      <p className="mb-4 text-sm text-foreground-muted" aria-live="polite">
        {rows.length} rule{rows.length === 1 ? '' : 's'}
      </p>

      <div className="space-y-3">
        {rows.map((r) => (
          <StateRuleEditor
            key={r.id}
            rule={{
              stateCode: r.stateCode,
              stateName: jurisdictionName(r.stateCode as UsJurisdictionCode),
              productLine: r.productLine,
              status: r.status,
              statuteCitation: r.statuteCitation ?? '',
              statuteUrl: r.statuteUrl ?? '',
              notes: r.notes ?? '',
              minAge: r.minAge,
              requiresAdultSignature: r.requiresAdultSignature,
              requiresProductDirectory: r.requiresProductDirectory,
              watch: r.watch,
              lastReviewedAt: r.lastReviewedAt.toISOString().slice(0, 10),
            }}
          />
        ))}
      </div>
    </>
  )
}

export default function AdminStateRulesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  return (
    <main className="mx-auto max-w-4xl px-4 py-8 md:px-8">
      <h1 className="font-display text-3xl text-foreground">State rules</h1>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-foreground-muted">
        Legality is data, not code. A change here takes effect on the next request —
        the cart stops accepting the item and the public legality page updates, because
        both read this same row. Every edit is written to an immutable audit log with
        the reason you give.
      </p>
      <div className="mt-6">
        <Suspense
          fallback={<div className="min-h-[70vh] animate-pulse rounded-lg bg-surface-sunken" aria-hidden />}
        >
          <Rules searchParams={searchParams} />
        </Suspense>
      </div>
    </main>
  )
}
