import type { PrismaClient } from '@prisma/client'
import { CATEGORIES, PRODUCTS } from '@/lib/catalog/catalog.data'
import { toPostedProduct } from '@/lib/catalog/posted-product'
import type { Product } from '@/lib/catalog/types'
import type { OrderItem } from './types'

/**
 * ─────────────────────────────────────────────────────────────────────────────
 *  FOREIGN-KEY ANCHORS FOR ORDER LINES.
 *
 *  `OrderItem.productId` and `OrderItem.variantId` are foreign keys to
 *  `Product.id` and `ProductVariant.id` — database cuids. The catalogue is
 *  authored in code, and nothing ever wrote its products into those tables: the
 *  rows that exist came from an older demo seed, under different slugs.
 *
 *  Checkout wrote the catalogue SLUG into `productId`. That matches no row, so
 *  Postgres refused every real order with a foreign-key violation — checked
 *  against the live database: 0 of 11 catalogue slugs and 0 of 20 variant ids
 *  exist as row ids, and both constraints are enforced. Nothing caught it. The
 *  customer got an error page, the cart stayed full, and no alert fired.
 *
 *  This makes the rows the constraint needs, at the moment an order needs them.
 *
 *  ── Create-only, on purpose ────────────────────────────────────────────────
 *  Every upsert has `update: {}`. The authored catalogue, with admin overrides
 *  on top, is the source of truth for names, prices and flags; these rows are
 *  anchors and nothing reads what they say. Updating them would grow a second
 *  copy of the catalogue that drifts, and the order line snapshots everything it
 *  displays anyway.
 *
 *  Scalar foreign keys, no nested writes, one unique field per `where`: the shape
 *  Prisma turns into a native INSERT … ON CONFLICT, so two orders racing to anchor
 *  the same product cannot both insert it.
 *
 *  ── No cache, on purpose ───────────────────────────────────────────────────
 *  Orders are rare and an anchor is three indexed upserts. A process-level cache
 *  would save milliseconds and could hand out the id of a row whose insert was
 *  rolled back — a foreign-key failure of exactly the kind this file exists to
 *  end.
 * ─────────────────────────────────────────────────────────────────────────────
 */

export type AnchorClient = Pick<
  PrismaClient,
  'category' | 'product' | 'productVariant' | 'postedProduct'
>

export interface LineAnchor {
  readonly productId: string
  readonly variantId: string
}

type LineRef = Pick<OrderItem, 'productSlug' | 'variantId'>

const keyOf = (line: LineRef) => `${line.productSlug}\u0000${line.variantId}`

/** Resolves (creating where needed) the row ids every line of an order points at. */
export async function anchorOrderLines(
  client: AnchorClient,
  lines: readonly LineRef[],
): Promise<ReadonlyMap<string, LineAnchor>> {
  const anchors = new Map<string, LineAnchor>()
  for (const line of lines) {
    const key = keyOf(line)
    if (!anchors.has(key)) anchors.set(key, await anchorLine(client, line))
  }
  return anchors
}

/** The anchor for one line. Throws rather than let a line be written against nothing. */
export function anchorFor(anchors: ReadonlyMap<string, LineAnchor>, line: LineRef): LineAnchor {
  const anchor = anchors.get(keyOf(line))
  if (!anchor) throw new Error(`No anchor resolved for ${line.productSlug} / ${line.variantId}.`)
  return anchor
}

/**
 * The product an order line was priced against: authored first, then posted.
 *
 * The posted row is read directly, uncached and whatever its active flag. An order
 * that reached this point was priced a moment ago, and an operator deactivating
 * the product in between must not make its foreign keys unresolvable.
 */
async function orderedProduct(client: AnchorClient, slug: string): Promise<Product | undefined> {
  const authored = PRODUCTS.find((p) => p.slug === slug)
  if (authored) return authored
  const row = await client.postedProduct.findUnique({ where: { slug } })
  return row ? toPostedProduct(row) : undefined
}

async function anchorLine(client: AnchorClient, line: LineRef): Promise<LineAnchor> {
  const product = await orderedProduct(client, line.productSlug)
  if (!product) {
    throw new Error(
      `Order line ${line.productSlug} / ${line.variantId} is neither in the catalogue nor posted.`,
    )
  }

  const variant = product.variants.find((v) => v.id === line.variantId)
  if (!variant) throw new Error(`Variant ${line.variantId} is not part of ${product.slug}.`)

  const category = CATEGORIES.find((c) => c.slug === product.categorySlug)
  if (!category) throw new Error(`Category ${product.categorySlug} of ${product.slug} is not authored.`)

  const categoryRow = await client.category.upsert({
    where: { slug: category.slug },
    update: {},
    create: {
      slug: category.slug,
      name: category.name,
      productLine: category.productLine,
      sortOrder: category.sortOrder,
    },
    select: { id: true },
  })

  const productRow = await client.product.upsert({
    where: { slug: product.slug },
    update: {},
    create: {
      slug: product.slug,
      name: product.name,
      productLine: product.productLine,
      categoryId: categoryRow.id,
      notForHumanConsumption: product.notForHumanConsumption,
      ageRestricted: product.ageRestricted,
      fulfillmentChannel: product.fulfillmentChannel,
      pactRegulated: product.pactRegulated,
      directoryStates: [...product.directoryStates],
      isActive: product.isActive,
      isFeatured: product.isFeatured,
    },
    select: { id: true },
  })

  const variantRow = await client.productVariant.upsert({
    where: { sku: variant.sku },
    update: {},
    create: {
      productId: productRow.id,
      sku: variant.sku,
      name: variant.name,
      priceCents: variant.priceCents,
    },
    select: { id: true },
  })

  return { productId: productRow.id, variantId: variantRow.id }
}
