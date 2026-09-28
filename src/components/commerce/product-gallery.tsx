'use client'

import { useState } from 'react'
import Image from 'next/image'
import { cn } from '@/lib/utils'

/**
 * The product gallery.
 *
 * One large frame with the other views as thumbnails beneath it. Clicking a
 * thumbnail swaps the large frame; it does not open a lightbox, because a
 * lightbox on a product page is a modal you have to dismiss before you can reach
 * the buy button.
 *
 * EVERY VIEW IS RENDERED, not swapped by changing a `src`. All of them are in the
 * DOM from the start with only the active one visible, so switching is a class
 * change rather than a network request — the second click never shows an empty
 * box while a JPEG downloads. Only the first is `priority`; it is the LCP element
 * and the rest must not compete with it for bandwidth.
 *
 * With a single view the thumbnail strip does not render at all. One thumbnail
 * under one photograph is a control that does nothing.
 */
export function ProductGallery({
  views,
  alt,
  alts,
  caption,
}: {
  /** Image URLs, main frame first. */
  views: readonly string[]
  alt: string
  /** A description per view, when each photo has its own. */
  alts?: readonly string[]
  /** Rendered over the foot of the frame — the sample-image disclosure. */
  caption?: React.ReactNode
}) {
  const [active, setActive] = useState(0)
  if (views.length === 0) return null

  return (
    /*
      A flex column so the frame can take its height from the ROW rather than from
      its own width. Beside a buy panel that ends around 540px, a square frame in a
      wide column rendered ~660px tall and hung well below everything it was selling.
    */
    <div className="flex h-full flex-col">
      {/*
        BELOW `lg`: a reserved 4:3. It is the LCP element and the layout is stacked at
        those widths, so there is nothing beside it to borrow a height from and the
        ratio has to hold the space itself.

        4:3 rather than square, and the 89px that saves is not cosmetic. Measured on a
        390x844 phone, a square frame put the <h1> at y=682 — directly underneath the
        fixed buy bar, which occupies 714-788. The product's own name, its 21+ badge
        and its price were all behind the bar at rest, and no amount of bottom padding
        fixes that: page padding lets the LAST element scroll clear, it cannot move
        something that sits at the fold.

        `lg` AND UP: `flex-1` instead, so the frame stretches to whatever the buy
        panel beside it measures — which is the height the photograph should be. That
        does not reintroduce layout shift: the column it matches is server-rendered
        text whose height is known at first paint, so the row is already sized before
        the JPEG arrives. The `min-h-80` floor stops it collapsing to a sliver if the
        panel beside it is ever shorter than the photograph deserves.
      */}
      <figure className="relative aspect-[4/3] w-full overflow-hidden rounded-xl bg-surface-sunken lg:aspect-auto lg:min-h-80 lg:flex-1">
        {views.map((src, i) => (
          <Image
            key={src}
            src={src}
            alt={i === active ? (alts?.[i] ?? alt) : ''}
            aria-hidden={i !== active}
            fill
            preload={i === 0}
            fetchPriority={i === 0 ? 'high' : 'auto'}
            sizes="(max-width: 1023px) 100vw, (max-width: 1279px) 40vw, 520px"
            className={cn(
              'object-cover transition-opacity duration-300 ease-[var(--ease-standard)] motion-reduce:transition-none',
              i === active ? 'opacity-100' : 'opacity-0',
            )}
          />
        ))}
        {caption}
      </figure>

      {views.length > 1 && (
        /*
          A radiogroup, not a list of buttons: picking a view is choosing one of a
          set, and that is what a screen reader should be told it is doing.
        */
        <div
          role="radiogroup"
          aria-label="Product views"
          className="mt-3 grid shrink-0 grid-cols-4 gap-3 sm:grid-cols-5"
        >
          {views.map((src, i) => (
            <button
              key={src}
              type="button"
              role="radio"
              aria-checked={i === active}
              aria-label={`View ${i + 1} of ${views.length}`}
              onClick={() => setActive(i)}
              className={cn(
                'relative aspect-square overflow-hidden rounded-lg bg-surface-sunken transition-[box-shadow,opacity] duration-200 ease-[var(--ease-standard)] focus-visible:outline-none motion-reduce:transition-none',
                i === active
                  ? 'opacity-100 ring-2 ring-primary'
                  : 'opacity-60 ring-1 ring-[var(--border)] hover:opacity-100',
              )}
            >
              <Image
                src={src}
                alt=""
                aria-hidden
                fill
                sizes="88px"
                className="object-cover"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
