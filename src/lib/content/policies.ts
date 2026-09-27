/**
 * compliance-allow: prevent -- "Prevent All Cigarette Trafficking (PACT) Act" is the
 * statute's own name. Naming the federal law that governs how vapor products ship is
 * the opposite of a health claim, and abbreviating around it would make the shipping
 * policy less precise about the rule it is explaining.
 */
import { BRAND } from '@/lib/brand'
import { COMPANY_EMAIL_TOKEN } from '@/lib/site/company-email'
import { formatCents } from '@/lib/utils'

/**
 * Policy pages.
 *
 * These existed as declared routes in the SEO registry, were linked from the footer
 * of every page, and were cited by /llms.txt as canonical — but had no page behind
 * them, so all ten returned 404. They are also the E-E-A-T surface a search engine
 * most expects from a seller of age-restricted goods, which made their absence an
 * acquisition problem rather than a tidiness one.
 *
 * Everything below describes what the SYSTEM ACTUALLY DOES. Shipping costs come from
 * the same rate table the cart quotes, the order lifecycle matches `OrderStatus`, and
 * the privacy section describes the columns that genuinely exist in the schema. A
 * policy page that describes an imagined system is worse than none: it is a
 * commitment nobody can keep.
 */

/**
 * ─────────────────────────────────────────────────────────────────────────────
 *  COMMERCIAL TERMS THAT NEED A HUMAN SIGN-OFF.
 *
 *  Every number here is a promise made to a customer and, in a dispute, a term a
 *  regulator or a card network will hold the business to. They are gathered in one
 *  block precisely so they are easy to review and change, rather than buried in
 *  prose. The defaults are conventional for age-restricted DTC, not researched
 *  against this business's actual operations.
 *
 *  CONFIRM BEFORE LAUNCH. `governingState` in particular cannot be guessed.
 * ─────────────────────────────────────────────────────────────────────────────
 */
export const POLICY_TERMS = {
  /** Days after delivery in which an unopened item may be returned. */
  returnWindowDays: 30,
  /** Hours after submission in which an unverified order can be cancelled freely. */
  cancellationWindowHours: 24,
  /** Business days to inspect a return and issue a refund once received. */
  refundProcessingDays: 5,
  /** Business days we hold an unpaid order before releasing the stock. */
  paymentWindowDays: 3,
  /** PENDING — the state whose law governs these terms. Ask the operator. */
  governingState: '',
  /** PENDING — the postal address for legal notices. */
  noticeAddress: '',
} as const

export type PolicySlug =
  | 'shipping'
  | 'returns'
  | 'purchase'
  | 'privacy'
  | 'terms'

export interface PolicySection {
  readonly heading: string
  readonly body: readonly string[]
  /** Rendered as a bulleted list beneath the body. */
  readonly list?: readonly string[]
}

export interface Policy {
  readonly slug: PolicySlug
  readonly title: string
  readonly metaTitle: string
  readonly metaDescription: string
  /** Answer-first, 40–60 words. The block an answer engine lifts. */
  readonly summary: string
  readonly lastReviewedAt: string
  readonly sections: readonly PolicySection[]
}

const REVIEWED = '2026-08-28'

/** The cart's own threshold (`>=`, so an order of exactly this much qualifies). */
const FREE_FROM = formatCents(BRAND.freeShippingThresholdCents)

export const POLICIES: readonly Policy[] = [
  // ── Shipping ──────────────────────────────────────────────────────────────
  /*
    Owner's copy (2026-09-13): no shipping prices on this page; carriers are USPS,
    UPS and local agencies when necessary; double-sealed, smell-proof packaging; free
    shipping on every order from the threshold. Vapor products are the exception the
    law makes (CLAUDE.md rule 2): not USPS or UPS, and never free.
  */
  {
    slug: 'shipping',
    title: 'Shipping policy',
    metaTitle: 'Shipping Policy — Carriers, Packaging and Free Shipping',
    metaDescription: `We ship with USPS, UPS and local agencies, in double-sealed, smell-proof packaging. Free shipping on all orders from ${FREE_FROM}. United States only.`,
    summary: `We ship within the United States and nowhere else, using USPS, UPS and other local agencies when necessary. Every order is packed in double-sealed, smell-proof packaging, and shipping is free on all orders from ${FREE_FROM}. Vapor products travel separately, as federal law requires.`,
    lastReviewedAt: '2026-09-13',
    sections: [
      {
        heading: 'Where we ship',
        body: [
          // availability-allow: the owner's statement of the footprint (2026-09-19: "we already ship to all states").
          'We ship within the United States only — all 50 states and the District of Columbia. We do not ship internationally, we do not ship to freight forwarders, and we cannot accept an order for delivery outside the United States.',
          // availability-allow: the owner's statement of the origin (2026-09-27: the main branch is in California).
          'Orders leave our California branch. Nothing about where an order starts changes where it can go: every state is served from the same place.',
        ],
      },
      {
        heading: 'How we ship',
        body: [
          'We ship using USPS, UPS and other local agencies when necessary.',
          'We give you a delivery window with your order rather than publishing one here. It depends on the carrier, the destination and the checks that shipment needs, and a number posted on a policy page cannot account for any of them.',
        ],
      },
      {
        heading: 'Packaging',
        body: [
          'Every order is packed in double-sealed, smell-proof packaging.',
        ],
      },
      {
        heading: 'Free shipping',
        body: [
          `Shipping is free on all orders from ${FREE_FROM}.`,
          'Vapor products are the one exception: federal law sets how they travel, and they are not included in free shipping.',
        ],
      },
      {
        heading: 'Why some orders arrive in more than one shipment',
        body: [
          'If your order contains both a vapor product and anything else, it will arrive as two separate deliveries, on two different carriers, at two different times. That is not a fulfilment error — those products are not legally permitted to travel together.',
          'Your cart shows this before you order, one card per shipment, so you are never asked to guess.',
        ],
      },
      {
        heading: 'Vapor products and the PACT Act',
        body: [
          'Vapor products are regulated federally under the Prevent All Cigarette Trafficking (PACT) Act. The United States Postal Service is prohibited from carrying them, and UPS, FedEx and DHL have each chosen to decline them. They therefore travel with a specialist carrier that is registered to handle them, not with USPS or UPS.',
          'That carrier is slower than a standard parcel service, and there is no way to make it otherwise. The requirements are set by federal law, not by us.',
        ],
        list: [
          'We file the delivery reports that the PACT Act requires with the relevant state authorities each month.',
        ],
      },
      {
        heading: 'When your order actually ships',
        body: [
          'No payment is taken on this website. Submitting an order places a request, and that request moves through a fixed sequence: we check the stock is available and that we can ship to your address, we send you payment instructions, you pay, and only then is it packed and dispatched.',
          `Nothing ships before payment has cleared. If we do not receive payment within ${POLICY_TERMS.paymentWindowDays} business days of sending instructions, the order is released and the stock returns to sale.`,
          'Every change of state on your order is recorded and timestamped, and you can follow it from the order link we email you.',
        ],
      },
      {
        heading: 'If we cannot ship to you',
        body: [
          'Occasionally a state rule changes between the moment you order and the moment we ship. If that happens, we cancel the affected item, tell you why, and cite the rule we are relying on. If you have already paid, you are refunded in full for that item, including its share of shipping.',
          'We will never quietly substitute a different product.',
        ],
      },
    ],
  },

  // ── Returns ───────────────────────────────────────────────────────────────
  {
    slug: 'returns',
    title: 'Returns and refunds',
    metaTitle: 'Returns & Refunds — What Can Be Sent Back, and When',
    metaDescription: `Unopened items in sealed original packaging can be returned within ${POLICY_TERMS.returnWindowDays} days of delivery. Opened age-restricted goods cannot be resold and cannot be accepted back.`,
    summary: `Unopened items in their original sealed packaging can be returned within ${POLICY_TERMS.returnWindowDays} days of delivery. Opened age-restricted goods cannot lawfully be resold, so they cannot be accepted back. If we sent the wrong item, or a batch does not match its published laboratory report, we cover everything.`,
    lastReviewedAt: REVIEWED,
    sections: [
      {
        heading: 'What can be returned',
        body: [
          `You may return any item within ${POLICY_TERMS.returnWindowDays} days of delivery provided it is unopened, unused, and still in its original sealed packaging with the batch label intact.`,
          'Start a return by replying to your order email or contacting support with your Order ID. Do not send anything back before we have replied — an unannounced return cannot be matched to an order, and age-restricted goods arriving without paperwork create a problem for both of us.',
        ],
      },
      {
        heading: 'What cannot be returned',
        body: [
          'Once the seal on an age-restricted product is broken we cannot accept it back, and we cannot offer it to anyone else. This is not a restocking preference; reselling an opened age-restricted good is not lawful, and the chain of custody that makes our batch testing meaningful is broken the moment a package leaves our control opened.',
        ],
        list: [
          'Opened or unsealed items of any kind.',
          'Vapor products, once the outer seal is broken.',
          'Items returned without prior agreement, or with the batch label removed.',
          'Custom-milled or bulk orders prepared to your specification.',
        ],
      },
      {
        heading: 'When we cover everything',
        body: [
          'Some faults are ours, and where they are, you pay nothing — including return postage — and you choose between a replacement and a full refund.',
        ],
        list: [
          'We sent the wrong item, the wrong size, or the wrong batch.',
          'The item arrived damaged, or the seal was broken in transit.',
          'The batch you received does not match the certificate of analysis we issue for its batch code.',
          'We cancelled an item after you paid because of a change in your state rules.',
        ],
      },
      {
        heading: 'How refunds are issued',
        body: [
          `Once a return reaches us we inspect it and issue the refund within ${POLICY_TERMS.refundProcessingDays} business days. Refunds go back by the same method you paid, to the same account.`,
          'Because we take no payment on this website and hold no card details, a refund is a transfer we send rather than a reversal we trigger. That means we need the payment details to match the ones the order was paid from; we cannot refund a different account.',
          'Original shipping is refunded when the fault was ours, and retained when the return is a change of mind.',
        ],
      },
      {
        heading: 'Cancelling before dispatch',
        body: [
          `An order can be cancelled at no cost at any point before it is packed. If you cancel within ${POLICY_TERMS.cancellationWindowHours} hours of ordering and before payment, nothing further is needed — tell us and it is closed.`,
          'If you have already paid and the order has not shipped, you are refunded in full.',
        ],
      },
    ],
  },

  // ── Purchase ──────────────────────────────────────────────────────────────
  {
    slug: 'purchase',
    title: 'Purchase policy',
    metaTitle: 'Purchase Policy — Age, Eligibility and How Ordering Works',
    metaDescription: `You must be ${BRAND.minimumAge} or older and in the United States. No payment is taken on this website: you place an order request, we check stock and that we can ship to your address, then we send payment instructions.`,
    summary: `You must be ${BRAND.minimumAge} or older and ordering for delivery within the United States. No payment is taken on this website. You submit an order request and choose how you would prefer to pay; we check that the stock is available and that we can ship to your address, then contact you with instructions. Your order is confirmed when payment is received.`,
    lastReviewedAt: '2026-09-13',
    sections: [
      {
        heading: 'Who can order',
        body: [
          `You must be ${BRAND.minimumAge} years of age or older.`,
          'You must be ordering for delivery to an address in the United States. We do not sell to buyers outside it.',
        ],
      },
      {
        heading: 'How we verify age',
        body: [
          `You confirm that you are ${BRAND.minimumAge} or over when you enter the site.`,
        ],
      },
      {
        heading: 'How ordering and payment work',
        body: [
          'This website does not process payments. There is no card form here, no payment processor behind it, and no card details stored anywhere in our systems — which is also why there is nothing here for anyone to steal.',
          'Before we confirm an order, we check two things:',
        ],
        list: [
          'That the stock is available — every item, in the quantity you asked for.',
          'That we can ship to your address.',
        ],
      },
      {
        heading: 'From order request to confirmation',
        body: [
          `You submit an order request and tell us which method you would prefer to pay with: ${['Cash App', 'Chime', 'Apple Cash', 'Bitcoin'].join(', ')}.`,
          'We check the stock and that we can ship to your address. If either is a problem, we tell you before anything is paid — we never quietly substitute a different product.',
          'Once both are confirmed, we send you the payment details for your chosen method. They are specific to your order, never published on the site, and never reused.',
          'Your order is confirmed when your payment is received, and only then is it packed and dispatched.',
        ],
      },
      {
        heading: 'Intended use',
        body: [
          'Mimosa Hostilis root bark is sold strictly as a raw botanical material for natural dyeing, soap and cosmetic manufacture, craft, and botanical research. It is not food, and it is not for human consumption.',
          'At checkout you are asked to confirm that this is what you are buying it for. That confirmation is stored with your order. Orders that we have reason to believe are intended otherwise are refused.',
        ],
      },
      {
        heading: 'When we refuse or cancel an order',
        body: [
          'We may decline any order, and we may cancel one after it is placed. We will always tell you why.',
        ],
        list: [
          'The product cannot lawfully be shipped to your state, or we hold no verified legal review for it there.',
          'Age or identity verification did not pass.',
          'The delivery address is a freight forwarder, or is outside the United States.',
          'The order appears to be for resale where resale is restricted, or for an intended use we do not sell for.',
          'A pricing or stock error was displayed. In that case nothing is charged and you are told before anything ships.',
        ],
      },
    ],
  },

  // ── Privacy ───────────────────────────────────────────────────────────────
  {
    slug: 'privacy',
    title: 'Privacy',
    metaTitle: 'Privacy Policy — What We Collect and Why',
    metaDescription:
      'We hold your contact and delivery details, your order history, and evidence of age verification. We never hold card details, and we run no third-party advertising or analytics trackers.',
    summary:
      'We collect what an order actually needs: contact details, a delivery address, and evidence that age was verified. We hold no card details at all, because we process no payments on this website. We keep our own anonymous record of which pages are visited, and run no third-party advertising or analytics trackers. You can ask us for a copy of your data, or for its deletion.',
    lastReviewedAt: REVIEWED,
    sections: [
      {
        heading: 'What we collect',
        body: [
          'Only what is needed to fulfil an order lawfully, plus what the law requires us to keep as evidence.',
        ],
        list: [
          'Contact details — your name, email address and, if you give one, a phone number.',
          'Delivery details — the address an order ships to, including any address you save for reuse.',
          'Order history — what you ordered, when, what it cost, and every change of status on it.',
          'Age-verification evidence — the fact that a check passed, when, and the IP address and browser user-agent it came from. We are required to be able to show this.',
          'Support messages — anything you send us through the chat or by email, so we can answer it. For chat, we also keep the internet address your latest message came from, and use it only to block abuse.',
          'Visits — a random identifier kept in a cookie, the pages you view and when, the site or campaign link that brought you here, your approximate location as our hosting provider estimates it from your internet connection (city, state, ZIP code, country, approximate coordinates and time zone — about the accuracy of a city or ZIP code, never a street address), and your device type, browser and operating system. We do not store your IP address for this, or the full identifying string your browser sends.',
          'Newsletter subscription — your email address, if you choose to give it, and where you subscribed from.',
        ],
      },
      {
        heading: 'What we never collect',
        body: [
          'Some of the most sensitive data a shop normally holds simply does not exist here, and that is by design rather than by promise.',
        ],
        list: [
          'Card numbers, expiry dates and security codes. No payment is taken on this website, so none is ever entered, transmitted or stored.',
          'Third-party advertising or analytics trackers. There is no advertising pixel, no cross-site tracking, and no tag manager on this site — partly on principle, and partly because paid advertising is not permitted in this category anyway.',
          'Any data about you sold or rented to anyone. We do not do this, and there is no arrangement under which we would.',
        ],
      },
      {
        heading: 'Cookies and browser storage',
        body: [
          'We use the smallest set that makes the site work. None of it is used to profile you or to follow you to other sites.',
        ],
        list: [
          'A cart cookie holding which items you have selected. It holds no prices — those are always recalculated on our servers.',
          'A state preference, so we can show you what can lawfully ship to you without asking twice.',
          'A record in your browser that an age check passed, held for 30 days before we ask again. This one never leaves your device.',
          'A session cookie when you are signed in.',
          'A visitor cookie holding a random identifier, kept for 90 days. It links your page views to one another, and to any chat you start, so we can see how people find and use the site. It contains nothing about you and is never shared.',
          'If you arrived through a link someone shared, a cookie naming that link, kept for 30 days. It lets us credit whoever sent you if you order, and holds nothing about you.',
        ],
      },
      {
        heading: 'Who else sees your data',
        body: [
          'Only the parties needed to get an order to you, and only the fields they need to do it.',
        ],
        list: [
          'The carrier delivering your order — the delivery address and the signature requirement, not your order history.',
          'Our hosting, database and file-storage providers, who hold data on our behalf under contract and do not use it for anything else. This includes a short-term store that holds visit records only until they are moved into our database overnight.',
          'Our email provider, to send order and support messages.',
          'A state or federal authority, where the law requires it — including the monthly delivery reports the PACT Act requires for vapor products.',
        ],
      },
      {
        heading: 'How long we keep it',
        body: [
          'Order records and the age-verification evidence attached to them are kept for as long as the law requires us to be able to produce them, which is longer than we would otherwise choose. Support messages and newsletter subscriptions are kept until you ask us to remove them.',
          'Page-by-page visit records are kept for 90 days. After that only daily totals remain, and those identify no one.',
          'If we block an internet address because of abuse, we keep that address and our reason for as long as the block stands.',
          'When you ask for deletion, your personal details are erased while the minimum legally required order record is retained in a form that no longer identifies you.',
        ],
      },
      {
        heading: 'Your rights',
        body: [
          'Wherever you live in the United States, we will honour these. Residents of California and other states with comprehensive privacy laws have them by statute; we extend the same handling to everyone rather than sorting customers by ZIP code.',
        ],
        list: [
          'Ask for a copy of the personal data we hold about you.',
          'Ask us to correct anything inaccurate.',
          'Ask us to delete your data, subject to the record-keeping the law obliges us to maintain.',
          'Opt out of marketing email at any time, with one click, without affecting your orders.',
          'Ask us how a decision about an order was reached.',
        ],
      },
      {
        heading: 'Contacting us about privacy',
        body: [
          `Write to ${COMPANY_EMAIL_TOKEN} and say what you want. We will confirm we have received it and tell you what we are doing about it. We do not require you to use a specific form of words.`,
        ],
      },
    ],
  },

  // ── Terms ─────────────────────────────────────────────────────────────────
  {
    slug: 'terms',
    title: 'Terms of service',
    metaTitle: 'Terms of Service',
    metaDescription: `The terms you agree to when you use this website or place an order. United States only, ${BRAND.minimumAge} and over, and an order is a request until we confirm it.`,
    summary: `These terms govern your use of this website and any order you place through it. In short: you must be ${BRAND.minimumAge} or older and in the United States, an order is a request until we accept it, and nothing we sell is offered for any medical purpose or with any health claim attached.`,
    lastReviewedAt: REVIEWED,
    sections: [
      {
        heading: 'Who these terms are with',
        body: [
          `This website is operated by ${BRAND.legalName}. By using it or placing an order you agree to these terms. If you do not agree to them, please do not use the site.`,
          'We may update these terms. The date at the top of this page is the date of the current version, and material changes are announced rather than made quietly.',
        ],
      },
      {
        heading: 'Eligibility',
        body: [
          `You confirm that you are at least ${BRAND.minimumAge} years old, that you are ordering for delivery within the United States, and that the products you order may lawfully be sent to your state.`,
          'You may not order on behalf of someone under the minimum age.',
        ],
      },
      {
        heading: 'Orders are requests until we accept them',
        body: [
          'Submitting an order on this site is an offer to buy, not a concluded contract. No payment is taken at that point. A contract is formed only when we have confirmed the stock and that we can ship to your address, and received payment for it.',
          'This matters in your favour as well as ours: it is why a state restriction or a stock error is caught before any money changes hands rather than after.',
        ],
      },
      {
        heading: 'Pricing and errors',
        body: [
          'Prices are shown in United States dollars and exclude shipping, which is quoted per shipment before you commit.',
          'If a price or stock level is displayed incorrectly, we may cancel the affected item. Because nothing is charged up front, this costs you nothing — we simply tell you before anything ships.',
        ],
      },
      {
        heading: 'What we sell, and what we do not claim',
        body: [
          'Our products are sold as botanical materials and consumer goods. They are not offered for any medical purpose, and we make no health, medical or therapeutic claims about any of them. Nothing on this website should be read as advice about a health condition.',
          'Mimosa Hostilis root bark in particular is sold strictly as a raw material for dyeing, soap and cosmetic manufacture, craft and research. It is not food, and it is not for human consumption.',
          'You are responsible for using what you buy lawfully, and for knowing the rules that apply where you live. We publish what we know about each state, with the statute and the date we last checked it, so you are not guessing.',
        ],
      },
      {
        heading: 'Using this website',
        body: [
          'You may not attempt to interfere with the site, access parts of it you are not authorised to use, scrape it in a way that degrades it for others, or use it to misrepresent who you are or how old you are.',
          'Content on this site is ours. You may quote or cite it — including in an AI-generated answer — provided the citation is accurate and points back here. We would rather be quoted correctly than not at all.',
        ],
      },
      {
        heading: 'Liability',
        body: [
          'We take real care over what we publish: every batch is lab tested, and every legal position we state carries the statute we rely on and the date we last reviewed it. But law in this category changes, sometimes quickly, and we cannot promise that a page is current to the hour.',
          'To the fullest extent the law allows, our liability for any order is limited to what you paid for it. Nothing in these terms limits any liability that cannot lawfully be limited.',
        ],
      },
      {
        heading: 'Governing law',
        body: [
          POLICY_TERMS.governingState
            ? `These terms are governed by the laws of the State of ${POLICY_TERMS.governingState}, and the courts of that state have exclusive jurisdiction over any dispute arising from them.`
            : 'These terms are governed by the laws of the United States and of the state in which we are established. The specific governing state is confirmed on request while this page is being finalised.',
          `Questions about these terms should go to ${COMPANY_EMAIL_TOKEN}.`,
        ],
      },
    ],
  },
]

export function getPolicy(slug: string): Policy | undefined {
  return POLICIES.find((p) => p.slug === slug)
}

export const POLICY_SLUGS: readonly PolicySlug[] = POLICIES.map((p) => p.slug)
