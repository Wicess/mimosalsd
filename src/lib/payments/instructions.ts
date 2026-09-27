import type { PaymentMethod } from '@/lib/orders/types'
import { PAYMENT_LABELS } from '@/lib/orders/types'
import { formatCents } from '@/lib/utils'

/**
 * ─────────────────────────────────────────────────────────────────────────────
 *  PAYMENT INSTRUCTIONS — one source for every place a customer reads them.
 *
 *  The invoice image, the email, the chat message and the order page all render
 *  from `buildPaymentInstructions`, so the four can never tell a customer different
 *  things. A customer comparing an email with their order page and finding two
 *  versions would reasonably suspect a scam, and the step that differs would be the
 *  one they got wrong.
 *
 *  Written from each provider's own help pages (checked 2026-09-13):
 *   · Cash App — cash.app/help (sending a payment); the "For" note; $Cashtag typos
 *     send money to the wrong person; payments move instantly.
 *   · Chime Pay Anyone — chime.com/blog/how-to-use-chime-pay-anyone and
 *     help.chime.com: the SENDER needs a Chime Checking Account; Pay tab → Pay →
 *     $ChimeSign; instant between members and not reversible; daily/monthly limits;
 *     transfers may be held for fraud review.
 *   · Apple Cash — support.apple.com/105013: iPhone, 18+, US resident; send from
 *     Wallet (Apple Cash card → Send) or Messages (+ → Apple Cash, with a comment);
 *     a payment can be cancelled only while it still shows Pending.
 *   · Bitcoin — bitcoin.org "Some things you need to know", Cash App bitcoin help,
 *     Coinbase "steps to send crypto": the Bitcoin network only (a wrong network loses
 *     the funds), check the whole address, irreversible, and fees may be taken out of
 *     the amount sent.
 *
 *  Apple's P2P product is Apple CASH. It is never called Apple Pay here (CLAUDE.md,
 *  rule 7): Apple Pay is a card wallet this shop does not accept.
 * ─────────────────────────────────────────────────────────────────────────────
 */

export interface IssuedPaymentDetails {
  readonly method: PaymentMethod
  /** $Cashtag, $ChimeSign, the Apple Cash phone number or email, or the BTC address. */
  readonly payTo: string
  /** The name on the receiving account, when the owner gives one. Shown so the customer can check it. */
  readonly payToName?: string | undefined
  readonly amountCents: number
  /** Bitcoin only: the amount in BTC, as a decimal string with up to 8 places. */
  readonly btcAmount?: string | undefined
  /** Bitcoin only: the USD price of one BTC the amount was worked out from. */
  readonly btcRateUsd?: number | undefined
  /** Bitcoin only: until when that BTC amount holds (ISO). */
  readonly btcQuoteUntil?: string | undefined
  readonly orderId: string
  /** Pay by (ISO): when the order's reservation lapses. */
  readonly payBy: string
}

export interface PaymentInstructions {
  readonly method: PaymentMethod
  readonly methodLabel: string
  readonly headline: string
  /** The at-a-glance table: send to, amount, note, pay by. */
  readonly summary: readonly { readonly label: string; readonly value: string }[]
  /** Who can use this method at all, when there is a condition. */
  readonly requirement?: string
  readonly steps: readonly string[]
  readonly warnings: readonly string[]
  /** Shown with every set of details: how to tell these are really from us. */
  readonly safety: string
}

const UTC = new Intl.DateTimeFormat('en-US', {
  timeZone: 'UTC',
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
})

/** "Sep 15, 4:30 PM UTC" — always UTC, and always saying so. */
export function formatUtc(iso: string): string {
  return `${UTC.format(new Date(iso))} UTC`
}

const PROOF_STEP = 'Take a screenshot of the finished payment and send it to us in the chat on our site, or upload it on your order page.'

export function buildPaymentInstructions(d: IssuedPaymentDetails): PaymentInstructions {
  const amount = formatCents(d.amountCents)
  const label = PAYMENT_LABELS[d.method]
  const safety =
    'We only send payment details for an order you placed, and they always match your order page on mimosalsd.com. If a message asks you to pay anywhere else, do not pay. Contact us through the chat on our site instead.'
  const payToLine = d.payToName ? `${d.payTo} (${d.payToName})` : d.payTo

  switch (d.method) {
    case 'CASHAPP':
      return {
        method: d.method,
        methodLabel: label,
        headline: `Pay ${amount} with Cash App`,
        summary: [
          { label: 'Send to', value: payToLine },
          { label: 'Amount', value: amount },
          { label: 'Note ("For")', value: d.orderId },
          { label: 'Pay by', value: formatUtc(d.payBy) },
        ],
        steps: [
          'Open Cash App and tap the $ (Pay) tab.',
          `Enter exactly ${amount} and tap Pay.`,
          `Search for ${d.payTo} and check it matches exactly, character for character.`,
          `In the "For" note, type your Order ID: ${d.orderId}.`,
          'Review the details, then tap Pay.',
          PROOF_STEP,
        ],
        warnings: [
          'Cash App payments arrive instantly and cannot be cancelled. A single typo in the $Cashtag sends your money to someone else, so check it before you pay.',
          'Send the exact amount in one payment, with your Order ID in the note.',
        ],
        safety,
      }

    case 'CHIME':
      return {
        method: d.method,
        methodLabel: label,
        headline: `Pay ${amount} with Chime`,
        requirement: 'Paying with Chime needs your own Chime Checking Account (Chime Pay Anyone).',
        summary: [
          { label: 'Send to', value: payToLine },
          { label: 'Amount', value: amount },
          { label: 'Note', value: d.orderId },
          { label: 'Pay by', value: formatUtc(d.payBy) },
        ],
        steps: [
          'Open the Chime app and go to the Pay tab.',
          `Tap Pay, then search for ${d.payTo}.`,
          `Enter exactly ${amount}.`,
          `Add your Order ID as the note: ${d.orderId}.`,
          'Double-check the details, then tap Pay.',
          PROOF_STEP,
        ],
        warnings: [
          'Pay Anyone transfers between Chime members are instant and cannot be reversed, so check the $ChimeSign before you pay.',
          'Chime sets daily and monthly Pay Anyone limits (you can see yours in the app), and may hold a transfer for review. If yours is held, tell us in chat.',
        ],
        safety,
      }

    case 'APPLE_CASH':
      return {
        method: d.method,
        methodLabel: label,
        headline: `Pay ${amount} with Apple Cash`,
        requirement: 'Apple Cash works on an iPhone with Apple Cash set up in Wallet, for US residents aged 18 or over.',
        summary: [
          { label: 'Send to', value: payToLine },
          { label: 'Amount', value: amount },
          { label: 'Comment', value: d.orderId },
          { label: 'Pay by', value: formatUtc(d.payBy) },
        ],
        steps: [
          `Open Messages, start a message to ${d.payTo}, tap the + button, then choose Apple Cash.`,
          `Enter exactly ${amount} and tap Send.`,
          `Add your Order ID as the comment: ${d.orderId}.`,
          'Tap Send, then double-click the side button and confirm with Face ID, Touch ID or your passcode.',
          `No Messages? Open Wallet, tap your Apple Cash card, tap Send, choose ${d.payTo}, enter ${amount} and send. Wallet has no comment field, so send us your Order ID in chat.`,
          PROOF_STEP,
        ],
        warnings: [
          `Check the recipient is exactly ${d.payTo} before you confirm.`,
          'A payment can only be cancelled while it still shows Pending.',
        ],
        safety,
      }

    case 'BITCOIN': {
      const btc = d.btcAmount ?? ''
      return {
        method: d.method,
        methodLabel: label,
        headline: `Pay ${btc} BTC (${amount}) with Bitcoin`,
        summary: [
          { label: 'Send to', value: d.payTo },
          { label: 'Amount', value: `${btc} BTC` },
          { label: 'Network', value: 'Bitcoin (BTC)' },
          { label: 'Pay by', value: formatUtc(d.btcQuoteUntil ?? d.payBy) },
        ],
        steps: [
          'Open your Bitcoin wallet or exchange. In Cash App: Money tab, then Bitcoin, then Send.',
          'Choose to send Bitcoin (BTC) on the Bitcoin network.',
          'Paste the address above, then check every character matches.',
          `Enter exactly ${btc} BTC. If your wallet or exchange takes its fee out of that amount, add the fee on top so the full ${btc} BTC arrives.`,
          `Send it before ${formatUtc(d.btcQuoteUntil ?? d.payBy)}.`,
          'Send us the transaction ID, or a screenshot of the sent payment, in the chat on our site.',
        ],
        warnings: [
          'Send BTC on the Bitcoin network only. Bitcoin sent on any other network, or to a different address, is lost and cannot be recovered.',
          'Bitcoin payments cannot be reversed.',
          d.btcRateUsd
            ? `The BTC amount is worked out at ${formatUsdRate(d.btcRateUsd)} per bitcoin. If you pay after ${formatUtc(d.btcQuoteUntil ?? d.payBy)}, ask us in chat for a fresh amount first.`
            : `If you pay after ${formatUtc(d.btcQuoteUntil ?? d.payBy)}, ask us in chat for a fresh amount first.`,
          'We confirm your payment once the Bitcoin network has confirmed it.',
        ],
        safety,
      }
    }
  }
}

function formatUsdRate(rate: number): string {
  return rate.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
}

/** The instructions as plain text, for the email's text body and the chat message. */
export function instructionsAsText(ins: PaymentInstructions, orderId: string): string {
  return [
    ins.headline,
    `Order ID: ${orderId}`,
    '',
    ...ins.summary.map((row) => `${row.label}: ${row.value}`),
    ...(ins.requirement ? ['', ins.requirement] : []),
    '',
    'How to pay:',
    ...ins.steps.map((step, i) => `${i + 1}. ${step}`),
    '',
    'Please note:',
    ...ins.warnings.map((w) => `- ${w}`),
    '',
    ins.safety,
  ].join('\n')
}

// ── What the owner types, checked and put in the form a customer will recognise ──

export type DetailCheck = { ok: true; value: string } | { ok: false; error: string }

/** $Cashtag: a $ then 1–20 letters or digits, at least one a letter (Cash App's rule). */
export function normalizeCashtag(input: string): DetailCheck {
  const bare = input.trim().replace(/^\$/, '')
  if (!/^[A-Za-z0-9]{1,20}$/.test(bare) || !/[A-Za-z]/.test(bare)) {
    return { ok: false, error: 'A $Cashtag is a $ followed by up to 20 letters and numbers, e.g. $MIMOSALSD.' }
  }
  return { ok: true, value: `$${bare}` }
}

/** $ChimeSign: a $ then letters, digits, hyphens or underscores. */
export function normalizeChimeSign(input: string): DetailCheck {
  const bare = input.trim().replace(/^\$/, '')
  if (!/^[A-Za-z0-9][A-Za-z0-9_-]{1,29}$/.test(bare)) {
    return { ok: false, error: 'A $ChimeSign is a $ followed by letters and numbers, e.g. $MIMOSALSD.' }
  }
  return { ok: true, value: `$${bare}` }
}

/** Apple Cash is sent to an iPhone owner's phone number or Apple Account email. */
export function normalizeAppleCashRecipient(input: string): DetailCheck {
  const value = input.trim()
  if (value.includes('@')) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value)
      ? { ok: true, value: value.toLowerCase() }
      : { ok: false, error: 'That email address does not look complete.' }
  }
  const digits = value.replace(/\D/g, '')
  const national = digits.length === 11 && digits.startsWith('1') ? digits.slice(1) : digits
  if (national.length !== 10 || /^[01]/.test(national)) {
    return { ok: false, error: 'Enter a 10-digit US phone number, or an email address.' }
  }
  return { ok: true, value: `(${national.slice(0, 3)}) ${national.slice(3, 6)}-${national.slice(6)}` }
}

/** USD cents → BTC as an 8-place decimal string, rounded UP so the shop is never short. */
export function btcForCents(cents: number, usdPerBtc: number): string {
  if (!(usdPerBtc > 0) || !(cents > 0)) throw new Error('A positive amount and rate are required')
  const sats = Math.ceil((cents / 100 / usdPerBtc) * 1e8)
  return (sats / 1e8).toFixed(8)
}

/** A BTC amount typed by the owner: positive, at most 8 decimal places. */
export function normalizeBtcAmount(input: string): DetailCheck {
  const value = input.trim()
  if (!/^\d+(\.\d{1,8})?$/.test(value) || Number(value) <= 0) {
    return { ok: false, error: 'Enter the BTC amount as a number with up to 8 decimal places, e.g. 0.00123456.' }
  }
  return { ok: true, value: Number(value).toFixed(8) }
}
