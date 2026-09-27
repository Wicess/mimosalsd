import { connection } from 'next/server'
import { db } from '@/lib/db/client'
import { AdminPage, Cell, DataTable, EmptyState, Row, StatCard } from '@/components/admin/shell'
import { NumberTable, RangeTabs } from '@/components/admin/figures'
import { Badge } from '@/components/ui/badge'
import { CrudPanel, Field, InlineAction, Select } from '@/components/admin/forms'
import { CopyLink } from '@/components/admin/copy-link'
import { createTrackingLink, toggleTrackingLink } from '@/app/actions/admin-crud'
import { LINK_PLATFORMS, platformLabel } from '@/lib/links/platforms'
import { trafficReport } from '@/lib/links/traffic'
import { onSiteTarget } from '@/lib/links/redirect'
import { absoluteUrl } from '@/lib/seo/routes'
import { formatCents } from '@/lib/utils'

export const metadata = { title: 'Tracking links' }

type SearchParams = Promise<Record<string, string | string[] | undefined>>

const PERIODS = { '7': '7 days', '30': '30 days', '90': '90 days' } as const
type PeriodKey = keyof typeof PERIODS
const number = (n: number) => n.toLocaleString('en-US')

async function Links({ searchParams }: { searchParams: SearchParams }) {
  // RangeTabs writes ?range=.
  const raw = (await searchParams).range
  const days: PeriodKey = raw === '7' || raw === '90' ? raw : '30'
  await connection()
  const end = new Date()
  const start = new Date(end.getTime() - Number(days) * 24 * 60 * 60 * 1000)

  const [links, report] = await Promise.all([
    db.trackingLink.findMany({
      orderBy: { createdAt: 'desc' },
      take: 200,
      select: { id: true, slug: true, label: true, targetUrl: true, source: true, clicks: true, isActive: true, promoter: { select: { name: true } } },
    }),
    trafficReport(start, end),
  ])

  const form = (
    <CrudPanel summary="+ Make a link for a post" action={createTrackingLink}>
      <Select
        label="Where you will post it"
        name="platform"
        options={LINK_PLATFORMS.map((p) => [p.key, p.label] as const)}
        hint="Every visit from this link is counted under this platform."
      />
      <Field label="What it is for" name="label" required placeholder="Bio link" hint="For your own list: Bio link, Story 14 Sep, Pinned post." />
      <Field label="Page it opens" name="targetUrl" placeholder="/" hint="A page on this site, like /shop or /shop/mushrooms. Leave blank for the home page." />
      <Field label="Link address (optional)" name="slug" placeholder="instagram-bio" hint="Leave blank and one is made from the platform and what it is for." />
    </CrudPanel>
  )

  const totals = report.sources.reduce(
    (sum, s) => ({ visitors: sum.visitors + s.visitors, orders: sum.orders + s.orders, revenue: sum.revenue + s.revenueCents }),
    { visitors: 0, orders: 0, revenue: 0 },
  )
  const linked = [...report.links.values()].reduce((sum, l) => sum + l.visitors, 0)
  const site = absoluteUrl('/')

  return (
    <>
      {form}

      <RangeTabs current={days} options={(Object.keys(PERIODS) as PeriodKey[]).map((key) => ({ key, label: PERIODS[key] }))} />

      <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Visitors" value={number(totals.visitors)} hint={`real visitors, last ${PERIODS[days]}`} />
        <StatCard label="From your links" value={number(linked)} hint={totals.visitors ? `${Math.round((linked / totals.visitors) * 100)}% of visitors` : 'no visitors yet'} />
        <StatCard label="Orders" value={number(totals.orders)} hint="placed in the period" />
        <StatCard label="Paid revenue" value={formatCents(totals.revenue)} hint="from those orders" />
      </div>

      <section className="mt-8">
        <h2 className="font-display text-lg text-foreground">Traffic by source</h2>
        <p className="mt-1 max-w-3xl text-xs leading-relaxed text-foreground-muted">
          Where real visitors came from: a tracking link&rsquo;s platform, or the site that sent them (a tap on your
          profile in Instagram counts as Instagram too), or direct. Then what they did. Bots are left out.
        </p>
        <div className="mt-3">
          {report.sources.length === 0 ? (
            <p className="rounded-lg border border-border bg-surface p-6 text-sm text-foreground-muted">No visitors in this period.</p>
          ) : (
            <NumberTable
              headers={['Source', 'Visitors', 'Page views', 'Cart adds', 'Checkouts', 'Orders', 'Paid revenue']}
              rows={report.sources.map((s) => ({
                key: s.key,
                cells: [
                  <span key="l" className="font-medium">{s.label}</span>,
                  number(s.visitors),
                  number(s.views),
                  number(s.cartAdds),
                  number(s.checkouts),
                  s.paidOrders ? `${number(s.orders)} (${number(s.paidOrders)} paid)` : number(s.orders),
                  formatCents(s.revenueCents),
                ],
              }))}
            />
          )}
        </div>
      </section>

      <section className="mt-8">
        <h2 className="font-display text-lg text-foreground">Your links</h2>
        <p className="mt-1 max-w-3xl text-xs leading-relaxed text-foreground-muted">
          Copy a link into a post, a bio or a message. Clicks count every tap since the link was made; the other figures
          are for the last {PERIODS[days]}.
        </p>
        <div className="mt-3">
          {links.length === 0 ? (
            <EmptyState title="No links yet" hint="Make one above for each place you post: your Instagram bio, a TikTok video, a Reddit thread." />
          ) : (
            <DataTable headers={['Link', 'Clicks', 'Visitors', 'Cart adds', 'Orders', 'Paid revenue', '']}>
              {links.map((link) => {
                const stats = report.links.get(link.slug)
                const offSite = onSiteTarget(link.targetUrl, site) === null
                return (
                  <Row key={link.id}>
                    <Cell>
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="font-medium text-foreground">{link.label}</span>
                        <Badge tone="info">{platformLabel(link.source)}</Badge>
                        {link.isActive ? null : <Badge tone="neutral">off</Badge>}
                      </span>
                      <CopyLink value={absoluteUrl(`/r/${link.slug}`)} className="mt-1.5" />
                      <span className="mt-1 block text-xs text-foreground-muted">
                        Opens {link.targetUrl}
                        {link.promoter ? ` · promoter ${link.promoter.name}` : ''}
                      </span>
                      {offSite ? (
                        <span className="mt-1 block text-xs text-warning-fg">
                          Points off this site, so it lands on the home page. Make a new link and turn this one off.
                        </span>
                      ) : null}
                    </Cell>
                    <Cell className="tabular text-foreground">{number(link.clicks)}</Cell>
                    <Cell className="tabular text-foreground">{number(stats?.visitors ?? 0)}</Cell>
                    <Cell className="tabular text-foreground">{number(stats?.cartAdds ?? 0)}</Cell>
                    <Cell className="tabular text-foreground">
                      {number(stats?.orders ?? 0)}
                      {stats?.paidOrders ? <span className="block text-xs text-foreground-muted">{stats.paidOrders} paid</span> : null}
                    </Cell>
                    <Cell className="tabular text-foreground">{formatCents(stats?.revenueCents ?? 0)}</Cell>
                    <Cell>
                      <InlineAction action={toggleTrackingLink} label={link.isActive ? 'Turn off' : 'Turn on'} fields={{ id: link.id }} />
                    </Cell>
                  </Row>
                )
              })}
            </DataTable>
          )}
        </div>
      </section>
    </>
  )
}

export default function AdminLinksPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <AdminPage
      title="Tracking links"
      description="A link for every place you post. Each one counts its clicks, and every visitor it brings is followed through to cart, checkout and order, so you can see which platform and which post actually sells."
    >
      <Links searchParams={searchParams} />
    </AdminPage>
  )
}
