import { FDA_DISCLAIMER } from '@/lib/compliance/disclaimers'
import { cn } from '@/lib/utils'

/**
 * Rendered on every product and content page.
 *
 * A component rather than pasted copy, so the wording changes in one place — and so
 * a new page cannot silently ship without it.
 *
 * TWO paragraphs, and the order is the whole point. The required FDA sentence says
 * only what we have NOT done; on its own at the foot of a page it was the last thing
 * every reader saw, and it read as a warning about the product rather than as the
 * boilerplate it is. It stays, verbatim and legible — it is what keeps a lawful
 * botanical from being sold as an unapproved drug — but it now sits underneath a
 * sentence about what we DO verify. Same information, opposite parting impression.
 *
 * The lead sentence is deliberately plain rather than promotional: every clause in it
 * is something the business actually does. Nothing here is a health claim, and
 * nothing here may become one.
 */
export function FdaDisclaimer({ className }: { className?: string }) {
  return (
    /*
      `grid` with an auto-fit minimum rather than a fixed column count: given one
      column it stacks, given the width of two it sits them side by side, and it
      needs no breakpoint to decide which — the container's width does.

      The minimum is `min(22rem, 100%)`, not `22rem`. `auto-fit` cannot shrink a
      track below a fixed minimum, so a bare `minmax(22rem, 1fr)` held a 352px
      column inside a 288px container and pushed 48px of every page off the side
      of a 320px screen — on all thirteen routes this component appears on. The
      `min()` lets the track collapse to the container when the container is the
      smaller of the two, which is the whole point of the pattern.
    */
    <aside
      className={cn(
        'grid gap-x-10 gap-y-3 border-t border-border pt-5 [grid-template-columns:repeat(auto-fit,minmax(min(22rem,100%),1fr))]',
        className,
      )}
    >
      {/*
        Rewritten 2026-09-28. The old sentence promised an accredited third-party
        laboratory and a statute printed beside every state. Neither is true of this
        site: the owner has not confirmed a laboratory, and no state rule cites a
        statute. What follows is only what the site actually does.
      */}
      <p className="text-sm leading-relaxed text-pretty text-foreground">
        <span className="font-medium">Sold for dyeing and craft.</span> Our root bark is
        raw botanical material, sold by weight and shipped from California to US
        addresses. Every order is checked by a person before payment is asked for, and
        the report for your batch is available on request.
      </p>
      <p className="text-xs leading-relaxed text-pretty text-foreground-subtle">
        {FDA_DISCLAIMER}
      </p>
    </aside>
  )
}
