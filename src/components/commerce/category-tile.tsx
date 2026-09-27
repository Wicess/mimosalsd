import Image from 'next/image'
import { listMergedProducts } from '@/lib/catalog/merged'
import type { Category, Product } from '@/lib/catalog/types'
import { displayImageFor } from '@/lib/catalog/sample-images'
import { url } from '@/lib/seo/routes'

/**
 * A category, as a poster.
 *
 * Everything on it is READ FROM THE CATALOGUE AS IT IS SOLD — posted products
 * included — so the photograph is a real product in this category, and the count is
 * how many products are actually in it. A category tile that
 * says "12 products" because someone typed 12 is wrong the first time a product
 * is delisted, and nothing in the system would ever notice.
 *
 * The whole tile is one link. No secondary action: this is a doorway, and a
 * doorway with two handles is a decision the reader did not ask to make.
 */
export async function CategoryTile({ category }: { category: Category }) {
  const products = await listMergedProducts({ categorySlug: category.slug })
  /*
    A photograph of something actually in this category: the first product with a
    real photograph, preferring one the owner featured. A product whose only image
    is a placeholder is passed over, so the tile never wears a sample if a real
    photograph exists anywhere in the aisle.
  */
  const shot = (list: readonly Product[]) =>
    list.map((p) => displayImageFor(p)).find((i) => i && !i.isSample)
  const byFeature = [...products].sort((a, b) => Number(b.isFeatured) - Number(a.isFeatured))
  const image = shot(byFeature) ?? (byFeature[0] ? displayImageFor(byFeature[0]) : undefined)

  return (
    <a
      href={url.category(category.slug)}
      /*
        `cat-tile` is the hook the rail's CSS uses to push this back when a
        sibling is hovered and bring it forward when this one is. The class
        carries no styling of its own.
      */
      className="cat-tile group/tile relative block w-[var(--tile)] shrink-0 overflow-hidden rounded-3xl bg-surface-sunken ring-1 ring-[var(--border)] focus-visible:outline-none"
    >
      {/*
        5:4, not 4:5. Portrait made the rail the tallest thing on the page for a
        section whose whole job is to be passed through — and the tile is read as
        a name over a photograph, which does not need the extra height.
      */}
      <div className="relative aspect-[5/4] w-full overflow-hidden">
        {image ? (
          <Image
            src={image.src}
            alt=""
            aria-hidden
            fill
            sizes="(max-width: 639px) 76vw, (max-width: 1279px) 44vw, 25vw"
            className="object-cover"
          />
        ) : null}

        {/* Deep enough to hold four lines, and nothing above them. */}
        <span
          aria-hidden
          className="absolute inset-x-0 bottom-0 h-3/4 bg-gradient-to-t from-stone-950 via-stone-950/75 to-transparent"
        />

        {image?.isSample && (
          <span className="absolute top-4 left-4 rounded-full bg-stone-950/75 px-2.5 py-1 text-[11px] font-medium tracking-[0.14em] text-white uppercase">
            Sample
          </span>
        )}

        <div className="absolute inset-x-0 bottom-0 p-5">
          <p className="tabular font-product text-[11px] tracking-[0.16em] text-white/60 uppercase">
            {products.length} {products.length === 1 ? 'product' : 'products'}
          </p>

          <h3 className="mt-1.5 font-display text-xl leading-tight text-balance text-white">
            {category.name}
          </h3>

          <p className="mt-1.5 line-clamp-2 text-sm leading-snug text-pretty text-white/70">
            {category.intro}
          </p>

          {/*
            The arrow is the affordance, and it leans in on hover. Transform only,
            so it costs nothing and cannot shift the line it sits on.
          */}
          <p className="mt-3 inline-flex items-center gap-2 text-sm font-medium text-white">
            Browse
            <span
              aria-hidden
              className="transition-transform duration-300 ease-[var(--ease-standard)] group-hover/tile:translate-x-1 motion-reduce:transition-none"
            >
              →
            </span>
          </p>
        </div>
      </div>
    </a>
  )
}
