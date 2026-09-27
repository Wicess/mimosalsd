import { ProductCard } from '@/components/commerce/product-card'
import type { UsJurisdictionCode } from '@/lib/compliance/types'
import { listMergedProducts } from '@/lib/catalog/merged'

/**
 * The blog → revenue loop.
 *
 * Per the brief: blogs are informative content that ALSO recommends our products.
 * This component is how that happens — contextually, from live catalogue data, at the
 * end of the piece the reader came for. It doubles as automatic internal linking,
 * which is why the link graph does not need hand-maintaining.
 *
 * It never appears mid-sentence and never interrupts the argument. Content that
 * earns its ranking on information should not read like an advertorial.
 */
export async function RecommendedProducts({
  slugs,
  visitorState,
  heading = 'Related products',
}: {
  slugs: readonly string[]
  visitorState?: UsJurisdictionCode
  heading?: string
}) {
  // One merged list, then a lookup — not a merged fetch per slug. The override map
  // is cached, but a call per slug would still walk it repeatedly for every block.
  const merged = await listMergedProducts()
  const bySlug = new Map(merged.map((p) => [p.slug, p]))
  const products = slugs
    .map((slug) => bySlug.get(slug))
    .filter((p): p is NonNullable<typeof p> => Boolean(p))

  if (products.length === 0) return null

  return (
    <section className="mt-12 border-t border-border pt-8">
      <h2 className="font-display text-2xl text-foreground">{heading}</h2>
      <div className="mt-4 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {products.map((p) => (
          <ProductCard
            key={p.slug}
            product={p}
            {...(visitorState ? { visitorState } : {})}
          />
        ))}
      </div>
    </section>
  )
}
