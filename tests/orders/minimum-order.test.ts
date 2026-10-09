import { describe, expect, it } from 'vitest'
import {
  MINIMUM_ORDER_CENTS,
  meetsMinimumOrder,
  minimumOrderMessage,
  shortOfMinimumCents,
} from '@/lib/orders/minimum-order'
import { BRAND } from '@/lib/brand'

/**
 * The minimum order (owner, 2026-10-02).
 *
 * The boundary is the whole test. A rule written with `>` instead of `>=` refuses a
 * cart that is exactly on the minimum, and that is the one cart most likely to exist:
 * someone who read "minimum $100" and added exactly that.
 */
describe('the minimum order rule', () => {
  it('reads the figure from BRAND, so one edit moves the rule and every message', () => {
    expect(MINIMUM_ORDER_CENTS).toBe(BRAND.minimumOrderCents)
  })

  it('accepts a cart exactly on the minimum', () => {
    expect(meetsMinimumOrder(MINIMUM_ORDER_CENTS)).toBe(true)
    expect(shortOfMinimumCents(MINIMUM_ORDER_CENTS)).toBe(0)
    expect(minimumOrderMessage(MINIMUM_ORDER_CENTS)).toBe('')
  })

  it('refuses a cart one cent short, and says how much is missing', () => {
    const short = MINIMUM_ORDER_CENTS - 1
    expect(meetsMinimumOrder(short)).toBe(false)
    expect(shortOfMinimumCents(short)).toBe(1)
    expect(minimumOrderMessage(short)).toContain('Add $0.01 more')
  })

  it('accepts anything above the minimum', () => {
    expect(meetsMinimumOrder(MINIMUM_ORDER_CENTS + 1)).toBe(true)
    expect(minimumOrderMessage(MINIMUM_ORDER_CENTS + 5_000)).toBe('')
  })

  it('never reports a negative shortfall', () => {
    expect(shortOfMinimumCents(MINIMUM_ORDER_CENTS * 3)).toBe(0)
  })

  /*
    The empty cart is handled before this rule ever runs — the checkout action returns
    "Your cart is empty" first — but the message still has to be sane if it is reached,
    because a nonsense figure here would be read as a bug in the pricing.
  */
  it('states the full amount for an empty cart', () => {
    expect(shortOfMinimumCents(0)).toBe(MINIMUM_ORDER_CENTS)
    // formatCents drops the trailing .00 on a whole dollar amount: "$100", not "$100.00".
    expect(minimumOrderMessage(0)).toContain('$100')
  })

  it('tells the customer what to do, not just what the rule is', () => {
    const message = minimumOrderMessage(MINIMUM_ORDER_CENTS - 2_305)
    expect(message).toContain('Add $23.05 more')
    expect(message).toContain('check out')
  })
})
