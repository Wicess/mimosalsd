import { formatPhone } from '@/lib/invoices/data'
import { PAYMENT_LABELS, type Order } from '@/lib/orders/types'
import { formatCents } from '@/lib/utils'

/** ntfy turns a longer body into a file attachment, which a phone does not show inline. */
const MAX_BODY = 3800

/**
 * The text of the new-order push: who to call, then what they ordered. The phone
 * number comes first, so a very long order is cut at the end and never loses it.
 */
export function newOrderAlertBody(order: Order, stateName: string): string {
  const discountCents =
    order.discountCents + order.subscriberDiscountCents + order.appDiscountCents + order.paymentDiscountCents
  const body = [
    `Phone: ${formatPhone(order.phone)}`,
    `Name: ${order.firstName} ${order.lastName}`,
    `Email: ${order.email}`,
    `Ship to: ${[order.addressLine1, order.addressLine2, order.city, `${stateName} ${order.postalCode}`].filter(Boolean).join(', ')}`,
    '',
    ...order.items.map(
      (item) => `${item.quantity} x ${item.productName} (${item.variantName}) - ${formatCents(item.lineTotalCents)}`,
    ),
    '',
    `Subtotal: ${formatCents(order.subtotalCents)}`,
    `Shipping: ${order.shippingCents === 0 ? 'Free' : formatCents(order.shippingCents)}`,
    ...(discountCents > 0 ? [`Discounts: -${formatCents(discountCents)}`] : []),
    `Total: ${formatCents(order.totalCents)}`,
    `Payment: ${PAYMENT_LABELS[order.preferredPaymentMethod]}`,
  ].join('\n')
  return body.length > MAX_BODY ? `${body.slice(0, MAX_BODY - 3)}...` : body
}
