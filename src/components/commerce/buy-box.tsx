'use client'

import { useMemo, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { addToCart } from '@/app/actions/cart'
import { openCart } from '@/lib/cart/cart-ui'
import { setCartCount } from '@/lib/cart/cart-count-store'
import { url } from '@/lib/seo/routes'
import { Button } from '@/components/ui/button'
import { StickyAddToCart } from '@/components/commerce/sticky-add-to-cart'
import { tierFor, tierPriceCents, type PriceTier, type ProductVariant } from '@/lib/catalog/types'
import { sizeOptions, type SizeLadder, type SizeOption } from '@/lib/catalog/sizing'
import { formatCents } from '@/lib/utils'

/**
 * Size, quantity, and the buy action.
 *
 * Two different questions live here and they are deliberately not the same
 * control:
 *
 *   HOW BIG  — the size ladder. Only for things that come in sizes: root bark by
 *              weight, gummies and capsules by pack count. Each size shows its
 *              own price AND its own per-gram rate, because "is the big bag
 *              actually better value" is the question every buyer of a measured
 *              product is silently doing arithmetic on, and a shop that makes
 *              them do it in their head loses the larger order.
 *
 *   HOW MANY — the stepper. Every product has it, and for vapes it is the only
 *              quantity control there is: a disposable is one unit, counted, and
 *              there is no size to choose.
 *
 * Client-side because it holds that selection state and the IntersectionObserver
 * target for the sticky bar. Everything around it stays a Server Component.
 *
 * When the product cannot ship to the visitor's state the buy button is disabled
 * with the reason shown inline — never a silently dead control, and never a
 * refusal deferred to checkout.
 */
export function BuyBox({
  slug,
  productName,
  variants,
  priceTiers,
  sizing,
  blockedReason,
}: {
  slug: string
  productName: string
  variants: readonly ProductVariant[]
  priceTiers: readonly PriceTier[]
  sizing?: SizeLadder
  blockedReason?: string
}) {
  /*
    The ladder and the variant list are two views of one thing — `sized()` in the
    catalogue generates the second from the first — so a size option and its
    variant are matched by index rather than by re-deriving an id here.
  */
  const options = useMemo(() => (sizing ? sizeOptions(sizing) : []), [sizing])
  const defaultIndex = sizing
    ? Math.max(
        0,
        options.findIndex((o) => o.key === sizing.defaultKey),
      )
    : Math.max(
        0,
        variants.findIndex((v) => v.inStock),
      )

  const [index, setIndex] = useState(defaultIndex)
  const [quantity, setQuantity] = useState(1)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const router = useRouter()
  const triggerRef = useRef<HTMLDivElement>(null)

  const selected = variants[index] ?? variants[0]
  const option: SizeOption | undefined = options[index]
  if (!selected) return null

  const tier = tierFor(priceTiers, quantity)
  const unitCents = tier ? tierPriceCents(selected.priceCents, tier) : selected.priceCents
  const blocked = Boolean(blockedReason)

  /*
   * `then` decides what happens after a successful add.
   *
   * "Add to cart" opens the drawer and leaves you on the page — the old behaviour
   * pushed to /cart, which threw people off the product they were still reading in
   * order to show them a page containing that same product.
   *
   * "Buy now" is the same add followed by the order request, for someone who has
   * already decided. It is not a separate code path: one add, one destination.
   */
  function handleAdd(then: 'drawer' | 'checkout' = 'drawer') {
    setError(null)
    startTransition(async () => {
      const result = await addToCart({ slug, variantId: selected!.id, quantity })
      if (!result.ok) {
        setError(result.error)
        return
      }
      setCartCount(result.count)
      if (then === 'checkout') {
        router.push(url.checkout())
        return
      }
      openCart()
      // Re-renders the drawer's server contents with the new line in them.
      router.refresh()
    })
  }

  return (
    <>
      <div className="space-y-5">
        {/*
          The live price. One number, large, and it moves the instant a size or a
          quantity changes — the whole reason the ladder is worth building is that
          the buyer never has to guess what they are about to be charged.
        */}
        {/*
          CAPPED, not full width.

          The panel holds four short values — a label, a price, a unit and a rate —
          and it was stretching the full measure of the buy column, which on a wide
          display is over a thousand pixels of border around "$69 / 28g". A box that
          wide reads as a section rather than as a price, and the eye has to travel
          the whole width to find out nothing else is in it.

          `max-w-sm` does not constrain it on a phone, where the column is already
          narrower than the cap, so the mobile layout is untouched.
        */}
        <div className="max-w-sm rounded-xl border border-border bg-surface-sunken px-4 py-3">
          <p className="text-[11px] font-medium tracking-[0.18em] text-foreground-subtle uppercase">
            Pricing
          </p>
          <p className="mt-1 flex flex-wrap items-baseline gap-x-2">
            <span className="tabular font-product text-3xl font-semibold text-foreground">
              {formatCents(unitCents)}
            </span>
            {option && (
              <span className="font-product text-base font-medium text-foreground-muted">
                / {option.label}
              </span>
            )}
            {!option && (
              <span className="font-product text-base font-medium text-foreground-muted">
                / unit
              </span>
            )}
          </p>
          {option && sizing && (
            <p className="tabular mt-1 text-sm text-foreground-muted">
              {formatCents(sizing.poundPriceCents)} per pound
            </p>
          )}
        </div>

        {/*
          THE SIZE LADDER.

          Price and per-unit rate on every tile, not just the selected one. A
          selector that reveals the price only after you pick makes comparison a
          sequence of clicks; showing all of them makes it one glance, and it is
          the glance that sells the 500 g bag.
        */}
        {options.length > 1 && sizing && (
          <fieldset>
            <legend className="text-sm font-medium text-foreground">
              Size <span className="text-foreground-muted">(by the pound)</span>
            </legend>
            <div className="mt-2 flex flex-wrap gap-2">
              {options.map((o, i) => {
                const active = i === index
                return (
                  <button
                    key={o.key}
                    type="button"
                    onClick={() => setIndex(i)}
                    aria-pressed={active}
                    className={[
                      'flex min-h-11 items-baseline gap-2 rounded-full border px-3.5 py-2',
                      'transition-[scale,color,background-color,border-color] duration-[160ms] ease-[var(--ease-standard)]',
                      'active:scale-[0.96] motion-reduce:active:scale-100',
                      active
                        ? 'border-primary bg-primary text-on-primary'
                        : 'border-border-strong bg-surface text-foreground hover:bg-surface-sunken',
                    ].join(' ')}
                  >
                    {/*
                      The accessible name is the button's own text, with no
                      `aria-label` overriding it.

                      It carried `aria-label="50 grams, $28"` while reading "50g",
                      and a name that does not contain the visible label breaks
                      WCAG 2.5.3 — someone on voice control says "click fifty g"
                      and nothing matches. Lighthouse flagged it as
                      `label-content-name-mismatch`.

                      The spoken long form rides along in an `sr-only` span, so the
                      name still contains "50g" and a screen reader hears
                      "50g, 50 grams" instead of parsing the unit.
                    */}
                    <span className="font-product text-sm font-semibold">
                      {o.label}
                      <span className="sr-only"> ({o.longLabel})</span>
                    </span>
                    <span className="tabular text-sm">
                      {formatCents(o.priceCents)}
                    </span>
                    {/*
                      No per-unit rate on the pill. Three figures in a pill is a
                      table pretending to be a control, and the rate for the size
                      you actually picked — plus the best rate available — is stated
                      in the pricing panel directly above.
                    */}
                  </button>
                )
              })}
            </div>
          </fieldset>
        )}

        {/*
          NAMED SIZES — a product with several variants but no ladder.

          Products posted from the admin panel carry sizes as a plain list ("7g",
          "14g") rather than a generated weight ladder, and without this the
          picker above never rendered for them: the page offered one size and the
          rest could not be bought. Same pills, same accessible naming; a size
          that is out of stock says so and cannot be chosen.
        */}
        {!sizing && variants.length > 1 && (
          <fieldset>
            <legend className="text-sm font-medium text-foreground">Size</legend>
            <div className="mt-2 flex flex-wrap gap-2">
              {variants.map((v, i) => {
                const active = i === index
                return (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => setIndex(i)}
                    aria-pressed={active}
                    disabled={!v.inStock}
                    className={[
                      'flex min-h-11 items-baseline gap-2 rounded-full border px-3.5 py-2',
                      'transition-[scale,color,background-color,border-color] duration-[160ms] ease-[var(--ease-standard)]',
                      'active:scale-[0.96] motion-reduce:active:scale-100',
                      'disabled:cursor-not-allowed disabled:opacity-50 disabled:active:scale-100',
                      active
                        ? 'border-primary bg-primary text-on-primary'
                        : 'border-border-strong bg-surface text-foreground hover:bg-surface-sunken',
                    ].join(' ')}
                  >
                    <span className="font-product text-sm font-semibold">{v.name}</span>
                    <span className="tabular text-sm">
                      {v.inStock ? formatCents(v.priceCents) : 'Out of stock'}
                    </span>
                  </button>
                )
              })}
            </div>
          </fieldset>
        )}

        {/*
          THE STEPPER — how many of the chosen size.

          A stepper rather than a bare number field because the median change is
          ±1 and a phone keyboard for that is three taps too many. The field stays
          typeable for the person ordering twelve.
        */}
        <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
          <div>
            <label htmlFor="quantity" className="block text-sm font-medium text-foreground">
              How many
            </label>
            <div className="mt-2 inline-flex items-center rounded-full border border-border-strong bg-surface">
              <button
                type="button"
                onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                disabled={quantity <= 1}
                aria-label="One fewer"
                className="grid size-11 place-items-center rounded-l-full text-foreground transition-[scale,background-color] duration-[140ms] ease-[var(--ease-standard)] hover:bg-surface-sunken active:scale-90 disabled:opacity-30 motion-reduce:active:scale-100"
              >
                <MinusGlyph />
              </button>
              <input
                id="quantity"
                type="number"
                inputMode="numeric"
                min={1}
                max={99}
                value={quantity}
                onChange={(e) =>
                  setQuantity(Math.max(1, Math.min(99, Number(e.target.value) || 1)))
                }
                aria-label="Quantity"
                className="tabular h-11 w-14 border-x border-border bg-transparent text-center text-base font-semibold text-foreground [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
              />
              <button
                type="button"
                onClick={() => setQuantity((q) => Math.min(99, q + 1))}
                disabled={quantity >= 99}
                aria-label="One more"
                className="grid size-11 place-items-center rounded-r-full text-foreground transition-[scale,background-color] duration-[140ms] ease-[var(--ease-standard)] hover:bg-surface-sunken active:scale-90 disabled:opacity-30 motion-reduce:active:scale-100"
              >
                <PlusGlyph />
              </button>
            </div>
          </div>

          <div>
            <p className="text-sm text-foreground-muted">Total</p>
            <p
              className="tabular font-product text-2xl font-semibold text-foreground"
              aria-live="polite"
            >
              {formatCents(unitCents * quantity)}
            </p>
            <p className="text-xs text-foreground-subtle">
              {option
                ? `${quantity} × ${option.label} at ${formatCents(unitCents)}`
                : `${quantity} ${quantity === 1 ? 'unit' : 'units'} at ${formatCents(unitCents)} each`}
            </p>
          </div>
        </div>

        {/*
          The bulk ladder, live.

          Rendered against the SELECTED size and highlighting the row the current
          quantity has reached, so it doubles as the prompt to reach the next one.
          Percentages are the stored fact; the cents beside them are computed here
          from whatever is in the box.
        */}
        {/*
          The bulk ladder that stood here is gone.

          Three rows restating "5% off / 10% off / 15% off" under a control that
          already applies them — the total above updates the moment the quantity
          crosses a tier, which is the same information delivered by the thing the
          buyer is already looking at. The percentages are still stated once, on
          /bulk, for someone shopping volume deliberately.
        */}

        {/*
          Capped and centred rather than edge to edge.

          `fullWidth` is right on a phone — a 375px CTA under the thumb is the whole
          reason the sticky bar exists — and wrong the moment the column is wide. A
          nine-hundred-pixel "Add to cart" does not read as more important, it reads
          as unfinished: the label floats in the middle of a slab with nothing to set
          its size against. The cap holds the button to a size that matches its own
          label, and `mx-auto` is inert until the container is wider than the cap, so
          nothing about the mobile layout changes.
        */}
        <div ref={triggerRef} className="mx-auto w-full max-w-[26rem]">
          <Button
            variant="accent"
            size="lg"
            fullWidth
            disabled={blocked}
            loading={pending}
            onClick={() => handleAdd('drawer')}
            aria-describedby={blocked ? 'buy-blocked-reason' : undefined}
          >
            {blocked ? 'Not available in your state' : 'Add to cart'}
          </Button>

          {/*
            Subordinate to "Add to cart" on purpose. One primary action per screen —
            and here the secondary one carries the larger commitment, so it should not
            be the button the eye lands on first.
          */}
          {!blocked && (
            <Button
              variant="secondary"
              size="lg"
              fullWidth
              disabled={pending}
              onClick={() => handleAdd('checkout')}
              className="mt-3"
            >
              Buy now
            </Button>
          )}
          {blocked && (
            <p id="buy-blocked-reason" className="mt-2 text-sm text-foreground-muted">
              {blockedReason}
            </p>
          )}
          {error && (
            <p role="alert" className="mt-2 text-sm text-danger-fg">
              {error}
            </p>
          )}
        </div>
      </div>

      <StickyAddToCart
        productName={option ? `${productName} — ${option.label}` : productName}
        priceCents={unitCents * quantity}
        disabled={blocked}
        onAddToCart={() => handleAdd('drawer')}
        {...(blockedReason ? { disabledReason: blockedReason } : {})}
        triggerRef={triggerRef}
      />
    </>
  )
}

function MinusGlyph() {
  return (
    <svg viewBox="0 0 16 16" className="size-4" aria-hidden="true">
      <path d="M3 8h10" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  )
}

function PlusGlyph() {
  return (
    <svg viewBox="0 0 16 16" className="size-4" aria-hidden="true">
      <path
        d="M8 3v10M3 8h10"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
    </svg>
  )
}
