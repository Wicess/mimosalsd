import { cn } from '@/lib/utils'

/**
 * A small green glint that runs right to left along a section's hairline, all the
 * time. The motion and colour live in `.shine-rule` in globals.css.
 *
 * Place it inside the element that draws the border. That element must be
 * positioned (`relative`, `sticky`) and must not clip its own edges with
 * `overflow-hidden`, or the glint is cut off at the line it is meant to run along.
 * It takes no space and is hidden from assistive technology: it is decoration.
 */
export function ShineRule({
  edge = 'top',
  className,
}: {
  /** Which border it runs along. */
  edge?: 'top' | 'bottom'
  className?: string
}) {
  return <span aria-hidden data-edge={edge} className={cn('shine-rule', className)} />
}
