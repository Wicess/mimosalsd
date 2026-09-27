import { BRAND } from '@/lib/brand'
import type { PushMessage } from '@/lib/push/payload'

/**
 * The notifications a customer gets without anyone composing them.
 *
 * Staff replies share one tag with the chat's own in-page alert
 * (components/chat/use-chat.ts), so a reply that triggers both shows once: the
 * second replaces the first instead of stacking.
 */
export const CHAT_REPLY_TAG = 'chat-reply'
export const CHAT_PATH = '/account/chat'

export function staffReplyNotification(input: { body: string; attachmentName?: string | null }): PushMessage {
  const text = input.body.replace(/\s+/g, ' ').trim()
  const shown = text || (input.attachmentName ? `📎 ${input.attachmentName}` : 'You have a new message.')
  return {
    title: `New reply from ${BRAND.name}`,
    body: shown.length > 120 ? `${shown.slice(0, 119).trimEnd()}…` : shown,
    url: CHAT_PATH,
    tag: CHAT_REPLY_TAG,
  }
}

export function paymentDetailsNotification(input: { orderNumber: string; orderToken: string; methodLabel: string }): PushMessage {
  return {
    title: `Order ID ${input.orderNumber}: ready to pay`,
    body: `Your ${input.methodLabel} payment details are here. Tap to see how to pay.`,
    url: `/order/${input.orderToken}`,
    tag: `order-${input.orderNumber}`,
  }
}
