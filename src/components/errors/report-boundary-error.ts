'use client'

import { useEffect, useRef } from 'react'
import { postClientError } from './report'

/**
 * Shared reporting hook for every error boundary.
 *
 * THE RULE THAT MATTERS HERE: do not report an error that carries a `digest`.
 *
 * When a Server Component throws, Next hands the boundary a redacted stand-in whose
 * `digest` points at the real error — and `onRequestError` has ALREADY captured that
 * real one, with its true message, stack and route. Reporting again from the browser
 * would file a second row saying "an error occurred in the Server Components render"
 * with no stack, for every server bug, and the admin list would fill with useless
 * duplicates of entries that already exist properly.
 *
 * So a digest means "already known, show the customer the reference". No digest means
 * the error happened in the browser, where the server never saw it, and that one is
 * genuinely ours to report.
 */
export function useReportBoundaryError(
  error: Error & { digest?: string },
  boundary: 'global' | 'site' | 'admin',
): void {
  // React 19 StrictMode double-invokes effects in development. Without this guard the
  // same crash is reported twice on every local reload.
  const reported = useRef<string>('')

  useEffect(() => {
    if (error.digest) return

    const key = `${error.name}:${error.message}`
    if (reported.current === key) return
    reported.current = key

    postClientError({
      name: error.name || 'Error',
      message: error.message || 'Unknown client render error',
      ...(error.stack ? { stack: error.stack } : {}),
      boundary,
    })
  }, [error, boundary])
}
