'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { getMergedProduct } from '@/lib/catalog/merged'
import { addLine, cartItemCount, normalizeCart, removeLine, updateQuantity, MAX_LINE_QUANTITY } from '@/lib/cart/cart'
import { readCart, writeCart } from '@/lib/cart/storage'
import { url } from '@/lib/seo/routes'
import { recordActivity } from '@/lib/visitors/record-activity'
import { trackCart } from '@/lib/cart/track'

/**
 * Cart mutations.
 *
 * Every one validates with Zod and then re-checks the product against the catalogue.
 * A server action is a public HTTP endpoint — the fact that the UI only ever sends
 * valid slugs is not a guarantee about what arrives here.
 */
const lineSchema = z.object({
  slug: z.string().min(1).max(120),
  variantId: z.string().min(1).max(160),
  quantity: z.number().int().min(1).max(MAX_LINE_QUANTITY),
})

/** `count` is the cart's new item count, so the cart badges can update without a reload. */
export type CartActionResult = { ok: true; count: number } | { ok: false; error: string }

export async function addToCart(input: unknown): Promise<CartActionResult> {
  const parsed = lineSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: 'That item could not be added.' }

  /*
    The MERGED product, the same one the cart prices and checkout re-prices. This
    read the authored catalogue, which knew nothing of the admin panel: a product
    an operator had deactivated could still be added, and one they had posted
    could not be added at all.
  */
  const product = await getMergedProduct(parsed.data.slug)
  if (!product) return { ok: false, error: 'That product is no longer available.' }

  const variant = product.variants.find((v) => v.id === parsed.data.variantId)
  if (!variant) return { ok: false, error: 'That option is no longer available.' }
  if (!variant.inStock) return { ok: false, error: 'That option is out of stock.' }

  const next = addLine(await readCart(), parsed.data)
  await writeCart(next)
  revalidatePath(url.cart())
  await recordActivity('CART_ADD', {
    detail: `${product.name}${variant.name ? ` — ${variant.name}` : ''}${parsed.data.quantity > 1 ? ` ×${parsed.data.quantity}` : ''}`,
    path: url.product(product.slug),
  })
  await trackCart('ADDED', {
    cart: next,
    product: { slug: product.slug, name: product.name },
    variant: { id: variant.id, name: variant.name },
    quantity: parsed.data.quantity,
  })
  return { ok: true, count: cartItemCount(normalizeCart(next)) }
}

const identifySchema = z.object({
  slug: z.string().min(1).max(120),
  variantId: z.string().min(1).max(160),
})

export async function setCartQuantity(input: unknown, quantity: number): Promise<CartActionResult> {
  const parsed = identifySchema.safeParse(input)
  const qty = z.number().int().min(0).max(MAX_LINE_QUANTITY).safeParse(quantity)
  if (!parsed.success || !qty.success) return { ok: false, error: 'Could not update that item.' }

  const next = updateQuantity(await readCart(), parsed.data.slug, parsed.data.variantId, qty.data)
  await writeCart(next)
  revalidatePath(url.cart())
  const product = await getMergedProduct(parsed.data.slug)
  await trackCart(qty.data === 0 ? 'REMOVED' : 'UPDATED', {
    cart: next,
    product: { slug: parsed.data.slug, name: product?.name ?? parsed.data.slug },
    variant: { id: parsed.data.variantId, name: product?.variants.find((v) => v.id === parsed.data.variantId)?.name ?? '' },
    quantity: qty.data,
  })
  return { ok: true, count: cartItemCount(normalizeCart(next)) }
}

export async function removeFromCart(input: unknown): Promise<CartActionResult> {
  const parsed = identifySchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: 'Could not remove that item.' }

  const next = removeLine(await readCart(), parsed.data.slug, parsed.data.variantId)
  await writeCart(next)
  revalidatePath(url.cart())
  const product = await getMergedProduct(parsed.data.slug)
  await trackCart('REMOVED', {
    cart: next,
    product: { slug: parsed.data.slug, name: product?.name ?? parsed.data.slug },
    variant: { id: parsed.data.variantId, name: product?.variants.find((v) => v.id === parsed.data.variantId)?.name ?? '' },
  })
  return { ok: true, count: cartItemCount(normalizeCart(next)) }
}
