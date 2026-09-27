import type { PolicySection } from '@/lib/content/policies'
import { AnswerFirst } from '@/components/content/answer-first'

/**
 * Shared long-form shell for policy, disclaimer and about pages.
 *
 * These pages are read in two very different ways: a customer scanning for the one
 * clause that affects them, and an answer engine looking for a liftable statement.
 * Both are served by the same structure — an answer-first summary at the top, a jump
 * list, and headed sections with stable anchors — so neither is optimised at the
 * other's expense.
 */

/** Stable, human-readable anchors so a section can be linked to and cited directly. */
export function sectionId(heading: string): string {
  return heading
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

function reviewedLabel(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

export interface RelatedLink {
  readonly label: string
  readonly href: string
}

export function PolicyProse({
  title,
  summary,
  lastReviewedAt,
  sections,
  related,
  relatedHeading = 'Related policies',
}: {
  title: string
  summary: string
  lastReviewedAt: string
  sections: readonly PolicySection[]
  related?: readonly RelatedLink[]
  relatedHeading?: string
}) {
  return (
    /*
      Reading column plus a companion rail.

      A policy is running text, so the column stays at a measure the eye can track —
      widening paragraphs to fill a 1920px display makes them harder to read, not
      easier. The space a large screen offers goes to the section index instead,
      which turns dead margin into navigation and keeps it in view while you scroll.
      Below xl the rail collapses back above the content, where it was before.
    */
    <div
      className={
        /* Same guard as the legality pages: no rail content, no reserved column. */
        sections.length > 1
          ? 'grid gap-10 lg:grid-cols-[minmax(0,1fr)_19rem] lg:gap-14'
          : 'grid gap-10'
      }
    >
      <div className="min-w-0">
      <h1 className="font-display text-4xl text-foreground">{title}</h1>

      {/* Answer-first. The block an answer engine lifts, and the one a reader in a
          hurry needs. Same treatment as the legality pages, deliberately. */}
      <AnswerFirst>
        {summary}
      </AnswerFirst>

      {/* A dated review is a trust signal for a buyer and a recency signal for an
          answer engine. Machine-readable as well as legible. */}
      <p className="mt-4 text-sm text-foreground-muted">
        Last reviewed{' '}
        <time dateTime={lastReviewedAt} className="text-foreground">
          {reviewedLabel(lastReviewedAt)}
        </time>
      </p>

      {sections.map((section) => (
        <section key={section.heading} className="mt-10">
          <h2
            id={sectionId(section.heading)}
            className="scroll-mt-24 font-display text-2xl text-foreground"
          >
            {section.heading}
          </h2>
          {section.body.map((para, i) => (
            <p key={i} className="mt-3 leading-relaxed text-foreground-muted">
              {para}
            </p>
          ))}
          {section.list && (
            <ul className="mt-4 space-y-2">
              {section.list.map((item) => (
                <li
                  key={item}
                  className="border-l-2 border-border-data pl-4 leading-relaxed text-foreground-muted"
                >
                  {item}
                </li>
              ))}
            </ul>
          )}
        </section>
      ))}

      </div>

      {sections.length > 1 && (
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <nav aria-label="On this page" className="rounded-lg border border-border bg-surface-sunken p-5">
            <h2 className="text-xs font-medium tracking-[0.2em] text-foreground-subtle uppercase">
              On this page
            </h2>
            <ul className="mt-3 grid gap-1 sm:grid-cols-2 lg:grid-cols-1">
              {sections.map((section) => (
                <li key={section.heading}>
                  <a
                    href={`#${sectionId(section.heading)}`}
                    className="inline-flex min-h-11 items-center text-sm leading-snug text-foreground-muted underline-offset-4 hover:text-foreground hover:underline"
                  >
                    {section.heading}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        </aside>
      )}

      <div className="min-w-0 xl:col-start-1">
      {related && related.length > 0 && (
        <nav aria-label={relatedHeading} className="mt-12 border-t border-border pt-6">
          <h2 className="text-xs font-medium tracking-[0.2em] text-foreground-subtle uppercase">
            {relatedHeading}
          </h2>
          <ul className="mt-3 flex flex-wrap gap-x-6 gap-y-2">
            {related.map((r) => (
              <li key={r.href}>
                <a
                  href={r.href}
                  className="inline-flex min-h-11 items-center text-sm text-primary underline underline-offset-4"
                >
                  {r.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      )}
      </div>
    </div>
  )
}
