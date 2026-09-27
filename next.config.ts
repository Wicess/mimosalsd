import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Do not advertise the framework and version to anyone scanning for known issues.
  poweredByHeader: false,
  /**
   * Partial Prerendering. Lets a route ship a STATIC shell (product copy, specs,
   * lab results, JSON-LD — everything a crawler and the LCP need) while the
   * per-visitor parts (state availability) stream in behind Suspense.
   *
   * Without this, one cookies() call in a page opts the whole route out of
   * prerendering, which is what happened to /product/[slug] and /shop/[category].
   */
  cacheComponents: true,
  /**
   * The CDN host, made available to the browser bundle as well as the server.
   *
   * `R2_PUBLIC_HOST` is a plain server variable, so a `'use client'` module
   * reading it gets `undefined` — the cart drawer rendered its thumbnails from
   * the CDN on the server and from /public after hydration, which is both a
   * hydration mismatch and, once the local fallbacks are gone, a broken image.
   *
   * Publishing it is not a leak: it is the hostname already visible in the `src`
   * of every product image on the site.
   */
  env: {
    NEXT_PUBLIC_R2_PUBLIC_HOST: process.env.R2_PUBLIC_HOST ?? '',
  },
  /*
    The invoice image is drawn on the server from font files and the logo, read from
    disk (lib/invoices/render.tsx). A file read by path is invisible to Next's
    tracing, so without this the fonts would be there locally and missing on
    Vercel, and every invoice would fail to draw. Listed for exactly the routes that
    draw one: checkout (the received invoice) and the admin payment page (the
    payment invoice).
  */
  outputFileTracingIncludes: {
    '/checkout': ['./src/lib/invoices/fonts/*.ttf', './public/brand/logo-email.png'],
    '/admin/orders/\\[slug\\]/payment': ['./src/lib/invoices/fonts/*.ttf', './public/brand/logo-email.png'],
  },
  /*
    Server Actions accept 1 MB by default, which silently capped every admin
    upload at 1 MB: the media library advertised 8 MB and refused anything over
    one. 4.5 MB is Vercel's own ceiling for a function request body, so this is
    as high as it can usefully go; lib/storage/upload-limits.ts keeps the files
    themselves at 4 MB, leaving room for the multipart overhead.
  */
  experimental: {
    serverActions: {
      bodySizeLimit: '4.5mb',
    },
  },
  images: {
    formats: ['image/avif', 'image/webp'],
    remotePatterns: [
      /*
       * Cloudflare R2 public bucket. Currently the r2.dev development host, which is
       * rate-limited and explicitly not intended for production traffic — swap
       * R2_PUBLIC_HOST for a custom CDN domain before launch.
       */
      {
        protocol: 'https',
        hostname:
          process.env.R2_PUBLIC_HOST?.replace(/^https?:\/\//, '').replace(/\/$/, '') ??
          'cdn.example.com',
      },
    ],
  },
  /**
   * The eight sample products were deleted on 2026-09-15 (see catalog.data.ts).
   *
   * Their URLs were in the sitemap and may be indexed or linked, and a deleted
   * product is a permanent move, not a page that is temporarily away: 301 to the
   * category the product lived in, which is the nearest thing a visitor who
   * followed that link actually wants. Keep these — a redirect that is removed
   * once the link rot is "probably over" is removed on a guess.
   */
  async redirects() {
    const gone: Record<string, string> = {
      'mhrb-powder': 'mimosa-hostilis',
      'mhrb-shredded': 'mimosa-hostilis',
      'amanita-caps-whole-dried': 'amanita',
      'amanita-powder': 'amanita',
      'amanita-gummies-mixed-berry': 'amanita',
      'amanita-gummies-citrus': 'amanita',
      'amanita-capsules': 'amanita',
      'disposable-vape-classic': 'disposable-vapes',
      'disposable-vape-menthol': 'disposable-vapes',
      'disposable-vape-berry': 'disposable-vapes',
      'disposable-vape-citrus': 'disposable-vapes',
    }
    return Object.entries(gone).map(([slug, category]) => ({
      source: `/product/${slug}`,
      destination: `/shop/${category}`,
      permanent: true,
    }))
  },
  async headers() {
    /**
     * Faceted and tracking URLs are marked noindex,follow at the EDGE.
     *
     * `/shop?sort=price-asc` and `/shop` are the same page, and every filter
     * combination is another near-duplicate competing for the same intent. Bing calls
     * this out three times over — consolidate duplicates (§6), use NOINDEX when a URL
     * should not appear (§10), and eliminate crawl waste (§21), which is the one that
     * bites here because crawl budget is allocated on crawl value.
     *
     * The canonical tag already points every one of these at the clean URL, and that
     * remains the primary consolidation signal. This is the second half of the
     * standard pattern: canonical to consolidate, noindex to keep them out of the
     * index, follow so link equity still flows through them.
     *
     * Done as a header rather than in `generateMetadata` deliberately. Reading
     * `searchParams` in metadata opts the whole route out of prerendering, and the
     * static shells are what make this site fast for a crawler — the trade is not
     * worth it. A `has` rule matches the query string without touching how the page
     * renders.
     *
     * NOT robots.txt-disallowed, on purpose: a blocked URL can still be indexed
     * URL-only, and Bing would never see the canonical or the noindex that resolve it.
     */
    const facetParams = [
      'sort', 'price', 'strength', 'form', 'availability', 'page', 'q', 'filter',
      'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
      'fbclid', 'gclid', 'msclkid', 'ref',
    ]

    return [
      ...facetParams.map((key) => ({
        source: '/:path*',
        has: [{ type: 'query' as const, key }],
        headers: [{ key: 'X-Robots-Tag', value: 'noindex, follow' }],
      })),
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(self)' },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
        ],
      },
    ]
  },
}

export default nextConfig
