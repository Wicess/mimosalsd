'use client'

import { useTransition } from 'react'
import Image from 'next/image'
import { removeFromCart, setCartQuantity } from '@/app/actions/cart'
import { setCartCount } from '@/lib/cart/cart-count-store'
import { displayImageFor } from '@/lib/catalog/sample-images'
import type { ResolvedLine } from '@/lib/cart/types'
import { Badge } from '@/components/ui/badge'
import { MinusIcon, PlusIcon, TrashIcon } from '@/components/ui/icon'
import { MAX_LINE_QUANTITY } from '@/lib/cart/cart'
import { formatCents } from '@/lib/utils'

/**
 * A cart line.
 *
 * Quantity and removal are optimistic-free on purpose — a cart total that briefly
 * shows the wrong number is worse than one that takes 200ms to settle, because the
 * number is what the customer is about to commit money against.
 *
 * Layout: thumbnail, then name and price on one line, then the stepper and the
 * delete control on the line below it. The previous version put a 80px number input
 * and an underlined "Remove" link side by side in a 360px drawer, and at that width
 * they wrapped onto separate rows — the controls fell out of the bottom of the line.
 * A stepper and an icon fit the space a text link could not.
 */
export function CartLineRow({ line }: { line: ResolvedLine }) {
  const [pending, startTransition] = useTransition()
  const identity = { slug: line.product.slug, variantId: line.variant.id }
  const image = displayImageFor(line.product)
  const quantity = line.line.quantity

  const setQuantity = (next: number) => {
    if (next < 1 || next > MAX_LINE_QUANTITY) return
    startTransition(async () => {
      const result = await setCartQuantity(identity, next)
      if (result.ok) setCartCount(result.count)
    })
  }

  return (
    <div
      className={`flex gap-3 ${pending ? 'opacity-60' : ''} transition-opacity motion-reduce:transition-none`}
      aria-busy={pending || undefined}
    >
      {/*
        The box is reserved whether or not an image resolves, so a missing file cannot
        shift the row. Decorative on purpose: the product name sits immediately beside
        it, and announcing the picture too would make a screen reader say it twice.
      */}
      <div className="relative size-16 shrink-0 overflow-hidden rounded-md bg-surface-sunken">
        {image && (
          <Image src={image.src} alt="" aria-hidden fill sizes="64px" className="object-cover" />
        )}
        {image?.isSample && (
          <span className="absolute inset-x-0 bottom-0 bg-stone-950/70 py-px text-center text-[8px] font-medium tracking-wide text-white uppercase">
            Sample
          </span>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <p className="font-product min-w-0 text-sm leading-snug font-medium text-foreground">
            {line.product.name}
          </p>
          <p className="tabular font-product shrink-0 text-sm font-semibold text-foreground">
            {formatCents(line.lineTotalCents)}
          </p>
        </div>

        {line.variant.name !== 'Default' && line.variant.name !== 'Single unit' && (
          <p className="mt-0.5 text-xs text-foreground-muted">{line.variant.name}</p>
        )}

        {(line.product.notForHumanConsumption || line.bulkTierLabel) && (
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {line.product.notForHumanConsumption && (
              <Badge tone="neutral">Botanical use only</Badge>
            )}
            {line.bulkTierLabel && <Badge tone="success">{line.bulkTierLabel} price</Badge>}
          </div>
        )}

        {/*
          One line, and it cannot wrap: the stepper is a fixed 104px and the delete
          control 36px, which fits the narrowest drawer this renders in.
        */}
        <div className="mt-2 flex items-center justify-between gap-3">
          <div className="flex items-center rounded-md border border-border-strong">
            <button
              type="button"
              onClick={() => setQuantity(quantity - 1)}
              disabled={pending || quantity <= 1}
              aria-label={`Decrease quantity of ${line.product.name}`}
              className="inline-flex size-9 cursor-pointer items-center justify-center rounded-l-md text-foreground-muted transition-[scale,color,background-color] duration-[140ms] ease-[var(--ease-standard)] hover:bg-surface-sunken hover:text-foreground active:scale-90 disabled:cursor-not-allowed disabled:opacity-40 motion-reduce:active:scale-100"
            >
              <MinusIcon className="size-4" />
            </button>
            {/*
              Not an input. A number field in a 64px box invites typing "100" and
              being silently clamped; the stepper can only produce values the cart
              accepts. `aria-live` announces the change for anyone not watching.
            */}
            <span
              aria-live="polite"
              aria-label={`Quantity: ${quantity}`}
              className="tabular w-8 text-center text-sm font-medium text-foreground"
            >
              {quantity}
            </span>
            <button
              type="button"
              onClick={() => setQuantity(quantity + 1)}
              disabled={pending || quantity >= MAX_LINE_QUANTITY}
              aria-label={`Increase quantity of ${line.product.name}`}
              className="inline-flex size-9 cursor-pointer items-center justify-center rounded-r-md text-foreground-muted transition-[scale,color,background-color] duration-[140ms] ease-[var(--ease-standard)] hover:bg-surface-sunken hover:text-foreground active:scale-90 disabled:cursor-not-allowed disabled:opacity-40 motion-reduce:active:scale-100"
            >
              <PlusIcon className="size-4" />
            </button>
          </div>

          <div className="flex items-center gap-3">
            {line.unitPriceCents !== line.baseUnitPriceCents ? (
              <span className="tabular text-xs text-foreground-subtle">
                <span className="line-through">{formatCents(line.baseUnitPriceCents)}</span>{' '}
                {formatCents(line.unitPriceCents)} each
              </span>
            ) : (
              <span className="tabular text-xs text-foreground-muted">
                {formatCents(line.unitPriceCents)} each
              </span>
            )}

            <button
              type="button"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  const result = await removeFromCart(identity)
                  if (result.ok) setCartCount(result.count)
                })
              }
              aria-label={`Remove ${line.product.name} from your cart`}
              className="inline-flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-md text-foreground-muted transition-[scale,color,background-color] duration-[140ms] ease-[var(--ease-standard)] hover:bg-danger-bg hover:text-danger-fg active:scale-90 disabled:cursor-not-allowed disabled:opacity-40 motion-reduce:active:scale-100"
            >
              <TrashIcon className="size-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
