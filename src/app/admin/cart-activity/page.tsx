import Link from 'next/link'
import { connection } from 'next/server'
import { db } from '@/lib/db/client'
import { AdminPage, Cell, DataTable, EmptyState, Row, StatCard } from '@/components/admin/shell'
import { NumberTable, RangeTabs } from '@/components/admin/figures'
import { Badge } from '@/components/ui/badge'
import { jurisdictionName } from '@/lib/compliance/jurisdictions'
import type { UsJurisdictionCode } from '@/lib/compliance/types'
import { cartEventsSince } from '@/lib/cart/queries'
import { cartFunnel, cartSessions, productMoves, type CartStatus } from '@/lib/cart/sessions'
import { platformLabel } from '@/lib/links/platforms'
import { ago } from '@/lib/visitors/directory'
import { visitorEmails } from '@/lib/visitors/queries'
import { formatCents } from '@/lib/utils'

export const metadata = { title: 'Carts' }

type SearchParams = Promise<Record<string, string | string[] | undefined>>

const PERIODS = { '1': '24 hours', '7': '7 days', '30': '30 days' } as const
type PeriodKey = keyof typeof PERIODS
const number = (n: number) => n.toLocaleString('en-US')
const percent = (part: number, whole: number) => (whole > 0 ? `${Math.round((part / whole) * 100)}%` : '—')

const STATUS: Record<CartStatus, { label: string; tone: 'success' | 'info' | 'warning' | 'danger' | 'neutral' }> = {
  ordered: { label: 'ordered', tone: 'success' },
  checkout: { label: 'at checkout', tone: 'warning' },
  active: { label: 'shopping now', tone: 'info' },
  abandoned: { label: 'abandoned', tone: 'danger' },
  emptied: { label: 'emptied', tone: 'neutral' },
}

const EVENT: Record<string, string> = {
  ADDED: 'added',
  UPDATED: 'changed quantity',
  REMOVED: 'removed',
  CHECKOUT_STARTED: 'opened checkout',
  ORDER_PLACED: 'placed order',
  BLOCKED_BY_STATE: 'refused for state',
}

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="font-display text-lg text-foreground">{title}</h2>
      {hint ? <p className="mt-1 max-w-3xl text-xs leading-relaxed text-foreground-muted">{hint}</p> : null}
      <div className="mt-3">{children}</div>
    </section>
  )
}

async function Carts({ searchParams }: { searchParams: SearchParams }) {
  const raw = (await searchParams).range
  const days: PeriodKey = raw === '1' || raw === '30' ? raw : '7'
  await connection()
  const now = new Date()
  const start = new Date(now.getTime() - Number(days) * 24 * 60 * 60 * 1000)

  const rows = await cartEventsSince(start)
  if (rows === null) {
    return (
      <p className="rounded-lg bg-warning-bg p-4 text-sm text-warning-fg">
        Database migration 0019 has not been applied, so carts cannot be recorded yet.
      </p>
    )
  }

  const sessions = cartSessions(rows, now)
  const funnel = cartFunnel(sessions)
  const visitorIds = [...new Set(sessions.map((s) => s.visitorId))]
  const [emails, links] = await Promise.all([
    visitorEmails(visitorIds),
    db.trackingLink.findMany({ select: { slug: true, label: true, source: true } }).catch(() => []),
  ])
  const linkBy = new Map(links.map((l) => [l.slug, l]))
  const moves = productMoves(rows)
  const blocked = [
    ...rows
      .filter((r) => r.type === 'BLOCKED_BY_STATE')
      .reduce((map, r) => {
        const key = r.stateCode ?? '—'
        const entry = map.get(key) ?? { state: key, attempts: 0, valueCents: 0 }
        entry.attempts += 1
        entry.valueCents += r.valueCents
        return map.set(key, entry)
      }, new Map<string, { state: string; attempts: number; valueCents: number }>())
      .values(),
  ].sort((a, b) => b.attempts - a.attempts)

  return (
    <>
      <RangeTabs current={days} options={(Object.keys(PERIODS) as PeriodKey[]).map((key) => ({ key, label: PERIODS[key] }))} />

      <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-5">
        <StatCard label="Carts started" value={number(funnel.carts)} hint={`in the last ${PERIODS[days]}`} />
        <StatCard label="Reached checkout" value={number(funnel.checkouts)} hint={`${percent(funnel.checkouts, funnel.carts)} of carts`} />
        <StatCard label="Ordered" value={number(funnel.orders)} hint={`${percent(funnel.orders, funnel.carts)} of carts`} tone={funnel.orders ? 'success' : undefined} />
        <StatCard
          label="Abandoned"
          value={number(funnel.abandoned)}
          hint={`${formatCents(funnel.abandonedValueCents)} left in them`}
          tone={funnel.abandoned ? 'danger' : undefined}
        />
        <StatCard label="Open now" value={number(funnel.open)} hint={`${formatCents(funnel.openValueCents)} in carts`} />
      </div>

      <Section
        title="Every cart"
        hint="Rebuilt from each change as it happened, newest first. A cart untouched for an hour with items still in it and no order counts as abandoned. The visitor opens their whole visit; the email shows when they gave one."
      >
        {sessions.length === 0 ? (
          <EmptyState title="No carts in this period" hint="A cart appears here the moment someone adds something." />
        ) : (
          <DataTable headers={['Visitor', 'In the cart', 'Value', 'Status', 'Came from', 'Last change']}>
            {sessions.slice(0, 200).map((s) => {
              const link = s.linkSlug ? linkBy.get(s.linkSlug) : undefined
              const status = STATUS[s.status]
              return (
                <Row key={`${s.visitorId}-${s.startedAt.toISOString()}`}>
                  <Cell>
                    <Link href={`/admin/visitors/${s.visitorId}`} prefetch={false} className="font-medium text-foreground underline underline-offset-4">
                      {emails.get(s.visitorId) ?? `Visitor …${s.visitorId.slice(-6)}`}
                    </Link>
                  </Cell>
                  <Cell className="text-sm text-foreground">
                    {s.lines.length === 0 ? (
                      <span className="text-foreground-muted">—</span>
                    ) : (
                      <ul className="space-y-0.5">
                        {s.lines.map((line) => (
                          <li key={`${line.slug}-${line.variant}`}>
                            <span className="tabular">{line.quantity} ×</span> {line.name}
                            {line.variant && line.variant !== 'Default' ? <span className="text-foreground-muted"> · {line.variant}</span> : null}
                          </li>
                        ))}
                      </ul>
                    )}
                  </Cell>
                  <Cell className="tabular font-medium text-foreground">{s.valueCents ? formatCents(s.valueCents) : '—'}</Cell>
                  <Cell>
                    <Badge tone={status.tone}>{status.label}</Badge>
                  </Cell>
                  <Cell className="text-sm text-foreground-muted">
                    {link ? (
                      <>
                        {platformLabel(link.source)}
                        <span className="block text-xs">{link.label}</span>
                      </>
                    ) : s.linkSlug ? (
                      s.linkSlug
                    ) : (
                      '—'
                    )}
                  </Cell>
                  <Cell className="tabular text-xs text-foreground-muted">{ago(s.lastAt, now)} ago</Cell>
                </Row>
              )
            })}
          </DataTable>
        )}
      </Section>

      <div className="grid gap-x-6 lg:grid-cols-2">
        <Section title="Products put in carts" hint="How many went in, and how often one was taken back out.">
          {moves.length === 0 ? (
            <p className="text-sm text-foreground-muted">Nothing added in this period.</p>
          ) : (
            <NumberTable
              headers={['Product', 'Added', 'Removed']}
              rows={moves.slice(0, 15).map((m) => ({ key: m.slug, cells: [m.name, number(m.added), number(m.removed)] }))}
            />
          )}
        </Section>
        <Section title="Demand refused by state" hint="Checkouts turned away because a product cannot ship to that state, and what those carts were worth.">
          {blocked.length === 0 ? (
            <p className="text-sm text-foreground-muted">Nothing refused in this period.</p>
          ) : (
            <NumberTable
              headers={['State', 'Attempts', 'Cart value']}
              rows={blocked.map((b) => ({
                key: b.state,
                cells: [b.state === '—' ? 'Unknown' : jurisdictionName(b.state as UsJurisdictionCode), number(b.attempts), formatCents(b.valueCents)],
              }))}
            />
          )}
        </Section>
      </div>

      <Section title="Every change" hint="The last 100 cart events, newest first.">
        {rows.length === 0 ? (
          <p className="text-sm text-foreground-muted">No cart activity in this period.</p>
        ) : (
          <DataTable headers={['When', 'What happened', 'Product', 'Cart after', 'Visitor']}>
            {[...rows]
              .reverse()
              .slice(0, 100)
              .map((r, i) => (
                <Row key={`${r.createdAt.toISOString()}-${i}`}>
                  <Cell className="tabular text-xs text-foreground-muted">{ago(r.createdAt, now)} ago</Cell>
                  <Cell className="text-sm text-foreground">
                    {EVENT[r.type] ?? r.type.toLowerCase()}
                    {r.type === 'BLOCKED_BY_STATE' && r.reason ? <span className="block text-xs text-foreground-muted">{r.reason}</span> : null}
                  </Cell>
                  <Cell className="text-sm text-foreground">
                    {r.productName ?? (r.type === 'ORDER_PLACED' && r.reason ? `Order ${r.reason}` : '—')}
                    {r.quantity > 0 && r.productName ? <span className="text-foreground-muted"> · {r.quantity}</span> : null}
                  </Cell>
                  <Cell className="tabular text-sm text-foreground">
                    {r.type === 'ORDER_PLACED' ? formatCents(r.valueCents) : r.cartItems ? `${r.cartItems} items · ${formatCents(r.cartValueCents)}` : '—'}
                  </Cell>
                  <Cell className="text-xs">
                    {r.visitorId ? (
                      <Link href={`/admin/visitors/${r.visitorId}`} prefetch={false} className="text-foreground-muted underline underline-offset-4">
                        {emails.get(r.visitorId) ?? `…${r.visitorId.slice(-6)}`}
                      </Link>
                    ) : (
                      '—'
                    )}
                  </Cell>
                </Row>
              ))}
          </DataTable>
        )}
      </Section>
    </>
  )
}

export default function AdminCartsPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <AdminPage
      title="Carts"
      description="Every cart on the site, as it changes: what went in, what came out, who reached checkout, who ordered, and which carts were abandoned with what still in them, each credited to the tracking link the visitor followed."
    >
      <Carts searchParams={searchParams} />
    </AdminPage>
  )
}
