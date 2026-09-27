import Link from 'next/link'
import { connection } from 'next/server'
import { notFound } from 'next/navigation'
import { AdminPage, StatCard } from '@/components/admin/shell'
import { ActivityIcon, ActivityStrip } from '@/components/admin/activity-icons'
import { Badge } from '@/components/ui/badge'
import { EyeIcon } from '@/components/ui/icon'
import { canAccessAdminPath } from '@/lib/admin/areas'
import { getAdminSession } from '@/lib/admin/auth'
import { ACTIVITY_LABEL, HUMAN_KIND, isActivityKind, TEAM_KIND } from '@/lib/visitors/activity'
import { isVisitorId } from '@/lib/visitors/cookie'
import { PAGE_VIEW_RETENTION_DAYS } from '@/lib/visitors/flush'
import { summariseLiveVisitors } from '@/lib/visitors/live'
import { countryName, deviceOf, localTimeIn, placeOf, regionFullName, sourceOf, stamp } from '@/lib/visitors/present'
import { pageNames } from '@/lib/seo/page-names'
import { cartEventsSince } from '@/lib/cart/queries'
import { cartSessions } from '@/lib/cart/sessions'
import { formatCents } from '@/lib/utils'
import { isLinkablePage } from '@/lib/seo/page-name-fallback'
import {
  activityTimeline,
  bufferedEvents,
  humanEvidence,
  pageHistory,
  visitorById,
  visitorByVisitorId,
  visitorEmails,
  visitorThreads,
  whenMigrated,
} from '@/lib/visitors/queries'

export const metadata = { title: 'Visitor' }

/**
 * One visitor: who they are (coarsely), what they did and when.
 *
 * Reached two ways. From the filed list, by the record's own id; from "Live today",
 * by the visitor id in their cookie — someone first seen this morning has no filed
 * record until tonight, and must still be openable now. Either way the page shows
 * the same thing: their milestones, and one timeline of everything, newest first,
 * merging what the filing has kept, what today's buffer holds, and the milestones
 * recorded the moment they happened.
 */

function Panel({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-border bg-surface p-4 sm:p-5">
      <h2 className="font-display text-lg text-foreground">{title}</h2>
      {hint ? <p className="mt-1 text-xs text-foreground-muted">{hint}</p> : null}
      <div className="mt-4">{children}</div>
    </section>
  )
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-[11px] font-medium tracking-wide text-foreground-subtle uppercase">{label}</dt>
      <dd className="mt-0.5 text-sm break-words text-foreground">{children}</dd>
    </div>
  )
}

/** A page by its name, opening the page itself in a new tab. Private addresses are named but not linked. */
function PageLink({ path, name }: { path: string; name: string }) {
  if (!isLinkablePage(path)) return <span className="font-medium text-foreground">{name}</span>
  return (
    <a
      href={path}
      target="_blank"
      rel="noopener noreferrer"
      className="font-medium text-foreground underline decoration-border-strong underline-offset-4 hover:text-primary hover:decoration-primary"
    >
      {name}
    </a>
  )
}

interface TimelineEntry {
  readonly key: string
  readonly at: Date
  readonly kind: 'VIEW' | string
  readonly title: string
  readonly detail: string | null
  /** The page viewed, for a page view: named and linked. */
  readonly path?: string
}

async function VisitorDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  await connection()
  const now = new Date()

  /*
    Either id reaches the record. The list linked by the row's own id, which on this
    database is a UUID too, so `isVisitorId` sent it to the visitorId column, found
    nothing and returned 404 for every visitor (owner, 2026-09-19). Try the cookie id
    first, then the row id, whatever shape the id has.
  */
  const found = await whenMigrated(async () =>
    (isVisitorId(id) ? await visitorByVisitorId(id) : null) ?? (await visitorById(id)),
  )
  if (!found.migrated) {
    return (
      <p className="rounded-lg bg-warning-bg p-4 text-sm text-warning-fg">
        Database migration 0012 has not been applied, so there are no visitor records to show yet.
      </p>
    )
  }
  const record = found.value
  const visitorId = record?.visitorId ?? (isVisitorId(id) ? id : null)
  if (!visitorId) notFound()

  const [history, today, activity, threads, session] = await Promise.all([
    record ? pageHistory(visitorId) : Promise.resolve([]),
    bufferedEvents(now, visitorId),
    activityTimeline(visitorId),
    visitorThreads(visitorId),
    getAdminSession(),
  ])
  const [evidence, emails, cartRows] = await Promise.all([
    humanEvidence([visitorId]),
    visitorEmails([visitorId]),
    cartEventsSince(new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000), visitorId),
  ])
  // Their carts, rebuilt from every change (lib/cart/sessions.ts), newest first.
  const carts = cartRows ? cartSessions(cartRows, now) : []
  const live = summariseLiveVisitors(today, evidence)[0]
  const email = emails.get(visitorId) ?? null
  const viewed = [...today.map((event) => ({ path: event.p, at: new Date(event.t) })), ...history.map((view) => ({ path: view.path, at: view.at }))]
  const names = await pageNames(viewed.map((view) => view.path))
  const nameOf = (path: string) => names.get(path) ?? path
  // Every page they looked at, most viewed first, with when they last did.
  const pages = [
    ...viewed
      .reduce((map, view) => {
        const row = map.get(view.path) ?? { path: view.path, views: 0, last: view.at }
        row.views += 1
        if (view.at > row.last) row.last = view.at
        return map.set(view.path, row)
      }, new Map<string, { path: string; views: number; last: Date }>())
      .values(),
  ].sort((a, b) => b.views - a.views || b.last.getTime() - a.last.getTime())
  if (!record && !live && activity.length === 0) notFound()

  // Display only; the proxy enforces the messages grant on the inbox itself.
  const canMessages = canAccessAdminPath(session?.role, session?.adminAreas ?? [], '/admin/messages')
  const place = record ?? live
  const campaign = record ? [record.utmSource, record.utmMedium, record.utmCampaign].filter(Boolean).join(' · ') : ''
  const firstSeen = record?.firstSeen ?? live?.firstAt ?? activity[activity.length - 1]?.createdAt ?? now
  const lastSeen = [record?.lastSeen, live?.lastAt, activity[0]?.createdAt]
    .filter((d): d is Date => Boolean(d))
    .sort((a, b) => b.getTime() - a.getTime())[0] ?? now

  const timeline: TimelineEntry[] = [
    ...activity.map((row) => ({
      key: `a-${row.id}`,
      at: row.createdAt,
      kind: row.kind,
      title: isActivityKind(row.kind)
        ? ACTIVITY_LABEL[row.kind]
        : row.kind === TEAM_KIND
          ? 'Signed in to the admin (team)'
          : row.kind === HUMAN_KIND
            ? 'Confirmed a real person (used the page)'
            : row.kind,
      detail: row.detail ?? row.path,
    })),
    ...today.map((event, i) => ({
      key: `t-${event.t}-${i}`,
      at: new Date(event.t),
      kind: 'VIEW',
      title: 'Viewed',
      detail: null,
      path: event.p,
    })),
    ...history.map((view) => ({
      key: `h-${view.id}`,
      at: view.at,
      kind: 'VIEW',
      title: 'Viewed',
      detail: null,
      path: view.path,
    })),
  ]
    .sort((a, b) => b.at.getTime() - a.at.getTime())
    .slice(0, 400)

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <p className="font-display text-xl text-foreground">{place ? placeOf(place) : 'Unknown place'}</p>
        <span className="text-sm text-foreground-muted">{place ? deviceOf(place) : 'Unknown device'}</span>
        <span className="tabular text-xs text-foreground-subtle">#{visitorId.slice(0, 8)}</span>
        {record?.isLikelyBot || live?.likelyBot ? <Badge tone="warning">bot: not counted</Badge> : null}
        {!record ? <Badge tone="info">first seen today</Badge> : null}
        {email ? <span className="text-sm font-medium text-foreground">{email}</span> : null}
      </div>

      <Panel title="Milestones" hint="Lit when this visitor has done it, at any time.">
        <ActivityStrip kinds={activity.map((row) => row.kind)} size="lg" />
      </Panel>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Page views" value={(record?.pageViews ?? 0) + today.length} hint={today.length ? `${today.length} today` : undefined} />
        <StatCard label="Visits" value={record?.sessionCount ?? (live ? 1 : 0)} hint="30 quiet minutes apart" />
        <StatCard label="First seen" value={firstSeen.toISOString().slice(0, 10)} />
        <StatCard label="Last seen" value={stamp(lastSeen)} />
      </div>

      {place ? (
        <Panel
          title="Where they are"
          hint="Located from their internet connection (IP address) by our host — about as exact as a city or ZIP code, never a street. The IP address itself is not stored."
        >
          <dl className="grid gap-4 md:grid-cols-3">
            <Fact label="City">{place.city ?? '—'}</Fact>
            <Fact label="State or region">{regionFullName(place.country, place.region) ?? '—'}</Fact>
            <Fact label="ZIP code">{place.postalCode ?? '—'}</Fact>
            <Fact label="Country">{countryName(place.country) ?? '—'}</Fact>
            <Fact label="Time zone">
              {place.timezone ? (
                <>
                  {place.timezone.replace(/_/g, ' ')}
                  {localTimeIn(place.timezone) ? (
                    <span className="block text-xs text-foreground-muted">Their local time now: {localTimeIn(place.timezone)}</span>
                  ) : null}
                </>
              ) : (
                '—'
              )}
            </Fact>
            <Fact label="Approximate coordinates">
              {place.latitude != null && place.longitude != null ? (
                <>
                  {place.latitude.toFixed(4)}, {place.longitude.toFixed(4)}
                  <a
                    href={`https://www.google.com/maps?q=${place.latitude},${place.longitude}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-0.5 block text-xs text-primary underline underline-offset-4"
                  >
                    Open in Google Maps
                  </a>
                </>
              ) : (
                '—'
              )}
            </Fact>
          </dl>
        </Panel>
      ) : null}

      {record ? (
        <Panel title="How they arrived" hint="From their first visit on record.">
          <dl className="grid gap-4 md:grid-cols-3">
            <Fact label="Landed on">{record.landingPath === '/' ? 'Home' : (record.landingPath ?? '—')}</Fact>
            <Fact label="Came from">{sourceOf(record)}</Fact>
            <Fact label="Campaign">{campaign || '—'}</Fact>
          </dl>
        </Panel>
      ) : null}

      <Panel title="Cart" hint="What this visitor put in their cart, rebuilt from every change, over the last 90 days.">
        {carts.length === 0 ? (
          <p className="text-sm text-foreground-muted">No cart activity.</p>
        ) : (
          <ul className="divide-y divide-border">
            {carts.slice(0, 10).map((cart) => (
              <li key={cart.startedAt.toISOString()} className="py-2.5 first:pt-0">
                <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                  <span className="flex items-center gap-2">
                    <Badge
                      tone={
                        cart.status === 'ordered'
                          ? 'success'
                          : cart.status === 'abandoned'
                            ? 'danger'
                            : cart.status === 'checkout'
                              ? 'warning'
                              : cart.status === 'active'
                                ? 'info'
                                : 'neutral'
                      }
                    >
                      {cart.status === 'checkout' ? 'at checkout' : cart.status === 'active' ? 'shopping now' : cart.status}
                    </Badge>
                    <span className="tabular text-sm font-medium text-foreground">{cart.valueCents ? formatCents(cart.valueCents) : ''}</span>
                  </span>
                  <span className="tabular text-xs text-foreground-subtle">last change {stamp(cart.lastAt)}</span>
                </div>
                {cart.lines.length ? (
                  <ul className="mt-1 space-y-0.5 text-sm text-foreground-muted">
                    {cart.lines.map((line) => (
                      <li key={`${line.slug}-${line.variant}`}>
                        <span className="tabular text-foreground">{line.quantity} ×</span> <PageLink path={`/product/${line.slug}`} name={line.name} />
                        {line.variant && line.variant !== 'Default' ? ` · ${line.variant}` : ''}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel title="Pages visited" hint="Every page this visitor viewed, most viewed first. Open one to see it as they did.">
        {pages.length === 0 ? (
          <p className="text-sm text-foreground-muted">No page views on record.</p>
        ) : (
          <ul className="divide-y divide-border">
            {pages.slice(0, 100).map((page) => (
              <li key={page.path} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 py-2 first:pt-0">
                <span className="min-w-0">
                  <PageLink path={page.path} name={nameOf(page.path)} />
                  <span className="block truncate text-xs text-foreground-subtle">{page.path.startsWith('/order/') ? '/order/…' : page.path}</span>
                </span>
                <span className="tabular shrink-0 text-xs text-foreground-muted">
                  {page.views} view{page.views === 1 ? '' : 's'} · last {stamp(page.last)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel
        title="Timeline"
        hint={`Everything they did, newest first. Page views are kept for ${PAGE_VIEW_RETENTION_DAYS} days; milestones are kept for good.`}
      >
        {timeline.length === 0 ? (
          <p className="text-sm text-foreground-muted">Nothing on record yet.</p>
        ) : (
          <ol className="relative space-y-1 before:absolute before:top-2 before:bottom-2 before:left-[1.05rem] before:w-px before:bg-border">
            {timeline.map((entry) => {
              const milestone = isActivityKind(entry.kind)
              return (
                <li key={entry.key} className="relative flex items-start gap-3 py-1.5">
                  <span
                    className={`relative z-10 grid size-9 shrink-0 place-items-center rounded-full ring-4 ring-surface ${
                      milestone ? 'bg-accent text-on-accent' : 'bg-surface-sunken text-foreground-subtle'
                    }`}
                  >
                    {milestone ? <ActivityIcon kind={entry.kind as never} className="size-4" /> : <EyeIcon className="size-4" />}
                  </span>
                  <span className="min-w-0 flex-1 pt-1">
                    <span className={`block text-sm ${milestone ? 'font-medium text-foreground' : 'text-foreground-muted'}`}>
                      {entry.title}
                      {entry.path ? (
                        <>
                          {' '}
                          <PageLink path={entry.path} name={nameOf(entry.path)} />
                        </>
                      ) : null}
                      {entry.detail ? <span className="font-normal text-foreground-muted"> — {entry.detail}</span> : null}
                    </span>
                    <span className="tabular block text-xs text-foreground-subtle">{stamp(entry.at)}</span>
                  </span>
                </li>
              )
            })}
          </ol>
        )}
      </Panel>

      <Panel title="Conversations" hint="Chat threads from the same browser. Content stays in the inbox.">
        {threads.length === 0 ? (
          <p className="text-sm text-foreground-muted">None.</p>
        ) : (
          <ul className="divide-y divide-border">
            {threads.map((thread) => (
              <li key={thread.id} className="flex flex-wrap items-baseline gap-x-3 py-2 first:pt-0 text-sm">
                <span className="tabular font-medium text-foreground">{thread.publicId ?? 'Chat'}</span>
                <span className="text-foreground-muted">
                  {thread.isOpen ? 'open' : 'closed'} · last message {stamp(thread.lastMessageAt)}
                </span>
              </li>
            ))}
          </ul>
        )}
        {threads.length > 0 && canMessages ? (
          <Link
            href="/admin/messages"
            prefetch={false}
            className="mt-2 inline-flex min-h-11 items-center text-sm text-foreground-muted underline underline-offset-4 hover:text-foreground"
          >
            Open the inbox
          </Link>
        ) : null}
      </Panel>

      <p className="text-xs leading-relaxed text-foreground-muted">
        No IP address is kept for visits. To block someone, use the address in their chat
        thread&rsquo;s profile, or one from your hosting logs, on{' '}
        <Link href="/admin/visitors/blocked" className="underline underline-offset-4">
          Blocked addresses
        </Link>
        .
      </p>
    </div>
  )
}

export default function AdminVisitorPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <AdminPage
      title="Visitor"
      description="An anonymous visitor: a random id in a cookie, what they did, and where they came from."
      actions={
        <Link
          href="/admin/visitors"
          className="inline-flex min-h-11 items-center rounded-md border border-border-strong bg-surface px-3 text-sm font-medium text-foreground hover:bg-surface-sunken"
        >
          All visitors
        </Link>
      }
    >
      <VisitorDetail params={params} />
    </AdminPage>
  )
}
