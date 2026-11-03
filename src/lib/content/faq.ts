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
      'It is sold as raw botanical material for natural dyeing, soap color, leather work and craft. Dyers use it for rose, plum, burgundy and brown on wool and silk, and grey to charcoal with an iron afterbath. It is not food, and not for human consumption. Checkout asks you to confirm that intended use, and the confirmation is kept on the order record.',
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
    question: 'Does paying in Bitcoin cost less?',
    answer:
      `Yes: paying in Bitcoin takes ${BITCOIN_OFF}% off the product total. Payment rails that sit close to cards charge us fees and leave us open to chargebacks, while a Bitcoin transfer has neither cost and cannot be reversed later, so we pass that saving on. Shipping is not discounted, because that money goes to the carrier. You see the discount next to the payment options at checkout, and once more on the emailed invoice.`,
  },
  {
    category: 'Ordering and payment',
    question: 'Which payment methods do you accept?',
    answer:
      `Cash App, Chime, Apple Cash and Bitcoin, with ${BITCOIN_OFF}% off the items when you choose Bitcoin. Submitting an order request starts a check: we confirm the stock is there and that your address can receive it, then email payment details for the method you picked. Those details are issued for your order alone and never appear on the site. The order is confirmed when your payment arrives.`,
  },
  {
    category: 'Ordering and payment',
    question: 'What is the minimum age to buy?',
    answer: `${BRAND.minimumAge}. Every product in the shop, without exception, is sold only to adults aged ${BRAND.minimumAge} and up, and you confirm your age a single time, on your first visit.`,
  },
  {
    category: 'Ordering and payment',
    question: 'Can I change or cancel an order after placing it?',
    answer: `Yes, free of charge, right up until the order is packed: let us know and we close it. A paid order that has not shipped yet is refunded in full. After dispatch the returns policy takes over, and it accepts unopened items for ${POLICY_TERMS.returnWindowDays} days.`,
  },
  {
    category: 'Ordering and payment',
    question: 'Can I return something?',
    answer: `Yes, for ${POLICY_TERMS.returnWindowDays} days after delivery, as long as the item is unopened and still in its original sealed packaging. Age-restricted goods that have been opened cannot lawfully go back on sale, so those are the exception. When the fault is ours, a wrong item or one that arrives damaged, we pay every cost, return postage included.`,
  },

  // ── Shipping ─────────────────────────────────────────────────────────────
  {
    category: 'Shipping',
    question: 'Can you deliver to my state?',
    answer:
      // Owner, 2026-09-19: "we already ship to all states" — no restriction wording.
      'Yes. Delivery covers every US state plus the District of Columbia, and before you place an order the cart shows which delivery option your address gets and what it costs.',
  },
  {
    category: 'Shipping',
    // Owner, 2026-09-27: the main branch is in California, shipping to every state.
    question: 'Where do you ship from?',
    answer:
      // availability-allow: the owner's own statement of origin and footprint.
      'Our branch in California, which sends parcels to all fifty states and the District of Columbia. Transit time varies with distance, so instead of a published estimate you get a delivery window confirmed with your order.',
  },
  {
    category: 'Shipping',
    question: 'How much is delivery?',
    answer: `${formatCents(795)} for standard parcel delivery, and nothing at all on parcel orders over ${formatCents(BRAND.freeShippingThresholdCents)}. Delivery windows are confirmed order by order instead of posted here, since they depend on the carrier and the distance from California.`,
  },
  {
    category: 'Shipping',
    // availability-allow: answers international vs domestic. The phrase describes the
    // carrier footprint, not what any product line may be sent to a given state.
    question: 'Do you ship internationally?',
    answer:
      'Yes, for root bark only. The United States comes first, and every state plus the District of Columbia is covered. Beyond the US, Mimosa hostilis and sassafras root bark go out on a quote sized to the order: open the bulk quote form and pick Outside the United States. Checking import rules, and paying any duties and taxes, falls to the buyer. We do not ship to freight forwarders.',
  },
  {
    category: 'Shipping',
    question: 'Will my order arrive discreetly?',
    answer:
      'Yes. The outer packaging is plain, with no branding or product pictures, and carries only what the carrier needs to deliver it. Inside, the bark sits in a double-sealed, smell-proof bag.',
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
    question: 'Can I buy root bark in bulk or wholesale?',
    answer: `Yes. The shop sells root bark in 1/4 lb, 1/3 lb, 1/2 lb and 1 lb bags, and a member of our team quotes anything larger for dye studios, soap makers, schools and resellers. Send the cut and the quantity through the bulk order page or to ${COMPANY_EMAIL_TOKEN}.`,
  },
]

export const FAQ_CATEGORIES = [
  'Root bark',
  'Dyeing with root bark',
  'Ordering and payment',
  'Shipping',
  'Batches and bulk',
] as const
