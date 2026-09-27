import { describe, expect, it } from 'vitest'
import { paymentDetailsNotification, staffReplyNotification } from '@/lib/push/customer'

describe('customer notifications', () => {
  it('a staff reply opens the chat and shares the chat alert tag, so it never shows twice', () => {
    expect(staffReplyNotification({ body: 'Your parcel\nleft this morning.' })).toEqual({
      title: 'New reply from MIMOSALSD',
      body: 'Your parcel left this morning.',
      url: '/account/chat',
      tag: 'chat-reply',
    })
  })

  it('a file with no caption says what arrived; a long reply is cut at 120 characters', () => {
    expect(staffReplyNotification({ body: '  ', attachmentName: 'label.pdf' }).body).toBe('📎 label.pdf')
    expect(staffReplyNotification({ body: '' }).body).toBe('You have a new message.')
    const long = staffReplyNotification({ body: 'word '.repeat(60) }).body
    expect(long.length).toBeLessThanOrEqual(120)
    expect(long.endsWith('…')).toBe(true)
  })

  it('payment details open the order page, one notification per order', () => {
    expect(paymentDetailsNotification({ orderNumber: '202609-7K3M9P', orderToken: 'tok_abc', methodLabel: 'Cash App' })).toEqual({
      title: 'Order ID 202609-7K3M9P: ready to pay',
      body: 'Your Cash App payment details are here. Tap to see how to pay.',
      url: '/order/tok_abc',
      tag: 'order-202609-7K3M9P',
    })
  })
})
