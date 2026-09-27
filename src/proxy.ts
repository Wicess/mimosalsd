import { createHmac, timingSafeEqual } from 'node:crypto'
import { NextResponse, type NextFetchEvent, type NextRequest } from 'next/server'
import { ADMIN_NEXT_COOKIE, canAccessAdminPath, firstAllowedAdminPath } from '@/lib/admin/areas'
import { catalog } from '@/lib/catalog/repository'
import { isPostedSlug } from '@/lib/catalog/posted-slugs'
import { isPostedContent, type PostedContentKind } from '@/lib/content/posted-content-slugs'
import { getJurisdictionBySlug } from '@/lib/compliance/jurisdictions'
import { publishedLocations } from '@/lib/locations/locations'
import { getGuide, getPost } from '@/lib/content/content.data'
import { BRAND } from '@/lib/brand'
import { clientIpFrom } from '@/lib/security/client-ip'
import { blocklistExempt, isBlockedIp } from '@/lib/security/blocklist'
import { trackVisit } from '@/lib/visitors/track'

/**
 * ─────────────────────────────────────────────────────────────────────────────
 *  EXISTENCE CHECKS — why these live in the proxy layer
 *
 *  Under Cache Components, a route with a dynamic segment serves a prerendered PPR
 *  shell with HTTP 200 and only then resumes. A `notFound()` inside that resume
 *  therefore returns 200 carrying not-found content — a SOFT 404.
 *
 *  Soft 404s waste crawl budget and Google can flag them, and organic search is this
 *  business's only acquisition channel. The route-segment escapes that would normally
 *  fix it (`dynamicParams = false`, `dynamic = 'force-static'`) are both rejected
 *  under Cache Components.
 *
 *  The proxy runs BEFORE rendering, so it can rewrite to a real 404 with a real
 *  status. The lookups below are all in-memory array scans over small static lists —
 *  no database, no network, no measurable latency.
 *
 *  One exception, and only for a /product/ slug the authored catalogue does not
 *  know: it may be a product posted from the admin panel, which lives in the
 *  database. `postedProductExists` answers that from an in-memory snapshot of a
 *  cached endpoint (lib/catalog/posted-slugs.ts), so it is still never a query.
 * ─────────────────────────────────────────────────────────────────────────────
 */

function segment(pathname: string, index: number): string | undefined {
  return pathname.split('/').filter(Boolean)[index]
}

/**
 * ─────────────────────────────────────────────────────────────────────────────
 *  ADMIN AUTH — and why it lives here rather than in the admin layout
 *
 *  It was in `src/app/admin/layout.tsx` first, and it did not work: every admin page
 *  returned 200 to an unauthenticated request. The layout ran, but its render is
 *  shared and reused across sibling routes, so the redirect branch was not
 *  re-evaluated per request.
 *
 *  This is a documented Next.js caveat rather than a bug — a layout is not a security
 *  boundary. The proxy runs BEFORE rendering on every request, which is the only place
 *  an authorisation decision can be made reliably.
 *
 *  The layout still checks, as defence in depth. This is the check that enforces.
 * ─────────────────────────────────────────────────────────────────────────────
 */
const ADMIN_SESSION_COOKIE = 'admin_session'

interface ProxySession {
  readonly role?: string
  readonly adminAreas?: string[]
  readonly expiresAt?: number
}

function readAdminSession(request: NextRequest): ProxySession | null {
  const secret = process.env.ADMIN_SESSION_SECRET
  if (!secret || secret.length < 32) return null

  const token = request.cookies.get(ADMIN_SESSION_COOKIE)?.value
  if (!token) return null

  const [payload, signature] = token.split('.')
  if (!payload || !signature) return null

  // Verify the signature BEFORE parsing. Parsing attacker-controlled JSON first would
  // mean the signature check guards a decision already made — and the payload now
  // carries the ROLE, so an unverified parse would let a user grant themselves one.
  const expected = createHmac('sha256', secret).update(payload).digest('base64url')
  const a = Buffer.from(signature)
  const b = Buffer.from(expected)
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null

  try {
    const session = JSON.parse(Buffer.from(payload, 'base64url').toString()) as ProxySession
    if (typeof session.expiresAt !== 'number' || Date.now() >= session.expiresAt) return null
    return session
  } catch {
    return null
  }
}

/**
 * Does this path point at something that actually exists?
 *
 * Exported and pure so it can be unit-tested without a request object — the whole
 * point of this layer is correctness, and an untested correctness layer is decoration.
 */
/**
 * The slug of a /product/ path the authored catalogue does not know, which may
 * belong to a posted product. Pure, so the choice of WHICH paths reach the
 * network is testable on its own.
 */
export function postedProductCandidate(pathname: string): string | undefined {
  if (!pathname.startsWith('/product/')) return undefined
  const slug = segment(pathname, 1)
  return slug && !catalog.getProduct(slug) ? slug : undefined
}

async function postedProductExists(pathname: string, origin: string): Promise<boolean> {
  const slug = postedProductCandidate(pathname)
  if (!slug) return false
  // 'unknown' lets the request through: see the failure note in posted-slugs.ts.
  return (await isPostedSlug(slug, origin)) !== false
}

/**
 * A /blog/ or /guides/ path whose slug the authored content does not know, which may
 * be a piece published from the admin panel. Pure, so the choice of which paths
 * reach the network is testable on its own — and authored pages never do.
 */
export function postedContentCandidate(
  pathname: string,
): { kind: PostedContentKind; slug: string } | undefined {
  if (pathname.startsWith('/blog/') && !pathname.startsWith('/blog/category/')) {
    const slug = segment(pathname, 1)
    return slug && !getPost(slug) ? { kind: 'post', slug } : undefined
  }
  if (pathname.startsWith('/guides/')) {
    const slug = segment(pathname, 1)
    return slug && !getGuide(slug) ? { kind: 'guide', slug } : undefined
  }
  return undefined
}

async function postedContentExists(pathname: string, origin: string): Promise<boolean> {
  const candidate = postedContentCandidate(pathname)
  if (!candidate) return false
  // 'unknown' lets the request through, exactly as for posted products.
  return (await isPostedContent(candidate.kind, candidate.slug, origin)) !== false
}

export function routeExists(pathname: string): boolean {
  let exists = true

  if (pathname.startsWith('/lab-results/')) {
    /*
      Batches live in the database now (see catalog/merged.ts), and the edge cannot
      reach Neon. This used to check the in-memory constant, which was emptied when
      the sample batches were deleted — so every real certificate a publisher entered
      would have been 404'd here before its page ever ran.

      So the request goes through and the page answers for itself with notFound().
      Failing open costs at worst a soft 404 for a code that exists nowhere; failing
      closed 404s a real certificate. That is the same trade posted product slugs
      already make.
    */
    exists = true
  } else if (pathname.startsWith('/locations/')) {
    const slug = segment(pathname, 1)
    // Only PUBLISHED locations resolve. An unpublished one is not a real place yet.
    exists = Boolean(slug && publishedLocations().some((l) => l.slug === slug))
  } else if (pathname.startsWith('/legality/')) {
    const slug = segment(pathname, 1)
    exists = Boolean(slug && getJurisdictionBySlug(slug))
  } else if (pathname.startsWith('/product/')) {
    const slug = segment(pathname, 1)
    exists = Boolean(slug && catalog.getProduct(slug))
  } else if (pathname.startsWith('/shop/')) {
    const slug = segment(pathname, 1)
    exists = Boolean(slug && catalog.getCategory(slug))
  } else if (pathname.startsWith('/blog/') && !pathname.startsWith('/blog/category/')) {
    const slug = segment(pathname, 1)
    exists = Boolean(slug && getPost(slug))
  } else if (pathname.startsWith('/guides/')) {
    const slug = segment(pathname, 1)
    exists = Boolean(slug && getGuide(slug))
  }

  return exists
}

/**
 * ─────────────────────────────────────────────────────────────────────────────
 *  CONTENT SECURITY POLICY — and an honest note about its limits
 *
 *  `script-src 'self' 'unsafe-inline'`. That is weaker than we would like, and it is
 *  a deliberate, recorded trade rather than an oversight. Two stronger policies were
 *  built and measured first:
 *
 *   1. nonce + 'strict-dynamic' — broke the entire site. 'strict-dynamic' causes
 *      'self' to be ignored, and under Partial Prerendering a per-request nonce cannot
 *      be baked into HTML rendered at build time. Verified: 1 of 13 script tags
 *      received a nonce; every chunk was refused.
 *   2. `script-src 'self'` alone — chunks loaded, but Next's App Router emits inline
 *      scripts to stream the RSC payload. Those are required for hydration and were
 *      all blocked.
 *
 *  Hashes are not viable either: the inline payload differs per page and per build.
 *
 *  THE TRADE. Organic search is this business's only acquisition channel, so PPR's
 *  static shells are close to existential. The XSS surface here is genuinely small —
 *  there is no user-generated HTML anywhere; reviews are moderated and rendered as
 *  text, never as markup. Given that, keeping PPR and accepting 'unsafe-inline' for
 *  scripts is the better risk position than the reverse.
 *
 *  What this policy still buys, and it is not nothing:
 *   · script cannot be loaded from any origin but our own
 *   · `object-src 'none'` — no plugin-based execution
 *   · `base-uri 'self'` — a base-tag injection cannot redirect every relative URL
 *   · `frame-ancestors 'none'` — no clickjacking
 *   · `form-action 'self'` — a form cannot be made to POST addresses and age
 *     attestations to someone else's server
 *
 *  Those last two matter specifically here, because this site collects exactly the
 *  data those attacks target.
 *
 *  Revisit if Next ships nonce support that survives prerendering.
 * ─────────────────────────────────────────────────────────────────────────────
 */
function buildCsp(): string {
  const dev = process.env.NODE_ENV !== 'production'
  return [
    "default-src 'self'",
    // See the note above: 'unsafe-inline' is required by App Router's RSC streaming
    // and cannot be replaced by a nonce while PPR is enabled.
    `script-src 'self' 'unsafe-inline'${dev ? " 'unsafe-eval'" : ''}`,
    // Tailwind and next/font emit inline styles, and there is no nonce path for them
    // under PPR either.
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    'upgrade-insecure-requests',
  ].join('; ')
}

/**
 * What a blocked address gets: a plain 403 with a way to reach a person, since an
 * address is shared by everyone behind it and the block may have caught someone
 * it was not meant for. No reason is given — it would only help an abuser adjust.
 */
function blockedResponse(pathname: string): NextResponse {
  const headers = { 'cache-control': 'no-store', 'x-robots-tag': 'noindex' }
  if (pathname.startsWith('/api/')) {
    return NextResponse.json(
      { error: 'Requests from this network are not being accepted.' },
      { status: 403, headers },
    )
  }
  // The default address: the admin-set one lives in the database, which the proxy does not read.
  const support = BRAND.email
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light dark"><meta name="robots" content="noindex"><title>Access restricted</title></head><body style="font:16px/1.6 system-ui,sans-serif;max-width:32rem;margin:15vh auto 0;padding:0 1.25rem"><h1 style="font-size:1.5rem">Access restricted</h1><p>This site isn’t accepting requests from your network right now.</p><p>If you think that’s a mistake, email <a href="mailto:${support}">${support}</a> and tell us roughly when it happened.</p></body></html>`
  return new NextResponse(html, {
    status: 403,
    headers: {
      ...headers,
      'content-type': 'text/html; charset=utf-8',
      'content-security-policy': "default-src 'none'; style-src 'unsafe-inline'",
    },
  })
}

export async function proxy(request: NextRequest, event?: NextFetchEvent): Promise<NextResponse> {
  const { pathname } = request.nextUrl

  /*
   * Blocked addresses before anything else (lib/security/blocklist.ts). Only when
   * the admin is configured: without the session secret nobody can have blocked
   * anyone, and the endpoint could not answer. 'unknown' lets the request through.
   */
  if (process.env.ADMIN_SESSION_SECRET && !blocklistExempt(pathname)) {
    const ip = clientIpFrom(request.headers)
    if (ip && (await isBlockedIp(ip, request.nextUrl.origin)) === true) {
      return blockedResponse(pathname)
    }
  }

  /*
   * Authorisation first — authentication AND the area check, before anything else.
   *
   * The area check lives here, not in the admin layout. It was in the layout first and
   * it did not enforce: a STAFF user granted only "orders" still received 200 on
   * /admin/team and every other page. A layout render is shared across sibling routes,
   * so its redirect branch is not re-evaluated per request. That is the same failure
   * as the authentication check in Step 18, and the same fix.
   *
   * This is why role and granted areas are carried in the signed cookie: the proxy
   * cannot query the database, and the proxy is the only place this reliably runs.
   */
  if (pathname.startsWith('/admin') && pathname !== '/admin/login') {
    const session = readAdminSession(request)
    if (!session) {
      const toLogin = NextResponse.redirect(new URL('/admin/login', request.url))
      /*
        Remember where they were going, so signing in lands there. A page view only:
        a stale API call or a background fetch must not become the destination.
        Validated again, against the signed-in role, before sign-in follows it.
      */
      if (request.method === 'GET' && !pathname.startsWith('/admin/api')) {
        toLogin.cookies.set(ADMIN_NEXT_COOKIE, `${pathname}${request.nextUrl.search}`, {
          httpOnly: true,
          sameSite: 'lax',
          secure: process.env.NODE_ENV === 'production',
          path: '/',
          maxAge: 10 * 60,
        })
      }
      return toLogin
    }
    if (!canAccessAdminPath(session.role, session.adminAreas ?? [], pathname)) {
      const fallback = firstAllowedAdminPath(session.role, session.adminAreas ?? [])
      return NextResponse.redirect(
        new URL(fallback === pathname ? '/' : fallback, request.url),
      )
    }
  }

  // An authenticated operator hitting the sign-in page goes where they can actually go.
  if (pathname === '/admin/login') {
    const session = readAdminSession(request)
    if (session) {
      return NextResponse.redirect(
        new URL(firstAllowedAdminPath(session.role, session.adminAreas ?? []), request.url),
      )
    }
  }

  if (
    !routeExists(request.nextUrl.pathname) &&
    !(await postedProductExists(request.nextUrl.pathname, request.nextUrl.origin)) &&
    !(await postedContentExists(request.nextUrl.pathname, request.nextUrl.origin))
  ) {
    // A rewrite to the not-found route returns the correct 404 status, unlike a
    // notFound() call that happens after the shell has already been flushed.
    return NextResponse.rewrite(new URL('/_not-found', request.url), { status: 404 })
  }

  const csp = buildCsp()

  const headers = new Headers(request.headers)
  // Next does not expose the pathname to layouts. The admin layout needs it to know
  // whether it is rendering the sign-in page (which must not redirect to itself).
  headers.set('x-pathname', pathname)

  const response = NextResponse.next({ request: { headers } })
  response.headers.set('content-security-policy', csp)

  // Last, so a redirect, a refusal and the 404s rewritten above are never counted.
  // It cannot be the whole story: routeExists only narrows the prefixes it knows,
  // so a path like /wp-admin/install.php reaches here and Next serves the 404
  // afterwards. The counter keeps its own list of route roots for that reason —
  // see PAGE_ROOTS in lib/visitors/page-view.ts. Batched in memory, stored a
  // batch at a time.
  trackVisit(request, response, event ? (promise) => event.waitUntil(promise) : undefined)
  return response
}

/**
 * Matches every document request.
 *
 * The existence checks only care about a handful of prefixes, but the CSP has to be on
 * every response — a policy with holes is not a policy. Static assets and image
 * optimisation are excluded because they are not documents and cannot execute script.
 *
 * That last sentence was true of `_next/*` and false of everything in `public/`. The
 * logo, the sample photography and the payment marks all matched this proxy, so a
 * request for `/brand/logo.png` ran an HMAC session verify and seven prefix comparisons
 * in order to attach a Content-Security-Policy to a PNG — which governs nothing, because
 * a PNG has no script to govern. Vercel bills proxy invocations, and the logo is in the
 * header, the footer, the home hero and the admin sidebar, which made it the single
 * most-requested path on the site. The extension list closes that gap; it is the same
 * intent the paragraph above already claimed.
 */
export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|icon.svg|robots.txt|sitemap.xml|llms.txt|.*\\.(?:png|jpe?g|gif|webp|avif|svg|ico|woff2?|ttf|otf|mp4|webm|webmanifest|js|mjs|css|map|json|txt|xml|pdf|zip|mp3)$).*)',
  ],
}
