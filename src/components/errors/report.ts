/**
 * The browser's only route into the error pipeline.
 *
 * This module imports NOTHING from the server. That is the whole point of it existing.
 *
 * The first version had the error boundaries and `instrumentation-client.ts` import a
 * `'use server'` action directly. From a React Client Component that is fine — Next
 * replaces it with an action reference. From `instrumentation-client.ts`, which is a
 * plain script rather than part of the React client graph, it is not: the tracer
 * followed the import through to `report-error.ts` and then to `ntfy.ts`, which is
 * marked `server-only`, and THE PRODUCTION BUILD FAILED with "It should only be used
 * from a Server Component".
 *
 * A plain `fetch` to a route handler has no module graph to follow, so both callers
 * can share one path with no way to reintroduce that.
 */

export interface ClientErrorReport {
  readonly name: string
  readonly message: string
  readonly stack?: string
  readonly digest?: string
  readonly boundary: 'global' | 'site' | 'admin' | 'window' | 'promise'
}

export function postClientError(report: ClientErrorReport): void {
  try {
    if (!report.message) return

    void fetch('/api/client-error', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...report,
        path: window.location.pathname + window.location.search,
      }),
      /*
       * `keepalive` matters more than it looks. A failed navigation or a crash during
       * unload is exactly when an error report is most valuable and most likely to be
       * cancelled — without this the browser drops the request as the page tears down,
       * and the errors that killed the page are the ones that never get reported.
       */
      keepalive: true,
    }).catch(() => {
      // Already visible in the browser console. A failed report must never throw
      // inside an error boundary: that escalates to the boundary above it.
    })
  } catch {
    // Never let instrumentation break the page it is instrumenting.
  }
}
