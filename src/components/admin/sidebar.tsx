import Link from 'next/link'
import Image from 'next/image'
import { canAccessAdminPath } from '@/lib/admin/areas'
import { BRAND } from '@/lib/brand'
import { adminLogout } from '@/app/actions/admin-auth'
import {
  BellIcon, BookIcon, CardIcon, CartIcon, ChartIcon, ChatIcon, ExternalLinkIcon, FlaskIcon, GearIcon,
  GridIcon, LeafIcon, LinkIcon, MailIcon, MegaphoneIcon, SendIcon, ShieldIcon, SignOutIcon, StarIcon,
  TagIcon, UserIcon, UsersIcon,
} from '@/components/ui/icon'
import { AdminNavLink } from '@/components/admin/nav-link'

type NavItem = {
  href: string
  label: string
  icon: React.ComponentType<{ className?: string }>
}
/** A group with no title is the top one: the pages used every day, in the owner's order. */
type NavGroup = { title: string | null; items: NavItem[] }

/**
 * ─────────────────────────────────────────────────────────────────────────────
 *  THE ADMIN NAVIGATION (owner's layout, 2026-09-13).
 *
 *  The top group is the everyday work, in the order the owner asked for, with
 *  Visitors and Messages right under the Dashboard. Everything else is grouped
 *  below it.
 *
 *  Not in the navigation, at the owner's request: audit trail, error log,
 *  promoters, media, locations, PACT reports, state rules, cart activity and
 *  coupons. The pages still exist and still enforce their access rules. The
 *  state rules are what checkout reads to decide where each product may ship,
 *  and the error alerts on the phone link to the error log, so those addresses
 *  keep working for anyone who has them. They are simply no longer part of the
 *  panel. Add an item back here to restore it.
 * ─────────────────────────────────────────────────────────────────────────────
 */
export const NAV_GROUPS: readonly NavGroup[] = [
  {
    title: null,
    items: [
      { href: '/admin', label: 'Dashboard', icon: GridIcon },
      { href: '/admin/visitors', label: 'Visitors', icon: UsersIcon },
      { href: '/admin/messages', label: 'Messages', icon: ChatIcon },
      { href: '/admin/analytics', label: 'Analytics', icon: ChartIcon },
      { href: '/admin/products', label: 'Products', icon: LeafIcon },
      { href: '/admin/orders', label: 'Orders', icon: CartIcon },
      { href: '/admin/cart-activity', label: 'Carts', icon: CartIcon },
      { href: '/admin/newsletter', label: 'Subscribers', icon: MailIcon },
    ],
  },
  {
    title: 'Store',
    items: [
      { href: '/admin/payments', label: 'Payment handles', icon: CardIcon },
      { href: '/admin/categories', label: 'Categories', icon: TagIcon },
      { href: '/admin/customers', label: 'Customers', icon: UserIcon },
      { href: '/admin/lab-batches', label: 'Lab batches', icon: FlaskIcon },
      { href: '/admin/reviews', label: 'Reviews', icon: StarIcon },
    ],
  },
  {
    title: 'Marketing',
    items: [
      { href: '/admin/content', label: 'Guides & blogs', icon: BookIcon },
      { href: '/admin/announcements', label: 'Announcements', icon: MegaphoneIcon },
      { href: '/admin/campaigns', label: 'Email blasts', icon: SendIcon },
      { href: '/admin/notifications', label: 'Push notifications', icon: BellIcon },
      { href: '/admin/links', label: 'Tracking links', icon: LinkIcon },
    ],
  },
  {
    title: 'System',
    items: [
      { href: '/admin/settings', label: 'Settings', icon: GearIcon },
      // SUPERADMIN only. Hidden for everyone else by the access filter.
      { href: '/admin/team', label: 'Team & access', icon: ShieldIcon },
    ],
  },
]

const FOOTER_BUTTON =
  'inline-flex size-11 cursor-pointer items-center justify-center rounded-md text-stone-300 transition-[color,background-color,scale] duration-150 hover:bg-white/10 hover:text-white focus-visible:ring-2 focus-visible:ring-moss-300 focus-visible:outline-none active:scale-[0.94] motion-reduce:active:scale-100 lg:size-9'

/**
 * The sidebar filters items by the SAME predicate the proxy enforces with, so a
 * hidden item is genuinely unreachable rather than merely invisible.
 *
 * On a computer it fits the window with no scroll bar: every row shares the height
 * the window has, between 22 and 40px (the `.admin-nav` rules in globals.css). The
 * phone drawer keeps full 44px rows and scrolls with a finger, as a drawer should.
 */
export function AdminSidebar({
  role,
  adminAreas,
  name,
}: {
  role: string
  adminAreas: readonly string[]
  name: string
}) {
  const groups = NAV_GROUPS.map((g) => ({
    ...g,
    items: g.items.filter((i) => canAccessAdminPath(role, adminAreas, i.href)),
  })).filter((g) => g.items.length > 0)
  const rows = groups.reduce((n, g) => n + g.items.length, 0)
  const headings = groups.filter((g) => g.title).length

  return (
    <div
      className="admin-nav flex h-full flex-col bg-stone-950 text-stone-200"
      style={{ '--nav-rows': rows, '--nav-heads': headings } as React.CSSProperties}
    >
      <div className="admin-nav-bar flex h-14 shrink-0 items-center gap-2.5 border-b border-white/10 px-5">
        {/*
          The same logo the storefront uses. The sidebar is always dark, so the
          artwork's black outline melts into it and the green reads — no separate
          admin variant to keep in sync with the public one.
        */}
        <Image src="/brand/logo.png" alt={BRAND.name} width={996} height={440} sizes="112px" className="h-7 w-auto" />
        <span className="text-[10px] font-medium tracking-[0.2em] text-moss-300 uppercase">Admin</span>
      </div>

      <nav
        aria-label="Admin"
        className="min-h-0 flex-1 overflow-y-auto px-3 py-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {groups.map((group) => (
          <div key={group.title ?? 'main'} className="admin-nav-group">
            {group.title ? (
              <p className="admin-nav-heading px-3 text-[10px] font-semibold tracking-[0.18em] text-stone-500 uppercase">
                {group.title}
              </p>
            ) : null}
            <ul>
              {group.items.map((item) => (
                <li key={item.href}>
                  <AdminNavLink
                    href={item.href}
                    label={item.label}
                    emphasis={group.title === null}
                    icon={<item.icon className="size-[18px] shrink-0" />}
                  />
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      <div className="admin-nav-bar flex h-14 shrink-0 items-center gap-1 border-t border-white/10 pr-2 pl-5">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm leading-tight text-white">{name}</p>
          <p className="text-[10px] leading-tight tracking-[0.18em] text-stone-400 uppercase">{role.toLowerCase()}</p>
        </div>
        <Link href="/" className={FOOTER_BUTTON} title="View site" aria-label="View site">
          <ExternalLinkIcon className="size-5" />
        </Link>
        <form action={adminLogout}>
          <button type="submit" className={FOOTER_BUTTON} title="Sign out" aria-label="Sign out">
            <SignOutIcon className="size-5" />
          </button>
        </form>
      </div>
    </div>
  )
}
