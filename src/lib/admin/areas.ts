/**
 * Admin access areas.
 *
 * A STAFF user is granted a subset of these; ADMIN and SUPERADMIN get everything.
 * Used to filter the sidebar AND to guard routes, so the two can never disagree —
 * a hidden nav item that is still reachable by typing the URL is not access control.
 *
 * Pure functions with no database access, so the proxy can enforce them before
 * rendering.
 *
 * NOTHING is accessible to STAFF unless explicitly granted, including the dashboard.
 * Defaulting to "everything except the dangerous bits" is how an intern ends up able
 * to change which states we ship controlled products to.
 */
export type AdminArea = {
  readonly slug: string
  readonly label: string
  readonly description: string
  readonly prefixes: readonly string[]
}

export const ADMIN_AREAS: readonly AdminArea[] = [
  {
    slug: 'dashboard',
    label: 'Dashboard & analytics',
    description: 'Revenue, order counts, demand signals',
    prefixes: ['/admin/analytics'],
  },
  {
    slug: 'orders',
    label: 'Orders',
    description: 'Verify payment, pack, ship',
    prefixes: ['/admin/orders'],
  },
  {
    slug: 'payments',
    label: 'Payment handles',
    description: 'Rotate and burn Cash App, Chime and Apple Cash handles',
    prefixes: ['/admin/payments'],
  },
  {
    slug: 'catalog',
    label: 'Products & categories',
    description: 'Catalogue, pricing, coupons, inventory',
    prefixes: ['/admin/products', '/admin/categories', '/admin/coupons'],
  },
  {
    slug: 'customers',
    label: 'Customers & carts',
    description: 'Customer records and cart activity',
    prefixes: ['/admin/customers', '/admin/cart-activity'],
  },
  {
    // Its own area rather than folded into customers: reading a customer list and
    // reading their private messages are different levels of trust.
    slug: 'messages',
    label: 'Customer messages',
    description: 'Support inbox',
    prefixes: ['/admin/messages'],
  },
  {
    slug: 'visitors',
    label: 'Visitors',
    description: 'Anonymous visit records and blocked addresses',
    prefixes: ['/admin/visitors'],
  },
  {
    // The highest-consequence area in the panel. An edit here changes what we will
    // legally sell, and to whom.
    slug: 'compliance',
    label: 'Compliance',
    description: 'State rules, lab batches, review moderation, PACT filings',
    prefixes: [
      '/admin/state-rules',
      '/admin/lab-batches',
      '/admin/reviews',
      '/admin/reports',
      '/admin/locations',
    ],
  },
  {
    slug: 'content',
    label: 'Content',
    description: 'Guides, blogs, announcements and media uploads',
    prefixes: ['/admin/content', '/admin/announcements', '/admin/media'],
  },
  {
    slug: 'marketing',
    label: 'Newsletter & campaigns',
    description: 'Subscribers, email blasts, push notifications, tracking links, promoters',
    prefixes: ['/admin/newsletter', '/admin/campaigns', '/admin/notifications', '/admin/links', '/admin/promoters'],
  },
  {
    slug: 'settings',
    label: 'Settings',
    description: 'Operational copy and thresholds',
    prefixes: ['/admin/settings'],
  },
  {
    // Its own area, for the same reason the error log has one, only more so. This
    // table records privilege grants, credential rotations, burned payment handles
    // and every state-rule change — reading it tells you what the whole team has
    // been doing. It is also the record that has to stay trustworthy when something
    // goes wrong, so the set of people who can read it is deliberately small and
    // separately grantable rather than arriving free with "compliance".
    slug: 'audit',
    label: 'Audit trail',
    description: 'Who changed what, across the whole panel',
    prefixes: ['/admin/audit'],
  },
  {
    // Its own area rather than folded into settings. The error log carries stack
    // traces and request paths from every surface, which is a different level of
    // trust from editing a shipping threshold — and it is the first place someone
    // debugging an incident goes, so it should be grantable on its own.
    slug: 'errors',
    label: 'Error log',
    description: 'Unresolved application errors from every surface',
    prefixes: ['/admin/errors'],
  },
]

export const ADMIN_AREA_SLUGS = ADMIN_AREAS.map((a) => a.slug)

export type AdminRoleName = 'SUPERADMIN' | 'ADMIN' | 'STAFF'

/** The area a path belongs to. Bare `/admin` is the dashboard. Longest prefix wins. */
export function areaForPath(pathname: string): string {
  if (pathname === '/admin') return 'dashboard'
  const matches = ADMIN_AREAS.flatMap((a) => a.prefixes.map((p) => ({ slug: a.slug, p })))
    .filter((m) => pathname === m.p || pathname.startsWith(`${m.p}/`))
    .sort((a, b) => b.p.length - a.p.length)
  return matches[0]?.slug ?? 'dashboard'
}

/**
 * Can this user reach this path?
 *
 *  SUPERADMIN — everything.
 *  ADMIN      — everything except team management.
 *  STAFF      — only the areas explicitly granted.
 *  anything else — no.
 */
export function canAccessAdminPath(
  role: string | undefined,
  adminAreas: readonly string[],
  pathname: string,
): boolean {
  if (role === 'SUPERADMIN') return true

  const isTeam = pathname === '/admin/team' || pathname.startsWith('/admin/team/')
  if (role === 'ADMIN') return !isTeam
  if (role === 'STAFF') {
    if (isTeam) return false
    return adminAreas.includes(areaForPath(pathname))
  }
  return false
}

/** Where to send someone who lands somewhere they cannot reach. */
export function firstAllowedAdminPath(
  role: string | undefined,
  adminAreas: readonly string[],
): string {
  if (role === 'SUPERADMIN' || role === 'ADMIN') return '/admin'
  if (adminAreas.includes('dashboard')) return '/admin'
  for (const area of ADMIN_AREAS) {
    if (adminAreas.includes(area.slug)) return area.prefixes[0] ?? '/admin'
  }
  return '/'
}

/**
 * Where the operator was going when the proxy sent them to sign in.
 *
 * A notification on the phone links straight to one order or one conversation, and
 * the admin session may have expired since it was last used. Without this the
 * operator signed in and landed on the dashboard, and had to find the order the
 * notification was about. The proxy stores the requested path in this short-lived
 * cookie; sign-in reads it once and goes there.
 */
export const ADMIN_NEXT_COOKIE = 'admin-next'

/**
 * The stored destination, if it is safe to send this operator to; otherwise undefined.
 *
 * Safe means: a same-site path inside /admin (never `//host`, a backslash trick or
 * a full URL, so this cannot become an open redirect), not the sign-in page itself,
 * not absurdly long, and an area this operator's role and grants can actually open.
 */
export function safeAdminNext(
  value: string | undefined | null,
  role: string | undefined,
  adminAreas: readonly string[],
): string | undefined {
  if (!value || value.length > 512) return undefined
  if (!value.startsWith('/admin') || value.startsWith('//') || /[\\\s]/.test(value)) return undefined
  const pathname = value.split(/[?#]/)[0] ?? ''
  if (pathname !== '/admin' && !pathname.startsWith('/admin/')) return undefined
  if (pathname === '/admin/login' || pathname.startsWith('/admin/login/')) return undefined
  if (!canAccessAdminPath(role, adminAreas, pathname)) return undefined
  return value
}
