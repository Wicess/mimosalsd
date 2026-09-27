import { cn } from '@/lib/utils'

/**
 * The answer-first block — the paragraph an answer engine lifts.
 *
 * Every page that competes for a question opens with one: the verdict stated
 * plainly, before the reasoning, so the page can be quoted without being read
 * further. It is the single most valuable paragraph on a legality page, a guide
 * or a post, and it is marked as such.
 *
 * ── Why it is a component and not four copies of a class string ──
 * It was four. The identical markup sat in `policy-prose`, `blog/[slug]`,
 * `guides/[slug]` and `legality/[state]`, which is the arrangement where a
 * deliberate change to one becomes an accidental inconsistency across the other
 * three. One definition, four call sites, no drift.
 *
 * ── Why it is not a left stripe ──
 * It used to be `border-l-4 border-accent`. A thick coloured bar down one edge of
 * a callout is the most recognisable tell of a generated interface — it appears
 * on the majority of them regardless of the brief — and it also asks the reader
 * to infer importance from a decoration rather than see it in the block itself.
 * A full hairline and a tinted ground say the same thing without the costume:
 * the panel is visibly a different kind of surface from the prose around it,
 * closed on all four sides, which is what makes it read as a pull-out rather
 * than as a paragraph someone highlighted.
 */
export function AnswerFirst({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <p
      className={cn(
        'mt-5 rounded-lg border border-accent-fg/25 bg-accent-muted px-5 py-4 text-lg leading-relaxed text-pretty text-foreground',
        className,
      )}
    >
      {children}
    </p>
  )
}
