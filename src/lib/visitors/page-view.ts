import { isVisitorId } from './cookie'
import { crawlerName, looksAutomated, parseUserAgent, type Device } from './user-agent'

/**
 * ─────────────────────────────────────────────────────────────────────────────
 *  ONE PAGE VIEW, AS THE PROXY RECORDS IT.
 *
 *  Each real page view becomes one small JSON event, batched in memory by the
 *  proxy and stored a batch at a time (lib/visitors/buffer.ts), so browsing costs
 *  no database write of its own. The nightly filing (lib/visitors/flush) turns a
 *  finished day into visitor rows and a daily summary.
 *
 *  What is in an event, and what is deliberately not:
 *   - a random visitor id (the cookie), never an IP address;
 *   - the path, with the one secret-bearing route masked (/order/<token>);
 *   - the referring SITE, not the page, and only when it is another site;
 *   - campaign tags from the landing URL, nothing else from the query string,
 *     which can carry anything a link-builder chose to put there;
 *   - coarse location from the host's geo headers, coarse device from the
 *     user-agent — and not the user-agent itself.
 *
 *  Pure, so what is recorded can be tested without a request or a database.
 * ─────────────────────────────────────────────────────────────────────────────
 */

export interface VisitEvent {
  /** Visitor id, or "crawler" for a crawler that names itself (no cookie, no record). */
  readonly v: string
  /** Epoch milliseconds. */
  readonly t: number
  /** Path, masked where it carries a secret. */
  readonly p: string
  /** External referring host. */
  readonly r?: string
  readonly us?: string
  readonly um?: string
  readonly uc?: string
  /** Country, region (subdivision), city — from the host's geo headers. */
  readonly c?: string
  readonly g?: string
  readonly ci?: string
  /**
   * Postal (ZIP) code, latitude, longitude and IANA time zone — the rest of what the
   * host's IP lookup gives. As exact as locating by IP gets: about a city or a ZIP
   * code, never a street. The IP address itself is not recorded.
   */
  readonly z?: string
  readonly la?: number
  readonly lo?: number
  readonly tz?: string
  readonly d: Device
  readonly b: string
  readonly o: string
  /** The crawler's name, when it named itself. */
  readonly k?: string
  /** Looks automated without saying so. */
  readonly a?: 1
  /** First request from this browser: the cookie was minted for it. */
  readonly n?: 1
}

export const CRAWLER_VISITOR = 'crawler'

/*
  A file, not a page. A browser says which it asked for in `sec-fetch-dest`, but
  crawlers and older clients send no fetch metadata at all, and those are exactly
  the requests counted on trust below. Without this, a crawler pulling /sw.js or
  a lab report PDF would be filed as somebody reading a page.
*/
const FILE = /\.(?:js|mjs|css|map|json|webmanifest|xml|txt|ico|png|jpe?g|gif|webp|avif|svg|bmp|pdf|zip|mp4|webm|mp3|woff2?|ttf|otf|eot)$/i

/*
  The first segment of every path this site serves a page at.

  The proxy rewrites an unknown path to a 404 before it can be counted, but only
  for the prefixes it narrows: /legality/nowhere is caught, /wp-admin/install.php
  is not, because nothing tells the proxy that no route begins with "wp-admin".
  Next serves the right 404 either way — but the proxy had already counted it, so
  the vulnerability scanners that probe /wp-admin, /.env and /xmlrpc.php around
  the clock were filed as people reading pages. Two were, on the first day.

  Kept in step with src/app by tests/visitors/page-roots.test.ts, so a new route
  cannot be added without this list being told about it.
*/
export const PAGE_ROOTS: ReadonlySet<string> = new Set([
  'about',
  'account',
  'blog',
  'bulk',
  'cart',
  'checkout',
  'contact',
  'design-system',
  'faq',
  'guides',
  'lab-results',
  'legal-disclaimer',
  'where-we-ship',
  'locations',
  'offline',
  'order',
  'policies',
  'product',
  'shop',
  'shop-near-me',
  'unsubscribe',
])

/**
 * Is this request a page a person is looking at?
 *
 * A full document load, or a client-side navigation — which in the App Router is
 * an RSC request for the page, not a document. Never a prefetch: the router and
 * the browser both fetch pages nobody opens, and counting them would inflate
 * every figure by however many links happened to be on screen.
 */
export function isCountablePageView(
  method: string,
  pathname: string,
  headers: Pick<Headers, 'get'>,
): boolean {
  if (method !== 'GET') return false
  if (pathname === '/admin' || pathname.startsWith('/admin/')) return false
  if (pathname.startsWith('/api/') || pathname.startsWith('/_next/')) return false
  // A tracking link only redirects; the page it lands on is the view.
  if (pathname.startsWith('/r/')) return false
  if (FILE.test(pathname)) return false
  // The homepage is the empty first segment; everything else must be a real route.
  const root = pathname.split('/')[1] ?? ''
  if (root !== '' && !PAGE_ROOTS.has(root)) return false

  if (headers.get('next-router-prefetch') || headers.get('next-router-segment-prefetch')) return false
  if (headers.get('next-hmr-refresh')) return false
  const purpose = [headers.get('sec-purpose'), headers.get('purpose'), headers.get('x-purpose')]
    .join(' ')
    .toLowerCase()
  if (purpose.includes('prefetch') || purpose.includes('preview')) return false

  if (headers.get('rsc') === '1') return true
  /*
    A navigation the site's own service worker forwards (public/sw.js, network-first
    for pages) reaches us as `sec-fetch-dest: empty`, not `document`, but keeps
    `sec-fetch-mode: navigate`. Only a real navigation can carry that mode, and every
    prefetch was refused above. Without this, once the worker installed on a first
    visit, every page after it went uncounted: the Visitors page showed one view per
    visitor (owner, 2026-09-19).
  */
  if (headers.get('sec-fetch-mode') === 'navigate') return true
  const destination = headers.get('sec-fetch-dest')
  return destination === null || destination === 'document'
}

/**
 * The path as recorded. /order/<token> is a bearer link to someone's order: it
 * is recorded as the route, never the token, or anyone who can read the visitor
 * log could open any customer's order page.
 */
export function trackedPath(pathname: string): string {
  if (pathname === '/order' || pathname.startsWith('/order/')) return '/order/[token]'
  const trimmed = pathname.length > 1 && pathname.endsWith('/') ? pathname.slice(0, -1) : pathname
  return trimmed.slice(0, 200)
}

const clip = (value: string | null | undefined, max: number): string | undefined => {
  const trimmed = value?.trim()
  return trimmed ? trimmed.slice(0, max) : undefined
}

/** The referring site's host when it is not this site, else undefined. */
export function externalReferrer(referer: string | null, ownHost: string): string | undefined {
  if (!referer) return undefined
  try {
    const host = new URL(referer).hostname.toLowerCase().replace(/^www\./, '')
    const own = ownHost.toLowerCase().split(':')[0]!.replace(/^www\./, '')
    return host && host !== own ? host.slice(0, 100) : undefined
  } catch {
    return undefined
  }
}

function decodeCity(raw: string | null): string | undefined {
  if (!raw) return undefined
  try {
    return clip(decodeURIComponent(raw), 80)
  } catch {
    return clip(raw, 80)
  }
}

/** A latitude or longitude from a header, or undefined when it is not a real one. */
function coordinate(raw: string | null, limit: number): number | undefined {
  if (!raw) return undefined
  const value = Number(raw)
  return Number.isFinite(value) && Math.abs(value) <= limit ? Math.round(value * 10_000) / 10_000 : undefined
}

export function buildVisitEvent(input: {
  visitorId: string
  minted: boolean
  now: number
  pathname: string
  search: URLSearchParams
  host: string
  headers: Pick<Headers, 'get'>
}): VisitEvent {
  const { headers } = input
  const userAgent = headers.get('user-agent')
  const crawler = crawlerName(userAgent)
  const client = parseUserAgent(userAgent)
  const referrer = externalReferrer(headers.get('referer'), input.host)

  const event: Record<string, unknown> = {
    v: crawler ? CRAWLER_VISITOR : input.visitorId,
    t: input.now,
    p: trackedPath(input.pathname),
    r: referrer,
    us: clip(input.search.get('utm_source'), 100),
    um: clip(input.search.get('utm_medium'), 100),
    uc: clip(input.search.get('utm_campaign'), 100),
    c: clip(headers.get('x-vercel-ip-country'), 2)?.toUpperCase(),
    g: clip(headers.get('x-vercel-ip-country-region'), 8)?.toUpperCase(),
    ci: decodeCity(headers.get('x-vercel-ip-city')),
    z: clip(decodeCity(headers.get('x-vercel-ip-postal-code')), 12),
    la: coordinate(headers.get('x-vercel-ip-latitude'), 90),
    lo: coordinate(headers.get('x-vercel-ip-longitude'), 180),
    tz: clip(headers.get('x-vercel-ip-timezone'), 64),
    d: client.device,
    b: client.browser,
    o: client.os,
    k: crawler ?? undefined,
    a: !crawler && looksAutomated(client, referrer ?? null) ? 1 : undefined,
    n: !crawler && input.minted ? 1 : undefined,
  }
  // Absent rather than undefined, so the stored JSON stays small.
  for (const key of Object.keys(event)) if (event[key] === undefined) delete event[key]
  return event as unknown as VisitEvent
}

const DEVICES = new Set(['mobile', 'tablet', 'desktop'])

/** An event read back from the buffer, or null if it is not one. */
export function parseVisitEvent(raw: unknown): VisitEvent | null {
  if (typeof raw !== 'string') return null
  let value: unknown
  try {
    value = JSON.parse(raw)
  } catch {
    return null
  }
  if (!value || typeof value !== 'object') return null
  const e = value as Record<string, unknown>
  if (typeof e.v !== 'string' || (e.v !== CRAWLER_VISITOR && !isVisitorId(e.v))) return null
  if (typeof e.t !== 'number' || !Number.isFinite(e.t)) return null
  if (typeof e.p !== 'string' || !e.p.startsWith('/')) return null
  if (typeof e.d !== 'string' || !DEVICES.has(e.d)) return null
  if (typeof e.b !== 'string' || typeof e.o !== 'string') return null
  // Location extras are optional: a malformed one is dropped, never the whole view.
  if (e.z !== undefined && typeof e.z !== 'string') delete e.z
  if (e.tz !== undefined && typeof e.tz !== 'string') delete e.tz
  if (e.la !== undefined && !(typeof e.la === 'number' && Math.abs(e.la) <= 90)) delete e.la
  if (e.lo !== undefined && !(typeof e.lo === 'number' && Math.abs(e.lo) <= 180)) delete e.lo
  return e as unknown as VisitEvent
}
