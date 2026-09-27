'use client'

import { useActionState } from 'react'
import { rewritePostedProduct, type PostedProductState } from '@/app/actions/admin-posted-products'
import { Button } from '@/components/ui/button'
import type { PostedProductValues } from '@/components/admin/posted-product-form'

/**
 * What the automatic writer produced for this product, as a search result would show
 * it, and a button to write the page again (with Claude when it is configured).
 */
export function AutowritePanel({ slug, written, claudeReady }: { slug: string; written: NonNullable<PostedProductValues['written']>; claudeReady: boolean }) {
  const [state, action, pending] = useActionState<PostedProductState, FormData>(rewritePostedProduct, {})
  const who = written.writer === 'claude' ? 'Claude' : written.writer === 'template' ? 'the built-in writer' : null

  return (
    <section className="mb-6 rounded-lg border border-border bg-surface p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-lg text-foreground">Written automatically</h2>
          <p className="mt-1 text-xs text-foreground-muted">
            {who
              ? `By ${who}${written.writtenAt ? `, ${new Date(written.writtenAt).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' })} UTC` : ''}: ${written.sections} sections, ${written.faqs} questions, ${written.sources} sources, ${written.photos} photo descriptions.`
              : 'This product was posted before pages were written automatically. Write it now.'}
          </p>
        </div>
        <form action={action}>
          <input type="hidden" name="slug" value={slug} />
          <Button type="submit" variant="secondary" size="sm" loading={pending}>
            {pending ? 'Writing…' : who ? 'Rewrite automatically' : 'Write the page'}
          </Button>
        </form>
      </div>

      {written.metaTitle ? (
        <div className="mt-4 rounded-md bg-surface-sunken p-3">
          <p className="text-xs text-foreground-subtle">How it can look in a search result</p>
          <p className="mt-1 text-base text-primary">{written.metaTitle}</p>
          <p className="mt-0.5 text-sm text-foreground-muted">{written.metaDescription}</p>
        </div>
      ) : null}

      {state.error ? <p role="alert" className="mt-3 text-sm text-danger-fg">{state.error}</p> : null}
      {state.ok ? <p role="status" className="mt-3 text-sm text-success-fg">{state.ok}</p> : null}
      {!claudeReady ? (
        <p className="mt-3 text-xs text-foreground-muted">Add ANTHROPIC_API_KEY in Vercel to have Claude write richer pages that describe the photos.</p>
      ) : null}
    </section>
  )
}
