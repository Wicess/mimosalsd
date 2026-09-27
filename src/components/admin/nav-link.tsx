'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

/**
 * One sidebar link.
 *
 * A CLIENT component, and the only part of the sidebar that is. Two reasons, and the
 * second one is why it had to be split out rather than making the whole sidebar
 * client-side:
 *
 *  1. `next/link` instead of `<a>`. Every admin click used to be a full document load —
 *     re-downloading the shell, the fonts and the sidebar to move between two tables.
 *     Client navigation keeps the layout mounted and only fetches the new segment.
 *
 *  2. That is exactly what breaks the active state. A layout does NOT re-render when
 *     you navigate between its own children, so the `pathname` the server read from
 *     headers goes stale the moment client navigation is switched on — the highlight
 *     would stick to whichever page was loaded first. `usePathname()` is reactive and
 *     always correct.
 *
 * The sidebar itself stays a Server Component, so the role filtering that decides which
 * links exist at all is still done on the server and never shipped to the browser.
 *
 * The icon arrives RENDERED, as an element, not as the component that draws it. It
 * was a component (`icon={LeafIcon}`), and a Server Component cannot hand a function
 * to a Client Component: React refuses to serialise it, so every admin page failed
 * with "Functions cannot be passed directly to Client Components". An element is
 * already rendered on the server and crosses the boundary as data.
 */
export function AdminNavLink({
  href,
  label,
  icon,
  emphasis = false,
  onNavigate,
}: {
  href: string
  label: string
  icon: React.ReactNode
  /** The everyday pages at the top: a touch larger than the rest. */
  emphasis?: boolean
  onNavigate?: () => void
}) {
  const pathname = usePathname()
  // `/admin` would otherwise match every page beneath it.
  const active = pathname === href || (href !== '/admin' && pathname.startsWith(`${href}/`))

  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      onClick={onNavigate}
      className={`admin-nav-row relative flex min-h-11 items-center gap-3 rounded-md px-3 transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-moss-300 focus-visible:outline-none motion-reduce:transition-none ${
        emphasis ? 'text-sm' : 'text-[13px]'
      } ${
        active
          ? 'bg-white/10 font-medium text-white before:absolute before:inset-y-1.5 before:left-0 before:w-0.5 before:rounded-full before:bg-moss-300'
          : 'text-stone-300 hover:bg-white/5 hover:text-white'
      }`}
    >
      {icon}
      <span className="truncate">{label}</span>
    </Link>
  )
}
