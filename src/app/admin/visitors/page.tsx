import Link from 'next/link'
import { connection } from 'next/server'
import { AdminPage, EmptyState, StatCard } from '@/components/admin/shell'
import { BarChart, NumberTable, RangeTabs } from '@/components/admin/figures'
import { ActivityIcon } from '@/components/admin/activity-icons'
import { VisitorDirectory } from '@/components/admin/visitor-directory'
import { parseRange, periodFor, RANGES, type RangeKey } from '@/lib/analytics/orders'
import { ACTIVITY_KINDS, ACTIVITY_LABEL, HUMAN_KIND, TEAM_KIND } from '@/lib/visitors/activity'
import { asCounts, sumCounts, topCounts, type Counts } from '@/lib/visitors/aggregate'
import { buildDirectory, clusterDirectory } from '@/lib/visitors/directory'
import { summariseLiveVisitors, type LiveVisitor } from '@/lib/visitors/live'
import { regionName } from '@/lib/visitors/present'
import {
  activityCounts,
  activitySince,
  bufferedEvents,
  bufferedToday,
  dailyStats,
  humanEvidence,
  pushVisitorIds,
  recentVisitors,
  visitorCounts,
  visitorEmails,
  whenMigrated,
  type ActivityRow,
} from '@/lib/visitors/queries'

export const metadata = { title: 'Visitors' }

type SearchParams = Promise<Record<string, string | string[] | undefined>>

const number = (n: number) => n.toLocaleString('en-US')

function Notice({ tone, title, children }: { tone: 'warning' | 'info'; title: string; children: React.ReactNode }) {
  return (
    <section
      className={`rounded-lg p-4 text-sm leading-relaxed ${
        tone === 'warning' ? 'bg-warning-bg text-warning-fg' : 'bg-info-bg text-info-fg'
      }`}
    >
      <h2 className="font-semibold">{title}</h2>
      <div className="mt-1 space-y-2 opacity-90">{children}</div>
    </section>
  )
}

function MigrationPending() {
  return (
    <Notice tone="warning" title="Database migrations 0012 and 0014 have not been applied">
      <p>
        Visits can be recorded, but nothing can be filed or shown until the database has the
        tables for it. Back the database up, then run <code>npm run db:migrate:http</code>. It
        only adds columns and tables, and is safe to run twice.
      </p>
    </Notice>
  )
}

function CountsTable({
  header,
  unit,
  counts,
  name = (key) => key,
  empty,
}: {
  header: string
  /** What each count is: views, visitors or requests. They are not interchangeable. */
  unit: string
  counts: Counts
  name?: (key: string) => string
  empty: string
}) {
  const rows = Object.entries(topCounts(counts, 10))
  if (rows.length === 0) return <p className="text-sm text-foreground-muted">{empty}</p>
  return (
    <NumberTable
      headers={[header, unit]}
      rows={rows.map(([key, n]) => ({ key, cells: [name(key), number(n)] }))}
    />
  )
}

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="font-display text-lg text-foreground">{title}</h2>
      {hint ? <p className="mt-1 max-w-2xl text-xs leading-relaxed text-foreground-muted">{hint}</p> : null}
      <div className="mt-3">{children}</div>
    </section>
  )
}

/** Today's milestones, one card per kind, so "did anyone order today?" is one glance. */
function TodayActivity({ rows }: { rows: readonly ActivityRow[] }) {
  const count = (kind: string) => rows.filter((row) => row.kind === kind).length
  return (
    <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
      {ACTIVITY_KINDS.map((kind) => {
        const n = count(kind)
        return (
          <li
            key={kind}
            className={`flex items-center gap-3 rounded-lg border p-3 ${n > 0 ? 'border-accent/40 bg-accent-muted' : 'border-border bg-surface'}`}
          >
            <span
              className={`grid size-9 shrink-0 place-items-center rounded-full ${n > 0 ? 'bg-accent text-on-accent' : 'bg-surface-sunken text-foreground-subtle'}`}
            >
              <ActivityIcon kind={kind} className="size-4" />
            </span>
            <span className="min-w-0">
              <span className="tabular block text-lg leading-none font-semibold text-foreground">{number(n)}</span>
              <span className="mt-1 block text-xs text-foreground-muted">{ACTIVITY_LABEL[kind]}</span>
            </span>
          </li>
        )
      })}
    </ul>
  )
}

async function Visitors({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams
  const range = parseRange(params.range)
  // Read the clock at request time, never while prerendering.
  await connection()
  const now = new Date()
  const period = periodFor(range, now)

  const todayStart = new Date(`${now.toISOString().slice(0, 10)}T00:00:00Z`)
  const [buffered, events, todayActivity, data] = await Promise.all([
    bufferedToday(now),
    bufferedEvents(now),
    activitySince(todayStart),
    whenMigrated(() =>
      Promise.all([
        dailyStats(period.start, period.end),
        visitorCounts(period.start),
        // Real visitors only: bots are neither listed nor counted (lib/visitors/human.ts).
        recentVisitors({ bots: false, limit: 150 }),
      ]),
    ),
  ])

  /*
    Live visitors: everyone in today's buffer, plus anyone who did something today
    whose page views are still on their way to it (they are batched in memory).
  */
  const evidence = await humanEvidence([...events.map((e) => e.v), ...todayActivity.map((row) => row.visitorId)])
  const liveFromViews = summariseLiveVisitors(events, evidence)
  const seen = new Set(liveFromViews.map((v) => v.visitorId))
  const liveFromActivity: LiveVisitor[] = []
  for (const row of todayActivity) {
    // An admin sign-in alone is not a visit to the shop, and a proof of a person
    // arrives before the page views it came with: those rows wait for the views.
    if (row.kind === TEAM_KIND || row.kind === HUMAN_KIND || seen.has(row.visitorId)) continue
    seen.add(row.visitorId)
    liveFromActivity.push({
      visitorId: row.visitorId,
      views: 0,
      sessions: 0,
      firstAt: row.createdAt,
      lastAt: row.createdAt,
      lastPath: row.path,
      country: null,
      region: null,
      city: null,
      postalCode: null,
      latitude: null,
      longitude: null,
      timezone: null,
      device: null,
      browser: null,
      os: null,
      referrer: null,
      utmSource: null,
      likelyBot: false,
      isNew: false,
    })
  }
  const everyoneToday = [...liveFromViews, ...liveFromActivity]
  const bots = new Set(everyoneToday.filter((v) => v.likelyBot).map((v) => v.visitorId))
  const live = everyoneToday.filter((v) => !v.likelyBot).sort((a, b) => b.lastAt.getTime() - a.lastAt.getTime())
  const realViewsToday = live.reduce((sum, v) => sum + v.views, 0)
  const realActivityToday = todayActivity.filter((row) => !bots.has(row.visitorId))

  const filed = data.migrated ? data.value[2] : []
  const ids = [...new Set([...filed.map((v) => v.visitorId), ...live.map((v) => v.visitorId)])]
  const [signals, emails, pushed] = await Promise.all([activityCounts(ids), visitorEmails(ids), pushVisitorIds(ids)])
  const clusters = clusterDirectory(
    buildDirectory({ filed, live, activity: signals, emails, pushVisitors: pushed, now }).filter((row) => !row.likelyBot),
  ).slice(0, 100)

  const liveSection = (
    <>
      <Section title="Today, live" hint="What visitors did today, the moment they did it. Resets at midnight UTC.">
        <TodayActivity rows={realActivityToday} />
      </Section>
      <Section
        title="Visitors"
        hint="Real people only, newest first: today's visits the moment they arrive, merged with every earlier visit on record. A visitor is listed once they have used the page (a tap, a key, a scroll wheel or a mouse move); crawlers, link previews, scanners and other bots never are. The place is from Vercel's location lookup: city, state or region, ZIP or postal code and country. The email is the one they gave on an order, in a chat or signing up. Records with the same email, or the same place and device, fold under “likely same”. “Team” marks a browser that has signed in to the admin."
      >
        {clusters.length === 0 ? (
          <EmptyState title="No visitors yet" hint="A visitor appears here within a minute or so of first using a page." />
        ) : (
          <VisitorDirectory clusters={clusters} />
        )}
      </Section>
    </>
  )

  const status = (
    <Notice tone="info" title="Recording">
      <p>
        {buffered === null
          ? 'Waiting on the database migration below before anything can be counted.'
          : `${number(realViewsToday)} page view${realViewsToday === 1 ? '' : 's'} by ${number(live.length)} real visitor${live.length === 1 ? '' : 's'} today so far.`}{' '}
        Bots are not counted anywhere on this page. Views are held in this site&rsquo;s own
        database and filed once a day, so today is not in the figures below yet. No third-party
        service is involved, and nothing to configure.
      </p>
    </Notice>
  )

  if (!data.migrated) {
    return (
      <div className="space-y-4">
        {status}
        <MigrationPending />
        {liveSection}
      </div>
    )
  }

  const [days, counts] = data.value
  const inBucket = (start: Date, end: Date) => days.filter((d) => d.day >= start && d.day < end)
  const isDaily = RANGES[range].bucket === 'day'
  const points = period.buckets.map((bucket) => {
    const within = inBucket(bucket.start, bucket.end)
    const views = within.reduce((sum, d) => sum + d.humanViews, 0)
    const people = within.reduce((sum, d) => sum + d.humanVisitors, 0)
    return {
      key: bucket.start.toISOString(),
      label: bucket.label,
      title: bucket.title,
      value: views,
      // Daily visitors add up to visitor-days over a week, not people: only per day.
      ...(isDaily ? { detail: `${number(people)} visitor${people === 1 ? '' : 's'}` } : {}),
      cells: isDaily ? [number(views), number(people)] : [number(views)],
    }
  })
  const humanViews = days.reduce((sum, d) => sum + d.humanViews, 0)
  const crawlerViews = days.reduce((sum, d) => sum + d.crawlerViews, 0)
  const total = (field: 'paths' | 'referrers' | 'regions' | 'countries' | 'devices' | 'crawlers') =>
    sumCounts(days.map((d) => asCounts(d[field])))
  const bucketHeader = { day: 'Day', week: 'Week', month: 'Month' }[RANGES[range].bucket]

  return (
    <>
      <div className="space-y-4">{status}</div>

      {liveSection}

      <div className="mt-6">
        <RangeTabs
          current={range}
          options={(Object.keys(RANGES) as RangeKey[]).map((key) => ({ key, label: RANGES[key].label }))}
          query={{}}
        />
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-3">
        <StatCard label="Real visitors" value={number(counts.active)} hint="people who visited at least once" />
        <StatCard label="New" value={number(counts.fresh)} hint="first visit in this period" />
        <StatCard label="Page views" value={number(humanViews)} hint="by real visitors only" />
      </div>

      <Section
        title="Page views"
        hint="Real visitors only: bots and crawlers are left out. Days are UTC."
      >
        {humanViews === 0 ? (
          <p className="rounded-lg border border-border bg-surface p-6 text-sm text-foreground-muted">
            No page views filed for the last {RANGES[range].label}.
          </p>
        ) : (
          <BarChart
            caption={`${number(humanViews)} page views over the last ${RANGES[range].label}`}
            points={points}
            format={number}
            floor={2}
            tableHeaders={isDaily ? [bucketHeader, 'Page views', 'Visitors'] : [bucketHeader, 'Page views']}
          />
        )}
      </Section>

      <div className="grid gap-x-6 lg:grid-cols-2">
        <Section title="Top pages">
          <CountsTable header="Page" unit="Views" counts={total('paths')} name={(path) => (path === '/' ? 'Home' : path)} empty="Nothing filed yet." />
        </Section>
        <Section
          title="Where they came from"
          hint="The site that sent each visitor, counted once a day. Direct visits are not listed; campaign tags show on each visitor below."
        >
          <CountsTable header="Site" unit="Visitors" counts={total('referrers')} empty="Every visit was direct." />
        </Section>
        <Section
          title="Where they are"
          hint="From Vercel's location lookup, each real visitor counted once a day, the state or region written out in full. No IP address is kept."
        >
          <CountsTable
            header="State or region"
            unit="Visitors"
            counts={total('regions')}
            name={regionName}
            empty="No locations filed yet."
          />
        </Section>
        <Section
          title="Crawlers"
          hint={`Not visitors, and not counted above: search engines and AI assistants reading the site, ${number(crawlerViews)} requests in this period. Worth knowing, because being read by AI assistants is how this shop gets cited.`}
        >
          <CountsTable header="Crawler" unit="Requests" counts={total('crawlers')} empty="No crawlers filed yet." />
        </Section>
      </div>

    </>
  )
}

export default function AdminVisitorsPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <AdminPage
      title="Visitors"
      description="First-party and anonymous: a random id in a cookie, the pages viewed, where the visit came from, and a coarse place and device. No IP address, no fingerprinting, no third-party trackers. Nothing here refreshes on its own."
      actions={
        <Link
          href="/admin/visitors/blocked"
          className="inline-flex min-h-11 items-center rounded-md border border-border-strong bg-surface px-3 text-sm font-medium text-foreground hover:bg-surface-sunken"
        >
          Blocked addresses
        </Link>
      }
    >
      <Visitors searchParams={searchParams} />
    </AdminPage>
  )
}
