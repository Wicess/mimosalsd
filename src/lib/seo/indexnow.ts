import 'server-only'
import { absoluteUrl } from '@/lib/seo/routes'

/**
 * ─────────────────────────────────────────────────────────────────────────────
 *  IndexNow.
 *
 *  Bing's guidelines reference it in four separate places — discovery (§2),
 *  notification on change (§4), clean removal (§9) and freshness (§19) — because it
 *  is the only mechanism that tells Bing a URL changed rather than waiting to be
 *  re-crawled. For this site that matters more than usual: the legality pages carry a
 *  legal position and a review date, and a stale answer in Copilot is not a missed
 *  click, it is a wrong statement about the law with our name on it.
 *
 *  Bing prefers STREAMING submissions — one URL as it changes — over batches, so
 *  `submitUrl` is the primary entry point and the batch form exists only for a
 *  deliberate full resubmit.
 *
 *  KEY OWNERSHIP. IndexNow verifies that you control the host by fetching a text file
 *  whose body is the key. The protocol lets the submission declare where that file
 *  lives, so it is served from one fixed path — `/indexnow-key.txt` — by
 *  `src/app/indexnow-key.txt/route.ts`, reading the same env var used to sign
 *  submissions. The two therefore cannot drift apart, which is the single most common
 *  reason submissions are silently rejected with a bare 403.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const ENDPOINT = 'https://api.indexnow.org/IndexNow'

/** Must match the route that serves the key file. */
export const KEY_PATH = '/indexnow-key.txt'

/** Bing rejects a batch over 10,000 URLs outright. */
const MAX_BATCH = 10_000

export type IndexNowOutcome =
  | { readonly ok: true; readonly status: number; readonly submitted: number }
  | { readonly ok: false; readonly reason: string; readonly status?: number }

export function indexNowKey(): string | undefined {
  const key = process.env.INDEXNOW_KEY?.trim()
  return key && key.length > 0 ? key : undefined
}

/**
 * A key must be 8–128 hexadecimal characters. Validated rather than trusted, because
 * a malformed key produces a 422 that is easy to mistake for "IndexNow is not
 * working" when the real problem is one bad character in an env var.
 */
export function isValidKey(key: string): boolean {
  return /^[a-f0-9]{8,128}$/i.test(key)
}

function hostOf(url: string): string {
  return new URL(url).host
}

/**
 * Submit one URL. This is the form to reach for.
 *
 * Never throws. A search-engine ping is not worth failing an admin action or an order
 * transition over, so every failure is returned as a value for the caller to log.
 */
export async function submitUrl(path: string): Promise<IndexNowOutcome> {
  return submitUrls([path])
}

export async function submitUrls(paths: readonly string[]): Promise<IndexNowOutcome> {
  const key = indexNowKey()
  if (!key) return { ok: false, reason: 'INDEXNOW_KEY is not set' }
  if (!isValidKey(key)) return { ok: false, reason: 'INDEXNOW_KEY is not 8–128 hex characters' }
  if (paths.length === 0) return { ok: false, reason: 'no URLs given' }
  if (paths.length > MAX_BATCH) {
    return { ok: false, reason: `batch of ${paths.length} exceeds the ${MAX_BATCH} limit` }
  }

  const urlList = paths.map((p) => (p.startsWith('http') ? p : absoluteUrl(p)))
  const host = hostOf(urlList[0]!)

  /*
   * Submitting localhost is not an error worth reporting to a developer on every
   * save — it is simply not a thing IndexNow can accept. Bail quietly so `npm run
   * dev` does not fill the console with failures.
   */
  if (host === 'localhost' || host.startsWith('localhost:') || host === '127.0.0.1') {
    return { ok: false, reason: 'refusing to submit a localhost URL' }
  }

  /* Every URL in one submission must share the host the key file is served from. */
  const foreign = urlList.filter((u) => hostOf(u) !== host)
  if (foreign.length > 0) {
    return { ok: false, reason: `URLs span more than one host: ${foreign[0]}` }
  }

  try {
    const response = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({
        host,
        key,
        keyLocation: absoluteUrl(KEY_PATH),
        urlList,
      }),
      // A search ping must never hold a request open. Bing answers in well under this.
      signal: AbortSignal.timeout(8_000),
    })

    if (!response.ok) {
      return { ok: false, status: response.status, reason: describeStatus(response.status) }
    }
    return { ok: true, status: response.status, submitted: urlList.length }
  } catch (error) {
    return {
      ok: false,
      reason: error instanceof Error ? error.message : 'network error',
    }
  }
}

/** Bing's documented status codes, translated into something actionable. */
function describeStatus(status: number): string {
  switch (status) {
    case 400: return 'Bad request — the URL list or host was malformed'
    case 403: return 'Key rejected — the key file is missing or does not match INDEXNOW_KEY'
    case 422: return 'URL does not belong to the host, or the key format is invalid'
    case 429: return 'Rate limited — too many submissions, likely batching too often'
    default: return `unexpected status ${status}`
  }
}
