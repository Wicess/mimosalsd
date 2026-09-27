/**
 * Badge tone per order status — one map, shared by the order queue and the chat
 * inbox's customer panel, so a status reads the same colour everywhere it appears.
 */
export const ORDER_STATUS_TONE: Record<string, 'warning' | 'info' | 'success' | 'danger' | 'neutral'> = {
  PENDING_VERIFICATION: 'warning',
  AWAITING_PAYMENT: 'warning',
  PAYMENT_CLAIMED: 'warning',
  PAID: 'success',
  PACKED: 'info',
  SHIPPED: 'info',
  DELIVERED: 'success',
  REJECTED: 'danger',
  CANCELLED: 'neutral',
}

export function orderStatusLabel(status: string): string {
  return status.replace(/_/g, ' ').toLowerCase()
}
