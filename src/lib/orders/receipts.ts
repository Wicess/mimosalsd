import { sniffFileType, type FileSignature } from '@/lib/storage/file-type'

/**
 * Rules for a customer's proof of payment, kept pure so they can be tested without a
 * request, a bucket or a database.
 *
 * The upload route is the one PUBLIC endpoint that writes a customer's banking
 * screenshots into storage, so every limit it enforces lives here where it can be
 * asserted rather than scattered through a handler.
 */

/** Per file. A phone screenshot is ~1–3 MB; a bank PDF rarely passes 2. */
export const MAX_RECEIPT_BYTES = 15 * 1024 * 1024

/**
 * Per request. Ported from WHAM, where it was set from real behaviour: buyers
 * legitimately send the bank confirmation AND the app receipt, or a payment split
 * across two transfers. Five is past any honest case while bounding one request.
 */
export const MAX_RECEIPTS_PER_UPLOAD = 5

/**
 * Per ORDER, across every upload. WHAM caps only the request, so a buyer could keep
 * resubmitting indefinitely and fill the bucket against one order. This endpoint is
 * public — the order token is the only credential — so the lifetime total is bounded
 * as well.
 */
export const MAX_RECEIPTS_PER_ORDER = 10

/**
 * What a receipt may be.
 *
 * PDF is allowed where WHAM allows only images, because banking apps export their
 * receipts as PDF and refusing one sends the buyer off to screenshot a document they
 * already have. GIF is not: nobody's bank produces one, and it is the format most
 * often used to smuggle something that is not an image.
 *
 * Decided by SNIFFING THE BYTES, never by the filename or the browser's claimed
 * type — both are attacker-controlled on a public endpoint.
 */
const ALLOWED_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/avif',
  'application/pdf',
])

export type ReceiptCheck =
  | { readonly ok: true; readonly signature: FileSignature }
  | { readonly ok: false; readonly error: string }

export function checkReceipt(bytes: Uint8Array): ReceiptCheck {
  if (bytes.byteLength === 0) {
    return { ok: false, error: 'That file is empty.' }
  }
  if (bytes.byteLength > MAX_RECEIPT_BYTES) {
    return { ok: false, error: 'One file is too large — the limit is 15 MB.' }
  }
  const signature = sniffFileType(bytes)
  if (!signature || !ALLOWED_TYPES.has(signature.contentType)) {
    return {
      ok: false,
      error: 'Please upload a screenshot (JPG, PNG, WebP) or a PDF receipt.',
    }
  }
  return { ok: true, signature }
}

/**
 * Statuses at which a receipt makes sense.
 *
 * Not before AWAITING_PAYMENT: an order still pending verification has no payment
 * instructions yet, so there is nothing the buyer could have paid. Not after PAID:
 * the payment is confirmed and a further upload would only be noise on an order
 * that is being packed.
 */
export const RECEIPT_STATUSES = new Set(['AWAITING_PAYMENT', 'PAYMENT_CLAIMED'])

/** Trim and cap a buyer-supplied reference. Blank means "none given". */
export function normaliseTxRef(raw: unknown): string | undefined {
  if (typeof raw !== 'string') return undefined
  // Control characters out, so a pasted reference cannot corrupt the ntfy header or
  // the admin view it is shown in.
  const cleaned = raw.replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, 200)
  return cleaned === '' ? undefined : cleaned
}
