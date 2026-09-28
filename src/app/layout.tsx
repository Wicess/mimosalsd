import type { Metadata, Viewport } from 'next'
import { Inter, Newsreader, Space_Grotesk } from 'next/font/google'
import { BRAND } from '@/lib/brand'
import { absoluteUrl } from '@/lib/seo/routes'
import { clampDescription } from '@/lib/seo/meta'
import { ServiceWorker } from '@/components/pwa/service-worker'
import { HumanCheck } from '@/components/visitors/human-check'
import { ScrollMemory } from '@/components/navigation/scroll-memory'
import { Suspense } from 'react'
import { THEME_INIT_SCRIPT } from '@/lib/design/theme'
import './globals.css'

/**
 * Self-hosted via next/font — no render-blocking request to a third-party origin,
 * and no layout shift, because the fallback metrics are matched automatically.
 *
 * Newsreader is drawn for long-form reading. The legality pages and pillar guides
 * ARE long-form reading, and they are where most organic traffic lands, so the
 * display face is chosen for the content that matters rather than for the hero.
 *
 * NORMAL ONLY — no italic face.
 *
 * Nothing on this site renders italic Newsreader; the only `italic` matches in the
 * codebase are `not-italic` utilities on <address> elements, which exist to CANCEL
 * the browser default. Next emits a `Link: rel=preload` header for every declared
 * face regardless of use, so the italic subset was being fetched at high priority on
 * every page — 63.5 KB, competing with the LCP for bandwidth, for nothing.
 *
 * With it gone, fonts no longer outweigh the entire JavaScript bundle. If italic
 * copy is ever genuinely needed, add the style back here rather than faux-slanting.
 */
const newsreader = Newsreader({
  subsets: ['latin'],
  /*
    400, 500, 600 — and deliberately not 700.

    Rendered-weight census across all sixteen public routes: 400 on 231 elements,
    500 on 85, 600 on 3, and 700 on none. A weight nothing asks for is a file the
    browser may still fetch and always has to account for.
  */
  weight: ['400', '500', '600'],
  style: ['normal'],
  variable: '--font-newsreader',
  display: 'swap',
})

/*
 * Product voice.
 *
 * Scoped deliberately: product names, prices and batch codes, nowhere else. Newsreader
 * is drawn for reading and goes thin and wide at the 14px a card title runs at, which
 * is where most product names are actually read. Space Grotesk holds its weight at
 * that size and its figures are distinctive, which is what prices need.
 *
 * Only the two weights the product surfaces use are loaded — asking for the full range
 * would cost more than the face is worth here.
 */
const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  weight: ['500', '600'],
  variable: '--font-product-face',
  display: 'swap',
})

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
})

/*
  The homepage title leads with the products, not the company.

  Nobody searches "MIMOSALSD" yet, and a title tag is about 60 characters before
  Google truncates it. Spending the first twelve of those on a term with no search
  volume pushes the things people DO search toward the cut.

  2026-09-19: it read "Mimosa Hostilis, Amanita Muscaria & Vapes — MIMOSALSD": two
  symbols the owner banned from titles, and a product name that is not what that
  category holds. Google's autocomplete puts "mimosa hostilis root bark for sale" at
  the top of every search about the material, so the title is that phrase, then the
  line the business is built around. Google appends the site name itself.
*/
const SITE_TITLE = 'Mimosa Hostilis Root Bark for Sale, for Natural Dyeing'
const SITE_DESCRIPTION = clampDescription(
  `Mimosa hostilis root bark for natural dyeing and soap making, powder, shredded and whole, sold by the pound. Trading since ${BRAND.track.foundedYear}, shipped from California.`,
)

export const metadata: Metadata = {
  metadataBase: new URL(absoluteUrl('/')),
  /*
    NO `template`, deliberately.

    It used to be `%s | MIMOSALSD`, which appended the brand to all ~150 page
    titles. For an established brand that is worth the characters; for one nobody
    is searching it is twelve characters of a sixty-character budget spent on a
    term that wins no query, repeated on every page — and it is the tail of the
    title, the part Google drops first, so it degrades the pages it is meant to
    badge.

    The brand is not being hidden. It stays in the Organization JSON-LD, the
    manifest, `applicationName` and the footer, which is where an answer engine
    resolves the entity anyway. What it leaves is the one piece of real estate
    that has to compete for a product query.
  */
  title: SITE_TITLE,
  description: SITE_DESCRIPTION,
  applicationName: BRAND.name,
  /*
    For a copy added to an iPhone's home screen: iOS takes the title from here and
    not from the manifest, and without `capable` it opens in a browser chrome the
    manifest's `display: standalone` was meant to replace.
  */
  appleWebApp: { capable: true, title: BRAND.name, statusBarStyle: 'default' },
  robots: { index: true, follow: true },
  /*
    Ownership verification for Google Search Console and Bing Webmaster Tools.

    Both accept an HTML meta tag as proof, and both are the places this site is
    submitted to and then monitored from. Driven by environment variables rather
    than literals so the tokens are set once per deployment and never committed:
    without them the tags are simply absent, which is the correct state for a
    deployment that has not been claimed.
  */
  verification: {
    ...(process.env.GOOGLE_SITE_VERIFICATION
      ? { google: process.env.GOOGLE_SITE_VERIFICATION }
      : {}),
    ...(process.env.BING_SITE_VERIFICATION
      ? { other: { 'msvalidate.01': process.env.BING_SITE_VERIFICATION } }
      : {}),
  },
  /**
   * Open Graph and Twitter cards.
   *
   * Not vanity. Acquisition here is 100% organic, which makes every link someone
   * pastes into a forum, a Discord, a subreddit or a group chat a real channel — and
   * without these tags every one of those renders as a bare URL with no title, no
   * description and no image. Several link-preview and AI-crawler pipelines also read
   * `og:title`/`og:description` before falling back to parsing the body.
   *
   * This block is the DEFAULT and the fallback — nothing more. Next does not derive
   * `openGraph.title` from a page's `title`, and a parent `openGraph` is inherited
   * verbatim, so leaving pages to inherit this gave all 150 of them the same card.
   * Individual routes build their own via `pageMetadata()` in lib/seo/meta.ts; what
   * remains here is what an un-titled route falls back to. The image comes from the
   * sibling `opengraph-image.tsx`.
   */
  openGraph: {
    type: 'website',
    siteName: BRAND.name,
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    url: absoluteUrl('/'),
    locale: 'en_US',
  },
  twitter: {
    card: 'summary_large_image',
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
  },
  // US market only. Stated explicitly so no crawler infers otherwise.
  other: { 'geo.region': 'US' },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  // Never disable zoom — WCAG 1.4.4.
  maximumScale: 5,
  /*
    Paint into the notch.

    Without `cover`, iOS letterboxes the page inside the safe area and the strip
    behind the status bar is filled with the browser's own colour — which is the
    seam this is meant to remove. With it, the page owns the full screen and the
    safe-area insets (applied on the header and the tab bar) keep content clear of
    the notch and the home indicator.
  */
  viewportFit: 'cover',
  /*
    THE STATUS BAR.

    iOS and Android tint the area showing the clock, signal and battery with this
    colour. It matched `--background`, which is right for the body — but the thing
    physically touching the status bar is the STICKY HEADER, and that is
    `--surface`. A one-shade seam directly under the clock is exactly the detail
    that makes a site feel like a web page rather than an app.

    Both themes are declared. A phone on light with the site on dark reads the
    matching entry, and there is no third state to get wrong.
  */
  // The dark default. A visitor on light gets theirs from lib/design/theme.ts syncThemeColor.
  themeColor: '#1a1f16',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    /*
      DARK BY DEFAULT, LIGHT ON REQUEST.

      Dark on every device was the owner's decision on 2026-09-13. On 2026-09-15
      they asked for the light theme back as a choice customers make from the nav
      bar (components/layout/theme-toggle.tsx).

      Dark is set in the server-rendered HTML, so the default has no flash and needs
      no script. A visitor who chose light has it applied by THEME_INIT_SCRIPT in
      <head>, before the page paints. `suppressHydrationWarning` covers the attribute
      it changes.
    */
    <html
      lang="en"
      data-theme="dark"
      style={{ colorScheme: 'dark' }}
      className={`${newsreader.variable} ${inter.variable} ${spaceGrotesk.variable}`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      {/*
        The root layout carries ONLY the document shell. Storefront chrome — header,
        footer, age gate, chat — lives in the (site) route group, so /admin does not
        inherit it. It did at first, and the age gate rendered over the admin panel and
        blocked every click.
      */}
      <body>
        {/*
          Chrome and Samsung Internet offer their install dialog exactly once per page
          load, and can do so before any bundle has loaded. Caught here, inline, so the
          install button (components/pwa/install-store.ts) always has it to hand. The
          default banner is suppressed because the site shows its own.
        */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "addEventListener('beforeinstallprompt',function(e){e.preventDefault();window.__sgInstallPrompt=e});addEventListener('appinstalled',function(){window.__sgInstallPrompt=null;try{localStorage.setItem('sg-app-installed','1')}catch(_){}})",
          }}
        />
        {children}
        {/* Registers the service worker: installable, plus an offline page. */}
        <ServiceWorker />
        {/* Tells real visitors from bots for the admin: one request, on the first genuine input. */}
        <HumanCheck />
        {/* Back to the same spot on a page you return to, site and admin (reads the query, so it waits in Suspense). */}
        <Suspense fallback={null}>
          <ScrollMemory />
        </Suspense>
      </body>
    </html>
  )
}
