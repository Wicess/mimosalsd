import type { Prisma } from '@prisma/client'
import { notify } from '@/lib/notify/ntfy'
import { absoluteUrl } from '@/lib/seo/routes'
import { describeThrown, fingerprintOf, redact } from './fingerprint'

/**
 * ─────────────────────────────────────────────────────────────────────────────
 *  THE ONE PLACE AN ERROR IS REPORTED.
 *
 *  Before this existed, eleven `console.error` calls and eight silent `catch {}`
 *  blocks were the entire error story: a failed order email, a failed ops push and a
 *  crashed render all vanished into a log nobody reads. The specific failure that
 *  matters here is the quiet one — `sendEmail` deliberately swallows a rejection so a
 *  dead mail provider cannot take down checkout, which is correct, and it also meant a
 *  customer could pay and hear nothing while the dashboard looked healthy.
 *
 *  Three things happen on every report, in increasing order of how much they cost:
 *
 *   1. console.error, always. It is what Vercel's log drain reads.
 *   2. A row in ErrorLog, deduplicated by fingerprint and COALESCED in-process.
 *   3. An ntfy push to the alerts topic, throttled per fingerprint.
 *
 *  reportError NEVER throws and NEVER rejects. Everything here is a side effect of
 *  something that already went wrong; a reporter that can fail a request path is a
 *  second bug stacked on the first.
 * ─────────────────────────────────────────────────────────────────────────────
 */

export type ErrorSource =
  | 'render' // a Server Component threw
  | 'route' // a route handler threw
  | 'action' // a Server Action threw
  | 'proxy' // src/proxy.ts threw
  | 'client' // the browser reported it
  | 'mail'
  | 'ntfy'
  | 'db'
  | 'startup'

export type ErrorSeverity = 'FATAL' | 'ERROR' | 'WARN'

export interface ReportMeta {
  readonly source: ErrorSource
  readonly severity?: ErrorSeverity
  /** The route file, e.g. /app/product/[slug]. Part of the fingerprint. */
  readonly routePath?: string
  /** The URL actually requested. Not fingerprinted — it varies per request. */
  readonly requestPath?: string
  readonly method?: string
  readonly digest?: string
  readonly context?: Record<string, unknown>
  /**
   * Suppress the ntfy push for this report. Set it for failures IN the notifier:
   * pushing a "the push failed" alert down the channel that just failed is at best
   * pointless and at worst a loop. Such reports still log and still persist, so they
   * are visible in the admin list — they just do not try to ring a broken bell.
   */
  readonly push?: boolean
}

/**
 * How long one fingerprint stays coalesced in this process before it writes again.
 *
 * A crash loop firing 200 times a second must not become 200 writes a second. Neon
 * bills by how long the database stays awake, so an error storm would bill twice:
 * once for the outage, once for the logging of it. The occurrences are NOT dropped —
 * they accumulate in `pending` and land on the next write as one increment.
 */
const COALESCE_MS = 60_000

/** How often one fingerprint may push to a phone. Enough to notice, not enough to mute. */
const NOTIFY_MS = 15 * 60_000

/** Bounded so a pathological variety of errors cannot leak memory. */
const MAX_TRACKED = 500

interface Tracked {
  pending: number
  lastWriteAt: number
  lastNotifiedAt: number
}

const tracked = new Map<string, Tracked>()

/** Test seam. The coalescing window would otherwise leak state between cases. */
export function resetErrorReporter(): void {
  tracked.clear()
}

function trackerFor(fingerprint: string): Tracked {
  const existing = tracked.get(fingerprint)
  if (existing) return existing

  if (tracked.size >= MAX_TRACKED) {
    // Evict the least recently written. Losing a tracker only costs a coalescing
    // window, never a report.
    let oldestKey: string | undefined
    let oldestAt = Infinity
    for (const [key, value] of tracked) {
      if (value.lastWriteAt < oldestAt) {
        oldestAt = value.lastWriteAt
        oldestKey = key
      }
    }
    if (oldestKey) tracked.delete(oldestKey)
  }

  const fresh: Tracked = { pending: 0, lastWriteAt: 0, lastNotifiedAt: 0 }
  tracked.set(fingerprint, fresh)
  return fresh
}

const SEVERITY_TAGS: Record<ErrorSeverity, readonly string[]> = {
  FATAL: ['rotating_light'],
  ERROR: ['warning'],
  WARN: ['grey_exclamation'],
}

export async function reportError(thrown: unknown, meta: ReportMeta): Promise<void> {
  try {
    const described = describeThrown(thrown)
    const severity = meta.severity ?? 'ERROR'
    const fingerprint = fingerprintOf({
      source: meta.source,
      name: described.name,
      message: described.message,
      routePath: meta.routePath,
    })

    /*
     * Always, and first. If everything below fails, this still reached the log drain.
     *
     * REDACTED, and that is not belt-and-braces. `described` is already clean, but
     * `meta.context` is raw caller-supplied data — and this line goes to Vercel's log
     * drain, which is retained, searchable, and readable by anyone with project
     * access. An unredacted context here would have put a live Brevo key in the logs
     * every time a send failed, which is exactly the case that motivated the context
     * field in the first place.
     */
    console.error(
      `[error:${meta.source}] ${described.name}: ${described.message}`,
      redact(
        JSON.stringify({
          fingerprint,
          severity,
          routePath: meta.routePath,
          requestPath: meta.requestPath,
          digest: meta.digest ?? described.digest,
          ...meta.context,
        }),
      ),
    )

    const now = Date.now()
    const tracker = trackerFor(fingerprint)

    if (now - tracker.lastWriteAt < COALESCE_MS) {
      tracker.pending += 1
      return
    }

    const increment = tracker.pending + 1
    tracker.pending = 0
    tracker.lastWriteAt = now

    const shouldNotify = meta.push !== false && now - tracker.lastNotifiedAt >= NOTIFY_MS
    if (shouldNotify) tracker.lastNotifiedAt = now

    await Promise.allSettled([
      persist({ fingerprint, severity, described, meta, increment }),
      shouldNotify
        ? push({ fingerprint, severity, described, meta, increment })
        : Promise.resolve(),
    ])
  } catch (reporterFailure) {
    // The reporter failing must never surface. Nothing above this call is prepared
    // for it, and the original error has already been logged.
    console.error('[error:reporter-failed]', reporterFailure)
  }
}

interface WriteArgs {
  readonly fingerprint: string
  readonly severity: ErrorSeverity
  readonly described: ReturnType<typeof describeThrown>
  readonly meta: ReportMeta
  readonly increment: number
}

async function persist({
  fingerprint,
  severity,
  described,
  meta,
  increment,
}: WriteArgs): Promise<void> {
  // Imported lazily: the proxy reports from the edge runtime, where the Neon adapter's
  // `ws` dependency does not exist. A static import would break that bundle even
  // though the write is skipped there.
  if (process.env.NEXT_RUNTIME === 'edge') return

  try {
    const { db } = await import('@/lib/db/client')
    const seenAt = new Date()
    // Round-tripped through the redactor so a secret nested anywhere in the context
    // object is stripped, not just one at the top level.
    const context = meta.context
      ? (JSON.parse(redact(JSON.stringify(meta.context))) as Prisma.InputJsonValue)
      : undefined

    await db.errorLog.upsert({
      where: { fingerprint },
      create: {
        fingerprint,
        severity,
        source: meta.source,
        name: described.name,
        message: described.message,
        ...(described.stack ? { stack: described.stack } : {}),
        ...(meta.digest ?? described.digest
          ? { digest: meta.digest ?? described.digest }
          : {}),
        ...(meta.routePath ? { routePath: meta.routePath } : {}),
        ...(meta.requestPath ? { requestPath: meta.requestPath } : {}),
        ...(meta.method ? { method: meta.method } : {}),
        ...(context ? { context } : {}),
        count: increment,
      },
      update: {
        count: { increment },
        lastSeenAt: seenAt,
        severity,
        message: described.message,
        ...(described.stack ? { stack: described.stack } : {}),
        ...(meta.requestPath ? { requestPath: meta.requestPath } : {}),
        // A recurrence re-opens it. An error someone ticked off last week and which is
        // happening again is not resolved, and silently staying resolved is how a
        // known bug becomes an invisible one.
        resolvedAt: null,
        resolvedBy: null,
      },
    })
  } catch (writeFailure) {
    // A database that is itself down is the most likely reason to be here. Reporting
    // that failure through this same function would recurse.
    console.error('[error:persist-failed]', writeFailure)
  }
}

async function push({
  severity,
  described,
  meta,
  increment,
}: WriteArgs): Promise<void> {
  const where = meta.routePath ?? meta.requestPath ?? meta.source
  const repeats = increment > 1 ? ` (x${increment} since last write)` : ''

  await notify({
    topic: 'errors',
    title: `${severity} in ${meta.source} — ${where}`,
    body: `${described.name}: ${described.message}${repeats}`,
    tags: SEVERITY_TAGS[severity],
    clickUrl: absoluteUrl('/admin/errors'),
  })
}
