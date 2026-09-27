/**
 * An order's status in the customer's words, for their profile. Short, and honest
 * about who is waiting on whom. The order page itself explains each one in full.
 */
export const CUSTOMER_STATUS: Record<string, { readonly label: string; readonly tone: 'info' | 'warning' | 'success' | 'neutral' }> = {
  PENDING_VERIFICATION: { label: 'Being verified', tone: 'info' },
  AWAITING_PAYMENT: { label: 'Awaiting payment', tone: 'warning' },
  PAYMENT_CLAIMED: { label: 'Checking payment', tone: 'info' },
  PAID: { label: 'Paid', tone: 'success' },
  PACKED: { label: 'Packed', tone: 'success' },
  SHIPPED: { label: 'Shipped', tone: 'success' },
  DELIVERED: { label: 'Delivered', tone: 'success' },
  CANCELLED: { label: 'Cancelled', tone: 'neutral' },
  REJECTED: { label: 'Not accepted', tone: 'neutral' },
  REFUNDED: { label: 'Refunded', tone: 'neutral' },
}

export function customerStatus(status: string) {
  return CUSTOMER_STATUS[status] ?? { label: status.replace(/_/g, ' ').toLowerCase(), tone: 'neutral' as const }
}
