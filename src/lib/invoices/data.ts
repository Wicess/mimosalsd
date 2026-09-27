import type { Order } from '@/lib/orders/types'
import { PAYMENT_LABELS } from '@/lib/orders/types'
import type { PaymentInstructions } from '@/lib/payments/instructions'

/**
 * What an invoice shows, separated from how it is drawn so it can be tested without
 * rendering anything.
 *
 * Two stages, because a customer receives two invoices for one order:
 *  · RECEIVED — posted to their chat the moment they place the order: what they
 *    ordered, what it costs, and that payment details follow once it is verified.
 *  · PAYMENT — sent to their chat and their email when the owner issues the payment
 *    details: the same invoice, with the instructions for their payment method.
 */
export type InvoiceStage = 'RECEIVED' | 'PAYMENT'

export interface InvoiceLine {
  readonly name: string
  readonly variant: string
  readonly quantity: number
  readonly unitCents: number
  readonly lineCents: number
}

export interface InvoiceData {
  readonly stage: InvoiceStage
  readonly orderId: string
  readonly issuedAt: string
  readonly customerName: string
  readonly shipTo: readonly string[]
  readonly lines: readonly InvoiceLine[]
  readonly subtotalCents: number
  readonly shippingCents: number
  readonly couponCode?: string | undefined
  readonly discountCents: number
  readonly subscriberDiscountCents: number
  readonly appDiscountCents: number
  readonly paymentDiscountCents: number
  readonly totalCents: number
  readonly methodLabel: string
  readonly payment?: PaymentInstructions | undefined
}

export function invoiceDataFromOrder(
  order: Order,
  stage: InvoiceStage,
  options: { issuedAt?: string; payment?: PaymentInstructions } = {},
): InvoiceData {
  if (stage === 'PAYMENT' && !options.payment) {
    throw new Error('A PAYMENT invoice needs the payment instructions')
  }
  return {
    stage,
    orderId: order.orderNumber,
    issuedAt: options.issuedAt ?? new Date().toISOString(),
    customerName: `${order.firstName} ${order.lastName}`.trim(),
    shipTo: [
      order.addressLine1,
      ...(order.addressLine2 ? [order.addressLine2] : []),
      `${order.city}, ${order.stateCode} ${order.postalCode}`,
    ],
    lines: order.items.map((item) => ({
      name: item.productName,
      variant: item.variantName,
      quantity: item.quantity,
      unitCents: item.unitPriceCents,
      lineCents: item.lineTotalCents,
    })),
    subtotalCents: order.subtotalCents,
    shippingCents: order.shippingCents,
    couponCode: order.couponCode,
    discountCents: order.discountCents,
    subscriberDiscountCents: order.subscriberDiscountCents,
    appDiscountCents: order.appDiscountCents,
    paymentDiscountCents: order.paymentDiscountCents,
    totalCents: order.totalCents,
    methodLabel: PAYMENT_LABELS[order.preferredPaymentMethod],
    payment: options.payment,
  }
}
