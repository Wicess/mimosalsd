import { cn } from '@/lib/utils'

/**
 * The title block every top-level page shares.
 *
 * Left-aligned by default and full-width. Centring a 42rem block inside a 1440px
 * shell produced wide empty margins on every page using this header — the page looked
 * narrow even after the container was widened — so the header starts at the same left
 * edge as everything below it.
 *
 * `align="center"` opts a page out of that. It suits a short page whose title carries
 * the whole introduction: with nothing else on the line, a centred title reads as
 * deliberate rather than as a column that failed to fill.
 *
 * `children` is for whatever the page needs directly under the summary: a search box,
 * a filter row, a primary action.
 */
export function PageHeader({
  title,
  summary,
  align = 'left',
  children,
  className,
}: {
  title: React.ReactNode
  summary?: React.ReactNode
  align?: 'left' | 'center'
  children?: React.ReactNode
  className?: string
}) {
  const centered = align === 'center'

  return (
    <header
      className={cn(centered ? 'mx-auto max-w-3xl text-center' : 'max-w-5xl', className)}
    >
      <h1
        className={cn(
          'font-display text-foreground',
          // A centred title stands alone, so it takes the extra step. Left-aligned it
          // sits above a column of content and would overpower it.
          // `text-4xl` and no step beyond it. The 5xl token clamps to 7rem, which
          // rendered "Contact us" at 92px — larger than the homepage headline, on a
          // page whose job is to hand over four email addresses.
          centered ? 'text-4xl tracking-[-0.02em] text-balance' : 'text-3xl sm:text-4xl',
        )}
      >
        {title}
      </h1>

      {/*
        A short rule under a centred title. It gives the block a base to sit on — a
        centred heading with nothing beneath it floats — and it is the same accent the
        answer-first blocks use down the left edge elsewhere, so it reads as the same
        system rather than an ornament.
      */}
      {centered && <div aria-hidden className="mx-auto mt-5 h-0.5 w-10 rounded-full bg-accent" />}

      {summary && (
        <p
          className={cn(
            'mt-3 text-base leading-relaxed text-foreground-muted sm:text-lg',
            centered && 'mx-auto max-w-xl',
          )}
        >
          {summary}
        </p>
      )}
      {children && <div className="mt-6">{children}</div>}
    </header>
  )
}
