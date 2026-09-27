/**
 * ─────────────────────────────────────────────────────────────────────────────
 *  REFUND ARITHMETIC — pure, so the money rules can be tested without a database.
 *
 *  Every amount is INTEGER CENTS (CLAUDE.md rule 8). Nothing here divides, and
 *  nothing here sees a float: the one place a rounding error can enter a refund is
 *  parsing the operator's typed dollars, and that happens once, in `parseAmount`,
 *  which refuses anything it cannot represent exactly rather than rounding it.
 *
 *  ── What a refund is in THIS system ────────────────────────────────────────
 *  Not an API call. There is no payment processor here on purpose — the customer
 *  paid off-site through Cash App, Chime, Apple Cash or Bitcoin, and an operator
 *  sends the money back the same way. So these functions do not authorise anything;
 *  they decide whether a RECORD an operator is about to write is arithmetically
 *  possible, and refuse it when it is not.
 * ─────────────────────────────────────────────────────────────────────────────
 */

export interface RefundSummary {
  /** Sum of every refund already issued against the order, in cents. */
  readonly refundedCents: number
  /** What is still refundable, in cents. Never negative. */
  readonly remainingCents: number
  /** True once the whole order total has been returned. */
  readonly fullyRefunded: boolean
}

export function summariseRefunds(
  totalCents: number,
  refunds: readonly { readonly amountCents: number }[],
): RefundSummary {
  const refundedCents = refunds.reduce((sum, refund) => sum + refund.amountCents, 0)
  // Clamped at zero. If historical rows somehow exceed the total, the honest report
  // is "nothing remains", not a negative amount presented as though it were owed.
  const remainingCents = Math.max(0, totalCents - refundedCents)
  return {
    refundedCents,
    remainingCents,
    fullyRefunded: refundedCents >= totalCents && totalCents > 0,
  }
}

export type RefundCheck =
  | { readonly ok: true; readonly amountCents: number }
  | { readonly ok: false; readonly error: string }

/**
 * Dollars as an operator types them → integer cents, or a refusal.
 *
 * `28.999` is REFUSED rather than rounded. The alternative is a refund of an amount
 * nobody chose, off by a cent, recorded as though it were deliberate — and on a
 * record that exists to be reconciled against a bank statement, an unexplained cent
 * is worse than a rejected form.
 */
export function parseAmount(raw: string): RefundCheck {
  const text = raw.trim().replace(/[$,\s]/g, '')
  if (text === '') return { ok: false, error: 'Enter the amount to refund.' }
  if (!/^\d+(\.\d{1,2})?$/.test(text)) {
    return {
      ok: false,
      error: 'Enter an amount like 28 or 28.50 — cents only, no fractions of a cent.',
    }
  }
  // Split rather than multiply. `Math.round(28.15 * 100)` is 2815 today and relies on
  // a float that happens to land right; splitting the string cannot be wrong.
  const [dollars = '0', cents = ''] = text.split('.')
  const amountCents = Number(dollars) * 100 + Number(cents.padEnd(2, '0'))
  if (!Number.isSafeInteger(amountCents)) {
    return { ok: false, error: 'That amount is too large.' }
  }
  return { ok: true, amountCents }
}

/**
 * May this refund be recorded?
 *
 * The cap is the ORDER TOTAL minus what has already gone back, not the total alone.
 * Two half-refunds issued from two browser tabs would each pass a naive check and
 * together return twice what the customer paid — so the sum is what is checked, and
 * the caller re-checks it inside the same transaction that writes the row.
 */
export function checkRefund(
  amountCents: number,
  totalCents: number,
  existing: readonly { readonly amountCents: number }[],
): RefundCheck {
  if (amountCents <= 0) {
    return { ok: false, error: 'A refund must be more than zero.' }
  }

  const { refundedCents, remainingCents } = summariseRefunds(totalCents, existing)

  if (remainingCents === 0) {
    return {
      ok: false,
      error: 'This order has already been refunded in full.',
    }
  }
  if (amountCents > remainingCents) {
    return {
      ok: false,
      error:
        refundedCents > 0
          ? `That is more than remains. ${formatCentsPlain(refundedCents)} has already been refunded, leaving ${formatCentsPlain(remainingCents)}.`
          : `That is more than the order total of ${formatCentsPlain(totalCents)}.`,
    }
  }

  return { ok: true, amountCents }
}

/** Local, dependency-free money formatting, so this module stays pure. */
function formatCentsPlain(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`
}
