import type { MetadataRoute } from 'next'
import { BRAND } from '@/lib/brand'
import { absoluteUrl } from '@/lib/seo/routes'

/**
 * Web app manifest.
 *
 * Two jobs, and the second is the reason it exists here.
 *
 * On Android, Chrome reads `theme_color` from the manifest as well as from the
 * `theme-color` meta — and when a manifest is present the manifest WINS. Adding
 * one without it would have replaced a correct status bar with a white default.
 * The value is the same `--surface` the meta uses, so the two cannot disagree.
 *
 * `background_color` is what fills the screen while an installed app is starting,
 * before the first paint. It is the BODY background rather than the header's, so
 * the splash matches the page that is about to appear rather than its top bar.
 *
 * `display: 'standalone'` only affects an installed copy; in a browser tab it is
 * ignored. It is set because someone who adds this to a home screen should get
 * the site, not a browser wrapped around it.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    /*
      The installed app's identity. Without it Chrome derives one from start_url, and
      changing start_url later would make every installed copy a different app.
    */
    id: '/',
    name: `${BRAND.name} — ${BRAND.tagline}`,
    short_name: BRAND.name,
    description: BRAND.description,
    start_url: '/',
    display: 'standalone',
    orientation: 'portrait',
    // Matches viewport.themeColor in layout.tsx — the sticky header's surface.
    theme_color: '#1a1f16',
    // The body background, for the splash before first paint.
    background_color: '#12160f',
    /*
      The round MIMOSALSD badge, "Mi" with the mushroom i (scripts/brand-icons.mjs
      rebuilds the whole set). The 192 and 512 are the two Android requires, and
      the round art sits on transparency, which desktop installs show as it is.

      The maskable plate is the badge's own dark ground run to the edges with the
      wordmark inside the central 80% safe zone: a launcher crops it to whatever
      shape the phone's theme uses (circle, squircle, teardrop), and on a
      continuous ground no crop can cut the lettering or leave a ring half drawn.

      New filenames rather than new art under the old ones: an installed app
      re-downloads its icon when the URL changes, and may never notice otherwise.
      The iPhone home-screen icon is app/apple-icon.png, the same plate at 180px.
    */
    icons: [
      { src: '/brand/app-icon-v2-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/brand/app-icon-v2-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/brand/app-icon-maskable-v2-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
      { src: '/brand/app-icon-maskable-v2-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
    /*
      Points at itself, which is what lets a browser tab ask Chrome "is this site
      already installed?" (navigator.getInstalledRelatedApps) and hide the install
      button. `prefer_related_applications` stays false: true would tell Chrome to
      recommend some other app instead of installing this one.
    */
    related_applications: [{ platform: 'webapp', url: absoluteUrl('/manifest.webmanifest') }],
    prefer_related_applications: false,
    categories: ['shopping'],
    lang: 'en-US',
    // US only. Stated wherever the site describes itself.
    scope: '/',
  }
}
