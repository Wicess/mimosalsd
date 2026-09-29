'use client'

import Link from 'next/link'
import { useState } from 'react'
import { ActivityIcon } from '@/components/admin/activity-icons'
import { ChevronRightIcon, UserIcon } from '@/components/ui/icon'
import type { DirectoryCluster, DirectoryRow, VisitorSignals } from '@/lib/visitors/directory'
import { cn } from '@/lib/utils'

/**
 * The visitor list: one row per person, with who they are, where, on what, how
 * they came, how much they looked, what they did, and when.
 *
 * Records that are likely one person (the same email, or the same place and device)
 * fold under one row behind a "likely same" pill; the rest open with a tap. A table
 * from `md` up, cards below it, where nine columns cannot fit.
 */

const HEADERS = ['Visitor', 'Email', 'Location', 'Device', 'Source', 'Sess.', 'Views', 'Signals', 'Last'] as const

export function VisitorDirectory({ clusters }: { clusters: readonly DirectoryCluster[] }) {
  return (
    <>
      <SignalLegend />
      <div className="mt-3 hidden overflow-x-auto rounded-lg border border-border bg-surface md:block">
        <table className="w-full min-w-[60rem] text-left">
          <thead className="bg-surface-data">
            <tr>
              {HEADERS.map((header) => (
                <th
                  key={header}
                  scope="col"
                  className={cn(
                    'px-3 py-3 text-[11px] font-semibold tracking-wide whitespace-nowrap text-foreground-muted uppercase first:pl-4 last:pr-4',
                    (header === 'Sess.' || header === 'Views' || header === 'Last') && 'text-right',
                  )}
                >
                  {header === 'Sess.' ? <abbr title="Visits" className="no-underline">Sess.</abbr> : header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {clusters.map((cluster) => (
              <ClusterRows key={cluster.key} cluster={cluster} />
            ))}
          </tbody>
        </table>
      </div>
      <ul className="mt-3 space-y-2 md:hidden">
        {clusters.map((cluster) => (
          <ClusterCards key={cluster.key} cluster={cluster} />
        ))}
      </ul>
    </>
  )
}

function SignalLegend() {
  const items: { kind: Parameters<typeof ActivityIcon>[0]['kind']; label: string }[] = [
    { kind: 'SUBSCRIBED', label: 'Subscribed' },
    { kind: 'APP_INSTALLED', label: 'Installed the app' },
    { kind: 'NOTIFICATIONS_ENABLED', label: 'Notifications on' },
    { kind: 'CART_ADD', label: 'Cart adds' },
    { kind: 'ORDER_PLACED', label: 'Orders' },
  ]
  return (
    <ul className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-foreground-muted" aria-label="What the signals mean">
      {items.map((item) => (
        <li key={item.kind} className="inline-flex items-center gap-1.5">
          <Pill kind={item.kind} />
          {item.label}
        </li>
      ))}
    </ul>
  )
}

function LikelySame({ count, open, onToggle, controls }: { count: number; open: boolean; onToggle: () => void; controls: string }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      aria-controls={controls}
      title="The same email, or the same place and device, across separate records. Often one person whose browser did not keep its cookie (an in-app browser or a private window), but not always. Tap to show the others."
      className="inline-flex shrink-0 items-center gap-1 rounded-full! bg-warning-bg px-2 py-0.5 text-[10px] font-bold tracking-wide whitespace-nowrap text-warning-fg uppercase ring-1 ring-warning-fg/30 transition-colors hover:ring-warning-fg/60"
    >
      <UserIcon className="size-3" aria-hidden />×{count} likely same
      <ChevronRightIcon className={cn('size-3 transition-transform motion-reduce:transition-none', open && 'rotate-90')} aria-hidden />
    </button>
  )
}

function ClusterRows({ cluster }: { cluster: DirectoryCluster }) {
  const [open, setOpen] = useState(false)
  const [lead, ...others] = cluster.members
  const panelId = `visitors-${cluster.key}`
  return (
    <>
      <tr className="border-t border-border-data transition-colors hover:bg-surface-sunken/60">
        <RowCells
          row={lead!}
          badge={
            others.length > 0 ? (
              <LikelySame count={cluster.members.length} open={open} onToggle={() => setOpen((o) => !o)} controls={panelId} />
            ) : null
          }
        />
      </tr>
      {open
        ? others.map((row, i) => (
            <tr
              key={row.visitorId}
              id={i === 0 ? panelId : undefined}
              className="border-t border-dashed border-border-data bg-surface-sunken/40 transition-colors hover:bg-surface-sunken/70"
            >
              <RowCells row={row} nested />
            </tr>
          ))
        : null}
    </>
  )
}

function RowCells({ row, badge, nested = false }: { row: DirectoryRow; badge?: React.ReactNode; nested?: boolean }) {
  return (
    <>
      <td className="py-2.5 pr-3 pl-4">
        <div className="flex items-center gap-2">
          {nested ? (
            <span className="pl-2 text-foreground-subtle" aria-hidden>
              ↳
            </span>
          ) : null}
          <VisitorId row={row} />
          {badge}
        </div>
      </td>
      <td className="max-w-[16rem] px-3 py-2.5 text-xs">
        {row.email ? (
          <span className="block truncate font-medium text-foreground" title={row.email}>
            {row.email}
          </span>
        ) : (
          <span className="text-foreground-subtle">—</span>
        )}
      </td>
      <td className="px-3 py-2.5 text-xs">
        <Location row={row} />
      </td>
      <td className="px-3 py-2.5 text-[11px] whitespace-nowrap text-foreground-muted">{row.device}</td>
      <td className="max-w-[12rem] truncate px-3 py-2.5 text-[11px] text-foreground-muted" title={row.source}>
        {row.source}
      </td>
      <td className="tabular px-3 py-2.5 text-right font-mono text-xs text-foreground">{row.sessions.toLocaleString('en-US')}</td>
      <td className="tabular px-3 py-2.5 text-right font-mono text-xs text-foreground">{row.views.toLocaleString('en-US')}</td>
      <td className="px-3 py-2.5">
        <Signals signals={row.signals} />
      </td>
      <td className="py-2.5 pr-4 pl-3 text-right text-[11px] whitespace-nowrap text-foreground-muted" title={row.lastStamp}>
        {row.lastAgo}
      </td>
    </>
  )
}

function VisitorId({ row }: { row: DirectoryRow }) {
  return (
    <Link
      href={row.href}
      prefetch={false}
      className="inline-flex min-h-11 items-center gap-2 font-mono text-xs font-semibold whitespace-nowrap text-foreground hover:text-primary"
      aria-label={`Open visitor ending ${row.shortId}`}
    >
      <span className="grid size-6 shrink-0 place-items-center rounded-full! bg-primary-muted text-[10px] text-primary" aria-hidden>
        {row.initials}
      </span>
      …{row.shortId}
    </Link>
  )
}

function Location({ row }: { row: DirectoryRow }) {
  return (
    <>
      <span className="flex flex-wrap items-center gap-1.5">
        <span className="font-medium text-foreground">{row.country}</span>
        {row.team ? (
          <span
            title="This browser has signed in to the admin: the team, not a customer."
            className="inline-flex items-center rounded-full! bg-surface-sunken px-1.5 py-0.5 text-[9px] font-bold tracking-wide text-foreground-muted uppercase ring-1 ring-border-strong"
          >
            Team
          </span>
        ) : null}
        {row.likelyBot ? (
          <span className="inline-flex items-center rounded-full! bg-warning-bg px-1.5 py-0.5 text-[9px] font-bold tracking-wide text-warning-fg uppercase">
            Automated?
          </span>
        ) : null}
      </span>
      {row.place ? <span className="mt-0.5 block text-[11px] text-foreground-muted">{row.place}</span> : null}
    </>
  )
}

const TONE: Record<Parameters<typeof ActivityIcon>[0]['kind'], string> = {
  SUBSCRIBED: 'bg-warning-bg text-warning-fg ring-warning-fg/30',
  APP_INSTALLED: 'bg-info-bg text-info-fg ring-info-fg/30',
  NOTIFICATIONS_ENABLED: 'bg-danger-bg text-danger-fg ring-danger-fg/30',
  CART_ADD: 'bg-surface-sunken text-foreground-muted ring-border-strong',
  ORDER_PLACED: 'bg-success-bg text-success-fg ring-success-fg/30',
}

function Pill({
  kind,
  count,
  title,
  fresh = false,
}: {
  kind: Parameters<typeof ActivityIcon>[0]['kind']
  count?: number
  title?: string
  /** Done in the last 24 hours: the pill glows and a ring spreads from it, so a new signal is seen at a glance. */
  fresh?: boolean
}) {
  return (
    <span
      title={fresh && title ? `${title}, in the last 24 hours` : title}
      className={cn(
        'relative inline-flex h-6 min-w-6 items-center justify-center gap-1 rounded-full! px-1.5 ring-1',
        TONE[kind],
        fresh && 'shadow-[0_0_10px_1px_currentColor] ring-2',
      )}
    >
      {fresh ? (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-full ring-2 ring-current opacity-0 motion-safe:animate-[install-halo_2.4s_ease-out_infinite]"
        />
      ) : null}
      <ActivityIcon kind={kind} className="size-3.5" />
      {count !== undefined ? <span className="tabular font-mono text-[10px] font-bold">{count}</span> : null}
      {title ? <span className="sr-only">{title}</span> : null}
    </span>
  )
}

function Signals({ signals }: { signals: VisitorSignals }) {
  const any = signals.subscribed || signals.installed || signals.notifications || signals.cartAdds > 0 || signals.orders > 0
  if (!any) return <span className="sr-only">No signals yet</span>
  return (
    <span className="flex flex-wrap items-center gap-1">
      {signals.subscribed ? <Pill kind="SUBSCRIBED" title="Subscribed to emails" fresh={signals.fresh.includes('SUBSCRIBED')} /> : null}
      {signals.installed ? <Pill kind="APP_INSTALLED" title="Installed the app" fresh={signals.fresh.includes('APP_INSTALLED')} /> : null}
      {signals.notifications ? (
        <Pill kind="NOTIFICATIONS_ENABLED" title="Turned on notifications" fresh={signals.fresh.includes('NOTIFICATIONS_ENABLED')} />
      ) : null}
      {signals.cartAdds > 0 ? (
        <Pill
          kind="CART_ADD"
          count={signals.cartAdds}
          title={`Added to cart ${signals.cartAdds} time${signals.cartAdds === 1 ? '' : 's'}`}
          fresh={signals.fresh.includes('CART_ADD')}
        />
      ) : null}
      {signals.orders > 0 ? (
        <Pill
          kind="ORDER_PLACED"
          count={signals.orders}
          title={`Placed ${signals.orders} order${signals.orders === 1 ? '' : 's'}`}
          fresh={signals.fresh.includes('ORDER_PLACED')}
        />
      ) : null}
    </span>
  )
}

function ClusterCards({ cluster }: { cluster: DirectoryCluster }) {
  const [open, setOpen] = useState(false)
  const [lead, ...others] = cluster.members
  const panelId = `visitors-m-${cluster.key}`
  return (
    <li className="space-y-2">
      <VisitorCard row={lead!} />
      {others.length > 0 ? (
        <>
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            aria-controls={panelId}
            className="ml-4 flex min-h-11 w-[calc(100%-1rem)] items-center gap-1.5 rounded-lg bg-warning-bg px-3 text-[11px] font-bold tracking-wide text-warning-fg uppercase ring-1 ring-warning-fg/30"
          >
            <UserIcon className="size-3.5" aria-hidden />
            {open ? 'Hide' : 'Show'} {others.length} likely-same record{others.length === 1 ? '' : 's'}
            <ChevronRightIcon className={cn('ml-auto size-4 transition-transform motion-reduce:transition-none', open && 'rotate-90')} aria-hidden />
          </button>
          {open ? (
            <ul id={panelId} className="space-y-2">
              {others.map((row) => (
                <li key={row.visitorId}>
                  <VisitorCard row={row} nested />
                </li>
              ))}
            </ul>
          ) : null}
        </>
      ) : null}
    </li>
  )
}

function VisitorCard({ row, nested = false }: { row: DirectoryRow; nested?: boolean }) {
  return (
    <div className={cn('rounded-lg border border-border bg-surface p-3', nested && 'ml-4 border-dashed bg-surface-sunken/40')}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <VisitorId row={row} />
          {row.email ? <p className="mt-1 truncate text-sm font-semibold text-foreground">{row.email}</p> : null}
          <div className="mt-1 text-xs">
            <Location row={row} />
          </div>
          <p className="mt-0.5 truncate text-[11px] text-foreground-subtle">
            {row.device} · {row.source}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className="tabular text-sm font-bold text-foreground">{row.views.toLocaleString('en-US')}</p>
          <p className="text-[10px] text-foreground-muted">
            views · {row.sessions} visit{row.sessions === 1 ? '' : 's'}
          </p>
          <p className="mt-1 text-[11px] text-foreground-muted" title={row.lastStamp}>
            {row.lastAgo}
          </p>
        </div>
      </div>
      <div className="mt-2">
        <Signals signals={row.signals} />
      </div>
    </div>
  )
}
