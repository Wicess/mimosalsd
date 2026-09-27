'use client'

import { useReportBoundaryError } from '@/components/errors/report-boundary-error'

/**
 * Last resort.
 *
 * Only reached when the ROOT LAYOUT itself throws — the one failure the storefront and
 * admin boundaries cannot catch, because they render inside it. At that point the app
 * is gone: this file replaces the root layout, so it must ship its own `<html>` and
 * `<body>`, and it gets none of the global stylesheet, no fonts and no theme class.
 *
 * Everything below is therefore inline, with a `prefers-color-scheme` block instead of
 * the app's own theming, exactly as the Next 16 docs require. Nothing here imports a
 * component from the design system: a broken import in the root layout is one of the
 * ways to land here, and a fallback that depends on the thing that just failed is not
 * a fallback.
 *
 * `metadata` cannot be exported from a boundary, so the title is a React `<title>`.
 */
export default function GlobalError({
  error,
  retry,
}: {
  error: Error & { digest?: string }
  retry: () => void
}) {
  useReportBoundaryError(error, 'global')

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: '100dvh',
          display: 'grid',
          placeItems: 'center',
          padding: '24px',
          fontFamily:
            'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
          background: 'var(--bg)',
          color: 'var(--fg)',
        }}
      >
        <title>Something went wrong</title>
        <style>{`
          :root { --bg:#faf9f7; --fg:#1a1a19; --muted:#6b6b66; --line:#e4e2dd; --btn:#1a1a19; --btn-fg:#faf9f7; }
          @media (prefers-color-scheme: dark) {
            :root { --bg:#141413; --fg:#f2f1ee; --muted:#9a9992; --line:#2c2b28; --btn:#f2f1ee; --btn-fg:#141413; }
          }
        `}</style>

        <main style={{ maxWidth: '32rem', textAlign: 'center' }}>
          <p
            style={{
              margin: 0,
              fontSize: '11px',
              letterSpacing: '0.3em',
              textTransform: 'uppercase',
              color: 'var(--muted)',
            }}
          >
            Something went wrong
          </p>
          <h1 style={{ margin: '16px 0 0', fontSize: '28px', fontWeight: 600, lineHeight: 1.2 }}>
            The site failed to load
          </h1>
          <p style={{ margin: '16px 0 0', fontSize: '15px', lineHeight: 1.6, color: 'var(--muted)' }}>
            This is a fault on our end and it has been reported automatically. Trying
            again usually works.
          </p>

          <div
            style={{
              marginTop: '32px',
              display: 'flex',
              gap: '12px',
              justifyContent: 'center',
              flexWrap: 'wrap',
            }}
          >
            <button
              type="button"
              onClick={() => retry()}
              style={{
                minHeight: '44px',
                padding: '0 20px',
                borderRadius: '6px',
                border: 'none',
                background: 'var(--btn)',
                color: 'var(--btn-fg)',
                fontSize: '14px',
                fontWeight: 500,
                cursor: 'pointer',
              }}
            >
              Try again
            </button>
            {/*
              A real <a>, not next/link, and the lint rule is wrong here.

              Reaching this file means the ROOT LAYOUT threw, so the React tree is
              already broken. A client-side Link navigation would keep that same
              broken tree alive and land the customer on another dead screen. A plain
              anchor forces a full document load, which is the only reliable way out.
            */}
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
            <a
              href="/"
              style={{
                minHeight: '44px',
                padding: '0 20px',
                display: 'inline-flex',
                alignItems: 'center',
                borderRadius: '6px',
                border: '1px solid var(--line)',
                color: 'var(--fg)',
                fontSize: '14px',
                fontWeight: 500,
                textDecoration: 'none',
              }}
            >
              Go to the homepage
            </a>
          </div>

          {error.digest ? (
            <p style={{ marginTop: '32px', fontSize: '12px', color: 'var(--muted)' }}>
              Reference <span style={{ fontVariantNumeric: 'tabular-nums' }}>{error.digest}</span>
            </p>
          ) : null}
        </main>
      </body>
    </html>
  )
}
