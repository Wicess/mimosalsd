import type { FaqItem } from '@/lib/content/faq'
import { cn } from '@/lib/utils'

/**
 * A disclosure list of questions.
 *
 * Real `<details>`, not a JavaScript accordion. The distinction matters here rather
 * than being pedantry: a JS accordion renders nothing until it is clicked, so a
 * crawler that does not execute scripts sees a page of headings with no answers —
 * on a page whose whole purpose is to BE the answer. With `<details>` the text is in
 * the HTML whether it is open or shut, it works with JavaScript off, and the keyboard
 * behaviour is the browser's rather than something we reimplemented.
 *
 * The marker is ours: `list-none` removes the browser's triangle, which cannot be
 * styled consistently across engines.
 *
 * `defaultOpen` decides which of the two jobs this is doing. A short product FAQ under
 * a buy box is reference material and opens flat; a page of twenty questions is a
 * directory, and twenty open answers is a wall nobody scrolls.
 */
export function FaqList({
  items,
  defaultOpen = false,
  headingLevel = 'h3',
  idFor,
  wide = false,
  group = 'faq',
  className,
}: {
  items: readonly FaqItem[]
  defaultOpen?: boolean
  headingLevel?: 'h3' | 'h4'
  /** Anchor ids, so the category rail and a shared link can jump to one question. */
  idFor?: (question: string) => string
  /**
   * Let the answer run the full width of its container, at a larger size.
   *
   * For the band on a product page, which spans the screen: a 72ch column inside
   * a 1900px band leaves two thirds of every row empty, and the reading measure
   * that protects a narrow page makes a wide one look broken. The larger type and
   * looser leading are what keep a long line trackable once the cap is off.
   */
  wide?: boolean
  /**
   * Shared name for the exclusive group — opening one closes the rest.
   *
   * This is the platform's own `name` attribute on `<details>`, not a JavaScript
   * accordion. The browser handles the closing, so it keeps working with scripts
   * off and there is no open-state to hold, sync or get wrong.
   *
   * The default is shared across every instance ON PURPOSE. `/faq` renders one
   * list per category, and a reader who opens a Shipping question expects the
   * Legality one they left open to close — the grouping they perceive is the
   * page, not the section it happens to be rendered in.
   *
   * Pass a distinct value to scope exclusivity to one list.
   */
  group?: string
  className?: string
}) {
  const Heading = headingLevel

  return (
    <div className={cn('divide-y divide-border border-y border-border', className)}>
      {items.map((item) => (
        <details
          key={item.question}
          {...(defaultOpen ? { open: true } : {})}
          /*
            `name` and `open` are mutually exclusive by definition: a browser given
            several open members of one exclusive group keeps only the last, so
            asking for both silently collapses the rest. Where a list is meant to
            render flat, exclusivity is simply not what it wants.
          */
          {...(defaultOpen ? {} : { name: group })}
          {...(idFor ? { id: idFor(item.question) } : {})}
          /* `faq-item` is the hook for the smooth open/close in globals.css. */
          className="faq-item group/faq scroll-mt-24"
        >
          <summary className="flex cursor-pointer list-none items-start justify-between gap-4 py-4 [&::-webkit-details-marker]:hidden">
            <Heading
              className={cn(
                'font-display leading-snug text-balance text-foreground',
                wide ? 'text-lg md:text-xl' : 'text-lg',
              )}
            >
              {item.question}
            </Heading>
            {/*
              A plus that becomes a cross, not a chevron that flips. At 45 degrees the
              same two strokes read as "close", so one glyph covers both states and
              there is nothing to keep in sync.
            */}
            <span
              aria-hidden
              className="mt-1 shrink-0 text-foreground-subtle transition-transform duration-200 ease-[var(--ease-standard)] group-open/faq:rotate-45 motion-reduce:transition-none"
            >
              <svg viewBox="0 0 16 16" className="size-4">
                <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
              </svg>
            </span>
          </summary>
          {/*
            The answer sits in a reading measure even where the page is wide. Prose
            past about 70 characters a line costs the reader the start of the next one.
          */}
          <p
            className={cn(
              'pb-5 text-pretty text-foreground-muted',
              wide
                ? 'text-base leading-[1.75] md:text-lg'
                : 'max-w-[72ch] leading-relaxed',
            )}
          >
            {item.answer}
          </p>
        </details>
      ))}
    </div>
  )
}
