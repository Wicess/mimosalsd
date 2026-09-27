import { Suspense } from 'react'
import Image from 'next/image'
import { catalog } from '@/lib/catalog/repository'
import { BRAND } from '@/lib/brand'
import { url } from '@/lib/seo/routes'
import { ShineRule } from '@/components/ui/shine-rule'
import { CartButton } from '@/components/commerce/cart-button'
import { CartCount } from '@/components/commerce/cart-count'
import { UserIcon } from '@/components/ui/icon'
import { ThemeToggle } from '@/components/layout/theme-toggle'
import { InstallButton } from '@/components/pwa/install-button'
import { ChatUnreadBadge } from '@/components/chat/unread-badge'

/**
 * Site header. A server component; navigation is plain links, and links work.
 *
 * The one client component is the cart control, and it is still an anchor to /cart —
 * opening the drawer is layered on top of a link that works without JavaScript.
 */
export function SiteHeader() {
  /*
    ONE navigation list, rendered twice.

    The desktop bar and the phone rail were separate before, which is how "Shop"
    ended up being the only thing a phone user could reach — the categories, the
    legality hub, the lab lookup and Contact were all desktop-only, on a site
    that is designed mobile-first at 375px. Building both from one array means a
    link cannot be added to one and forgotten on the other.

    Contact is in it because a shop that sells age-restricted goods and takes no
    payment on site has to make reaching a human obvious. It was reachable only
    from the footer.
  */
  const NAV = [
    /*
      `navLabel`, not `name`: "Mimosa · Mushrooms · Disposables" fits a 375px rail
      whole, where the full names showed one and a half categories. The pages
      those links open still carry the full names in their headings and titles.
    */
    ...catalog
      .listCategories()
      .map((c) => ({ label: c.navLabel ?? c.name, href: url.category(c.slug) })),
    { label: 'Where we ship', href: url.legalityHub() },
    { label: 'Lab results', href: url.labResults() },
    { label: 'About us', href: url.about() },
    { label: 'Contact', href: url.contact() },
  ]

  return (
    <header
      // Blurred, like the two bottom bars. At 95% alpha with nothing behind it the page
      // text scrolled straight through the header and read as a rendering fault; the
      // blur is what makes the translucency deliberate. `backdrop-blur-md` does not
      // exist in this theme — there is no `--blur-md` token — so the value is explicit.
      className="header-elevate sticky top-0 z-(--z-sticky) border-b border-border bg-surface/95 backdrop-blur-[10px]"
      /*
        `viewport-fit: cover` lets the page paint into the notch, which is what
        removes the seam under the status bar — and it also means the header would
        sit UNDER the clock without this. The inset is padding rather than a
        margin so the header's own background still fills the notch area; a margin
        would leave a transparent strip and put the seam straight back.

        Zero on every device without a notch, so there is nothing to undo.
      */
      style={{ paddingTop: 'env(safe-area-inset-top)' }}
    >
      <ShineRule edge="bottom" />
      <div className="shell flex items-center gap-4 py-3 [padding-left:max(env(safe-area-inset-left),var(--shell-gutter,0px))] [padding-right:max(env(safe-area-inset-right),var(--shell-gutter,0px))]">
        {/*
          The wordmark, and it is the way home from every page — hence `min-h-11`,
          which keeps the tap target at 44px however short the artwork is.

          One asset serves both themes. The logo carries a heavy black outline, so
          on the light surface the outline defines it and on the near-black surface
          the outline disappears into the ground and the green letterforms float —
          which is the effect the artwork was drawn for. No second file, no
          `dark:` swap, nothing to keep in sync.

          `priority` because it sits in the header of every page, above the fold,
          and a logo that pops in after hydration is the most visible possible
          layout flicker. Width and height are the artwork's real ratio (996:440)
          so the box is reserved before the bytes arrive.
        */}
        <a
          href={url.home()}
          aria-label={`${BRAND.name} — home`}
          className="inline-flex min-h-11 shrink-0 items-center"
        >
          <Image
            src="/brand/logo.png"
            alt={BRAND.name}
            width={1180}
            height={329}
            priority
            sizes="112px"
            className="h-8 w-auto sm:h-9"
          />
        </a>

        {/*
            `lg:flex`, not `md:flex`. Six destinations plus the wordmark, the theme
            control and the cart do not fit in 768px — at exactly that width the row
            ran to 825px and the whole page scrolled sideways. The scrollable category
            strip below covers 768–1023 instead.
          */}
          <nav aria-label="Main" className="hidden gap-1 lg:flex">
          {NAV.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="inline-flex min-h-11 items-center rounded-md px-3 text-sm text-foreground hover:bg-surface-sunken"
            >
              {item.label}
            </a>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-1">
          {/* Install the app. Renders only where it can be installed, and never once it is. */}
          <InstallButton />
          {/* Light or dark, on every screen size. Dark is the default (see app/layout.tsx). */}
          <ThemeToggle />
          {/* The customer's account, in the top bar on every screen size. */}
          <a
            href={url.account()}
            className="relative inline-flex min-h-11 min-w-11 items-center justify-center rounded-md px-3 text-foreground hover:bg-surface-sunken"
          >
            <UserIcon className="size-5" />
            <span className="sr-only">Your account</span>
            {/* Unread staff messages: the profile opens on the chat. */}
            <ChatUnreadBadge className="top-0.5 right-0.5" />
          </a>
          <CartButton>
            {/*
              The count reads the cart cookie, so it is isolated behind Suspense. The
              header itself stays prerenderable; only this badge streams in.
            */}
            <Suspense fallback={null}>
              <CartCount />
            </Suspense>
          </CartButton>
        </div>
      </div>

      {/*
        The phone rail.

        Horizontally scrollable rather than a hamburger: there are six
        destinations, they all fit in a swipe, and a menu that has to be opened
        gets opened by almost nobody. The gutter bleed lets the last item run off
        the edge so it is visibly scrollable.

        `px-2.5` rather than the desktop bar's `px-3`, and the 4px is measured:
        at 12px a side, "Disposables" ended 7px past the edge of a 360px Android
        screen, so the one category a phone could not see was the one furthest
        along. Every link keeps its 44px tap height.
      */}
      <nav
        aria-label="Sections"
        className="shell flex gap-1 overflow-x-auto border-t border-border pb-2 [-ms-overflow-style:none] [scrollbar-width:none] lg:hidden [&::-webkit-scrollbar]:hidden"
      >
        <a
          href={url.shop()}
          className="inline-flex min-h-11 shrink-0 items-center rounded-md px-2.5 text-sm font-medium text-foreground hover:bg-surface-sunken"
        >
          Shop
        </a>
        {NAV.map((item) => (
          <a
            key={item.href}
            href={item.href}
            className="inline-flex min-h-11 shrink-0 items-center rounded-md px-2.5 text-sm whitespace-nowrap text-foreground-muted hover:bg-surface-sunken hover:text-foreground"
          >
            {item.label}
          </a>
        ))}
      </nav>
    </header>
  )
}
