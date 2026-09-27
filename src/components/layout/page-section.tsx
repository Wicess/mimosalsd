import { cn } from '@/lib/utils'
import { ShineRule } from '@/components/ui/shine-rule'

/**
 * One band of a page.
 *
 * The homepage reads as a sequence of distinct places rather than one long column,
 * and the reason is structural: its `<main>` is not a container, so every section
 * spans the full viewport and carries its own inner `.shell`. Alternating a tinted
 * background against the plain one, with a hairline between, is what gives the eye
 * somewhere to rest and tells a reader that the subject just changed.
 *
 * Every other page was built the other way round — `<main className="shell">` with
 * sections inside it — which makes a full-bleed band impossible: a child cannot
 * escape a container that has already centred and padded it. So adopting the
 * homepage's rhythm elsewhere means moving the shell down one level, from the main
 * element onto each section. This component is that shell, so the move is a wrap
 * rather than a rewrite, and so the spacing and rules stay identical across pages
 * instead of drifting a few pixels apart on each one.
 *
 * ── Why `border-t` and never `border-y` ─────────────────────────────────────
 * Two adjacent sections that each draw a full border produce two abutting hairlines
 * — a 2px rule between them and a 1px rule everywhere else, which reads as a
 * mistake at exactly the moment the design is trying to look deliberate. Every
 * band draws only its top edge; the footer draws its own. `first` suppresses the
 * rule where a section sits directly under the page header and has nothing above
 * it to be separated from.
 */
export function PageSection({
  tone = 'plain',
  first = false,
  reveal = false,
  id,
  labelledBy,
  className,
  innerClassName,
  children,
}: {
  /**
   * The band's surface.
   *
   * `plain` is the page's own reading surface. `sunken` is the brand-tinted step
   * down that separates one subject from the next. `accent` is a citron wash and
   * is rationed: it is the loudest surface on the site, so it marks the one band
   * on a page that is making the argument rather than listing the facts. Two
   * accent bands on one page and neither of them means anything.
   */
  tone?: 'plain' | 'sunken' | 'accent'
  /** Drop the top rule — for the first band under a page header. */
  first?: boolean
  /**
   * Opt in to the scroll reveal.
   *
   * Opt-IN, never automatic. An identical entrance applied to every section is
   * the tell that a page was decorated rather than designed — the reader stops
   * reading the content and starts watching furniture arrive. It belongs on the
   * two or three bands whose arrival is worth noticing.
   */
  reveal?: boolean
  id?: string
  /** id of the heading that names this section, for assistive technology. */
  labelledBy?: string
  className?: string
  innerClassName?: string
  children: React.ReactNode
}) {
  return (
    <section
      {...(id ? { id } : {})}
      {...(labelledBy ? { 'aria-labelledby': labelledBy } : {})}
      className={cn(
        'py-12 md:py-16',
        !first && 'relative border-t border-border',
        tone === 'sunken' && 'bg-surface-sunken',
        tone === 'accent' && 'bg-accent-muted',
        className,
      )}
    >
      {!first && <ShineRule />}
      <div className={cn('shell', reveal && 'reveal', innerClassName)}>{children}</div>
    </section>
  )
}
