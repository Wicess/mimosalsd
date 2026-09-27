import { listMergedProducts } from '@/lib/catalog/merged'
import { ProductCard } from '@/components/commerce/product-card'
import type { Product } from '@/lib/catalog/types'
import type { UsJurisdictionCode } from '@/lib/compliance/types'
import { url } from '@/lib/seo/routes'

/**
 * One row of the nearest neighbours.
 *
 * Chosen from the catalogue AS IT IS SOLD — the merged one, so the products posted
 * from the admin panel are what a shopper is offered, not the ones written into the
 * repository. A curated "you may also like" is correct on the day it is written and
 * wrong the first time a product is delisted, and nothing in the system would notice.
 *
 * Same category first, because that is what "similar" means to someone comparing
 * two weights of the same bark. If the category is thin the row is topped up from
 * the rest of the shop rather than rendering a lonely single card — a row of one
 * reads as a bug.
 *
 * `compact` cards: no buy button. This row is for moving sideways to a better
 * fit, and a second add-to-cart under a product someone has not chosen yet is one
 * decision too many on a page that already has one.
 */
export async function SimilarProducts({
  product,
  visitorState,
  limit = 4,
}: {
  product: Product
  visitorState?: UsJurisdictionCode
  limit?: number
}) {
  const [inCategory, everything] = await Promise.all([
    listMergedProducts({ categorySlug: product.categorySlug }),
    listMergedProducts(),
  ])
  const sameCategory = inCategory.filter((p) => p.slug !== product.slug)
  const filler = everything.filter((p) => p.slug !== product.slug && p.categorySlug !== product.categorySlug)

  const products = [...sameCategory, ...filler].slice(0, limit)
  if (products.length === 0) return null

  return (
    <section aria-labelledby="similar-products">
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
        <h2 id="similar-products" className="font-display text-2xl text-foreground">
          Related products
        </h2>
        <a
          href={url.category(product.categorySlug)}
          className="inline-flex min-h-11 items-center text-sm text-primary underline underline-offset-4"
        >
          All {product.categorySlug.replace(/-/g, ' ')}
        </a>
      </div>

      {/* One row. Four across where there is room, two on a phone. */}
      <div className="mt-6 grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-4">
        {products.map((p) => (
          <ProductCard
            key={p.slug}
            product={p}
            compact
            {...(visitorState ? { visitorState } : {})}
          />
        ))}
      </div>
    </section>
  )
}
