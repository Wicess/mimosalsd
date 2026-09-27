import { url } from '@/lib/seo/routes'

/**
 * The four questions that account for most contacts in this category.
 *
 * Answering them instantly, with a link to the real page, is worth more than a faster
 * human response — it removes the wait entirely for the majority of enquiries and
 * leaves the operator free for the ones that genuinely need a person.
 */
export interface CannedReply {
  readonly id: string
  readonly question: string
  readonly answer: string
  readonly href: string
  readonly linkLabel: string
}

export const CANNED_REPLIES: readonly CannedReply[] = [
  {
    id: 'legality',
    question: 'Is it legal in my state?',
    answer:
      'Pick your state and we will show you what we send there — it is the same check the cart runs against your delivery address.',
    href: url.shopNearMe(),
    linkLabel: 'Check my state',
  },
  {
    id: 'payment',
    question: 'How do I pay?',
    answer:
      'No payment is taken on this site. You submit an order and choose a method — Cash App, Chime, Apple Cash or Bitcoin — we verify the order, then send instructions. No card details are ever entered here, so there is nothing here to steal.',
    href: url.guide('how-ordering-and-payment-works'),
    linkLabel: 'How ordering works',
  },
  {
    id: 'order-status',
    question: "Where's my order?",
    answer:
      'Your orders are in your profile under Orders, on the device you ordered from, with their status and payment details. Your confirmation email also has a link to the order: open it on any device and the order appears in that profile too.',
    href: url.accountOrders(),
    linkLabel: 'My orders',
  },
  {
    id: 'lab-tested',
    question: 'Is it lab tested?',
    answer:
      'Every batch is lab tested, across the full panel — heavy metals, pesticides, mycotoxins, solvents and microbials, not potency alone. A certified copy goes to verified buyers who ask for it: send us the batch code from your package.',
    href: url.labResults(),
    linkLabel: 'Request a certificate',
  },
]
