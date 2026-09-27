import { cookies } from 'next/headers'
import { EMPTY_CART, type Cart } from './types'
import { normalizeCart, parseCartCookie } from './cart'

export const CART_COOKIE = 'cart'

/**
 * Cookie I/O only. All parsing and validation lives in `parseCartCookie`, which is
 * pure and unit-tested — validating untrusted input is exactly the code that should
 * not require a request context to exercise.
 */
export async function readCart(): Promise<Cart> {
  return parseCartCookie((await cookies()).get(CART_COOKIE)?.value)
}

export async function writeCart(cart: Cart): Promise<void> {
  const store = await cookies()
  const normalized = normalizeCart(cart)
  if (normalized.lines.length === 0) {
    store.delete(CART_COOKIE)
    return
  }
  store.set(CART_COOKIE, JSON.stringify(normalized), {
    // Nothing client-side needs to read it; the server renders the cart.
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 60 * 60 * 24 * 30,
    path: '/',
  })
}

export { EMPTY_CART }
