import type { ProductLine } from '@/lib/compliance/types'
import { getVisitorState } from '@/lib/geo/visitor-state'
import { ProductCard } from '@/components/commerce/product-card'
import { StateAvailability } from '@/components/compliance/state-availability'
import { listMergedProducts } from '@/lib/catalog/merged'

/**
 * The per-visitor half of a category page. Behind Suspense so the category's intro
 * copy — which is what actually ranks — still prerenders as a static shell.
 */
export async function CategoryProducts({
  categorySlug,
  productLine,
}: {
  categorySlug: string
  productLine: ProductLine
}) {
  const visitorState = await getVisitorState()
  const products = await listMergedProducts({ categorySlug })

  return (
    <>
      <div className="mt-5">
      </div>

      {visitorState && (
        <div className="mt-6 max-w-4xl">
          <StateAvailability stateCode={visitorState} productLine={productLine} />
        </div>
      )}

      <h2 className="sr-only">Products in this category</h2>
      <div className="mt-8 grid grid-cols-2 gap-3 sm:gap-5 md:grid-cols-3 xl:grid-cols-4 min-[1600px]:grid-cols-5">
        {products.map((product) => (
          <ProductCard
            key={product.slug}
            product={product}
            {...(visitorState ? { visitorState } : {})}
          />
        ))}
      </div>
    </>
  )
}

export function CategoryProductsSkeleton() {
  return (
    <div className="min-h-[70vh] animate-pulse" aria-hidden>
      <div className="mt-5 h-11 w-56 rounded-md bg-surface-sunken" />
      <h2 className="sr-only">Products in this category</h2>
      <div className="mt-8 grid grid-cols-2 gap-3 sm:gap-5 md:grid-cols-3 xl:grid-cols-4 min-[1600px]:grid-cols-5">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-80 rounded-lg bg-surface-sunken" />
        ))}
      </div>
    </div>
  )
}
