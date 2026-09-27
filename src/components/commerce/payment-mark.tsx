import Image from 'next/image'
import type { PaymentMethod } from '@/lib/orders/types'
import { cn } from '@/lib/utils'

/**
 * A payment brand mark, cut out: no plate, no tile, sitting on whatever surface
 * the caller puts it on (owner, 2026-09-15).
 *
 * ── Why no plate any more ──────────────────────────────────────────────────
 * The marks used to sit on white plates, because Chime came as a JPEG with its
 * own white square and the Apple mark was a black glyph that vanished on the dark
 * theme. On the site's dark ground the plates read as pasted-on stickers. Now:
 *
 *   - Cash App and Bitcoin are their own glyphs in their brand colours, lifted out
 *     of the square app tiles (public/payments/*-mark.svg).
 *   - Chime is its wordmark, traced to a vector from the supplied artwork, in
 *     Chime green on transparent.
 *   - Apple is drawn inline in `currentColor`, the black-or-white treatment Apple's
 *     own guidelines allow, so it follows the theme instead of needing a plate.
 *
 * ── Optical size ──────────────────────────────────────────────────────────
 * A tall glyph and a long wordmark at the same height do not look the same size:
 * the wordmark looks far bigger. Each mark carries the share of the box height it
 * fills, so the four read as one row. The caller sets the box height only.
 *
 * Decorative by construction. Every caller renders the method's name beside it,
 * and a screen reader announcing "Cash App logo, Cash App" is noise.
 */

type Mark =
  | { readonly kind: 'file'; readonly src: string; readonly ratio: number; readonly scale: number }
  | { readonly kind: 'apple'; readonly scale: number }

const MARKS: Record<PaymentMethod, Mark> = {
  CASHAPP: { kind: 'file', src: '/payments/cashapp-mark.svg', ratio: 0.7, scale: 1 },
  CHIME: { kind: 'file', src: '/payments/chime-mark.svg', ratio: 3.123, scale: 0.6 },
  APPLE_CASH: { kind: 'apple', scale: 0.72 },
  BITCOIN: { kind: 'file', src: '/payments/bitcoin-mark.svg', ratio: 0.761, scale: 0.9 },
}

export function PaymentMark({
  method,
  className,
}: {
  method: PaymentMethod
  /** Sets the box height (for example `h-8`). The mark is centred inside it. */
  className?: string
}) {
  const mark = MARKS[method]
  return (
    <span aria-hidden className={cn('inline-flex shrink-0 items-center justify-center', className)}>
      {mark.kind === 'apple' ? (
        <svg
          viewBox="0 1 82 32"
          fill="currentColor"
          style={{ height: `${mark.scale * 100}%` }}
          className="w-auto text-foreground"
        >
          <path
            transform="translate(1 2) scale(1.22)"
            d="M16.365 1.43c0 1.14-.493 2.27-1.177 3.08-.744.9-1.99 1.57-2.987 1.57-.12 0-.23-.02-.3-.03-.01-.06-.04-.22-.04-.39 0-1.15.572-2.27 1.206-2.98.804-.94 2.142-1.64 3.248-1.68.03.13.05.28.05.43zm4.565 15.71c-.03.07-.463 1.58-1.518 3.12-.945 1.34-1.94 2.71-3.43 2.71-1.517 0-1.9-.88-3.63-.88-1.698 0-2.302.91-3.67.91-1.377 0-2.332-1.26-3.428-2.8-1.287-1.82-2.323-4.63-2.323-7.28 0-4.28 2.797-6.55 5.552-6.55 1.448 0 2.675.95 3.6.95.865 0 2.222-1.01 3.902-1.01.613 0 2.886.06 4.374 2.19-.13.09-2.383 1.37-2.383 4.19 0 3.26 2.854 4.42 2.955 4.45z"
          />
          <text x="38" y="25" fontFamily="-apple-system,Helvetica,Arial,sans-serif" fontSize="23" fontWeight="500" letterSpacing="-0.5">
            Pay
          </text>
        </svg>
      ) : (
        <Image
          src={mark.src}
          alt=""
          width={Math.round(mark.ratio * 100)}
          height={100}
          unoptimized
          style={{ height: `${mark.scale * 100}%` }}
          className="w-auto"
        />
      )}
    </span>
  )
}
