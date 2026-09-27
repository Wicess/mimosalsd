import { describe, expect, it, vi } from 'vitest'
import type { AnchorClient } from '@/lib/orders/catalogue-anchors'
import { FIXTURE_PRODUCTS } from '../stubs/catalog'

/*
  The anchor reads the authored PRODUCTS list itself rather than asking the catalogue
  provider, so installFixtureCatalog() cannot reach it. Production authors no products,
  which would leave the authored path below with nothing to anchor, so this file
  swaps the fixtures in for that one list. Everything else in the module is the real
  one, the categories included.

  doMock and a dynamic import, not a hoisted vi.mock: the fixtures themselves import
  catalog.data, so a hoisted factory that loaded them would wait on its own result
  and the file would never finish collecting.
*/
vi.doMock('@/lib/catalog/catalog.data', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/catalog/catalog.data')>()),
  PRODUCTS: FIXTURE_PRODUCTS,
}))
const { anchorFor, anchorOrderLines } = await import('@/lib/orders/catalogue-anchors')

/**
 * A stand-in for the four Prisma delegates the anchor touches, backed by plain maps
 * and recording every call — so the tests can assert what was WRITTEN, not only what
 * came back.
 */
function fakeClient(seed: {
  products?: { id: string; slug: string }[]
  variants?: { id: string; sku: string; productId: string }[]
  posted?: { slug: string; categorySlug: string; document: unknown; isActive: boolean }[]
} = {}) {
  const categories = new Map<string, { id: string }>()
  const products = new Map((seed.products ?? []).map((p) => [p.slug, { id: p.id }]))
  const variantsBySku = new Map(
    (seed.variants ?? []).map((v) => [v.sku, { id: v.id, productId: v.productId }]),
  )
  const calls: { model: string; op: string; args: Record<string, unknown> }[] = []
  let next = 0
  const id = (prefix: string) => `${prefix}_${++next}`

  type Args = { where: Record<string, string>; create: Record<string, unknown>; update: object }

  const posted = new Map((seed.posted ?? []).map((p) => [p.slug, p]))

  const client = {
    postedProduct: {
      findUnique: async (args: { where: { slug: string } }) => {
        calls.push({ model: 'postedProduct', op: 'findUnique', args })
        return posted.get(args.where.slug) ?? null
      },
    },
    category: {
      upsert: async (args: Args) => {
        calls.push({ model: 'category', op: 'upsert', args })
        const slug = args.where.slug!
        if (!categories.has(slug)) categories.set(slug, { id: id('cat') })
        return categories.get(slug)!
      },
    },
    product: {
      upsert: async (args: Args) => {
        calls.push({ model: 'product', op: 'upsert', args })
        const slug = args.where.slug!
        if (!products.has(slug)) products.set(slug, { id: id('prod') })
        return products.get(slug)!
      },
    },
    productVariant: {
      upsert: async (args: Args) => {
        calls.push({ model: 'productVariant', op: 'upsert', args })
        const sku = args.where.sku!
        if (!variantsBySku.has(sku)) {
          variantsBySku.set(sku, { id: id('var'), productId: String(args.create.productId) })
        }
        return { id: variantsBySku.get(sku)!.id }
      },
    },
  }
  return { client: client as unknown as AnchorClient, calls }
}

const authored = FIXTURE_PRODUCTS[0]!

/** A posted root-bark product, as the admin form would store it. */
const POSTED = {
  slug: 'posted-thing',
  categorySlug: 'mimosa-hostilis',
  isActive: true,
  document: {
    name: 'Posted thing',
    shortDescription: 'A posted product used to exercise the anchor path in tests.',
    description: 'A posted product used to exercise the anchor path in tests, long enough to validate.',
    specs: [],
    variants: [
      { id: 'posted-thing--100g', sku: 'P-POSTED-THING-100G', name: '100g', priceCents: 2500, inStock: true },
    ],
    images: [],
    batchCodes: [],
    isFeatured: false,
  },
}
const [firstVariant, secondVariant] = authored.variants

describe('anchorOrderLines', () => {
  it('writes the rows an authored line needs and returns their ids, not the slug', async () => {
    const { client, calls } = fakeClient()
    const line = { productSlug: authored.slug, variantId: firstVariant!.id }

    const anchors = await anchorOrderLines(client, [line])
    const anchor = anchorFor(anchors, line)

    // The bug this exists for: the slug went into a column that holds cuids.
    expect(anchor.productId).not.toBe(authored.slug)
    expect(anchor.productId).toMatch(/^prod_/)
    expect(anchor.variantId).toMatch(/^var_/)
    expect(calls.map((c) => `${c.model}.${c.op}`)).toEqual([
      'category.upsert',
      'product.upsert',
      'productVariant.upsert',
    ])
  })

  it('is create-only: never updates a row that already exists', async () => {
    const { client, calls } = fakeClient()
    await anchorOrderLines(client, [{ productSlug: authored.slug, variantId: firstVariant!.id }])

    for (const call of calls.filter((c) => c.op === 'upsert')) {
      expect(call.args.update).toEqual({})
    }
  })

  it('reuses an existing product row found by slug', async () => {
    const { client } = fakeClient({ products: [{ id: 'existing_cuid', slug: authored.slug }] })
    const line = { productSlug: authored.slug, variantId: firstVariant!.id }

    const anchor = anchorFor(await anchorOrderLines(client, [line]), line)

    expect(anchor.productId).toBe('existing_cuid')
  })

  it('anchors each distinct line once, even when an order repeats it', async () => {
    const { client, calls } = fakeClient()
    const line = { productSlug: authored.slug, variantId: firstVariant!.id }

    await anchorOrderLines(client, [line, { ...line }])

    expect(calls.filter((c) => c.model === 'product')).toHaveLength(1)
  })

  it('gives two variants of one product the same product row and different variant rows', async () => {
    if (!secondVariant) return // single-variant product: nothing to compare
    const { client } = fakeClient()
    const a = { productSlug: authored.slug, variantId: firstVariant!.id }
    const b = { productSlug: authored.slug, variantId: secondVariant.id }

    const anchors = await anchorOrderLines(client, [a, b])

    expect(anchorFor(anchors, a).productId).toBe(anchorFor(anchors, b).productId)
    expect(anchorFor(anchors, a).variantId).not.toBe(anchorFor(anchors, b).variantId)
  })

  it('refuses a variant that is not part of the authored product', async () => {
    const { client } = fakeClient()
    await expect(
      anchorOrderLines(client, [{ productSlug: authored.slug, variantId: 'not-a-variant' }]),
    ).rejects.toThrow(/not part of/)
  })

  it('anchors a posted product exactly as it anchors an authored one', async () => {
    const { client, calls } = fakeClient({ posted: [POSTED] })
    const line = { productSlug: POSTED.slug, variantId: 'posted-thing--100g' }

    const anchor = anchorFor(await anchorOrderLines(client, [line]), line)

    expect(anchor.productId).toMatch(/^prod_/)
    expect(anchor.variantId).toMatch(/^var_/)
    const productUpsert = calls.find((c) => c.model === 'product' && c.op === 'upsert')!
    // The line's flags come from the CATEGORY, not from anything the document says.
    expect(productUpsert.args.create).toMatchObject({
      slug: POSTED.slug,
      productLine: 'MIMOSA_HOSTILIS',
      notForHumanConsumption: true,
      fulfillmentChannel: 'PARCEL',
    })
    const variantUpsert = calls.find((c) => c.model === 'productVariant')!
    expect(variantUpsert.args.where).toEqual({ sku: 'P-POSTED-THING-100G' })
  })

  it('still anchors a posted product that was deactivated after it was priced', async () => {
    const { client } = fakeClient({ posted: [{ ...POSTED, isActive: false }] })
    const line = { productSlug: POSTED.slug, variantId: 'posted-thing--100g' }

    await expect(anchorOrderLines(client, [line])).resolves.toBeDefined()
  })

  it('refuses a variant the posted product does not have', async () => {
    const { client } = fakeClient({ posted: [POSTED] })
    await expect(
      anchorOrderLines(client, [{ productSlug: POSTED.slug, variantId: 'posted-thing--9kg' }]),
    ).rejects.toThrow(/not part of/)
  })

  it('refuses a line that is neither authored nor posted', async () => {
    const { client } = fakeClient()
    await expect(
      anchorOrderLines(client, [{ productSlug: 'no-such-product', variantId: 'nope' }]),
    ).rejects.toThrow(/neither in the catalogue nor posted/)
  })
})

describe('anchorFor', () => {
  it('throws for a line that was never anchored', () => {
    expect(() => anchorFor(new Map(), { productSlug: 'x', variantId: 'y' })).toThrow(
      /No anchor/,
    )
  })
})
