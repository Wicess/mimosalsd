/**
 * compliance-allow: psilocybin -- the single most valuable question on this page is
 * whether Amanita muscaria is the same thing as psilocybin mushrooms. It is not, and
 * answer engines conflate them constantly. Refusing to name the substance we are
 * distinguishing ourselves FROM would leave the misconception standing, which is the
 * outcome the rule exists to avoid.
 */

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
  readonly category: 'Disposables' | 'Ordering and payment' | 'Shipping' | 'Legality' | 'Products and testing'
}

export const FAQ_ITEMS: readonly FaqItem[] = [
  /*
    ── Disposables ────────────────────────────────────────────────────────────
    First, because the business is a distributor of disposables (owner,
    2026-09-15). Deliberately not the same questions as the About band on
    /shop/disposable-vapes: the same answer on two URLs is the duplication Bing names.
  */
  {
    category: 'Disposables',
    question: 'Is SnypeGate a disposable vape distributor?',
    answer:
      'Yes. SnypeGate is a US distributor of disposable vapor products, supplying adult customers by the unit and retailers in volume. Our range covers nicotine disposables and hemp-derived cannabinoid disposables, including THCA and THC, and every batch is lab-tested before it is offered for sale.',
  },
  {
    category: 'Disposables',
    question: 'How do I know what is in a disposable before I order it?',
    answer:
      'Read its product page. Each disposable lists what it contains, its flavour and its size on its own page, because a category covers more than one kind of product. If anything is unclear, ask us in the chat before you order and a person will answer.',
  },
  {
    category: 'Disposables',
    question: 'Can I buy disposables wholesale for my shop?',
    answer:
      'Yes. Retailers, vape shops and resellers can buy disposables in volume, including mixed-flavour cases, at wholesale pricing. Send the quantities you need from the bulk order page and a person replies with a quote. A certified copy of the lab report for any batch you buy is available on request.',
  },
  {
    category: 'Disposables',
    question: 'Why do disposables ship separately from the rest of my order?',
    answer:
      'Because the federal PACT Act governs how vapor products travel. They go with a PACT Act compliant carrier, so a disposable cannot share a box with anything else in your order. The cart shows the separate delivery before you order.',
  },
  {
    category: 'Disposables',
    question: 'Do disposables qualify for free shipping?',
    answer:
      'No. Free shipping applies to parcel orders only, and disposables travel on a specialist carrier that we pay for per shipment. The delivery cost for disposables is shown in the cart before you place your order, whatever the order value.',
  },

  // ── Ordering and payment ─────────────────────────────────────────────────
  {
    category: 'Ordering and payment',
    question: 'Why can I not pay on your website?',
    answer:
      'Because we deliberately do not process payments here. You submit an order request and choose how you would prefer to pay; we check that the stock is available and that we can ship to your address, then send you instructions for that method. It means there is no card form on this site, no payment processor behind it, and no card details stored anywhere in our systems — so there is nothing here for anyone to steal.',
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
    answer: `Unopened items in their original sealed packaging can be returned within ${POLICY_TERMS.returnWindowDays} days of delivery. Opened age-restricted goods cannot lawfully be resold, so they cannot be accepted back. If we sent the wrong item, it arrived damaged, or a batch does not match its published laboratory report, we cover everything including return postage.`,
  },

  // ── Shipping ─────────────────────────────────────────────────────────────
  {
    category: 'Shipping',
    question: 'Do you ship to my state?',
    answer:
      // Owner, 2026-09-19: "we already ship to all states" — no restriction wording.
      'Yes. We ship within the United States, and your cart shows the delivery option and cost for your address before you order. Vapor products travel separately, on their own carrier.',
  },
  {
    category: 'Shipping',
    question: 'How much is delivery?',
    answer: `Standard parcel delivery is ${formatCents(795)}, free on parcel-eligible orders over ${formatCents(BRAND.freeShippingThresholdCents)}. Vapor products travel on a specialist age-restricted carrier at ${formatCents(1995)} and are never eligible for free shipping at any order value. We confirm a delivery window with your order rather than publishing one, because it depends on the carrier and destination.`,
  },
  {
    category: 'Shipping',
    question: 'Why did my order arrive in two separate shipments?',
    answer:
      'Because vapor products are not legally permitted to travel with anything else. If your order contained both a parcel-eligible item and a vapor product, it ships as two deliveries on two different carriers, arriving at different times. Your cart shows this before you order, with a separate card, cost and estimate for each shipment.',
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
      'Yes. Orders ship in plain outer packaging with no product imagery or branding visible, showing only the information the carrier needs.',
  },

  // ── Legality ─────────────────────────────────────────────────────────────
  {
    category: 'Legality',
    question: 'Is Amanita muscaria the same as psilocybin mushrooms?',
    answer:
      'No, and the difference is the whole legal basis on which it is sold. Amanita muscaria contains muscimol and ibotenic acid. It does not contain psilocybin, which is a Schedule I controlled substance under federal law. Amanita muscaria is unscheduled federally. Conflating the two makes a lawful product sound illegal and an illegal one sound lawful.',
  },
  {
    category: 'Legality',
    question: 'Is Amanita muscaria legal in the United States?',
    answer:
      'Federally, yes — Amanita muscaria is not listed under the Controlled Substances Act, and neither is muscimol. State law is a separate question and it moves, so we publish the current position for every state with the statute and the date we last checked it. Separately, the FDA stated in December 2024 that Amanita muscaria is not authorised for use in conventional food, so edible formats sit in a regulatory grey area rather than having been affirmatively cleared.',
  },
  {
    category: 'Legality',
    question: 'What is Mimosa Hostilis root bark used for?',
    answer:
      'It is sold strictly as a raw botanical material for natural dyeing, soap and cosmetic manufacture, craft and botanical research. Natural dyers value it for the deep purple it produces on wool, silk and leather, and soap makers for its high tannin content. It is not food, and it is not for human consumption. At checkout you confirm that this is what you are buying it for, and that confirmation is stored with your order.',
  },
  {
    category: 'Legality',
    question: 'What happens if the law changes after I order?',
    answer:
      'We cancel the affected item, tell you why, and cite the rule we are relying on. If you have already paid you are refunded in full for that item, including its share of shipping. We never quietly substitute a different product.',
  },

  // ── Products and testing ─────────────────────────────────────────────────
  {
    category: 'Products and testing',
    question: 'What do your lab tests actually cover?',
    answer:
      'Every panel covers potency, heavy metals (lead, arsenic, cadmium, mercury), pesticides, mycotoxins, residual solvents and microbials — not potency alone. Every batch is tested before it is offered for sale, and the botanical line by accredited third-party laboratories. A report showing only active content is telling you the least useful part.',
  },
  {
    category: 'Products and testing',
    question: 'How do I get the lab report for what I received?',
    answer:
      'Ask us for it. Certificates are not posted publicly: a certified copy is issued to verified, licensed buyers on request. Send us the batch code printed on your package and we will send the report covering that exact batch — not a representative sample and not a typical result, the one in your hand.',
  },
  {
    category: 'Products and testing',
    question: 'Do you offer bulk or wholesale pricing?',
    answer: `Yes. As a distributor we sell disposables in volume to retailers and resellers, and quote larger quantities of everything else. Disposables are otherwise priced by the unit, and botanical materials by the pound in 1/4, 1/3, 1/2 and 1 lb. For volume pricing or a standing supply arrangement, use the bulk order page or contact ${COMPANY_EMAIL_TOKEN}.`,
  },
]

export const FAQ_CATEGORIES = [
  'Disposables',
  'Ordering and payment',
  'Shipping',
  'Legality',
  'Products and testing',
] as const
