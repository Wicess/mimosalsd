import { cn } from '@/lib/utils'

type Tone = 'neutral' | 'success' | 'warning' | 'danger' | 'info' | 'accent'

const TONES: Record<Tone, string> = {
  neutral: 'bg-surface-sunken text-foreground-muted',
  success: 'bg-success-bg text-success-fg',
  warning: 'bg-warning-bg text-warning-fg',
  danger: 'bg-danger-bg text-danger-fg',
  info: 'bg-info-bg text-info-fg',
  accent: 'bg-accent-muted text-accent-fg',
}

/**
 * Badge. `icon` is not decoration — status must never be conveyed by colour alone
 * (WCAG 1.4.1), so any tone carrying meaning should pass one.
 */
export function Badge({
  tone = 'neutral',
  icon,
  className,
  children,
}: {
  tone?: Tone
  icon?: React.ReactNode
  className?: string
  children: React.ReactNode
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium',
        TONES[tone],
        className,
      )}
    >
      {icon}
      {children}
    </span>
  )
}
