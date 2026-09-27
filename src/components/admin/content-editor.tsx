'use client'

import { useActionState, useState } from 'react'
import { saveContent, type ContentEditState } from '@/app/actions/admin-content'
import { Button } from '@/components/ui/button'
import { countWords, LIMITS, POST_CATEGORIES, type ContentKind } from '@/lib/content/posted-content'
import { Select as SiteSelect } from '@/components/ui/select'

const INITIAL: ContentEditState = {}

const field =
  'mt-1 min-h-11 w-full rounded-md border border-border-strong bg-surface px-3 py-2 text-sm text-foreground'

export interface ContentOptions {
  readonly products: readonly { slug: string; name: string }[]
  readonly guides: readonly { slug: string; title: string }[]
  readonly posts: readonly { slug: string; title: string }[]
  readonly authors: readonly { slug: string; name: string }[]
}

export interface ContentInitial {
  readonly id: string
  readonly slug: string
  readonly title: string
  readonly summary: string
  readonly body: string
  readonly category: string | null
  readonly authorSlug: string
  readonly recommendedProductSlugs: readonly string[]
  readonly pillarSlug: string | null
  readonly clusterSlugs: readonly string[]
  readonly metaTitle: string | null
  readonly metaDesc: string | null
  readonly heroImageKey: string | null
  /** The public URL of the current article image, for the preview. */
  readonly heroImageUrl?: string | null
}

/**
 * ─────────────────────────────────────────────────────────────────────────────
 *  POST AND GUIDE EDITOR.
 *
 *  Every rule is enforced by the save action; the counters here only save an
 *  operator from submitting a form the server will hand back. The summary counter
 *  exists because the 40–60 word answer-first block is the single passage most
 *  likely to be quoted by an answer engine, and it is easy to miss by writing one
 *  good sentence too many.
 *
 *  The slug is shown but not editable once a piece exists: a published address is
 *  inbound links and ranking history, and the action keeps the original regardless.
 * ─────────────────────────────────────────────────────────────────────────────
 */
export function ContentEditor({
  kind,
  options,
  initial,
}: {
  kind: ContentKind
  options: ContentOptions
  initial?: ContentInitial
}) {
  const [state, formAction, pending] = useActionState(saveContent, INITIAL)
  const [summary, setSummary] = useState(initial?.summary ?? '')
  const [body, setBody] = useState(initial?.body ?? '')

  const summaryWords = countWords(summary)
  const summaryOk =
    summaryWords >= LIMITS.summaryWords.min && summaryWords <= LIMITS.summaryWords.max
  const bodyWords = countWords(body)

  return (
    <form action={formAction} className="space-y-5">
      <input type="hidden" name="kind" value={kind} />
      {initial && <input type="hidden" name="id" value={initial.id} />}

      <div>
        <label htmlFor="title" className="text-sm text-foreground">Title</label>
        <input id="title" name="title" required defaultValue={initial?.title} className={field} />
      </div>

      <div>
        <label htmlFor="slug" className="text-sm text-foreground">
          Address <span className="text-foreground-muted">— /{kind === 'post' ? 'blog' : 'guides'}/…</span>
        </label>
        {initial ? (
          <p className="mt-1 text-sm text-foreground-muted">
            <span className="tabular">{initial.slug}</span> — fixed once created, so links to it keep working.
          </p>
        ) : (
          <input
            id="slug"
            name="slug"
            placeholder="Leave blank to make one from the title"
            className={field}
          />
        )}
      </div>

      <div>
        <label htmlFor="summary" className="text-sm text-foreground">Summary</label>
        <textarea
          id="summary"
          name="summary"
          rows={3}
          value={summary}
          onChange={(event) => setSummary(event.target.value)}
          className={field}
        />
        <p className={`mt-1 text-xs ${summaryOk ? 'text-foreground-muted' : 'text-warning-fg'}`}>
          {summaryWords} words — aim for {LIMITS.summaryWords.target}. It has to answer the
          question on its own, in the first sentence: this is the passage an answer engine lifts.
        </p>
      </div>

      <div>
        <label htmlFor="body" className="text-sm text-foreground">Body</label>
        <textarea
          id="body"
          name="body"
          rows={14}
          value={body}
          onChange={(event) => setBody(event.target.value)}
          className={field}
        />
        <p className="mt-1 text-xs text-foreground-muted">
          {bodyWords} words. Separate paragraphs with a blank line. Informative first — a
          product earns its place through the recommendations below, never through the prose.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label htmlFor="authorSlug" className="text-sm text-foreground">Author</label>
          <SiteSelect
            id="authorSlug"
            name="authorSlug"
            defaultValue={initial?.authorSlug ?? options.authors[0]?.slug ?? ''}
            placeholder="Choose…"
            options={options.authors.map((a) => ({ value: a.slug, label: a.name }))}
          />
        </div>

        {kind === 'post' ? (
          <div>
            <label htmlFor="category" className="text-sm text-foreground">Category</label>
            <SiteSelect
              id="category"
              name="category"
              defaultValue={initial?.category ?? ''}
              placeholder="Choose…"
              options={POST_CATEGORIES.map((c) => ({ value: c, label: c }))}
            />
          </div>
        ) : null}
      </div>

      {kind === 'post' ? (
        <div>
          <label htmlFor="pillarSlug" className="text-sm text-foreground">
            Pillar guide <span className="text-foreground-muted">— the guide this blog links up to</span>
          </label>
          <SiteSelect
            id="pillarSlug"
            name="pillarSlug"
            defaultValue={initial?.pillarSlug ?? ''}
            placeholder="None"
            options={[{ value: '', label: 'None' }, ...options.guides.map((g) => ({ value: g.slug, label: g.title }))]}
          />
        </div>
      ) : (
        <fieldset>
          <legend className="text-sm text-foreground">
            Blogs this guide links down to
          </legend>
          <div className="mt-2 grid gap-1 md:grid-cols-2">
            {options.posts.map((p) => (
              <label key={p.slug} className="flex min-h-11 items-center gap-2 text-sm text-foreground">
                <input type="checkbox" name="clusterSlugs" value={p.slug} defaultChecked={initial?.clusterSlugs.includes(p.slug)} className="size-6 shrink-0 md:size-4" />
                {p.title}
              </label>
            ))}
          </div>
        </fieldset>
      )}

      <fieldset>
        <legend className="text-sm text-foreground">Recommended products</legend>
        <div className="mt-2 grid gap-1 md:grid-cols-2">
          {options.products.map((p) => (
            <label key={p.slug} className="flex min-h-11 items-center gap-2 text-sm text-foreground">
              <input
                type="checkbox"
                name="recommendedProductSlugs"
                value={p.slug}
                defaultChecked={initial?.recommendedProductSlugs.includes(p.slug)}
                className="size-6 shrink-0 md:size-4"
              />
              {p.name}
            </label>
          ))}
        </div>
      </fieldset>

      {/*
        The article's picture. Optional: without one the article falls back to the
        topic-matched product photograph, so a post is never published with a gap
        where the image goes. Its alt text is derived from the title — see
        lib/content/hero-image.ts — so it is never empty.
      */}
      <fieldset className="rounded-lg border border-border p-4">
        <legend className="px-1 text-sm text-foreground">Article image</legend>
        {initial?.heroImageUrl && (
          <div className="mb-3 flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={initial.heroImageUrl}
              alt="The article image currently set"
              width={96}
              height={54}
              className="h-14 w-24 rounded object-cover"
            />
            <label className="flex items-center gap-2 text-sm text-foreground-muted">
              <input type="checkbox" id="removeHeroImage" name="removeHeroImage" />
              Remove it
            </label>
          </div>
        )}
        <label htmlFor="heroImage" className="text-sm text-foreground">
          {initial?.heroImageUrl ? 'Replace the image' : 'Upload an image'}{' '}
          <span className="text-foreground-muted">— JPEG, PNG, WebP or AVIF, optional</span>
        </label>
        <input
          id="heroImage"
          name="heroImage"
          type="file"
          accept="image/jpeg,image/png,image/webp,image/avif"
          className={field}
        />
      </fieldset>

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label htmlFor="metaTitle" className="text-sm text-foreground">
            Meta title <span className="text-foreground-muted">— under {LIMITS.metaTitle}, leave blank to generate</span>
          </label>
          <input id="metaTitle" name="metaTitle" defaultValue={initial?.metaTitle ?? ''} className={field} />
        </div>
        <div>
          <label htmlFor="metaDesc" className="text-sm text-foreground">
            Meta description <span className="text-foreground-muted">— under {LIMITS.metaDesc}, leave blank to generate</span>
          </label>
          <textarea id="metaDesc" name="metaDesc" rows={2} defaultValue={initial?.metaDesc ?? ''} className={field} />
        </div>
      </div>

      {state.error && <p role="alert" className="text-sm text-danger-fg">{state.error}</p>}
      {state.ok && (
        <p className="text-sm text-success-fg">
          {state.ok}{' '}
          {!initial && state.id && (
            <a href={`/admin/content/${state.id}?kind=${kind}`} className="underline underline-offset-4">
              Open it
            </a>
          )}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" variant="primary" size="sm" loading={pending}>
          Save
        </Button>
        <span className="text-xs text-foreground-muted">
          Saving never publishes. Every save and every publish runs the compliance lexicon.
        </span>
      </div>
    </form>
  )
}
