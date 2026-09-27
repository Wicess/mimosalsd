import Link from 'next/link'
import { labelledBars, niceCeiling } from '@/lib/charts/axis'

/**
 * ─────────────────────────────────────────────────────────────────────────────
 *  FIGURES FOR THE ADMIN — a bar chart and a compact table of numbers.
 *
 *  Server-rendered, no chart library, no client JavaScript. Shared by analytics
 *  and visitors so the two read as one system. Checked in Chromium at 390px and
 *  1280px when it was built for analytics: no horizontal overflow, idle or hovered.
 * ─────────────────────────────────────────────────────────────────────────────
 */

export interface BarPoint {
  /** Unique within the chart. */
  readonly key: string
  /** Short axis label: "Sep 3". */
  readonly label: string
  /** Full name for the tooltip and the table: "Thursday, September 3, 2026". */
  readonly title: string
  readonly value: number
  /** An extra tooltip line: "3 paid orders". */
  readonly detail?: string
  /** This point's row in the table view, after its title. */
  readonly cells: readonly React.ReactNode[]
}

/**
 * One series, so no legend: the section heading names it.
 *
 * Hover tooltips are CSS; they enhance and never gate, because every value is also
 * in the table view, which is what a screen reader, a keyboard or a phone (no hover)
 * uses. The drawing is aria-hidden for the same reason — thirty unlabelled
 * rectangles are noise to a screen reader when the table says it properly.
 *
 * The caller shows its own empty state: an all-zero chart says less than a sentence.
 */
export function BarChart({
  caption,
  points,
  format,
  floor = 100,
  tableHeaders,
}: {
  caption: React.ReactNode
  points: readonly BarPoint[]
  /** Formats values for the axis and the tooltips. */
  format: (value: number) => string
  /** The lowest the axis may top out at, in the values' own unit (cents: a dollar). */
  floor?: number
  /** The table view's headers; the first names the title column. */
  tableHeaders: readonly string[]
}) {
  const peak = points.reduce((max, point) => Math.max(max, point.value), 0)
  const top = niceCeiling(peak, floor)
  // A half line only where it lands on a whole value: a count axis topping out at
  // five has no honest tick at 2.5.
  const gridlines = Number.isInteger(top / 2) ? [1, 0.5, 0] : [1, 0]
  const labelled = labelledBars(points.length)
  // Counting back from the newest, every other label hides below md (768px here —
  // this project sets sm to 375px), where six labels collide on a phone-width plot.
  const phoneHidden = new Set([...labelled].sort((a, b) => b - a).filter((_, k) => k % 2 === 1))
  // Which way each tooltip grows: inward from the edges, centred in the middle.
  const anchor = (i: number) =>
    i < points.length / 3
      ? 'left-0'
      : i >= (points.length * 2) / 3
        ? 'right-0'
        : 'left-1/2 -translate-x-1/2'

  return (
    <figure className="rounded-lg border border-border bg-surface p-4 sm:p-5">
      <figcaption className="text-sm text-foreground-muted">{caption}</figcaption>

      {/*
        overflow-x: clip, not hidden: it clips sideways only, so a tooltip can still
        rise above the plot, and nothing in the chart can ever widen the page.
      */}
      <div aria-hidden className="mt-6 overflow-x-clip">
        <div className="relative h-48 pl-14">
          {/* Hairline gridlines: recessive, solid, at round values. */}
          {gridlines.map((fraction) => (
            <div
              key={fraction}
              className={`absolute right-0 left-14 border-t ${
                fraction === 0 ? 'border-border-strong' : 'border-border'
              }`}
              style={{ bottom: `${fraction * 100}%` }}
            >
              <span className="tabular absolute right-full -translate-y-1/2 pr-2 text-[11px] text-foreground-subtle">
                {format(Math.round(top * fraction))}
              </span>
            </div>
          ))}

          <div className="relative flex h-full items-end gap-0.5">
            {points.map((point, i) => {
              const pct = (point.value / top) * 100
              return (
                // The whole column is the hover target, not just the painted bar.
                <div
                  key={point.key}
                  className="group relative flex h-full min-w-0 flex-1 items-end justify-center"
                >
                  <div
                    className="w-full max-w-6 rounded-t bg-primary transition-opacity group-hover:opacity-75 motion-reduce:transition-none"
                    style={{ height: point.value > 0 ? `max(2px, ${pct}%)` : 0 }}
                  />
                  {/*
                    display: none until hovered, not visibility: hidden — an invisible
                    box still takes up layout, and thirty of them reaching past the edge
                    widened the page on a phone.
                  */}
                  <div
                    className={`pointer-events-none absolute z-10 hidden w-max max-w-60 rounded-md border border-border bg-surface px-2.5 py-1.5 text-xs shadow-sm group-hover:block ${anchor(i)}`}
                    style={{ bottom: `calc(${point.value > 0 ? pct : 0}% + 6px)` }}
                  >
                    <strong className="tabular block text-sm text-foreground">
                      {format(point.value)}
                    </strong>
                    <span className="block text-foreground-muted">{point.title}</span>
                    {point.detail ? (
                      <span className="block text-foreground-muted">{point.detail}</span>
                    ) : null}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        <div className="relative mt-2 flex h-4 gap-0.5 pl-14">
          {points.map((point, i) => (
            <div key={point.key} className="relative min-w-0 flex-1">
              {labelled.has(i) ? (
                <span
                  className={`absolute top-0 text-[11px] whitespace-nowrap text-foreground-subtle ${
                    phoneHidden.has(i) ? 'max-md:hidden ' : ''
                  }${
                    i === 0
                      ? 'left-0'
                      : i === points.length - 1
                        ? 'right-0'
                        : 'left-1/2 -translate-x-1/2'
                  }`}
                >
                  {point.label}
                </span>
              ) : null}
            </div>
          ))}
        </div>
      </div>

      <details className="mt-4">
        <summary className="inline-flex min-h-11 cursor-pointer items-center text-sm text-foreground-muted underline underline-offset-4 hover:text-foreground">
          Show as a table
        </summary>
        <div className="mt-3">
          <NumberTable
            headers={tableHeaders}
            rows={points.map((point) => ({ key: point.key, cells: [point.title, ...point.cells] }))}
          />
        </div>
      </details>
    </figure>
  )
}

/**
 * A compact, read-only table of figures.
 *
 * Not the shared DataTable: that one turns rows into cards below lg and holds a
 * 44rem minimum width for rows that carry buttons, and in a half-width column it
 * hid the money column behind a sideways scroll. These rows are three or four
 * short values, which fit a phone as a real table, and figures right-aligned in a
 * column are what make them comparable at a glance.
 */
export function NumberTable({
  headers,
  rows,
}: {
  headers: readonly string[]
  rows: readonly { key: string; cells: readonly React.ReactNode[] }[]
}) {
  return (
    <div className="overflow-x-auto rounded-lg border border-border-data">
      <table className="w-full text-sm">
        <thead className="bg-surface-data">
          <tr>
            {headers.map((header, i) => (
              <th
                key={header}
                scope="col"
                className={`px-3 py-2 font-medium text-foreground ${i === 0 ? 'text-left' : 'text-right'}`}
              >
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.key} className="border-t border-border-data align-top">
              {row.cells.map((cell, i) => (
                <td
                  key={i}
                  className={
                    i === 0
                      ? 'px-3 py-2 text-foreground'
                      : 'tabular px-3 py-2 text-right whitespace-nowrap text-foreground'
                  }
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/** The period picker above a page's figures: plain links, so it needs no JavaScript. */
export function RangeTabs({
  current,
  options,
  query = {},
}: {
  current: string
  options: readonly { key: string; label: string }[]
  /** Other parameters to keep when the period changes. */
  query?: Readonly<Record<string, string>>
}) {
  return (
    <nav aria-label="Period" className="flex flex-wrap gap-2">
      {options.map(({ key, label }) => (
        <Link
          key={key}
          href={`?${new URLSearchParams({ ...query, range: key })}`}
          prefetch={false}
          aria-current={key === current ? 'page' : undefined}
          className={`inline-flex min-h-11 items-center rounded-md border px-3 text-sm ${
            key === current
              ? 'border-primary bg-primary-muted text-primary'
              : 'border-border-strong bg-surface text-foreground hover:bg-surface-sunken'
          }`}
        >
          {label}
        </Link>
      ))}
    </nav>
  )
}
