import { isOnStateDirectory, type Product } from '@/lib/catalog/types'
import { getVisitorState } from '@/lib/geo/visitor-state'
import { BuyBox } from '@/components/commerce/buy-box'
import { StateAvailability } from '@/components/compliance/state-availability'

/**
 * The per-visitor half of the PDP.
 *
 * Isolated behind a Suspense boundary so the rest of the page — product copy, specs,
 * lab results, JSON-LD, everything a crawler and the LCP need — still prerenders as
 * a static shell. One `cookies()` call in the page body would otherwise opt the whole
 * route out of prerendering, which is exactly what it did before this split.
 *
 * The order inside is load-bearing and must not be rearranged: availability and the
 * consumption notice render ABOVE the buy button.
 */
export async function PurchasePanel({ product }: { product: Product }) {
  const visitorState = await getVisitorState()
  // The buy button no longer refuses by state (owner, 2026-09-19). What the state
  // rules say is still shown, in the availability note above it and on the state pages.

  return (
    <>
      <div className="space-y-4">
        {visitorState ? (
          <StateAvailability
            stateCode={visitorState}
            productLine={product.productLine}
            onStateProductDirectory={isOnStateDirectory(product, visitorState)}
          />
        ) : (
          /*
            Nothing here when the visitor's state is unknown.

            This slot held a panel saying we would confirm shipping at submit — a
            sentence that told the reader nothing they could act on, sitting in a
            bordered box directly above the buy controls where the eye lands. The
            same promise is made at checkout, by the thing that actually does it.
          */
          null
        )}
        {/* No "Botanical use only" notice on the product page (owner, 2026-09-19). */}
      </div>

      <div className="mt-6">
        <BuyBox
          slug={product.slug}
          productName={product.name}
          variants={product.variants}
          priceTiers={product.priceTiers}
          {...(product.sizing ? { sizing: product.sizing } : {})}
        />
      </div>
    </>
  )
}

/** Reserves the panel's height so streaming it in contributes nothing to CLS. */
export function PurchasePanelSkeleton() {
  return (
    <div className="animate-pulse space-y-4" aria-hidden>
      <div className="h-11 w-56 rounded-md bg-surface-sunken" />
      <div className="h-28 rounded-lg bg-surface-sunken" />
      <div className="mt-6 h-12 rounded-md bg-surface-sunken" />
    </div>
  )
}
