import { Suspense } from 'react'
import { buildPactReports, filingStatus, previousPeriod } from '@/lib/compliance/pact-report'
import { Badge } from '@/components/ui/badge'
import { AlertIcon } from '@/components/ui/icon'

async function Reports({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const params = await searchParams
  const fallback = previousPeriod()
  const year = Number(params.year) || fallback.year
  const month = Number(params.month) || fallback.month

  const reports = await buildPactReports(year, month)
  const { deadline, overdue } = filingStatus(year, month)
  const period = `${year}-${String(month).padStart(2, '0')}`

  return (
    <>
      <form className="mb-6 flex flex-wrap items-end gap-3">
        <label className="text-sm">
          <span className="block font-medium text-foreground">Year</span>
          <input
            name="year"
            type="number"
            defaultValue={year}
            className="tabular mt-1 min-h-11 w-28 rounded-md border border-border-strong bg-surface px-3 text-base text-foreground"
          />
        </label>
        <label className="text-sm">
          <span className="block font-medium text-foreground">Month</span>
          <input
            name="month"
            type="number"
            min={1}
            max={12}
            defaultValue={month}
            className="tabular mt-1 min-h-11 w-24 rounded-md border border-border-strong bg-surface px-3 text-base text-foreground"
          />
        </label>
        <button
          type="submit"
          className="inline-flex min-h-11 cursor-pointer items-center rounded-md bg-primary px-4 text-sm font-medium text-on-primary"
        >
          Load period
        </button>
      </form>

      <div
        className={`rounded-lg p-4 ${overdue ? 'bg-danger-bg text-danger-fg' : 'bg-info-bg text-info-fg'}`}
      >
        <div className="flex gap-3">
          <AlertIcon className="mt-0.5 size-5 shrink-0" />
          <p className="text-sm leading-relaxed">
            Reports for {period} are due by{' '}
            <strong>
              {deadline.toLocaleDateString('en-US', {
                timeZone: 'UTC',
                year: 'numeric', month: 'long', day: 'numeric',
              })}
            </strong>
            {overdue && ' — that date has passed'}. File one per state with that
            state&rsquo;s tax authority. Penalties reach $5,000 for a first violation
            and $10,000 thereafter.
          </p>
        </div>
      </div>

      {reports.length === 0 ? (
        <p className="mt-6 rounded-lg border border-border bg-surface p-6 text-sm text-foreground-muted">
          No vapor-product deliveries in {period}. Nothing to file for this period.
        </p>
      ) : (
        <ul className="mt-6 space-y-3">
          {reports.map((report) => (
            <li
              key={report.stateCode}
              className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-surface p-4"
            >
              <span className="font-medium text-foreground">{report.stateName}</span>
              <Badge tone="neutral">
                {report.rows.length} deliver{report.rows.length === 1 ? 'y' : 'ies'}
              </Badge>
              <Badge tone="neutral">{report.totalUnits} units</Badge>
              <a
                href={`/api/admin/pact?year=${year}&month=${month}&state=${report.stateCode}`}
                className="ml-auto inline-flex min-h-11 items-center rounded-md border border-border-strong px-3 text-sm text-foreground hover:bg-surface-sunken"
              >
                Download CSV
              </a>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}

export default function AdminReportsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  return (
    <main className="mx-auto max-w-4xl px-4 py-8 md:px-8">
      <h1 className="font-display text-3xl text-foreground">PACT Act reports</h1>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-foreground-muted">
        A separate monthly delivery report for every state we shipped vapor products
        into, filed with that state&rsquo;s tax authority by the 10th of the following
        month. Each CSV contains buyer name, address, brand and quantity.
      </p>
      <div className="mt-6">
        <Suspense
          fallback={<div className="min-h-[70vh] animate-pulse rounded-lg bg-surface-sunken" aria-hidden />}
        >
          <Reports searchParams={searchParams} />
        </Suspense>
      </div>
    </main>
  )
}
