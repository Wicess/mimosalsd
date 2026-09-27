import { describe, expect, it } from 'vitest'
import { cartFunnel, cartSessions, productMoves, type CartEventRow } from '@/lib/cart/sessions'

const T0 = Date.UTC(2026, 8, 14, 10, 0)
const event = (over: Partial<CartEventRow> & { minutes: number }): CartEventRow => ({
  visitorId: 'v1',
  type: 'ADDED',
  productSlug: 'mimosa',
  productName: 'Mimosa root bark',
  variantId: '100g',
  variantName: '100 g',
  quantity: 1,
  cartValueCents: 0,
  cartItems: 0,
  valueCents: 0,
  linkSlug: null,
  stateCode: null,
  reason: null,
  ...over,
  createdAt: new Date(T0 + over.minutes * 60_000),
})

describe('carts rebuilt from their changes', () => {
  it('replays adds, quantity changes and removals into the contents and value', () => {
    const [cart] = cartSessions(
      [
        event({ minutes: 0, quantity: 1, cartValueCents: 3_000, linkSlug: 'instagram-bio' }),
        event({ minutes: 1, productSlug: 'blue', productName: 'Blue meanie', variantId: 'x', variantName: 'Default', cartValueCents: 7_000 }),
        event({ minutes: 2, type: 'UPDATED', quantity: 3, cartValueCents: 13_000 }),
        event({ minutes: 3, type: 'REMOVED', productSlug: 'blue', variantId: 'x', quantity: 0, cartValueCents: 9_000 }),
      ],
      new Date(T0 + 10 * 60_000),
    )
    expect(cart).toMatchObject({ status: 'active', items: 3, valueCents: 9_000, linkSlug: 'instagram-bio' })
    expect(cart!.lines).toEqual([{ slug: 'mimosa', name: 'Mimosa root bark', variant: '100 g', quantity: 3 }])
  })

  it('calls a cart abandoned after an hour untouched, and at checkout while checkout is open', () => {
    const rows = [event({ minutes: 0, cartValueCents: 3_000 }), event({ minutes: 5, type: 'CHECKOUT_STARTED', cartValueCents: 3_000 })]
    expect(cartSessions(rows, new Date(T0 + 20 * 60_000))[0]!.status).toBe('checkout')
    const [late] = cartSessions(rows, new Date(T0 + 2 * 60 * 60_000))
    expect(late).toMatchObject({ status: 'abandoned', valueCents: 3_000, checkoutOpened: true })
  })

  it('closes a cart when the order is placed, and starts the next one fresh', () => {
    const sessions = cartSessions(
      [
        event({ minutes: 0, cartValueCents: 3_000 }),
        event({ minutes: 4, type: 'ORDER_PLACED', productSlug: null, valueCents: 3_495 }),
        event({ minutes: 90, cartValueCents: 3_000 }),
        event({ visitorId: 'v2', minutes: 1, cartValueCents: 1_000 }),
        event({ visitorId: 'v2', minutes: 2, type: 'REMOVED', quantity: 0 }),
      ],
      new Date(T0 + 100 * 60_000),
    )
    expect(sessions.map((s) => [s.visitorId, s.status, s.valueCents])).toEqual([
      ['v1', 'active', 3_000],
      ['v1', 'ordered', 3_495],
      ['v2', 'emptied', 0],
    ])
    expect(cartFunnel(sessions)).toMatchObject({ carts: 2, orders: 1, abandoned: 0, open: 1, openValueCents: 3_000 })
  })

  it('counts products going in and coming out', () => {
    expect(productMoves([event({ minutes: 0, quantity: 2 }), event({ minutes: 1, type: 'REMOVED' })])).toEqual([
      { slug: 'mimosa', name: 'Mimosa root bark', added: 2, removed: 1 },
    ])
  })
})
