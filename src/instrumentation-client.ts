/**
 * Client-side error capture.
 *
 * Runs after the document loads and BEFORE React hydration, which is the only window
 * that catches the errors that matter most here: a chunk that failed to download and a
 * hydration mismatch both happen before any component of ours has mounted, so an
 * error boundary cannot see them. On a storefront where organic search is the only
 * acquisition channel, a page that server-renders fine and then dies on the client is
 * the worst possible failure — it looks healthy in every server log while being
 * completely broken for the visitor.
 *
 * Two global listeners cover what boundaries miss:
 *   · `error`               — uncaught exceptions and failed resource loads.
 *   · `unhandledrejection`  — a promise nobody caught, which is most fetch failures.
 *
 * Everything is wrapped, budgeted and deduplicated. Instrumentation that can itself
 * throw, or that floods the network from a render loop, is worse than none.
 */

import { postClientError } from '@/components/errors/report'

/** Distinct errors reported per page load. A loop must not become a network flood. */
const MAX_REPORTS = 8
const seen = new Set<string>()

function send(report: {
  name: string
  message: string
  stack?: string
  boundary: 'window' | 'promise'
}): void {
  try {
    if (!report.message) return

    const key = `${report.name}:${report.message}`
    if (seen.has(key) || seen.size >= MAX_REPORTS) return
    seen.add(key)

    postClientError({
      name: report.name,
      message: report.message,
      ...(report.stack ? { stack: report.stack } : {}),
      boundary: report.boundary,
    })
  } catch {
    // Never let instrumentation break the page it is instrumenting.
  }
}

function describe(value: unknown): { name: string; message: string; stack?: string } {
  if (value instanceof Error) {
    return {
      name: value.name || 'Error',
      message: value.message || String(value),
      ...(value.stack ? { stack: value.stack } : {}),
    }
  }
  return { name: 'UnknownError', message: String(value) }
}

try {
  window.addEventListener('error', (event) => {
    // A failed <img>/<script>/<link> fires `error` on the element with no `error`
    // property. Worth reporting — a dead asset is usually a bad deploy — but it has to
    // be described from the target instead.
    if (!event.error && event.target && event.target !== window) {
      const element = event.target as Partial<HTMLImageElement> & { tagName?: string }
      const url = element.src ?? (element as Partial<HTMLLinkElement>).href
      if (!url) return
      send({
        name: 'ResourceLoadError',
        message: `${element.tagName ?? 'resource'} failed to load: ${url}`,
        boundary: 'window',
      })
      return
    }

    const described = describe(event.error ?? event.message)
    send({ ...described, boundary: 'window' })
    // Capture phase is REQUIRED: a resource `error` event fires on the element and
    // does not bubble, so a listener on the bubble phase never sees a dead image or a
    // chunk that 404'd — which is the single most common symptom of a bad deploy.
  }, true)

  window.addEventListener('unhandledrejection', (event) => {
    const described = describe(event.reason)
    send({ ...described, boundary: 'promise' })
  })
} catch {
  // An environment without addEventListener is not one we can instrument.
}
