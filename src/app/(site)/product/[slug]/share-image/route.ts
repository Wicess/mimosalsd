import { productShareCard } from '@/lib/seo/product-share-card'

/** The product's own 1200×630 share card. See lib/seo/product-share-card.tsx. */
export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  return productShareCard(params)
}
