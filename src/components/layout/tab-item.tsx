import { cn } from '@/lib/utils'

/**
 * Shared presentation for a bottom-tab item.
 *
 * Its own module with no server imports on purpose. These live alongside the tab bar
 * originally, and because the bar reads `next/headers`, the client-side cart tab
 * importing them pulled `next/headers` into the client graph and failed the build
 * outright. A shared leaf that imports nothing environment-specific cannot do that.
 */
export function tabClass(active: boolean): string {
  return cn(
    'relative flex min-h-14 flex-col items-center justify-center gap-1 px-1 pt-2 pb-1.5',
    'text-[11px] leading-none transition-colors',
    active ? 'text-foreground' : 'text-foreground-subtle',
  )
}

/**
 * The active marker is a bar at the top edge, not a colour change alone — colour on
 * its own is not a state anyone relying on contrast can read.
 */
export function TabMarker() {
  return <span aria-hidden className="absolute inset-x-4 top-0 h-0.5 rounded-full bg-primary" />
}
