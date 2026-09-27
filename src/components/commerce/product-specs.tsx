import type { Product } from '@/lib/catalog/types'

/**
 * The product's specifications, as a datasheet (owner, 2026-09-15).
 *
 * Filled by researching the exact product when its page is written, or by the owner
 * in the edit form. Posted products always had the field; nothing rendered it.
 * Nothing renders when there is nothing to show: an empty table reads as a promise
 * the page does not keep.
 */
export function ProductSpecs({ product, className }: { product: Product; className?: string }) {
  if (product.specs.length === 0) return null
  return (
    <section aria-labelledby="product-specs" className={className}>
      <h2 id="product-specs" className="font-display text-2xl leading-tight text-foreground">
        Specifications
      </h2>
      {/*
        One column on a phone. The two-column sheet switched on at `sm`, which is 375px
        here, so on a 390px iPhone each half was ~165px: a 24px gap and a label that
        would not shrink left the value 56-94px wide, "PACT Act compliant carrier" broke
        a word a line, and the longest values pushed the page 18px past the screen.
        Label 2 parts to value 3, both allowed to wrap, and a value breaks rather than
        widening the page.
      */}
      <dl className="mt-6 grid gap-x-14 md:grid-cols-2">
        {product.specs.map(([label, value]) => (
          <div key={`${label}-${value}`} className="grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)] items-baseline gap-4 border-b border-border-data py-3">
            <dt className="min-w-0 font-product text-sm font-semibold text-foreground">{label}</dt>
            <dd className="min-w-0 text-right text-sm text-pretty text-foreground-muted [overflow-wrap:anywhere]">{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  )
}
