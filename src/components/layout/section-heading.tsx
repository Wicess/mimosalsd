import { cn } from '@/lib/utils'

/**
 * A section title.
 *
 * Centred, with a short accent rule beneath it — the same device the centred page
 * header uses, so a section reads as a smaller instance of the same system rather
 * than a different one. The rule matters more than it looks: a centred heading with
 * nothing under it floats, and on a long page every section then starts the same way
 * with nothing marking where one ends and the next begins.
 *
 * `action` is for the link some sections carry ("See all"). It sits under the rule
 * rather than beside the title, because a centred title with something pinned to its
 * right is no longer centred — it just looks off-centre by the width of the link.
 */
export function SectionHeading({
  title,
  summary,
  action,
  className,
  id,
}: {
  title: React.ReactNode
  summary?: React.ReactNode
  action?: React.ReactNode
  className?: string
  id?: string
}) {
  return (
    <div className={cn('mx-auto mb-8 max-w-2xl text-center', className)}>
      <h2 id={id} className="font-display text-3xl tracking-[-0.015em] text-balance text-foreground">
        {title}
      </h2>
      <div aria-hidden className="mx-auto mt-4 h-0.5 w-10 rounded-full bg-accent" />
      {summary && (
        <p className="mt-4 text-base leading-relaxed text-foreground-muted">{summary}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}
