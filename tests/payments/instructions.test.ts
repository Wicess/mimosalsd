import { describe, expect, it } from 'vitest'
import {
  btcForCents,
  buildPaymentInstructions,
  instructionsAsText,
  normalizeAppleCashRecipient,
  normalizeBtcAmount,
  normalizeCashtag,
  normalizeChimeSign,
  type IssuedPaymentDetails,
} from '@/lib/payments/instructions'

const base = { amountCents: 12345, orderId: '202609-K7Q4M9', payBy: '2026-09-15T16:30:00Z' }

const detailsFor: Record<string, IssuedPaymentDetails> = {
  CASHAPP: { ...base, method: 'CASHAPP', payTo: '$MIMOSALSD', payToName: 'MIMOSALSD LLC' },
  CHIME: { ...base, method: 'CHIME', payTo: '$MIMOSALSD' },
  APPLE_CASH: { ...base, method: 'APPLE_CASH', payTo: '(512) 555-0134' },
  BITCOIN: {
    ...base,
    method: 'BITCOIN',
    payTo: 'bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4',
    btcAmount: '0.00205750',
    btcRateUsd: 60000,
    btcQuoteUntil: '2026-09-13T13:00:00Z',
  },
}

describe('buildPaymentInstructions', () => {
  it.each(Object.keys(detailsFor))('%s: names the recipient, the amount and the Order ID', (method) => {
    const d = detailsFor[method]!
    const ins = buildPaymentInstructions(d)
    const text = instructionsAsText(ins, d.orderId)
    expect(text).toContain(d.payTo)
    expect(text).toContain('202609-K7Q4M9')
    expect(ins.steps.length).toBeGreaterThanOrEqual(5)
    expect(ins.warnings.length).toBeGreaterThanOrEqual(2)
    expect(ins.safety).toMatch(/mimosalsd\.com/)
    // US dollars always shown, BTC amount as well for Bitcoin.
    expect(text).toContain('$123.45')
    if (method === 'BITCOIN') expect(text).toContain('0.00205750 BTC')
  })

  it('Cash App: puts the Order ID in the "For" note and warns that typos send money to someone else', () => {
    const ins = buildPaymentInstructions(detailsFor.CASHAPP!)
    expect(ins.steps.join(' ')).toMatch(/"For" note.*202609-K7Q4M9/)
    expect(ins.warnings.join(' ')).toMatch(/cannot be cancelled/)
    expect(ins.summary.find((r) => r.label === 'Send to')?.value).toBe('$MIMOSALSD (MIMOSALSD LLC)')
  })

  it('Chime: says the sender needs a Chime Checking Account, and that member transfers cannot be reversed', () => {
    const ins = buildPaymentInstructions(detailsFor.CHIME!)
    expect(ins.requirement).toMatch(/Chime Checking Account/)
    expect(ins.warnings.join(' ')).toMatch(/cannot be reversed/)
  })

  it('Apple Cash: is never called Apple Pay, and covers both Messages and Wallet', () => {
    const ins = buildPaymentInstructions(detailsFor.APPLE_CASH!)
    const text = instructionsAsText(ins, '202609-K7Q4M9')
    expect(text).not.toMatch(/Apple Pay/)
    expect(text).toMatch(/Messages/)
    expect(text).toMatch(/Wallet/)
    expect(ins.requirement).toMatch(/18 or over/)
  })

  it('Bitcoin: Bitcoin network only, fees on top, irreversible, and the quote deadline', () => {
    const ins = buildPaymentInstructions(detailsFor.BITCOIN!)
    const text = instructionsAsText(ins, '202609-K7Q4M9')
    expect(text).toMatch(/Bitcoin network only/)
    expect(text).toMatch(/add the fee on top/)
    expect(text).toMatch(/cannot be reversed/)
    expect(text).toMatch(/\$60,000 per bitcoin/)
    expect(text).toContain('Sep 13, 1:00 PM UTC')
  })
})

describe('what the owner types', () => {
  it('normalises $Cashtags and refuses bad ones', () => {
    expect(normalizeCashtag('MIMOSALSD')).toEqual({ ok: true, value: '$MIMOSALSD' })
    expect(normalizeCashtag(' $Snype99 ')).toEqual({ ok: true, value: '$Snype99' })
    expect(normalizeCashtag('$12345').ok).toBe(false) // needs a letter
    expect(normalizeCashtag('$snype gate').ok).toBe(false)
    expect(normalizeCashtag('$' + 'a'.repeat(21)).ok).toBe(false)
  })

  it('normalises $ChimeSigns', () => {
    expect(normalizeChimeSign('snype-gate')).toEqual({ ok: true, value: '$snype-gate' })
    expect(normalizeChimeSign('$').ok).toBe(false)
  })

  it('formats Apple Cash phone numbers and accepts emails', () => {
    expect(normalizeAppleCashRecipient('+1 512 555 0134')).toEqual({ ok: true, value: '(512) 555-0134' })
    expect(normalizeAppleCashRecipient('5125550134')).toEqual({ ok: true, value: '(512) 555-0134' })
    expect(normalizeAppleCashRecipient('Pay@MIMOSALSD.com')).toEqual({ ok: true, value: 'pay@mimosalsd.com' })
    expect(normalizeAppleCashRecipient('555-0134').ok).toBe(false)
    expect(normalizeAppleCashRecipient('pay@mimosalsd').ok).toBe(false)
  })

  it('works out BTC from dollars, rounding up so the shop is never short', () => {
    expect(btcForCents(12345, 60000)).toBe('0.00205750')
    expect(btcForCents(100, 3)).toBe('0.33333334') // 0.333…33 rounds UP to the next satoshi
    expect(() => btcForCents(100, 0)).toThrow()
  })

  it('checks a typed BTC amount', () => {
    expect(normalizeBtcAmount('0.002')).toEqual({ ok: true, value: '0.00200000' })
    expect(normalizeBtcAmount('0.000000001').ok).toBe(false)
    expect(normalizeBtcAmount('-1').ok).toBe(false)
    expect(normalizeBtcAmount('0').ok).toBe(false)
  })
})
