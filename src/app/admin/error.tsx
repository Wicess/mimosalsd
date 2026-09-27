'use client'

import { useReportBoundaryError } from '@/components/errors/report-boundary-error'

/**
 * Admin error boundary.
 *
 * The inverse of the storefront one. An operator IS the person who fixes this, so
 * hiding the detail from them would just mean opening a terminal to find out what a
 * page already knows. The message and stack are shown in full.
 *
 * That is only safe because the whole `/admin` tree is behind the proxy's session
 * check, so nothing here renders for an unauthenticated visitor.
 */
export default function AdminError({
  error,
  retry,
}: {
  error: Error & { digest?: string }
  retry: () => void
}) {
  useReportBoundaryError(error, 'admin')

  return (
    <div className="mx-auto max-w-3xl px-5 py-12">
      <p className="text-xs font-medium tracking-[0.3em] text-danger-fg uppercase">
        Admin error
      </p>
      <h1 className="mt-3 font-display text-2xl text-foreground">
        This screen failed to render
      </h1>
      <p className="mt-3 text-sm text-foreground-muted">
        It has been logged and pushed to the alerts topic. The detail below is the
        fastest way to work out why.
      </p>

      <dl className="mt-6 space-y-3 rounded-lg border border-border bg-surface-sunken p-4 text-sm">
        <div>
          <dt className="text-xs text-foreground-subtle uppercase">Error</dt>
          <dd className="mt-1 font-medium text-foreground">{error.name}</dd>
        </div>
        <div>
          <dt className="text-xs text-foreground-subtle uppercase">Message</dt>
          <dd className="mt-1 break-words text-foreground-muted">{error.message}</dd>
        </div>
        {error.digest ? (
          <div>
            <dt className="text-xs text-foreground-subtle uppercase">Digest</dt>
            <dd className="tabular mt-1 text-foreground-muted">{error.digest}</dd>
          </div>
        ) : null}
      </dl>

      {/*
        A server error's real stack never reaches the client — it is on the ErrorLog
        row, matched by digest. This is the client stack, when there is one.
      */}
      {error.stack ? (
        <pre className="mt-4 max-h-72 overflow-auto rounded-lg border border-border bg-surface p-4 text-xs leading-relaxed text-foreground-muted">
          {error.stack}
        </pre>
      ) : null}

      <div className="mt-6 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => retry()}
          className="inline-flex min-h-11 items-center justify-center rounded-md bg-primary px-5 text-sm font-medium text-on-primary shadow-sm hover:bg-primary-hover"
        >
          Try again
        </button>
        <a
          href="/admin"
          className="inline-flex min-h-11 items-center justify-center rounded-md border border-border-strong bg-surface px-5 text-sm font-medium text-foreground hover:bg-surface-sunken"
        >
          Back to the dashboard
        </a>
      </div>
    </div>
  )
}
