/**
 * ─────────────────────────────────────────────────────────────────────────────
 *  AN IN-MEMORY SNAPSHOT OF SLUGS THAT LIVE ONLY IN THE DATABASE.
 *
 *  Extracted, unchanged in behaviour, from lib/catalog/posted-slugs.ts so that
 *  posted products and admin-published posts and guides share ONE implementation of
 *  it. The timing, the single-flight refresh and the failure handling below were
 *  worked out carefully once; a second copy would be a second chance to get a
 *  subtle cache bug wrong, in the code that decides whether a real page 404s.
 *
 *  ── How fresh ──────────────────────────────────────────────────────────────
 *  A snapshot answers for 60 seconds. A key NOT in it is rechecked once the
 *  snapshot is 10 seconds old, so something published a moment ago stops returning
 *  404 almost at once, while a stream of made-up slugs costs at most one refresh
 *  per 10 seconds per instance.
 *
 *  ── When it cannot tell ────────────────────────────────────────────────────
 *  It says so ('unknown'), and the caller lets the request through to the page,
 *  which answers for itself. Failing open costs, at worst, a soft 404 for a slug
 *  that exists nowhere. Failing closed would 404 a real page.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const FRESH_MS = 60_000
const MISS_RECHECK_MS = 10_000
const RETRY_AFTER_FAILURE_MS = 10_000
const TIMEOUT_MS = 1_500

export type Fetcher = (input: URL, init?: RequestInit) => Promise<Response>

export interface SlugSnapshot {
  has(
    key: string,
    origin: string,
    options?: { now?: number; fetcher?: Fetcher },
  ): Promise<boolean | 'unknown'>
  /** Tests only. */
  reset(): void
}

/**
 * @param path  The endpoint that returns the keys, served from the data cache so a
 *              refresh costs a request and never a database query.
 * @param read  Turns the endpoint's JSON into the set of keys, or null when the body
 *              is not what was expected — which is treated exactly like a failed fetch.
 * @param missRecheckMs  How old the snapshot must be before a key NOT in it triggers
 *              a refresh. The 10-second default suits slugs, where a miss is rare
 *              and may be something published a moment ago. It is wrong for a
 *              blocklist, where nearly every lookup is a miss: it would refetch every
 *              ten seconds under ordinary traffic. Pass the full freshness there.
 * @param headers  Extra request headers for the fetch — the blocklist endpoint wants
 *              proof the request is the proxy's own.
 */
export function createSlugSnapshot({
  path,
  read,
  missRecheckMs = MISS_RECHECK_MS,
  headers,
}: {
  path: string
  read: (body: unknown) => ReadonlySet<string> | null
  missRecheckMs?: number
  headers?: () => Record<string, string>
}): SlugSnapshot {
  let snapshot: { keys: ReadonlySet<string>; at: number } | undefined
  let lastFailureAt = Number.NEGATIVE_INFINITY
  let inflight: Promise<void> | undefined

  async function load(origin: string, fetcher: Fetcher, now: number): Promise<void> {
    try {
      const response = await fetcher(new URL(path, origin), {
        headers: { accept: 'application/json', ...headers?.() },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      })
      const keys = response.ok ? read(await response.json()) : null
      if (!keys) throw new Error(`${path}: HTTP ${response.status}`)
      snapshot = { keys, at: now }
    } catch {
      // Keep the previous snapshot, if there is one.
      lastFailureAt = now
    }
  }

  async function refresh(origin: string, fetcher: Fetcher, now: number): Promise<void> {
    // Concurrent requests share one refresh. Cleared by identity once it settles,
    // so a load that fails synchronously cannot leave a finished promise parked
    // here and stop every later refresh.
    if (!inflight) {
      const run = load(origin, fetcher, now)
      inflight = run
      void run.finally(() => {
        if (inflight === run) inflight = undefined
      })
    }
    await inflight
  }

  return {
    async has(key, origin, { now = Date.now(), fetcher = fetch as Fetcher } = {}) {
      if (snapshot) {
        const age = now - snapshot.at
        const known = snapshot.keys.has(key)
        if (age < FRESH_MS && (known || age < missRecheckMs)) return known
      }

      // Due a refresh, unless one failed moments ago. Retrying on every request while
      // the endpoint is down would put a timeout in front of each of them.
      if (now - lastFailureAt >= RETRY_AFTER_FAILURE_MS) await refresh(origin, fetcher, now)

      return snapshot ? snapshot.keys.has(key) : 'unknown'
    },
    reset() {
      snapshot = undefined
      lastFailureAt = Number.NEGATIVE_INFINITY
      inflight = undefined
    },
  }
}

/** A string array from an unknown JSON value, or null if it is not one. */
export function stringArray(value: unknown): string[] | null {
  return Array.isArray(value) ? value.filter((s): s is string => typeof s === 'string') : null
}
