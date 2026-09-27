'use client'

import { useActionState } from 'react'
import {
  resetCategory,
  saveCategory,
  type CategoryEditState,
} from '@/app/actions/admin-categories'
import { Button } from '@/components/ui/button'

const INITIAL: CategoryEditState = {}

const field =
  'mt-1 min-h-11 w-full rounded-md border border-border-strong bg-surface px-3 py-2 text-sm text-foreground'

/**
 * ─────────────────────────────────────────────────────────────────────────────
 *  CATEGORY COPY EDITOR.
 *
 *  ── Placeholders carry the authored value, and that is load-bearing ────────
 *  Every input is EMPTY unless an override exists, with the authored text shown as
 *  its placeholder. That is not a styling choice: null means inherit, so an empty
 *  box and a box containing the authored words mean two different things to the
 *  save action. Pre-filling with the authored value would turn every save into an
 *  override of every field, and "reset" would stop meaning anything — a category
 *  would be permanently pinned to whatever the form happened to contain the first
 *  time somebody pressed Save.
 *
 *  So: placeholder = what the page says today with no override. Value = your edit.
 *  Clearing the box gives the authored words back.
 *
 *  ── Two forms, not one ─────────────────────────────────────────────────────
 *  Reset is a separate form with its own action rather than a second submit button,
 *  so a stray Enter in a text field can never discard every edit for the category.
 * ─────────────────────────────────────────────────────────────────────────────
 */
export function CategoryEditor({
  slug,
  authored,
  override,
  hasAbout,
}: {
  slug: string
  authored: {
    intro: string
    detail?: string
    metaTitle: string
    metaDesc: string
    aboutHeading?: string
    aboutLede?: string
  }
  override: {
    intro: string | null
    detail: string | null
    metaTitle: string | null
    metaDesc: string | null
    aboutHeading: string | null
    aboutLede: string | null
  } | null
  hasAbout: boolean
}) {
  const [state, formAction, pending] = useActionState(saveCategory, INITIAL)
  const [resetState, resetAction, resetting] = useActionState(resetCategory, INITIAL)

  return (
    <div className="space-y-4">
      <form action={formAction} className="space-y-4">
        <input type="hidden" name="slug" value={slug} />

        <div>
          <label htmlFor={`${slug}-intro`} className="text-sm text-foreground">
            Intro <span className="text-foreground-muted">— under the page title</span>
          </label>
          <textarea
            id={`${slug}-intro`}
            name="intro"
            rows={2}
            defaultValue={override?.intro ?? ''}
            placeholder={authored.intro}
            className={field}
          />
        </div>

        {hasAbout ? (
          <>
            <div>
              <label htmlFor={`${slug}-about-heading`} className="text-sm text-foreground">
                About heading
              </label>
              <input
                id={`${slug}-about-heading`}
                name="aboutHeading"
                type="text"
                defaultValue={override?.aboutHeading ?? ''}
                placeholder={authored.aboutHeading ?? ''}
                className={field}
              />
            </div>

            <div>
              <label htmlFor={`${slug}-about-lede`} className="text-sm text-foreground">
                About lede
              </label>
              <textarea
                id={`${slug}-about-lede`}
                name="aboutLede"
                rows={4}
                defaultValue={override?.aboutLede ?? ''}
                placeholder={authored.aboutLede ?? ''}
                className={field}
              />
              <p className="mt-1 text-xs leading-relaxed text-foreground-muted">
                The definition an answer engine is most likely to quote. Keep it
                self-contained — it has to answer the question with no page around it.
                The sub-questions and the spec sheet below it are authored in the
                catalogue and are not editable here.
              </p>
            </div>
          </>
        ) : (
          <div>
            <label htmlFor={`${slug}-detail`} className="text-sm text-foreground">
              Detail <span className="text-foreground-muted">— the About paragraph</span>
            </label>
            <textarea
              id={`${slug}-detail`}
              name="detail"
              rows={4}
              defaultValue={override?.detail ?? ''}
              placeholder={authored.detail ?? ''}
              className={field}
            />
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label htmlFor={`${slug}-meta-title`} className="text-sm text-foreground">
              Meta title <span className="text-foreground-muted">— under 70</span>
            </label>
            <input
              id={`${slug}-meta-title`}
              name="metaTitle"
              type="text"
              defaultValue={override?.metaTitle ?? ''}
              placeholder={authored.metaTitle}
              className={field}
            />
          </div>
          <div>
            <label htmlFor={`${slug}-meta-desc`} className="text-sm text-foreground">
              Meta description <span className="text-foreground-muted">— under 165</span>
            </label>
            <textarea
              id={`${slug}-meta-desc`}
              name="metaDesc"
              rows={2}
              defaultValue={override?.metaDesc ?? ''}
              placeholder={authored.metaDesc}
              className={field}
            />
          </div>
        </div>

        {state.error && (
          <p role="alert" className="text-sm text-danger-fg">
            {state.error}
          </p>
        )}
        {state.ok && <p className="text-sm text-success-fg">{state.ok}</p>}

        <Button type="submit" variant="primary" size="sm" loading={pending}>
          Save and publish
        </Button>
      </form>

      {override && (
        <form action={resetAction} className="border-t border-border pt-4">
          <input type="hidden" name="slug" value={slug} />
          {resetState.error && (
            <p role="alert" className="mb-2 text-sm text-danger-fg">
              {resetState.error}
            </p>
          )}
          {resetState.ok && (
            <p className="mb-2 text-sm text-success-fg">{resetState.ok}</p>
          )}
          <Button type="submit" variant="secondary" size="sm" loading={resetting}>
            Discard edits
          </Button>
          <p className="mt-2 text-xs leading-relaxed text-foreground-muted">
            Removes every override for this category and restores the authored copy.
            Nothing is lost that is not in the repository.
          </p>
        </form>
      )}
    </div>
  )
}
