import { describe, expect, it } from 'vitest'
import {
  checkReceipt,
  MAX_RECEIPT_BYTES,
  normaliseTxRef,
  RECEIPT_STATUSES,
} from '@/lib/orders/receipts'
import { isPrivateKey, keys } from '@/lib/storage/r2'

/**
 * The only PUBLIC endpoint that writes a customer's banking screenshots into storage.
 * Every rule it enforces is asserted here, because a regression in any of them is
 * either a privacy leak or a hole anyone can post through.
 */

// Real magic numbers, padded to plausible lengths.
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, ...new Array(64).fill(0)])
const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, ...new Array(64).fill(0)])
const PDF = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, ...new Array(64).fill(0)]) // %PDF-
const GIF = new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x39, 0x61, ...new Array(64).fill(0)])
const EXE = new Uint8Array([0x4d, 0x5a, 0x90, 0x00, ...new Array(64).fill(0)]) // MZ
const HTML = new TextEncoder().encode('<html><script>alert(1)</script></html>')

describe('checkReceipt', () => {
  it('accepts a PNG screenshot', () => {
    const result = checkReceipt(PNG)
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.signature.contentType).toBe('image/png')
  })

  it('accepts a JPEG photo', () => {
    expect(checkReceipt(JPEG).ok).toBe(true)
  })

  it('accepts a PDF, which WHAM refused', () => {
    // Banking apps export receipts as PDF. Refusing one sends the buyer off to
    // screenshot a document they already have.
    const result = checkReceipt(PDF)
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.signature.ext).toBe('pdf')
  })

  it('refuses a GIF', () => {
    // No bank produces one, and it is the format most often used to smuggle
    // something that is not an image.
    expect(checkReceipt(GIF).ok).toBe(false)
  })

  it('refuses an executable renamed to look like an image', () => {
    // The whole point of sniffing: the filename and the browser's declared type are
    // both attacker-controlled on a public endpoint.
    expect(checkReceipt(EXE).ok).toBe(false)
  })

  it('refuses HTML, which would be script served from our own bucket', () => {
    expect(checkReceipt(HTML).ok).toBe(false)
  })

  it('refuses an empty file', () => {
    expect(checkReceipt(new Uint8Array()).ok).toBe(false)
  })

  it('refuses a file over the limit', () => {
    const huge = new Uint8Array(MAX_RECEIPT_BYTES + 1)
    huge.set(PNG)
    const result = checkReceipt(huge)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toMatch(/15 MB/)
  })

  it('takes its extension from the bytes, not the filename', () => {
    const result = checkReceipt(JPEG)
    expect(result.ok && result.signature.ext).toBe('jpg')
  })
})

describe('receipt storage keys', () => {
  it('lands under the private prefix', () => {
    // publicUrl() throws for this prefix and putObject stamps it private, no-store.
    // A key outside it would be a bank screenshot on a public CDN.
    expect(isPrivateKey(keys.paymentReceipt('tok_abc', 1, 'n0nce', 'png'))).toBe(true)
  })

  it('never collides across uploads for the same order', () => {
    // An index alone restarts at 1 on a second upload and would overwrite the first
    // receipt. The nonce makes every upload its own object.
    const a = keys.paymentReceipt('tok_abc', 1, 'aaaaaa', 'png')
    const b = keys.paymentReceipt('tok_abc', 1, 'bbbbbb', 'png')
    expect(a).not.toBe(b)
  })

  it('keeps one order’s receipts apart from another’s', () => {
    expect(keys.paymentReceipt('tok_one', 1, 'x', 'png')).not.toBe(
      keys.paymentReceipt('tok_two', 1, 'x', 'png'),
    )
  })
})

describe('when a receipt is accepted', () => {
  it('accepts while awaiting payment and after the claim', () => {
    expect(RECEIPT_STATUSES.has('AWAITING_PAYMENT')).toBe(true)
    expect(RECEIPT_STATUSES.has('PAYMENT_CLAIMED')).toBe(true)
  })

  it('refuses before payment instructions exist', () => {
    // A buyer who pays an order still pending verification is paying for something
    // we may yet refuse to sell them.
    expect(RECEIPT_STATUSES.has('PENDING_VERIFICATION')).toBe(false)
  })

  it('refuses once the payment is confirmed', () => {
    expect(RECEIPT_STATUSES.has('PAID')).toBe(false)
    expect(RECEIPT_STATUSES.has('SHIPPED')).toBe(false)
  })
})

describe('normaliseTxRef', () => {
  it('trims and keeps a real reference', () => {
    expect(normaliseTxRef('  CA-1234  ')).toBe('CA-1234')
  })

  it('treats blank as none', () => {
    expect(normaliseTxRef('   ')).toBeUndefined()
    expect(normaliseTxRef(null)).toBeUndefined()
  })

  it('strips control characters that could break an ntfy header', () => {
    expect(normaliseTxRef('abc\r\nInjected: header')).not.toMatch(/[\r\n]/)
  })

  it('caps the length', () => {
    expect(normaliseTxRef('x'.repeat(500))).toHaveLength(200)
  })
})
