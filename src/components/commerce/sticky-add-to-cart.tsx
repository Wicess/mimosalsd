'use client'

import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { formatCents } from '@/lib/utils'

/**
 * Sticky Add-to-Cart.
 *
 * The top third of a phone viewport is the hard-to-reach zone, and a primary CTA
 * placed there measurably suppresses conversion. This bar anchors the buy action in
 * the thumb-comfortable zone the moment the main CTA scrolls out of view.
 *
 * It stays deliberately sparse — name, price, one prominent button. Anything
 * more competes with the product page it is supposed to serve.
 *
 * Client component because it observes scroll position; that is genuine interactivity
 * and the only reason to leave the server.
 */
export function StickyAddToCart({
  productName,
  priceCents,
  disabled = false,
  disabledReason,
  onAddToCart,
  /** Ref to the in-page Add-to-Cart button. The bar appears when it leaves view. */
  triggerRef,
}: {
  productName: string
  priceCents: number
  disabled?: boolean
  disabledReason?: string
  onAddToCart?: () => void
  triggerRef: React.RefObject<HTMLElement | null>
}) {
  const [visible, setVisible] = useState(false)
  const barRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const target = triggerRef.current
    if (!target) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry) return
        /*
          "Not intersecting" is NOT the same as "scrolled past", and the difference
          was a real defect. At the top of a product page the in-page button is below
          the fold, so `!isIntersecting` was true and the bar appeared immediately —
          over the product's own title. Measured on a 360x800 phone the <h1> ran
          605-678 while the bar occupied 650-744, so the name of the thing being sold
          was clipped by the button to buy it.

          `boundingClientRect.top < 0` is what distinguishes the two: the trigger has
          left the viewport UPWARD, meaning the customer has genuinely passed the real
          button. Below the fold, the bar stays down and nothing is covered — on any
          device, without the layout having to fit around it.
        */
        setVisible(!entry.isIntersecting && entry.boundingClientRect.top < 0)
      },
      { rootMargin: '0px 0px -120px 0px' },
    )
    observer.observe(target)
    return () => observer.disconnect()
  }, [triggerRef])

  return (
    <div
      ref={barRef}
      // aria-hidden while off-screen so the duplicate CTA is not announced twice.
      aria-hidden={!visible}
      className={[
        // Sits ON the tab bar, not over it. Both are `fixed bottom-0 md:hidden`, so
        // without this offset the buy button and the navigation occupied the same
        // 64px of screen and one of them was unreachable.
        // `backdrop-blur`, not just an alpha. At 95% opacity with nothing behind it, the
        // pricing panel underneath read straight through the bar — which looks like a
        // rendering fault rather than glass. The blur is what makes the translucency
        // deliberate, and it is the same treatment the admin page header uses.
        'fixed inset-x-0 bottom-[calc(3.5rem+env(safe-area-inset-bottom))] z-(--z-sticky) border-y border-border bg-surface/95 backdrop-blur-[10px]',
        'px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]',
        // Enters at 240ms, leaves at 160ms. Symmetric timing reads as sluggish on the
        // way out: arriving is the system offering something, leaving is the system
        // getting out of the way, and the second should not be savoured.
        'transition-transform motion-reduce:transition-none',
        visible
          ? 'translate-y-0 duration-[240ms] ease-[var(--ease-enter)]'
          : 'translate-y-full duration-[160ms] ease-[var(--ease-exit)]',
        'md:hidden',
      ].join(' ')}
    >
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm text-foreground-muted">{productName}</p>
          <p className="tabular text-lg font-semibold text-foreground">
            {formatCents(priceCents)}
          </p>
        </div>
        <Button
          variant="accent"
          size="md"
          disabled={disabled}
          onClick={onAddToCart}
          tabIndex={visible ? 0 : -1}
          className="shrink-0"
        >
          {disabled ? 'Unavailable' : 'Add to cart'}
        </Button>
      </div>
      {disabled && disabledReason && (
        <p className="mt-2 text-xs text-foreground-muted">{disabledReason}</p>
      )}
    </div>
  )
}
