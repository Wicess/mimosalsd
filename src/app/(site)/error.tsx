'use client'

import { ButtonLink } from '@/components/ui/button'
import { useReportBoundaryError } from '@/components/errors/report-boundary-error'
import { url } from '@/lib/seo/routes'
import { useCompanyEmail } from '@/components/site/company-email'

/**
 * Storefront error boundary.
 *
 * Wraps every customer-facing route. Sits INSIDE the site layout, so the header,
 * footer and cart survive — a customer who hits a broken product page keeps their
 * cart and their way out, rather than being dropped onto a bare error screen.
 *
 * What it deliberately does NOT do is show the error. `error.message` from a Server
 * Component is already redacted by Next, but the message from a CLIENT component is
 * not, and printing it would put internal detail in front of a customer on a site
 * selling age-restricted goods. The digest is shown instead: it is meaningless to a
 * stranger and lets support match a report to the exact row in the admin error log.
 */
export default function SiteError({
  error,
  retry,
}: {
  error: Error & { digest?: string }
  retry: () => void
}) {
  useReportBoundaryError(error, 'site')
  const email = useCompanyEmail()

  return (
    <main className="mx-auto flex min-h-[60vh] max-w-lg flex-col justify-center px-5 py-16 text-center">
      <p className="text-xs font-medium tracking-[0.3em] text-foreground-subtle uppercase">
        Something broke
      </p>
      <h1 className="mt-4 font-display text-3xl text-foreground">
        This page didn&rsquo;t load
      </h1>
      <p className="mt-4 text-sm leading-relaxed text-foreground-muted">
        The fault is ours, not yours, and we have already been told about it. Your cart
        is untouched — nothing you had saved has been lost.
      </p>

      {/*
        Primary action first and reachable with a thumb. `retry()` re-fetches and
        re-renders the segment, so a transient database blip resolves without the
        customer losing their place in the flow.
      */}
      <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
        <button
          type="button"
          onClick={() => retry()}
          className="inline-flex min-h-11 items-center justify-center rounded-md bg-accent px-5 text-sm font-medium text-on-accent shadow-sm hover:bg-accent-hover"
        >
          Try again
        </button>
        <ButtonLink href={url.shop()} variant="secondary">
          Back to the shop
        </ButtonLink>
      </div>

      {error.digest ? (
        <p className="mt-8 text-xs text-foreground-subtle">
          Reference <span className="tabular font-medium">{error.digest}</span> — quote
          this if you contact us at{' '}
          <a className="underline hover:text-foreground-muted" href={`mailto:${email}`}>
            {email}
          </a>
          .
        </p>
      ) : null}
    </main>
  )
}
