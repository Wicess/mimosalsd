'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { addToCart } from '@/app/actions/cart'
import { openCart } from '@/lib/cart/cart-ui'
import { setCartCount } from '@/lib/cart/cart-count-store'
import { Button } from '@/components/ui/button'

/**
 * Add-to-cart for a product card.
 *
 * Only rendered for products with a single variant. A card cannot ask which size or
 * flavour someone wants without becoming a form, and silently adding an arbitrary
 * variant is worse than sending them to the page that shows the choice — so the grid
 * renders a "Choose options" link instead in that case.
 *
 * On success the drawer opens rather than navigating. Being thrown off a category page
 * onto /cart after adding one item loses your place in the grid and your scroll
 * position, which is the single most common reason people abandon a browse session.
 */
export function AddToCartButton({
  slug,
  variantId,
  blocked,
  blockedReason,
  className,
  label = 'Add to cart',
  variant = 'secondary',
  fullWidth = true,
}: {
  slug: string
  variantId: string
  blocked?: boolean
  blockedReason?: string
  /** Lets a caller size the control — the product card runs it at two-up on phones. */
  className?: string
  /**
   * Overridable for surfaces where the button is not the width of a card — the
   * carousel runs a compact pill under a full-bleed photograph, where "Add to
   * cart" would be the widest thing on the card.
   */
  label?: string
  variant?: 'primary' | 'secondary' | 'accent' | 'ghost'
  fullWidth?: boolean
}) {
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const router = useRouter()

  function handleAdd(event: React.MouseEvent) {
    // The whole card is a link; this button sits on top of it.
    event.preventDefault()
    event.stopPropagation()
    setError(null)
    startTransition(async () => {
      const result = await addToCart({ slug, variantId, quantity: 1 })
      if (result.ok) {
        setCartCount(result.count)
        openCart()
        // Re-renders the drawer's server content with the new line in it.
        router.refresh()
      } else {
        setError(result.error)
      }
    })
  }

  return (
    <>
      <Button
        variant={variant}
        fullWidth={fullWidth}
        className={className}
        disabled={blocked}
        loading={pending}
        onClick={handleAdd}
        {...(blocked && blockedReason ? { title: blockedReason } : {})}
      >
        {blocked ? 'Not available in your state' : label}
      </Button>
      {error && (
        <p role="alert" className="mt-2 text-sm text-danger-fg">
          {error}
        </p>
      )}
    </>
  )
}
