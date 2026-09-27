import { unavailableIn } from '@/lib/catalog/repository'
import type { SortKey } from '@/lib/catalog/types'
import { jurisdictionName } from '@/lib/compliance/jurisdictions'
import { getVisitorState } from '@/lib/geo/visitor-state'
import { ProductCard } from '@/components/commerce/product-card'
import { ShopControls } from '@/components/commerce/shop-controls'
import { url } from '@/lib/seo/routes'
import { listMergedProducts } from '@/lib/catalog/merged'

const SORTS: readonly SortKey[] = ['featured', 'price-asc', 'price-desc', 'rating']

function parseSort(value: string | undefined): SortKey {
  return SORTS.includes(value as SortKey) ? (value as SortKey) : 'featured'
}

/**
 * Everything on /shop that depends on searchParams or the visitor's cookie.
 *
 * Isolated behind Suspense so the page header still prerenders. Both `searchParams`
 * and `cookies()` are dynamic under Cache Components, and either one in the page body
 * would opt the whole route out of a static shell.
 */
export async function ShopResults({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const params = await searchParams
  const visitorState = await getVisitorState()

  const sort = parseSort(typeof params.sort === 'string' ? params.sort : undefined)
  const query = typeof params.q === 'string' ? params.q : undefined
  const shipsToMe = params.availability === 'mine' && Boolean(visitorState)

  const products = await listMergedProducts({
    sort,
    ...(query ? { query } : {}),
    ...(shipsToMe && visitorState ? { shipsTo: visitorState } : {}),
  })

  // Stated plainly rather than silently filtered. A silent filter reads as "they
  // don't stock it"; an explained one reads as a business that knows the law.
  const blocked = visitorState ? unavailableIn(visitorState) : []

  return (
    <>
      <div className="mb-5 flex flex-wrap items-center gap-3">
        {visitorState && (
          <p className="text-sm text-foreground-muted">
            Showing availability for{' '}
            <span className="font-medium text-foreground">
              {jurisdictionName(visitorState)}
            </span>
            .
          </p>
        )}
      </div>

      <ShopControls
        sort={sort}
        query={query ?? ''}
        availabilityFilterEnabled={Boolean(visitorState)}
        availabilityActive={shipsToMe}
      />

      <p className="mt-6 text-sm text-foreground-muted" aria-live="polite">
        {products.length} product{products.length === 1 ? '' : 's'}
      </p>

      {products.length === 0 ? (
        <div className="mt-6 rounded-lg border border-border bg-surface p-8 text-center">
          <p className="font-medium text-foreground">Nothing matched that.</p>
          <p className="mt-1 text-sm text-foreground-muted">
            Try a broader search, or{' '}
            <a href={url.shop()} className="underline underline-offset-4">
              browse everything
            </a>
            .
          </p>
        </div>
      ) : (
        <>
          {/*
            Product cards are h3. Without an h2 for the grid the document jumps h1 -> h3,
            which is a real screen-reader navigation failure, not a lint nicety.
          */}
          <h2 className="sr-only">Products</h2>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:gap-5 md:grid-cols-3 xl:grid-cols-4 min-[1600px]:grid-cols-5">
            {products.map((product) => (
              <ProductCard
                key={product.slug}
                product={product}
                {...(visitorState ? { visitorState } : {})}
              />
            ))}
          </div>
        </>
      )}

      {blocked.length > 0 && !shipsToMe && visitorState && (
        <section className="mt-12 rounded-lg border border-border bg-surface-sunken p-6">
          <h2 className="font-display text-xl text-foreground">
            What we cannot ship to {jurisdictionName(visitorState)}
          </h2>
          <p className="mt-1 text-sm text-foreground-muted">
            We would rather tell you now than at checkout.
          </p>
          <ul className="mt-4 space-y-3">
            {blocked.slice(0, 5).map(({ product, reason }) => (
              <li key={product.slug} className="text-sm">
                <span className="font-medium text-foreground">{product.name}</span>
                <span className="text-foreground-muted"> — {reason}</span>
              </li>
            ))}
          </ul>
          {blocked.length > 5 && (
            <p className="mt-3 text-sm text-foreground-muted">
              …and {blocked.length - 5} more.{' '}
              <a
                href={url.legalityState(
                  jurisdictionName(visitorState).toLowerCase().replace(/\s+/g, '-'),
                )}
                className="underline underline-offset-4"
              >
                See the full legal position for {jurisdictionName(visitorState)}
              </a>
              .
            </p>
          )}
        </section>
      )}
    </>
  )
}

export function ShopResultsSkeleton() {
  return (
    <div className="min-h-[70vh] animate-pulse" aria-hidden>
      <div className="mb-5 h-11 w-56 rounded-md bg-surface-sunken" />
      <div className="h-14 border-y border-border" />
      <div className="mt-8 grid grid-cols-2 gap-3 sm:gap-5 md:grid-cols-3 xl:grid-cols-4 min-[1600px]:grid-cols-5">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-80 rounded-lg bg-surface-sunken" />
        ))}
      </div>
    </div>
  )
}
