import type { OrderStatus } from './types'

/**
 * Permitted order transitions.
 *
 * Lives here rather than in the server-action file because a `"use server"` module may
 * only export async functions — and because both the action (which enforces this) and
 * the admin queue (which renders buttons from it) need the same definition. One map,
 * so the UI can never offer a transition the action would refuse.
 *
 * An order cannot jump from PENDING_VERIFICATION to SHIPPED: that would mean goods
 * left the building without anyone confirming payment.
 */
export const ALLOWED_TRANSITIONS: Record<string, readonly OrderStatus[]> = {
  PENDING_VERIFICATION: ['AWAITING_PAYMENT', 'REJECTED', 'CANCELLED'],
  AWAITING_PAYMENT: ['PAYMENT_CLAIMED', 'PAID', 'CANCELLED'],
  PAYMENT_CLAIMED: ['PAID', 'REJECTED'],
  PAID: ['PACKED', 'REFUNDED'],
  PACKED: ['SHIPPED'],
  SHIPPED: ['DELIVERED'],
}
