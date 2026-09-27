import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { getAdminIdentity, isAdminConfigured } from '@/lib/admin/auth'

import { AdminSidebar } from '@/components/admin/sidebar'
import { AdminMobileNav } from '@/components/admin/mobile-nav'

export const metadata: Metadata = {
  title: 'Admin',
  robots: { index: false, follow: false, nocache: true },
}

/**
 * The admin area never prerenders — every page depends on the session, and an auth
 * check served from a prerendered shell is not an auth check.
 */
export const instant = false

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = (await headers()).get('x-pathname') ?? ''

  if (!isAdminConfigured()) {
    return (
      <main className="mx-auto max-w-xl px-4 py-16">
        <h1 className="font-display text-2xl text-foreground">Admin is not configured</h1>
        <p className="mt-3 text-sm leading-relaxed text-foreground-muted">
          Set <code className="rounded bg-surface-sunken px-1">ADMIN_SESSION_SECRET</code>{' '}
          and a bootstrap{' '}
          <code className="rounded bg-surface-sunken px-1">ADMIN_PASSWORD_HASH</code>.
          Generate both with{' '}
          <code className="rounded bg-surface-sunken px-1">npm run admin:hash</code>.
        </p>
      </main>
    )
  }

  if (pathname.startsWith('/admin/login')) return <>{children}</>

  /*
   * The proxy performs BOTH the authentication and the area check, and those are the
   * enforcing ones — a layout render is shared across sibling routes and is not
   * re-evaluated per request. Proven twice in this codebase.
   *
   * What follows is defence in depth plus the display identity, and it does add one
   * thing the proxy cannot: a disabled account is rejected here on the next request,
   * without waiting for the cookie to expire.
   */
  const identity = await getAdminIdentity()

  /*
   * If this is null the account was disabled since sign-in — a real revocation, so
   * send them out. It does NOT redirect for any other reason: an earlier version
   * redirected whenever the identity lookup came back empty, which meant one transient
   * database error bounced the operator to /admin/login mid-action. The proxy has
   * already authenticated and area-checked this request.
   */
  if (!identity) redirect('/admin/login')

  /*
   * No `pathname` prop any more. The active state is computed client-side by
   * AdminNavLink: a layout does not re-render when navigating between its own
   * children, so a server-read pathname would freeze at whichever page loaded first.
   */
  const sidebar = (
    <AdminSidebar
      role={identity.role}
      adminAreas={identity.adminAreas}
      name={identity.name}
    />
  )

  return (
    <div data-admin-ui className="min-h-dvh bg-background">
      {/*
        `data-admin-chrome` is the hook `@media print` uses to drop navigation, and
        `data-admin-shell` releases the 16rem gutter the fixed sidebar reserves —
        which is a column of nothing once there is no sidebar to sit in it.
      */}
      <aside
        data-admin-chrome
        className="fixed inset-y-0 left-0 z-30 hidden w-64 lg:block"
      >
        {sidebar}
      </aside>
      <div data-admin-chrome>
        <AdminMobileNav>{sidebar}</AdminMobileNav>
      </div>
      <div data-admin-shell className="pt-14 lg:pt-0 lg:pl-64">
        {children}
      </div>
    </div>
  )
}
