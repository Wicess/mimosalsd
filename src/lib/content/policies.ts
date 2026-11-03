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

/*
  Copy rewritten 2026-11-03 in this site's own words. The policy text had been carried
  over from the parent site almost verbatim (58–93% of 8-word runs shared), which gets
  a page filed as a copy of the older one. Every fact and commitment is unchanged;
  only the wording, order and headings moved. Headings are the question a customer
  asks, and the first sentence beneath each one answers it on its own.
*/
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
    title: 'Shipping and delivery',
    metaTitle: 'Shipping and Delivery, Root Bark Sent From California',
    /*
      The price is written in words: sanitizeMeta strips every currency amount, which
      left this description reading "Free shipping on all orders from." in results.
    */
    metaDescription: 'Tracked root bark parcels from California, in double-sealed, smell-proof bags flushed with nitrogen. Root bark ships free on US orders from one hundred dollars.',
    summary: `Parcel shipping costs nothing once an order reaches ${FREE_FROM}; vapor products are the exception and are never shipped free. Parcels leave California with tracking, carried by USPS, UPS or another local carrier, in a smell-proof bag that is sealed twice and flushed with nitrogen so oxygen cannot age the bark. The cart delivers anywhere in the United States, and root bark can go to other countries on a quote.`,
    lastReviewedAt: '2026-09-13',
    sections: [
      {
        heading: 'Is shipping free?',
        body: [
          `Yes, on any order of ${FREE_FROM} or more: from that amount up, we pay the postage.`,
          'Vapor products are the only exception. Federal law decides how they are carried, so their delivery never qualifies for free shipping.',
        ],
      },
      {
        heading: 'Which carrier will deliver my order?',
        body: [
          'USPS or UPS, or another local delivery agency when a route calls for one.',
          'Vapor products go with a specialist carrier instead, for the legal reasons set out further down this page.',
        ],
      },
      {
        heading: 'How long will delivery take?',
        body: [
          'You receive a delivery window with your order; we do not print one on this page. The honest answer depends on which carrier takes the parcel, where it is going and which checks it has to clear, and no single figure written here could reflect all three.',
        ],
      },
      {
        heading: 'How is my order packed?',
        body: [
          'In a smell-proof bag that is sealed twice and flushed with nitrogen just before it closes, whatever the order contains. The nitrogen pushes the oxygen out, and bark kept away from oxygen cannot oxidize, so it arrives as fresh as it left us and keeps that way on your shelf.',
        ],
      },
      {
        heading: 'When will my order leave?',
        body: [
          'Once your payment has cleared, never earlier. Every order moves through the same steps, in this order:',
        ],
        list: [
          'You place the order.',
          'We confirm the stock is on hand and that your address is one we can ship to.',
          'Payment details reach you in your order chat and by email.',
          'You pay.',
          'We pack the parcel and hand it to the carrier.',
        ],
      },
      {
        heading: 'What happens if I do not pay?',
        body: [
          `The order lapses. When ${POLICY_TERMS.paymentWindowDays} business days pass after we send payment instructions without the money reaching us, we release the order and put its stock back on sale.`,
        ],
      },
      {
        heading: 'Where can I follow my order?',
        body: [
          'At the order link in the email we send you. Each status change is logged there, with the time it happened.',
        ],
      },
      {
        heading: 'Where do you ship?',
        body: [
          // availability-allow: the owner's statement of the footprint (2026-09-19: "we already ship to all states").
          'To every one of the 50 states and to the District of Columbia. The United States is the market the cart and checkout were built for. The one kind of address we turn down is a freight forwarder.',
          // availability-allow: the owner's statement of the origin (2026-09-27: the main branch is in California).
          'Every parcel starts at our California branch, and that origin has no bearing on where an order can go: each state is served from the same place.',
          // Owner, 2026-10-15: "we are focused in the USA but we also ship worldwide based on the quantity of the order".
          `Mimosa hostilis and sassafras root bark can also travel abroad, priced one order at a time, because an international parcel costs what its weight dictates. To get a price, use the bulk enquiry form and pick Outside the United States. Checking your country's import rules for plant material, and paying any duties or taxes, falls to you as the buyer. [Shipping root bark outside the United States](/blog/shipping-root-bark-outside-the-united-states) walks through the process.`,
        ],
      },
      {
        heading: 'Why did my order come in two parts?',
        body: [
          'Because it held a vapor product as well as something else, and the law does not let the two travel together. They go out as separate shipments, with different carriers, and reach you on different days. That is the rule working, not a mistake in packing.',
          'You can see the split before you order. The cart gives each shipment its own card, so nothing about it comes as a surprise.',
        ],
      },
      {
        heading: 'How are vapor products shipped?',
        body: [
          'Through a specialist carrier registered to handle them, never USPS or UPS. The Prevent All Cigarette Trafficking (PACT) Act regulates vapor products at the federal level and forbids the Postal Service to carry them, and UPS, FedEx and DHL have each decided to refuse them too.',
          'These deliveries are slower than an ordinary parcel, and nothing we do can change that. Federal law sets the requirements; we only follow them.',
        ],
        list: [
          'Every month, we file the delivery reports the PACT Act calls for with the relevant state authorities.',
        ],
      },
      {
        heading: 'What if a state rule changes after I order?',
        body: [
          'We cancel the affected item, explain the reason and cite the rule we are acting on. This can happen when a state changes its rules in the gap between your order and our shipment. If you have paid already, that item is refunded in full, along with its portion of the shipping.',
          'You will never be sent a different product in its place without being told.',
        ],
      },
    ],
  },

  // ── Returns ───────────────────────────────────────────────────────────────
  {
    slug: 'returns',
    title: 'Returns, refunds and cancellations',
    metaTitle: `Returns and Refunds: Sealed Items Within ${POLICY_TERMS.returnWindowDays} Days`,
    // Short enough to show whole: at full length the clamp kept only the first sentence.
    metaDescription: `Sealed, unopened items can come back within ${POLICY_TERMS.returnWindowDays} days of delivery, but opened goods cannot. When the mistake is ours, it costs you nothing.`,
    summary: `You have ${POLICY_TERMS.returnWindowDays} days from delivery to send back anything still unopened and sealed in its original packaging. An age-restricted product that has been opened may not lawfully be sold again, so we cannot take it back. When the error is ours, such as a wrong item or a batch that differs from its published lab report, we pay the whole cost of putting it right.`,
    lastReviewedAt: REVIEWED,
    sections: [
      {
        heading: 'Can I send something back?',
        body: [
          `Yes, for ${POLICY_TERMS.returnWindowDays} days after delivery, as long as the item is unused, unopened and still sealed in its original packaging, with the batch label in place.`,
        ],
      },
      {
        heading: 'How do I start a return?',
        body: [
          'Reply to your order email, or contact support and give us your Order ID. Then wait for our answer before posting anything. A parcel that turns up unannounced cannot be linked to its order, and age-restricted goods that arrive with no paperwork leave both of us with a problem.',
        ],
      },
      {
        heading: 'What if the mistake was ours?',
        body: [
          'Then you pay nothing, return postage included, and you decide whether you want a replacement or a full refund. That applies when:',
        ],
        list: [
          'You received the wrong item, the wrong size or the wrong batch.',
          'The item was damaged on the way, or its seal broke in transit.',
          'Your batch differs from the certificate of analysis we issue for its batch code.',
          'You had already paid when we canceled an item because your state changed its rules.',
        ],
      },
      {
        heading: 'Which items cannot be returned?',
        body: [
          'Any age-restricted product with a broken seal. We could not accept it, and we could not pass it on to anyone else, because selling an opened age-restricted product again is unlawful. That is a legal limit, not a restocking preference. An item that has been opened outside our control also breaks the chain of custody that gives our batch testing its meaning.',
        ],
        list: [
          'Anything opened or unsealed, whatever it is.',
          'A vapor product whose outer seal has been broken.',
          'Anything sent back before we agreed to the return, or with its batch label removed.',
          'An order we milled or made up in bulk to your specification.',
        ],
      },
      {
        heading: 'When will I get my refund?',
        body: [
          `Within ${POLICY_TERMS.refundProcessingDays} business days of your return reaching us, once we have inspected it. The money goes back by the method you used to pay, into the same account.`,
          'We keep no card details, so there is no charge for us to reverse. A refund is a new transfer we send, and it can only go to the account the order was paid from, never to a different one.',
          'If we were at fault, your original shipping charge is refunded too. If you simply changed your mind, it is not.',
        ],
      },
      {
        heading: 'Can I cancel my order?',
        body: [
          `Yes, free of charge, at any point until it is packed. If it is within ${POLICY_TERMS.cancellationWindowHours} hours of ordering and you have not paid yet, just tell us and we close it; there is nothing else to do.`,
          'Paid, but not yet shipped? You get a full refund.',
        ],
      },
    ],
  },

  // ── Purchase ──────────────────────────────────────────────────────────────
  {
    slug: 'purchase',
    title: 'How ordering works',
    metaTitle: 'How Ordering Works: Age, Eligibility and Payment',
    metaDescription: `Buyers must be ${BRAND.minimumAge} or older. Send an order request, we confirm stock and that we can ship to you, then payment details arrive in your order chat.`,
    summary: `Ordering here happens in two steps. You send an order request and pick the way you would like to pay; we confirm the stock and that your address is one we can ship to, then send payment details in your order chat and by email. The order is confirmed once your payment arrives. Buyers must be ${BRAND.minimumAge} or older, and the cart delivers within the United States; orders for other countries are quoted first.`,
    lastReviewedAt: '2026-09-13',
    sections: [
      {
        heading: 'How do I place an order?',
        body: [
          `Send an order request and tell us which of these you would rather pay with: ${['Cash App', 'Chime', 'Apple Cash', 'Bitcoin'].join(', ')}.`,
          'Before anything else happens, we confirm two things:',
        ],
        list: [
          'Every item is in stock, in the quantity you asked for.',
          'Your address is one we can ship to.',
        ],
      },
      {
        heading: 'What happens after those checks?',
        body: [
          'If both pass, a person confirms your order and we send payment details for the method you chose, in your order chat on this site and by email. Those details are made for that single order: they never appear on the site and are never used again.',
          'If either check fails, you hear from us before any money changes hands. We never quietly swap in a different product.',
          'Your order is confirmed the moment your payment arrives, and nothing is packed or dispatched before then.',
        ],
      },
      {
        heading: 'Do you take card payments?',
        body: [
          'No. We never ask for card details, and we never store them.',
        ],
      },
      {
        heading: 'Who can buy?',
        body: [
          `Anyone aged ${BRAND.minimumAge} or older.`,
          'Orders through the cart need a delivery address in the United States. From any other country, root bark can be ordered on a quote through the bulk enquiry form.',
        ],
      },
      {
        heading: 'How is my age checked?',
        body: [
          `When you enter the site, you confirm that you are ${BRAND.minimumAge} or over.`,
        ],
      },
      {
        heading: 'What is root bark sold for?',
        body: [
          'Natural dyeing, soap and cosmetic manufacture, craft, and botanical research. We sell Mimosa hostilis root bark strictly as a raw botanical material for those purposes. It is not food, and it is not for human consumption.',
          'Checkout asks you to confirm that this is why you are buying it, and that answer is saved with your order. If we have reason to think an order is meant for anything else, we refuse it.',
        ],
      },
      {
        heading: 'Can you refuse or cancel my order?',
        body: [
          'Yes. We can turn down any order, or cancel one after it is placed, and we always give you the reason. Situations where we do so include:',
        ],
        list: [
          'Your state does not allow the product to be shipped there, or we have no verified legal review covering it in your state.',
          'Your age or identity could not be verified.',
          'The delivery address belongs to a freight forwarder, or lies outside the United States on an order we have not quoted.',
          'The order looks intended for resale where resale is restricted, or for a use we do not sell for.',
          'The site showed a wrong price or stock level. You are not charged, and we tell you before anything ships.',
        ],
      },
    ],
  },

  // ── Privacy ───────────────────────────────────────────────────────────────
  {
    slug: 'privacy',
    title: 'Privacy policy',
    metaTitle: 'Privacy Policy: The Data We Keep and Why We Keep It',
    metaDescription:
      'We keep your contact and delivery details, your orders and proof of an age check. No card details, and no third-party advertising or analytics trackers.',
    summary:
      'We keep only what an order needs: how to reach you, where to deliver, and proof that an age check was passed. Card details never reach us, since this website takes no payments. Page visits are counted by our own anonymous record, and no third-party advertising or analytics tracker runs here. You may ask for a copy of your data, or for it to be deleted.',
    lastReviewedAt: REVIEWED,
    sections: [
      {
        heading: 'Do you sell my data?',
        body: [
          'No. Your data is never sold or rented to anyone, and there is no arrangement under which it could be.',
        ],
      },
      {
        heading: 'Do you store my card details?',
        body: [
          'No, and there is nothing to store. We never ask for a card number, expiry date or security code, so none is typed in, sent to us or kept. That rests on how the site is built, not on a promise.',
        ],
      },
      {
        heading: 'Do you use advertising or analytics trackers?',
        body: [
          'Not from any third party. The site carries no advertising pixel and no tag manager, and nothing on it follows you across other websites. Part of that is principle; part is that paid advertising is not allowed in this category in any case.',
          'We do keep our own record of visits, described below.',
        ],
      },
      {
        heading: 'What do you keep about me?',
        body: [
          'What a lawful order requires, plus the evidence the law obliges us to hold:',
        ],
        list: [
          'Your name, your email address and, if you give us one, a phone number.',
          'Delivery addresses: the one each order goes to, and any you save to use again.',
          'Your orders: the items, the date, the price, and each change of status.',
          'Proof of your age check: that it passed, when it passed, and the IP address and browser user-agent it came from. We must be able to produce this.',
          'Messages you send support by chat or email, so we can reply. For chat we also keep the internet address your most recent message came from, and use it for nothing except blocking abuse.',
          'Your newsletter sign-up, if you choose to give us an email address, and where you signed up.',
        ],
      },
      {
        heading: 'What do you record when I browse?',
        body: [
          'A random identifier stored in a cookie, the pages you open and when, and the site or campaign link that sent you here. We also note your device type, browser and operating system, and an approximate location that our hosting provider works out from your internet connection: city, state, ZIP code, country, rough coordinates and time zone.',
          'That location is about as precise as a city or a ZIP code, never a street address. Visit records do not include your IP address, or the full identifying string your browser sends.',
        ],
      },
      {
        heading: 'Which cookies and browser storage do you use?',
        body: [
          'Only the few the site needs in order to work. None of them builds a profile of you or follows you to other sites.',
        ],
        list: [
          'Your cart: the items you picked, but no prices, which our servers always work out afresh.',
          'The state you chose, so we can show what may lawfully ship to you without asking a second time.',
          'A note in your browser that you passed the age check, kept 30 days before we ask again. It never leaves your device.',
          'A session cookie while you are signed in.',
          'A visitor cookie with a random identifier, kept 90 days. It ties your page views together, and to any chat you open, so we can see how people find and use the site. It holds nothing about you and is never shared.',
          'If someone shared a link that brought you here, a cookie naming that link, kept 30 days. It lets us credit whoever sent you if you place an order, and holds nothing about you.',
        ],
      },
      {
        heading: 'Who else can see my data?',
        body: [
          'Only the services needed to get your order to you, and each one sees only the details it needs.',
        ],
        list: [
          'The carrier: your delivery address and the signature requirement, but not your order history.',
          'Our hosting, database and file-storage providers, which hold data for us under contract and use it for nothing else. One of them is a short-term store that keeps visit records only until they move into our database overnight.',
          'Our email provider, which sends order and support messages.',
          'State or federal authorities where the law requires it, including the monthly PACT Act delivery reports for vapor products.',
        ],
      },
      {
        heading: 'How long do you keep it?',
        body: [
          'It depends on the record. Orders, and the age-check proof attached to them, stay for as long as the law requires us to be able to produce them, which is longer than we would choose.',
          'Support messages and newsletter sign-ups stay until you ask us to remove them.',
          'Individual visit records are kept 90 days. Only daily totals remain after that, and they identify nobody.',
          'An internet address we have blocked for abuse, and our reason for blocking it, are kept as long as the block stands.',
        ],
      },
      {
        heading: 'What are my rights?',
        body: [
          'These, wherever in the United States you live. California and other states with comprehensive privacy laws grant them to their residents by statute; rather than sort customers by ZIP code, we give everyone the same handling. You can:',
        ],
        list: [
          'Get a copy of the personal data we hold about you.',
          'Have anything inaccurate corrected.',
          'Have your data deleted, within the record-keeping the law requires of us. We erase your personal details and keep only the minimum order record the law requires, in a form that no longer identifies you.',
          'Unsubscribe from marketing email at any time with one click, with no effect on your orders.',
          'Find out how a decision about an order was reached.',
        ],
      },
      {
        heading: 'How do I make a privacy request?',
        body: [
          `Email ${COMPANY_EMAIL_TOKEN} and tell us what you need, in your own words; no particular wording is required. We will acknowledge the request and explain what we are doing about it.`,
        ],
      },
    ],
  },

  // ── Terms ─────────────────────────────────────────────────────────────────
  {
    slug: 'terms',
    title: 'Terms of service',
    metaTitle: 'Terms of Service: Using the Site and Ordering From It',
    metaDescription: `What you agree to by using this site or ordering from it: you are ${BRAND.minimumAge} or over, delivery is US focused, and an order stays a request until we confirm it.`,
    summary: `Using this website, or ordering through it, means accepting these terms. The essentials: buyers must be ${BRAND.minimumAge} or older, every order stays a request until we accept it, and no product here is offered for a medical purpose or sold with a health claim.`,
    lastReviewedAt: REVIEWED,
    sections: [
      {
        heading: 'Do these terms apply to me?',
        body: [
          `Yes, as soon as you use this website or order from it; doing either means you accept them. The site is run by ${BRAND.legalName}. If you do not accept these terms, please do not use the site.`,
          'The terms can change. The date shown at the top of this page belongs to the version now in force, and any material change will be announced, never slipped in.',
        ],
      },
      {
        heading: 'Who may order?',
        body: [
          `By ordering you confirm three things: you are at least ${BRAND.minimumAge} years old, your delivery address is in the United States or covered by a quote from us, and the products you chose may lawfully be sent to that address.`,
          'Ordering for someone below the minimum age is not allowed.',
        ],
      },
      {
        heading: 'When does an order become a contract?',
        body: [
          'Only after we have confirmed the stock, confirmed that we can ship to your address, and received your payment. Until then, submitting an order is an offer to buy and nothing more.',
          'That protects you as much as it protects us: a state restriction or a stock mistake comes to light before any money is paid, not after.',
        ],
      },
      {
        heading: 'What if a price is wrong?',
        body: [
          'We may cancel the item a pricing or stock error affects. You lose nothing when that happens, since no charge is taken up front; we let you know before anything ships.',
          'All prices are in US dollars and do not include shipping, which is quoted for each shipment before you commit.',
        ],
      },
      {
        heading: 'Do you make health claims about your products?',
        body: [
          'No. We make no health, medical or therapeutic claims about anything we sell, and no product is offered for a medical purpose. Everything is sold as a botanical material or consumer good, and nothing on this site is advice about any health condition.',
          'Root bark is the plainest case: Mimosa hostilis root bark is sold strictly as raw material for dyeing, soap and cosmetic manufacture, craft and research. It is not food, and it is not for human consumption.',
        ],
      },
      {
        heading: 'Who is responsible for how products are used?',
        body: [
          'You are. Using what you buy lawfully, and knowing the rules where you live, is up to you. To help, we publish what we know about each state, citing the statute and the date we last checked it.',
        ],
      },
      {
        heading: 'What may I not do on this site?',
        body: [
          'Interfere with it, enter parts of it you are not authorized to use, scrape it in a way that degrades it for other people, or use it to misrepresent your identity or your age.',
          'The content here belongs to us. You may quote or cite it, an AI-written answer included, as long as the citation is accurate and links back to this site. Being quoted correctly matters more to us than not being quoted at all.',
        ],
      },
      {
        heading: 'How far does your liability go?',
        body: [
          'No further than what you paid for the order in question, to the fullest extent the law allows. Nothing in these terms limits a liability that the law says cannot be limited.',
          'We are careful about what we publish. Every batch is tested in a lab, and every legal position we take names the statute behind it and the date we last reviewed it. Even so, the law in this category can move quickly, and we cannot promise that every page is current to the hour.',
        ],
      },
      {
        heading: 'Which law governs these terms?',
        body: [
          POLICY_TERMS.governingState
            ? `The law of the State of ${POLICY_TERMS.governingState}. Any dispute arising from these terms falls under the exclusive jurisdiction of that state's courts.`
            : 'United States law, together with the law of the state where we are established. While this page is being finalized, we confirm the specific governing state on request.',
          `Send any question about these terms to ${COMPANY_EMAIL_TOKEN}.`,
        ],
      },
    ],
  },
]

export function getPolicy(slug: string): Policy | undefined {
  return POLICIES.find((p) => p.slug === slug)
}

export const POLICY_SLUGS: readonly PolicySlug[] = POLICIES.map((p) => p.slug)
