/**
 * The welcome discounts on a stored order, as lines to print under the coupon: in
 * the order the formula takes them, and only the ones that applied. An invoice line
 * reading "App discount: $0.00" invites the question of what was missed.
 *
 * Named without a percentage on purpose. The amount is frozen on the order; a label
 * reading "10%" would be rewritten by a later change to the rate.
 */
export function welcomeLines(order: {
  readonly subscriberDiscountCents: number
  readonly appDiscountCents: number
}): { readonly key: string; readonly label: string; readonly cents: number }[] {
  return [
    { key: 'subscriber', label: 'Subscriber discount', cents: order.subscriberDiscountCents },
    { key: 'app', label: 'App discount', cents: order.appDiscountCents },
  ].filter((line) => line.cents > 0)
}
