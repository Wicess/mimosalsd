import { VISITS_PATH, VISITS_TOKEN_HEADER, visitsToken } from './collect-token'
import type { VisitEvent } from './page-view'

/**
 * ─────────────────────────────────────────────────────────────────────────────
 *  THE VISIT BUFFER — in this process, then a batch at a time to our own database.
 *
 *  There is no third-party store here on purpose. Page views collect in memory
 *  and are posted to /api/visits/collect when the batch is big enough or old
 *  enough, so browsing costs one extra request per BATCH rather than a database
 *  write per view. Nothing on the request path waits for it.
 *
 *  ── What this trades away ──────────────────────────────────────────────────
 *  A serverless instance can be recycled at any moment, and whatever is still in
 *  its buffer goes with it. The window is bounded by the two limits below, and a
 *  lost page view costs a line in a report — which is the right thing to risk,
 *  against writing to the database on every single view. Both limits are small
 *  enough that a busy minute never sits unsaved for long.
 *
 *  The buffer is capped. If the endpoint is unreachable the batch is kept and
 *  retried on the next view, but never beyond MAX_HELD events: a buffer that
 *  grows without limit during an outage is how a small problem becomes a
 *  memory one.
 * ─────────────────────────────────────────────────────────────────────────────
 */

/** Post once the batch reaches this many views. */
const BATCH_SIZE = 25
/** …or once the oldest view in it is this old, whichever comes first. */
const MAX_AGE_MS = 60_000
/** Never hold more than this, however long the endpoint stays down. */
const MAX_HELD = 500
/**
 * …and whatever is held is sent this long after it arrives, even if no other view
 * comes along to carry it.
 *
 * Without this the two limits above only fired when ANOTHER request reached the same
 * instance: on a quiet site, across Vercel's many instances, a visitor's views sat in
 * memory waiting for traffic that never came, and were lost when the instance was
 * recycled — every deploy recycles them all. The owner browsed several pages on
 * 2026-09-19 and the log showed one. The owner's rule for exactly this trade: reduce
 * how often data is written, never drop it. So one short wait per instance, handed to
 * `waitUntil` to keep the instance alive, sends every view that arrived in it as one
 * batch: a burst of browsing is still one write.
 */
const SETTLE_MS = 5_000

let held: VisitEvent[] = []
let oldestAt = 0
let sending = false
let settling = false

export function bufferedCount(): number {
  return held.length
}

/** Tests only. */
export function resetBuffer(): void {
  held = []
  oldestAt = 0
  sending = false
  settling = false
  settleWait = wait
}

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))
let settleWait: (ms: number) => Promise<void> = wait

/** Tests only: make the settle wait instant, so a test through `trackVisit` need not sleep. */
export function setSettleWaitForTests(next: (ms: number) => Promise<void>): void {
  settleWait = next
}

function due(now: number): boolean {
  if (held.length === 0 || sending) return false
  return held.length >= BATCH_SIZE || now - oldestAt >= MAX_AGE_MS
}

/**
 * Record one page view. Returns a promise to hand to `waitUntil` when a send is due
 * now or has been scheduled for this view, or null when a send already scheduled on
 * this instance will carry it.
 */
export function record(
  event: VisitEvent,
  origin: string,
  {
    now = Date.now(),
    fetcher = fetch,
    sleep = settleWait,
  }: { now?: number; fetcher?: typeof fetch; sleep?: (ms: number) => Promise<void> } = {},
): Promise<void> | null {
  if (held.length === 0) oldestAt = now
  held.push(event)
  if (held.length > MAX_HELD) held = held.slice(-MAX_HELD)
  if (due(now)) return send(origin, fetcher, now)
  if (settling) return null

  settling = true
  return sleep(SETTLE_MS)
    .then(() => {
      settling = false
      return send(origin, fetcher, now + SETTLE_MS) ?? undefined
    })
    .catch(() => {
      settling = false
    })
}

/** Post everything held, as one batch. Null when there is nothing to send, or a send is already out. */
function send(origin: string, fetcher: typeof fetch, now: number): Promise<void> | null {
  if (held.length === 0 || sending) return null
  const secret = process.env.ADMIN_SESSION_SECRET
  if (!secret) return null

  const batch = held
  held = []
  oldestAt = now
  sending = true

  return fetcher(new URL(VISITS_PATH, origin), {
    method: 'POST',
    headers: { 'content-type': 'application/json', [VISITS_TOKEN_HEADER]: visitsToken(secret) },
    body: JSON.stringify({ events: batch }),
    signal: AbortSignal.timeout(5_000),
    cache: 'no-store',
  })
    .then((response) => {
      // A refusal means these views cannot be stored at all; keeping them would
      // retry the same rejection for as long as the instance lives.
      if (!response.ok && response.status >= 500) throw new Error(`HTTP ${response.status}`)
    })
    .catch(() => {
      // Put them back in front of anything recorded since, and try again later.
      held = [...batch, ...held].slice(-MAX_HELD)
      oldestAt = now
    })
    .finally(() => {
      sending = false
    })
}
