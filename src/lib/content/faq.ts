import { discountPercent } from '@/lib/orders/payment-discount'
import { BRAND } from '@/lib/brand'
import { COMPANY_EMAIL_TOKEN } from '@/lib/site/company-email'
import { POLICY_TERMS } from '@/lib/content/policies'
import { formatCents } from '@/lib/utils'

/**
 * Frequently asked questions.
 *
 * This page exists for answer engines as much as for people. Roughly 40% of
 * information-seeking queries now begin in an AI interface, paid advertising is
 * prohibited in this category, and a question-and-answer page is the single most
 * liftable content shape there is.
 *
 * Two rules hold:
 *
 *  1. EVERY answer here is rendered on the page. The FAQPage markup is generated from
 *     this same array, so it can never describe an answer a visitor cannot read.
 *  2. Answers lead with the answer. A question that opens with context and reaches
 *     the verdict in sentence four does not get cited.
 */

/*
  Imported, never typed as a literal. A percentage written into copy keeps its old
  value forever once the rate moves — the exact failure this project has already been
  bitten by, on a legality page that went on saying 18 after the floor became 21.
*/
const BITCOIN_OFF = discountPercent('BITCOIN')

export interface FaqItem {
  readonly question: string
  /** Answer-first. The first sentence must stand alone as the answer. */
  readonly answer: string
  readonly category: 'Root bark' | 'Dyeing with root bark' | 'Ordering and payment' | 'Shipping' | 'Batches and bulk'
}

export const FAQ_ITEMS: readonly FaqItem[] = [
  /*
    ── Root bark ──────────────────────────────────────────────────────────────
    Rewritten 2026-09-28 when the shop narrowed to root bark. The questions are the
    ones buyers type before they order, and each answer leads with its verdict.
  */
  {
    category: 'Root bark',
    question: 'What is Mimosa hostilis root bark used for?',
    answer:
      'It is sold as raw botanical material for natural dyeing, soap color, leather work and craft. Dyers use it for rose, plum, burgundy and brown on wool and silk, and grey to charcoal with an iron afterbath. It is not food and it is not for human consumption; at checkout you confirm that is what you are buying it for, and that confirmation is stored with your order.',
  },
  {
    category: 'Root bark',
    question: 'Is Mimosa hostilis the same plant as Mimosa tenuiflora?',
    answer:
      'Yes. Mimosa tenuiflora is the accepted botanical name and Mimosa hostilis is an older synonym that the trade still uses. In Brazil the tree is called jurema preta. The root bark sold under any of these names is the same material.',
  },
  {
    category: 'Root bark',
    question: 'Should I buy powder, shredded or whole root bark?',
    answer:
      'Shredded for everyday dyeing: it strains cleanly and gives second and third baths from the same bark. Powder for test skeins, small batches and cold-process soap, because it releases color fastest. Whole chips and strips for stocking up, because they keep longest and can be broken or milled when you need them.',
  },
  {
    category: 'Root bark',
    question: 'What is sassafras root bark used for?',
    answer:
      'Natural dyeing and craft. On wool it gives warm tans, orange-browns and rose-browns, and soft greys with iron; the dried bark is also used for its scent in potpourri. Federal rules prohibit safrole and sassafras bark intended for flavoring from use in human food, so it is sold here for dyeing and craft only.',
  },

  // ── Dyeing with root bark ────────────────────────────────────────────────
  {
    category: 'Dyeing with root bark',
    question: 'What colors does Mimosa hostilis dye?',
    answer:
      'Dusky rose, plum, red-brown and burgundy on wool and silk, deepening with more bark and a longer simmer. An iron afterbath turns the same bath slate grey to charcoal. A neutral to slightly acidic bath keeps the purple tones; alkaline water pulls the color toward brown.',
  },
  {
    category: 'Dyeing with root bark',
    question: 'How much Mimosa hostilis do I need to dye a pound of wool?',
    answer:
      'Plan on 50 to 75 percent of the dry fiber weight for a mid shade, which is 8 to 12 ounces of bark per pound of wool, or 25 to 40 percent for a pale tint. Deep plum and burgundy take up to an equal weight of bark and fiber. Test a small skein first, because water and fiber change the result.',
  },
  {
    category: 'Dyeing with root bark',
    question: 'Do I need a mordant for Mimosa hostilis?',
    answer:
      'Not for most wool and silk. The bark is rich in tannins, which help the color bind to protein fiber on its own. An alum mordant brightens the pinks and helps the color hold in daylight, and it is worth using on anything that will be worn or washed often.',
  },
  {
    category: 'Dyeing with root bark',
    question: 'Can I dye cotton or linen with Mimosa hostilis?',
    answer:
      'Yes, but plant fibers come out paler than wool or silk because they carry no protein for the tannins to bind to. Mordant them with tannin and then alum before the dye bath and the color comes much closer to what the same bath gives on wool.',
  },

  {
    category: 'Ordering and payment',
    question: 'When do I pay for my order?',
    answer:
      'After a person has confirmed it. You place your order and choose a payment method; we check the stock and the address it is going to, then send payment details in your order chat on this site and by email. Your order is confirmed once payment arrives. We never ask for card details.',
  },
  {
    category: 'Ordering and payment',
    question: 'Is there a discount for paying with Bitcoin?',
    answer:
      `Yes — ${BITCOIN_OFF}% off the items on any order paid in Bitcoin. Card-adjacent rails cost us in fees and in chargeback exposure; a Bitcoin transfer costs neither and cannot be reversed after the fact, so the saving is handed back rather than kept. It applies to the products, not to shipping, which is a cost we pay a carrier. The discount is shown beside the payment choice at checkout and again on the invoice we email you.`,
  },
  {
    category: 'Ordering and payment',
    question: 'How do I pay for my order?',
    answer:
      `We accept Cash App, Chime, Apple Cash and Bitcoin, and Bitcoin orders take ${BITCOIN_OFF}% off the items. After you place an order request we check that the stock is available and that we can ship to your address, then email you the details for the method you chose. Those details are specific to your order and are never published on the site. Your order is confirmed once payment is received.`,
  },
  {
    category: 'Ordering and payment',
    question: 'How old do I have to be to order?',
    answer: `You must be ${BRAND.minimumAge} or older. You confirm your age once, when you enter the site, and everything we sell is for adults ${BRAND.minimumAge} and over, whatever the product.`,
  },
  {
    category: 'Ordering and payment',
    question: 'Can I cancel or change my order?',
    answer: `Yes, at no cost, at any point before your order is packed. Tell us and it is closed. If you have already paid and it has not shipped, you are refunded in full. Once a shipment is dispatched it falls under the returns policy instead, which allows unopened items back within ${POLICY_TERMS.returnWindowDays} days.`,
  },
  {
    category: 'Ordering and payment',
    question: 'Can I return something?',
    answer: `Unopened items in their original sealed packaging can be returned within ${POLICY_TERMS.returnWindowDays} days of delivery. Opened age-restricted goods cannot lawfully be resold, so they cannot be accepted back. If we sent the wrong item or it arrived damaged, we cover everything, including return postage.`,
  },

  // ── Shipping ─────────────────────────────────────────────────────────────
  {
    category: 'Shipping',
    question: 'Do you ship to my state?',
    answer:
      // Owner, 2026-09-19: "we already ship to all states" — no restriction wording.
      'Yes. We ship to every US state and the District of Columbia, and your cart shows the delivery option and cost for your address before you order.',
  },
  {
    category: 'Shipping',
    // Owner, 2026-09-27: the main branch is in California, shipping to every state.
    question: 'Where do you ship from?',
    answer:
      // availability-allow: the owner's own statement of origin and footprint.
      'From our California branch, to all fifty states and the District of Columbia. Delivery time depends on how far a parcel travels, so we confirm a window with your order rather than publishing one here.',
  },
  {
    category: 'Shipping',
    question: 'How much is delivery?',
    answer: `Standard parcel delivery is ${formatCents(795)}, and free on parcel orders over ${formatCents(BRAND.freeShippingThresholdCents)}. We confirm a delivery window with your order rather than publishing one, because it depends on the carrier and how far the parcel travels from California.`,
  },
  {
    category: 'Shipping',
    // availability-allow: answers international vs domestic. The phrase describes the
    // carrier footprint, not what any product line may be sent to a given state.
    question: 'Do you ship internationally?',
    answer:
      'No. We ship within the United States only — all 50 states and the District of Columbia. We do not ship to any other country, and we do not ship to freight forwarders.',
  },
  {
    category: 'Shipping',
    question: 'Will my order arrive discreetly?',
    answer:
      'Yes. Orders ship in plain outer packaging with no product imagery or branding visible, showing only the information the carrier needs. Inside, the bark is in a double-sealed, smell-proof bag.',
  },
  {
    category: 'Shipping',
    question: 'How is the root bark packed?',
    answer:
      'In a double-sealed, smell-proof bag that is flushed with nitrogen before it is closed. Nitrogen displaces the oxygen in the bag, which stops the bark oxidizing, so its color and freshness hold in transit and on your shelf. Reseal the bag after each use to keep it that way.',
  },

  // ── Batches and bulk ─────────────────────────────────────────────────────
  {
    category: 'Batches and bulk',
    question: 'How do I get the report for the batch I received?',
    answer:
      `Ask us for it. Send the batch code printed on your package through the contact page or to ${COMPANY_EMAIL_TOKEN}, and we reply with the report we hold for that exact batch. Reports are not posted publicly.`,
  },
  {
    category: 'Batches and bulk',
    question: 'Do you offer bulk or wholesale pricing?',
    answer: `Yes. Root bark is priced by the pound in 1/4, 1/3, 1/2 and 1 lb sizes, and larger quantities for dye studios, soap makers, schools and resellers are quoted by a person. Use the bulk order page or email ${COMPANY_EMAIL_TOKEN} with the cut and the quantity you need.`,
  },
]

export const FAQ_CATEGORIES = [
  'Root bark',
  'Dyeing with root bark',
  'Ordering and payment',
  'Shipping',
  'Batches and bulk',
] as const
