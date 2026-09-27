import { Children, cloneElement, isValidElement, Suspense } from 'react'

/**
 * Consistent page frame for every admin module.
 *
 * The header is sticky from `md` up. On a data screen the title is also the only
 * thing telling you which of twenty-five near-identical tables you are looking at, and
 * scrolling a hundred rows past it leaves an operator with no orientation. It is NOT
 * sticky on phones, where the fixed top bar already costs 56px and a second sticky
 * band would eat a third of the viewport.
 *
 * `max-md`, not `max-sm`: this project sets `sm` to 375px, so `max-sm` only reached
 * screens narrower than an iPhone SE, and on an ordinary 390px phone the header
 * stayed stuck over a fifth of the screen.
 */
export function AdminPage({
  title,
  description,
  actions,
  children,
}: {
  title: string
  description?: string
  actions?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    /*
      The full width of the screen beside the sidebar. It was capped at 72rem, which
      left a wide empty band either side on a large monitor (owner, 2026-09-13):
      tables, cards and grids now use the room, and only long paragraphs keep a
      reading width of their own.
    */
    <main className="w-full px-4 pb-16 md:px-8 2xl:px-12">
      <header className="sticky top-0 z-10 -mx-4 border-b border-border bg-background/95 px-4 py-5 backdrop-blur max-md:static max-md:mx-0 max-md:border-0 max-md:px-0 md:-mx-8 md:px-8 2xl:-mx-12 2xl:px-12">
        {/*
          On a phone the title and its actions each take the full width: sharing one
          row left the description 98px wide on a 360px screen, which broke words out
          of their own box. From `md` they sit side by side as before.
        */}
        <div className="flex flex-wrap items-start gap-4">
          <div className="min-w-0 flex-1 max-md:basis-full">
            <h1 className="font-display text-2xl text-foreground sm:text-3xl">{title}</h1>
            {description && (
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-foreground-muted">
                {description}
              </p>
            )}
          </div>
          {actions && <div className="flex flex-wrap gap-2 max-md:basis-full">{actions}</div>}
        </div>
      </header>
      <div className="mt-6">
        <Suspense fallback={<AdminSkeleton />}>{children}</Suspense>
      </div>
    </main>
  )
}

export function AdminSkeleton() {
  return (
    <div
      className="min-h-[60vh] animate-pulse rounded-lg bg-surface-sunken motion-reduce:animate-none"
      aria-hidden
    />
  )
}

export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="rounded-lg border border-border bg-surface p-8 text-center sm:p-10">
      <p className="font-medium text-foreground">{title}</p>
      {hint && (
        <p className="mx-auto mt-1 max-w-prose text-sm leading-relaxed text-foreground-muted">
          {hint}
        </p>
      )}
    </div>
  )
}

/**
 * Responsive data table.
 *
 * A table at `lg` and up, a stack of labelled cards below it.
 *
 * The previous version was a single sideways-scrolling table at every width. That is
 * a defensible pattern for a read-only report, and it was the wrong one here: an admin
 * row carries buttons, and on a 375px screen the actions sat off the right edge —
 * discoverable only by scrolling a container most people do not realise scrolls.
 * Operators use this on a phone.
 *
 * Below `lg` the `<thead>` is hidden, so each value would lose the only thing saying
 * what it is. Rather than making eighteen screens restate their headers as labels —
 * 92 cells, every one a chance to drift out of sync with the header above it — the
 * headers are injected DOWN to each cell by cloning.
 *
 * Cloning, not React Context: these are Server Components, and `createContext` does
 * not exist in the server environment. It type-checks and then fails at runtime,
 * which is the worst way to find out.
 */
export function DataTable({
  headers,
  children,
}: {
  headers: readonly string[]
  children: React.ReactNode
}) {
  const rows = Children.map(children, (child) =>
    isValidElement<{ headers?: readonly string[] }>(child)
      ? cloneElement(child, { headers })
      : child,
  )

  return (
    <div className="lg:overflow-x-auto lg:rounded-lg lg:border lg:border-border-data">
      <table className="w-full text-left text-sm max-lg:block lg:min-w-[44rem]">
        <thead className="bg-surface-data max-lg:hidden">
          <tr>
            {headers.map((h, i) => (
              <th
                key={h || `col-${i}`}
                scope="col"
                className="px-4 py-2 font-medium text-foreground"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="max-lg:block max-lg:space-y-3">{rows}</tbody>
      </table>
    </div>
  )
}

/**
 * One record.
 *
 * Cells are given their column position here rather than being asked to declare it.
 * `Children.map` numbers them in source order, which is the same order the headers are
 * declared in, so a cell and its label cannot disagree.
 */
export function Row({
  children,
  /** Injected by DataTable. Not passed by pages. */
  headers = [],
}: {
  children: React.ReactNode
  headers?: readonly string[]
}) {
  return (
    <tr className="align-top max-lg:block max-lg:rounded-lg max-lg:border max-lg:border-border max-lg:bg-surface max-lg:px-3 max-lg:py-2.5 lg:border-t lg:border-border-data">
      {Children.map(children, (child, index) =>
        isValidElement<{ label?: string; first?: boolean }>(child)
          ? cloneElement(child, {
              label: child.props.label ?? headers[index],
              first: child.props.first ?? index === 0,
            })
          : child,
      )}
    </tr>
  )
}

export function Cell({
  children,
  className = '',
  /** The column heading, injected by Row. A page may also set it explicitly. */
  label,
  /** True for the first cell in the row. Injected by Row. */
  first = false,
}: {
  children: React.ReactNode
  className?: string
  label?: string
  first?: boolean
}) {
  /*
    THE CARD IS A LIST OF LINES, NOT A STACK OF BLOCKS.

    Each value used to sit under its own label in 11px uppercase, which cost two lines
    and about 44px per field: a five-column table became a 300px card, and six of them
    filled a phone screen with three records. Label left, value right, one line each,
    takes a quarter to a third off these pages — and a column of labels down the left
    edge is far easier to scan than labels interleaved with values.

    The first cell is the record's identity — order number, customer, product — so it
    leads the card at body size with no label, and its link fills a 44px row: the
    thing an operator taps to open the record is the easiest thing to hit.

    A cell with no header — the actions column — spans the card and keeps its buttons
    full width, which is where a thumb expects them.

    Elsewhere a link gets vertical padding rather than a height: on an inline element
    padding grows the hit area without changing the line box, so a 17px row of text
    becomes a ~29px target and nothing moves. WCAG 2.2 AA asks for 24.
  */
  const phone = first
    ? 'max-lg:block max-lg:pb-1.5 max-lg:text-base max-lg:font-medium max-lg:text-foreground max-lg:[&_a]:flex max-lg:[&_a]:min-h-11 max-lg:[&_a]:w-fit max-lg:[&_a]:items-center max-lg:[&_a]:py-0'
    : label
      ? 'max-lg:grid max-lg:grid-cols-[minmax(5rem,36%)_minmax(0,1fr)] max-lg:items-baseline max-lg:gap-x-3'
      : 'max-lg:block max-lg:pt-2'

  return (
    <td className={`px-4 py-3 max-lg:px-0 max-lg:py-1 max-lg:[&_a]:py-1.5 ${phone} ${className}`}>
      {label && !first ? (
        /*
          aria-hidden: the real <th scope="col"> is still in the DOM and is what a
          screen reader associates with this cell. Announcing both would read every
          value twice.
        */
        <span aria-hidden className="text-xs text-foreground-subtle lg:hidden">
          {label}
        </span>
      ) : null}
      {/*
        One grid item, whatever the page passed.

        A cell often holds two things — "0 paid" and "of 1 placed" beneath it. Each was
        becoming its own item in the two-column card grid, so the second dropped into
        the LABEL column on the next line and read as a caption for the wrong field.
        `lg:contents` takes the wrapper back out of the layout at table widths.
      */}
      {/* A long unbroken value (a request path, an email) wraps instead of widening the card past the screen. */}
      <span className="min-w-0 [overflow-wrap:anywhere] lg:contents">{children}</span>
    </td>
  )
}

export function StatCard({
  label,
  value,
  hint,
  tone,
}: {
  label: string
  value: string | number
  hint?: string
  tone?: 'warning' | 'danger' | 'success'
}) {
  const toneClass =
    tone === 'danger'
      ? 'border-transparent bg-danger-bg text-danger-fg'
      : tone === 'warning'
        ? 'border-transparent bg-warning-bg text-warning-fg'
        : tone === 'success'
          ? 'border-transparent bg-success-bg text-success-fg'
          : 'border-border bg-surface'
  /*
    `break-words` is not decoration here. Several pages put four of these across, and
    at 390px that left each card 47px of inner width — narrower than the word
    "Subscribers", which then ran out of its own box. Those pages now hold two across
    on a phone; this makes the card safe at any width rather than trusting them to.
  */
  return (
    <div className={`rounded-lg border p-3 sm:p-4 ${toneClass}`}>
      <p className="text-xs tracking-wide break-words uppercase opacity-75">{label}</p>
      {/* Tabular figures so a changing number does not reflow the card beside it. */}
      <p className="tabular mt-1 text-xl font-semibold break-words sm:text-2xl">{value}</p>
      {hint && <p className="mt-1 text-xs break-words opacity-80">{hint}</p>}
    </div>
  )
}
