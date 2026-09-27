import { AppInstallIcon, BellIcon, CartIcon, MailIcon, PackageIcon } from '@/components/ui/icon'
import { ACTIVITY_LABEL, milestones, type ActivityKind } from '@/lib/visitors/activity'
import { cn } from '@/lib/utils'

const ICON: Record<ActivityKind, (props: { className?: string }) => React.ReactNode> = {
  APP_INSTALLED: AppInstallIcon,
  SUBSCRIBED: MailIcon,
  CART_ADD: CartIcon,
  NOTIFICATIONS_ENABLED: BellIcon,
  ORDER_PLACED: PackageIcon,
}

export function ActivityIcon({ kind, className }: { kind: ActivityKind; className?: string }) {
  const Icon = ICON[kind]
  return <Icon className={className} />
}

/**
 * The five milestones as a row of icons, lit for the ones this visitor has reached.
 * Always all five, always in the same order, so a column of them scans like a
 * table: a glance down it shows who installed, who subscribed, who ordered.
 */
export function ActivityStrip({ kinds, size = 'sm' }: { kinds: Iterable<string>; size?: 'sm' | 'lg' }) {
  const items = milestones(kinds)
  const reached = items.filter((item) => item.done).map((item) => ACTIVITY_LABEL[item.kind].toLowerCase())
  return (
    <ul
      className={cn('flex items-center', size === 'lg' ? 'flex-wrap gap-2' : 'gap-1')}
      aria-label={reached.length ? `Has ${reached.join(', ')}` : 'No actions yet'}
    >
      {items.map(({ kind, done }) => (
        <li
          key={kind}
          title={`${ACTIVITY_LABEL[kind]}${done ? '' : ' — not yet'}`}
          className={cn(
            'inline-flex items-center justify-center rounded-full transition-colors',
            size === 'lg' ? 'gap-2 px-3 py-1.5 text-xs font-medium' : 'size-7',
            done
              ? 'bg-accent-muted text-accent-fg ring-1 ring-accent/40'
              : 'bg-surface-sunken text-foreground-subtle/50',
          )}
        >
          <ActivityIcon kind={kind} className={size === 'lg' ? 'size-4' : 'size-3.5'} />
          {size === 'lg' ? <span>{ACTIVITY_LABEL[kind]}</span> : null}
        </li>
      ))}
    </ul>
  )
}
