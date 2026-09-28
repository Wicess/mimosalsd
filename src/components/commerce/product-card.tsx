import { canShipTo } from '@/lib/compliance/shipping'
import type { UsJurisdictionCode } from '@/lib/compliance/types'
import { isOnStateDirectory, listPrice, type Product } from '@/lib/catalog/types'
import { defaultSizeOption, sizeOptions } from '@/lib/catalog/sizing'
import { url } from '@/lib/seo/routes'
import { cn, formatCents } from '@/lib/utils'
import Image from 'next/image'
import { displayImageFor } from '@/lib/catalog/sample-images'
import { AddToCartButton } from '@/components/commerce/add-to-cart-button'

/**
 * Product card.
 *
 * Two things here that competitors do not do, and both are cheap:
 *
 *  1. The lab-test badge is on the CARD, not buried in a PDF drawer three clicks
 *     deep. The #1 thing buyers are told to check is visible where they browse.
 *  2. State availability is resolved HERE when we know the visitor's state, so a
 *     shopper never invests attention in something we cannot send them.
 */
export function ProductCard({
  product,
  visitorState,
  className,
  compact = false,
}: {
  product: Product
  visitorState?: UsJurisdictionCode
  className?: string
  /**
   * Showcase mode: no buy button, tighter box.
   *
   * For a row that exists to say "this is what we sell" rather than "pick one" —
   * the homepage strip above the category rail. The button is what makes the
   * full card tall, and on a page where the reader has not chosen anything yet
   * it asks for a commitment three sections too early. The whole card is still a
   * link to the product page, where the real buy controls live.
   *
   * The shop and the category pages keep the button. There, choosing IS the task.
   */
  compact?: boolean
}) {
  // One price, never a range: a pound, or one unit of a disposable.
  const price = listPrice(product)
  /*
    What the card quotes is the size the card's button ADDS — 1/4 lb, the opening
    size — not the price of a pound (owner, 2026-09-15). The two were different
    numbers on the same card, so the grid advertised $140 and the button put $35 in
    the basket. A disposable has no sizes and quotes its unit price.
  */
  const shown = product.sizing ? defaultSizeOption(product.sizing) : undefined
  const sizes = product.sizing ? sizeOptions(product.sizing) : []
  /*
    The size the card adds. `variantsForLadder` emits variants in ladder order, so
    the default option's index is the default variant's index — matched by position
    rather than by rebuilding the id, which would silently break the day the id
    scheme changes.
  */
  const defaultIndex = product.sizing
    ? Math.max(0, sizes.findIndex((o) => o.key === product.sizing!.defaultKey))
    : 0
  const defaultVariant = product.variants[defaultIndex] ?? product.variants[0]
  const decision = visitorState
    ? canShipTo(visitorState, product.productLine, {
        onStateProductDirectory: isOnStateDirectory(product, visitorState),
      })
    : undefined

  const blocked = decision !== undefined && !decision.allowed
  const image = displayImageFor(product)

  /*
   * The chips, in priority order. The row is a fixed 24px and clips, so the first
   * entry must always be the one worth keeping when the card is narrow.
   */
  const chips: { label: string; alert?: boolean; wide?: boolean }[] = [
    ...(decision
      ? [
          blocked
            ? { label: 'Not in your state', alert: true }
            : decision.status === 'RESTRICTED'
              ? { label: 'Conditions apply', alert: true }
              : { label: 'Ships to you' },
        ]
      : product.batchCodes.length > 0
        ? [{ label: 'Lab tested' }]
        : []),
    // No 21+ label on the card (owner, 2026-09-15). The age gate and the checkout attestation still apply.
    ...(product.notForHumanConsumption ? [{ label: 'Botanical use only', wide: true }] : []),
  ]

  return (
    <article
      className={cn(
        'group relative flex flex-col overflow-hidden bg-surface',
        compact ? 'rounded-xl' : 'rounded-2xl',
        // Borderless, like the reference: the colour panel defines the card. A ring
        // rather than a border so it sits inside the radius and never doubles up
        // against the panel's own edge.
        //
        // The variable directly, not a named colour utility. `ring-border` and
        // `ring-border-subtle` both fell back to currentColor and drew a near-black
        // outline round every card — Tailwind does not warn, it just uses the
        // fallback. `var(--border)` is the value the rest of the site's borders
        // already use, so it cannot drift from them.
        'ring-1 ring-[var(--border)]',
        /*
          A lift, not a show. A shopper passes over these dozens of times in a
          session, so the hover has to read as "this is pickable" and then get out of
          the way — 2px and a shadow, no scale on the card itself.

          `:active` propagates to ancestors, so pressing the stretched link inside
          presses the whole card. 0.99 rather than the 0.97 a button uses: the card is
          twenty times the area, and the same ratio on something this size reads as a
          lurch.
        */

        /*
          `translate` and `scale`, not `transform`.

          Tailwind v4 implements `translate-*` and `scale-*` with the standalone CSS
          `translate` and `scale` properties. Naming `transform` in the transition
          list compiles, passes review, and animates nothing — the lift and the press
          both snapped into place. Confirmed in a browser: the element reports
          `translate: 0px -2px` on hover while `transform` stays `none`.
        */
        'card-lift',
        'transition-[translate,scale,box-shadow,border-color] duration-[240ms] ease-[var(--ease-standard)]',
        'active:scale-[0.99] active:duration-[120ms] motion-reduce:active:scale-100',
        blocked && 'opacity-70',
        className,
      )}
    >
      {/*
        The link covers the card via a stretched pseudo-element rather than wrapping
        it. A <button> nested inside an <a> is invalid HTML — browsers recover from it
        unpredictably and assistive technology announces it as one confused control —
        so the add-to-cart button below is a SIBLING that sits above the overlay —
        when there is one; `compact` omits it.
      */}
      <a
        href={url.product(product.slug)}
        className="flex flex-1 flex-col after:absolute after:inset-0 after:content-['\'\']"
      >
        {/*
          THE COLOUR FIELD.

          The photograph is inset on a panel rather than bled to the card edge, which
          is what makes a bag of root bark read as a product shot instead of a stock
          photo. `--product-field` is semantic: moss-100 in light, moss-900 in dark,
          so the panel never sits as a pale mint slab on a dark page.
        */}
        <div className={cn('relative overflow-hidden rounded-xl bg-product-field', compact ? 'm-1.5' : 'm-2')}>
          {/*
            Fixed aspect ratio reserves the box before the image loads. Our CLS budget
            for the whole page is 0.1; a grid of unreserved images blows it alone. The
            ratio is on the WRAPPER, so it holds whether or not an image resolves.
          */}
          {/* Even inset all round. It was `mb-0` so the band could close the panel. */}
          <div
            className={cn(
              'relative overflow-hidden rounded-lg',
              compact ? 'm-1.5' : 'm-2',
              // 3:2 rather than 4:3 — the same photograph, roughly 40px less card.
              compact ? 'aspect-[3/2]' : 'aspect-[4/3]',
            )}
          >
            {image ? (
              <Image
                src={image.src}
                alt={image.isSample ? image.alt : product.name}
                fill
                // Describes the real grid: two-up to 1023px, three to 1279px, then
                // four (five on the shop grid past 1600px). Given as a percentage
                // rather than a fixed px so it stays true at every one of those steps.
                sizes="(max-width: 1023px) 50vw, (max-width: 1279px) 33vw, 25vw"
                className="object-cover transition-transform duration-[280ms] ease-[var(--ease-standard)] group-hover:scale-[1.04] motion-reduce:transition-none motion-reduce:group-hover:scale-100"
              />
            ) : null}

            {image?.isSample && (
              <span className="absolute bottom-2 left-2 rounded bg-stone-950/75 px-2 py-0.5 text-[11px] font-medium tracking-wide text-white uppercase">
                Sample
              </span>
            )}
          </div>
        </div>

        <div className={cn('flex flex-1 flex-col px-3 pb-3', !compact && 'md:px-4 md:pb-4')}>
          {/*
            Name left, size range right — the reference puts its call to action here,
            but this card carries a real button below, and two competing actions on
            one card is one more decision than the grid needs.

            The title is ONE line, truncated. Two lines meant a card whose name wrapped
            was taller than its neighbour, and the grid stretched every card in the row
            to match. The full name is on the product page, one click away.
          */}
          <div className="flex items-baseline justify-between gap-2">
            <h3 className={cn('truncate font-product text-sm leading-snug font-medium text-foreground', !compact && 'md:text-base')}>
              {product.name}
            </h3>
            {product.rating && (
              <span className="shrink-0 text-xs text-foreground-muted">
                <span aria-hidden>★</span>{' '}
                <span className="tabular">{product.rating.average.toFixed(1)}</span>
                <span className="sr-only">
                  {product.rating.average} out of 5 from {product.rating.count} reviews
                </span>
              </span>
            )}
          </div>

          {/*
            THE CHIP ROW — one row, fixed height, never wraps.

            Badge counts vary by product, and because the row used to wrap, every card
            in the grid stretched to the tallest. A fixed non-wrapping row keeps the
            whole row one height.
          */}
          <div className="mt-2 flex h-6 flex-nowrap items-center gap-1.5 overflow-hidden">
            {/*
              Plain neutral pills, no icons and no tone colour — the reference sets
              these as quiet attribute tags, and the eye should land on the photo, the
              name and the price before it lands on a chip.

              The exception is a state refusal. That is not an attribute, it is the
              reason the button below is disabled, so it keeps its colour.
            */}
            {chips.map((chip) => (
              <span
                key={chip.label}
                className={cn(
                  'shrink-0 rounded-full px-2.5 py-1 text-xs leading-none whitespace-nowrap',
                  chip.alert
                    ? 'bg-warning-bg font-medium text-warning-fg'
                    : 'bg-surface-sunken text-foreground-muted',
                  chip.wide && 'max-[1279px]:hidden',
                )}
              >
                {chip.label}
              </span>
            ))}
          </div>

          {/*
            THE PRICE, back in the card body.

            It rode in the corner of the photograph for a while, which costs no
            vertical space but puts the number over an image whose brightness we do
            not control — a light bag of bark behind a translucent chip is a price
            you have to squint at. Here it sits on a known surface, on the baseline
            the eye is already following down the card, and it can name the size
            the number belongs to.

            `mt-auto` pins it to the bottom, so the price line is level across every
            card in a row whatever else each one carries.
          */}
          <div className={cn('mt-auto flex items-baseline gap-2', compact ? 'pt-2' : 'pt-3')}>
            <span className={cn('tabular font-product text-base font-semibold text-foreground', !compact && 'md:text-lg')}>
              {formatCents(shown ? shown.priceCents : price.cents)}
            </span>
            <span className="text-sm text-foreground-subtle">{shown ? shown.label : 'each'}</span>
          </div>
        </div>
      </a>

      {!compact && (
        <div className="relative px-3 pb-3 md:px-4 md:pb-4">
          {defaultVariant && (
            <AddToCartButton
              className="text-sm whitespace-nowrap md:text-base"
              slug={product.slug}
              variantId={defaultVariant.id}
              blocked={blocked}
              {...(blocked && decision ? { blockedReason: decision.reason } : {})}
            />
          )}
        </div>
      )}
    </article>
  )
}
