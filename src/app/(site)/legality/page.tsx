import { ensureLiveStateRules } from '@/lib/compliance/live-state-rules'
import type { Metadata } from 'next'
import { pageMetadata } from '@/lib/seo/meta'
import { getAllStateLegality, LINE_LABEL, LINE_SHORT } from '@/lib/legality/state-pages'
import { PRODUCT_LINES, type ProductLine, type RuleStatus } from '@/lib/compliance/types'
import { AlertIcon, CheckIcon, CrossIcon } from '@/components/ui/icon'
import { FdaDisclaimer } from '@/components/compliance/fda-disclaimer'
import { absoluteUrl, url } from '@/lib/seo/routes'
import { organizationRef } from '@/lib/seo/structured-data'
import { PageHeader } from '@/components/layout/page-header'
import { PageSection } from '@/components/layout/page-section'

export const metadata: Metadata = pageMetadata({
  // 2026-09-19, owner: meta tags written to buy, the way a buyer searches ("where to
  // buy mimosa roots in california"), not to the page's own purpose.
  title: 'Where to Buy Mimosa Hostilis Root Bark in the USA, by State',
  description: 'Where to buy Mimosa hostilis root bark online in the US, state by state. Pick your state for delivery terms, current per-pound pricing and the rules we follow.',
  path: '/legality',
})

/**
 * Three steps, and the ramp is the message: green ships, amber ships with conditions,
 * red does not ship. Never colour alone — every cell carries an icon AND a word, per
 * WCAG 1.4.1 — but the two exception states are also given a filled chip, so that in a
 * column of 51 rows the handful that are NOT "ships" are what the eye lands on first.
 * A page where every one of 153 cells shouts equally is a page nobody reads.
 */
const STATUS_MARK: Record<
  RuleStatus,
  { icon: typeof CheckIcon; label: string; cell: string; bar: string }
> = {
  ALLOWED: {
    icon: CheckIcon,
    label: 'Ships',
    cell: 'text-success-fg',
    bar: 'bg-success-fg',
  },
  RESTRICTED: {
    icon: AlertIcon,
    label: 'Conditions',
    cell: 'rounded-full bg-warning-bg px-2.5 py-1 font-medium text-warning-fg',
    bar: 'bg-warning-fg',
  },
  BLOCKED: {
    icon: CrossIcon,
    label: 'Blocked',
    cell: 'rounded-full bg-danger-bg px-2.5 py-1 font-medium text-danger-fg',
    bar: 'bg-danger-fg',
  },
}

const ORDER: readonly RuleStatus[] = ['ALLOWED', 'RESTRICTED', 'BLOCKED']

interface Coverage {
  readonly line: ProductLine
  readonly counts: Record<RuleStatus, number>
  readonly total: number
  /** Named only when there are few enough to name; otherwise the table carries it. */
  readonly blockedNames: readonly string[]
}

export default async function LegalityHubPage() {
  await ensureLiveStateRules()
  const states = getAllStateLegality()

  /*
    Every number on this page is counted from the same rows the table renders, and the
    same rows the cart reads at checkout. Nothing is written down by hand.

    That is not tidiness. The previous version of this page asserted in prose that
    "Amanita muscaria ships to 49 states — Louisiana is the single exception" while the
    sentence beside it counted the restrictions live. When the underlying rules were
    disturbed, the counter fell to zero and the two sentences contradicted each other in
    the same paragraph — a legality claim the data no longer supported, published. Copy
    that cannot be computed cannot be trusted to stay true, so none of it is.
  */
  const coverage: readonly Coverage[] = PRODUCT_LINES.map((line) => {
    const counts: Record<RuleStatus, number> = { ALLOWED: 0, RESTRICTED: 0, BLOCKED: 0 }
    const blockedNames: string[] = []
    for (const state of states) {
      const verdict = state.verdicts.find((v) => v.productLine === line)
      if (!verdict) continue
      counts[verdict.rule.status] += 1
      if (verdict.rule.status === 'BLOCKED') blockedNames.push(state.name)
    }
    return { line, counts, total: states.length, blockedNames }
  })

  /* Which of the three statuses the current ruleset actually uses. */
  const presentStatuses = ORDER.filter((status) =>
    coverage.some((c) => c.counts[status] > 0),
  )

  const lastReviewed = states
    .map((s) => s.lastReviewedAt)
    .sort()
    .at(-1)

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: 'Legality by state',
    description: metadata.description,
    author: organizationRef(),
    mainEntityOfPage: absoluteUrl(url.legalityHub()),
    ...(lastReviewed ? { dateModified: lastReviewed } : {}),
  }

  return (
    <main>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <PageSection first>
        <PageHeader
          align="center"
          className="mb-10"
          title="Where we ship"
          summary="We ship within the United States only. What we can send depends on the product line and on where you live, and every position below carries the date a person last reviewed it."
        />

        {/*
          Coverage, per product line, before the 51-row table.

          Almost everything ships almost everywhere, which is the reassuring fact and also
          the reason the raw table buries it: 126 of 153 cells say the same word. These
          three meters say it in one glance, and put the exceptions in front of someone
          before they go hunting for their own state.
        */}
        <section aria-labelledby="coverage-heading" className="mx-auto max-w-4xl">
          <h2 id="coverage-heading" className="sr-only">
            Coverage by product line
          </h2>
          <ul className="divide-y divide-border border-y border-border">
            {coverage.map(({ line, counts, total, blockedNames }) => (
              <li key={line} className="py-5">
                <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                  <h3 className="font-display text-lg text-foreground">{LINE_LABEL[line]}</h3>
                  <p className="text-sm text-foreground-muted">
                    {counts.ALLOWED === total ? (
                      <span className="font-medium text-foreground">
                        All {total} jurisdictions
                      </span>
                    ) : (
                      ORDER.filter((status) => counts[status] > 0)
                        .map((status) => `${counts[status]} ${STATUS_MARK[status].label.toLowerCase()}`)
                        .join(' · ')
                    )}
                  </p>
                </div>

                {/*
                  Proportional, and decorative only — the counts above it are the
                  accessible source of the same fact, so this carries no information a
                  screen reader would miss.
                */}
                <div
                  aria-hidden
                  className="mt-3 flex h-1.5 gap-px overflow-hidden rounded-full bg-surface-sunken"
                >
                  {ORDER.filter((status) => counts[status] > 0).map((status) => (
                    <div
                      key={status}
                      className={STATUS_MARK[status].bar}
                      style={{ width: `${(counts[status] / total) * 100}%` }}
                    />
                  ))}
                </div>

                {blockedNames.length > 0 && blockedNames.length <= 4 && (
                  <p className="mt-2.5 text-sm text-foreground-muted">
                    Not available in {listSentence(blockedNames)}.
                  </p>
                )}
              </li>
            ))}
          </ul>
        </section>
      </PageSection>

      <PageSection tone="sunken">
        {/*
          Legend, built from the statuses the data actually contains.

          Naming a value that never appears in the table below teaches the reader a
          distinction the page then never makes — and it invites the question "so which
          ones ARE restricted?" against a table where none are. Filtering it here rather
          than deleting the states from the component keeps the page honest in the other
          direction too: if counsel restricts a jurisdiction tomorrow, its key returns on
          its own, with no code change.
        */}
        <div className="mx-auto mt-14 max-w-4xl">
          <h2 className="font-display text-xl text-foreground">Every jurisdiction</h2>
          <ul className="mt-2.5 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs">
            {presentStatuses.map((status) => {
              const mark = STATUS_MARK[status]
              const Icon = mark.icon
              return (
                <li key={status} className="flex items-center gap-1.5 text-foreground-muted">
                  <span aria-hidden className={`size-2 shrink-0 rounded-full ${mark.bar}`} />
                  <span>
                    <span className="font-medium text-foreground">{mark.label}</span>
                    {' — '}
                    {LEGEND_DETAIL[status]}
                  </span>
                  <Icon className="sr-only" />
                </li>
              )
            })}
          </ul>
        </div>

        {/*
          A bounded, scrollable panel rather than 51 rows down the page.

          The site header is `sticky top-0`, so a table header stuck to the viewport would
          slide underneath it. Giving the panel its own height makes it the scroll
          ancestor, which is what lets `sticky top-0` on the column headers actually hold
          — and the state column is pinned left for the same reason on a phone, where the
          table is wider than the screen and a row of three ticks means nothing once the
          state name has scrolled away.
        */}
        <div className="mx-auto mt-4 max-h-[min(70vh,40rem)] max-w-4xl overflow-auto overscroll-contain rounded-lg border border-border">
          <table className="w-full min-w-[38rem] border-collapse text-left text-sm">
            <caption className="sr-only">
              Legal status of each product line in every US state and the District of
              Columbia. Scroll to see all {states.length} jurisdictions.
            </caption>
            <thead>
              <tr>
                <th
                  scope="col"
                  className="sticky top-0 left-0 z-20 border-b border-border-data bg-surface-sunken px-4 py-3 text-xs font-semibold tracking-[0.08em] text-foreground-muted uppercase"
                >
                  State
                </th>
                {PRODUCT_LINES.map((line) => (
                  <th
                    key={line}
                    scope="col"
                    className="sticky top-0 z-10 border-b border-border-data bg-surface-sunken px-4 py-3 text-xs font-semibold tracking-[0.08em] text-foreground-muted uppercase"
                  >
                    {LINE_SHORT[line]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {states.map((state) => (
                <tr key={state.code} className="group/row border-b border-border last:border-0">
                  <th
                    scope="row"
                    className="sticky left-0 z-10 bg-surface px-4 font-normal transition-colors group-hover/row:bg-surface-sunken"
                  >
                    <a
                      href={url.legalityState(state.slug)}
                      className="inline-flex min-h-11 items-center text-foreground underline decoration-border-data underline-offset-4 transition-colors hover:decoration-foreground focus-visible:decoration-foreground"
                    >
                      {state.name}
                    </a>
                  </th>
                  {state.verdicts.map((v) => {
                    const mark = STATUS_MARK[v.rule.status]
                    const Icon = mark.icon
                    return (
                      <td
                        key={v.productLine}
                        className="px-4 py-2 transition-colors group-hover/row:bg-surface-sunken"
                      >
                        <span className={`inline-flex items-center gap-1.5 ${mark.cell}`}>
                          <Icon className="size-4 shrink-0" />
                          <span>{mark.label}</span>
                        </span>
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </PageSection>

      <PageSection>
        <section className="mx-auto max-w-4xl">
          <h2 className="font-display text-xl text-foreground">How we keep this current</h2>
          <p className="mt-2 max-w-[70ch] text-sm leading-relaxed text-foreground-muted">
            Each state page carries the statute we rely on and the date the position was
            last reviewed. Where legislation is pending we say so rather than waiting for
            it to pass. A page without a reviewed statute is not published — we would
            rather show nothing than a legality claim we cannot stand behind. The cart
            reads this same record at checkout, so nothing on this page can promise you
            something checkout then refuses.
          </p>
          {lastReviewed && (
            <p className="mt-4 text-sm text-foreground-subtle">
              These positions were last reviewed on{' '}
              <time dateTime={lastReviewed} className="text-foreground">
                {formatReviewDate(lastReviewed)}
              </time>
              .
            </p>
          )}
        </section>

        <FdaDisclaimer className="mx-auto mt-10 max-w-4xl" />
      </PageSection>
    </main>
  )
}

const LEGEND_DETAIL: Record<RuleStatus, string> = {
  ALLOWED: 'ships as standard',
  RESTRICTED: 'ships under state conditions',
  BLOCKED: 'we cannot send it there',
}

/** "Louisiana", "Louisiana and Texas", "Louisiana, Texas and Utah". */
function listSentence(names: readonly string[]): string {
  if (names.length <= 1) return names[0] ?? ''
  return `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`
}

function formatReviewDate(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  })
}
