import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

/**
 * Cloudflare R2 object storage.
 *
 * Holds product imagery, certificate-of-analysis PDFs, and customer-uploaded payment
 * receipts. R2 is S3-compatible and has no egress fees, which matters for a catalogue
 * served behind a CDN.
 *
 * TWO CLASSES OF OBJECT, and conflating them would be a privacy incident:
 *
 *  · PUBLIC  — product images, published COA PDFs. Served from the CDN host, cacheable,
 *              addressable by anyone with the URL.
 *  · PRIVATE — payment receipts. These contain PII, sometimes a bank statement. They
 *              are NEVER served from the public host; access is via a short-lived
 *              signed URL only, and `publicUrl()` throws if handed one.
 */

const PRIVATE_PREFIXES = ['receipts/', 'private/'] as const

let client: S3Client | undefined

function s3(): S3Client {
  if (!client) {
    const accountId = process.env.R2_ACCOUNT_ID
    const accessKeyId = process.env.R2_ACCESS_KEY_ID
    const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY
    if (!accountId || !accessKeyId || !secretAccessKey) {
      throw new Error('R2 credentials are not configured')
    }
    client = new S3Client({
      region: 'auto',
      endpoint:
        process.env.R2_ENDPOINT ?? `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId, secretAccessKey },
    })
  }
  return client
}

function bucket(): string {
  const name = process.env.R2_BUCKET
  if (!name) throw new Error('R2_BUCKET is not set')
  return name
}

export function isPrivateKey(key: string): boolean {
  return PRIVATE_PREFIXES.some((prefix) => key.startsWith(prefix))
}

/**
 * Public CDN URL for an object.
 *
 * Throws for a private key rather than returning a URL that would work. A silent
 * mistake here publishes a customer's bank receipt; a thrown error does not.
 */
export function publicUrl(key: string): string {
  if (isPrivateKey(key)) {
    throw new Error(
      `Refusing to build a public URL for private object "${key}". Use signedUrl() instead.`,
    )
  }
  const host = process.env.R2_PUBLIC_HOST
  if (!host) throw new Error('R2_PUBLIC_HOST is not set')
  return `https://${host.replace(/^https?:\/\//, '').replace(/\/$/, '')}/${key}`
}

export async function putObject(
  key: string,
  body: Uint8Array | Buffer | string,
  contentType: string,
): Promise<void> {
  await s3().send(
    new PutObjectCommand({
      Bucket: bucket(),
      Key: key,
      Body: body,
      ContentType: contentType,
      // Public assets are immutable — the key changes when the asset does.
      CacheControl: isPrivateKey(key) ? 'private, no-store' : 'public, max-age=31536000, immutable',
    }),
  )
}

/** Short-lived signed URL. The only way a private object is ever readable. */
export async function signedUrl(key: string, expiresInSeconds = 300): Promise<string> {
  return getSignedUrl(
    s3(),
    new GetObjectCommand({ Bucket: bucket(), Key: key }),
    { expiresIn: expiresInSeconds },
  )
}

export async function deleteObject(key: string): Promise<void> {
  await s3().send(new DeleteObjectCommand({ Bucket: bucket(), Key: key }))
}

export async function checkConnection(): Promise<boolean> {
  await s3().send(new HeadBucketCommand({ Bucket: bucket() }))
  return true
}

/** Canonical key layouts, so keys are never assembled ad hoc at call sites. */
export const keys = {
  productImage: (slug: string, index: number, ext = 'jpg') =>
    `products/${slug}-${index}.${ext}`,
  coaPdf: (batchCode: string) => `coa/${batchCode.toLowerCase()}.pdf`,
  /**
   * PRIVATE — a screenshot of somebody's banking app. Never served from the public
   * host; `publicUrl()` throws for this prefix and `signedUrl()` is the only way out.
   *
   * Indexed, and suffixed with a random nonce. The index alone was not enough: a
   * buyer who uploads two screenshots, then comes back and uploads one more, would
   * restart the numbering at 1 and silently overwrite the first receipt they sent.
   * The nonce makes every upload its own object, so an append can never be an
   * overwrite.
   */
  paymentReceipt: (orderToken: string, index: number, nonce: string, ext: string) =>
    `receipts/${orderToken}/${index}-${nonce}.${ext}`,
  /**
   * Operator-uploaded media, addressed by the CONTENT HASH of the file.
   *
   * `putObject` stamps public objects `immutable, max-age=31536000`, which is only
   * honest if a key never changes meaning. Uploading a corrected image over an
   * existing key would leave the old one cached at every CDN edge for a year with
   * no way to shift it — so the key is derived from the bytes instead. A different
   * file is a different key, and re-uploading the same file is a no-op that costs
   * nothing and returns the URL already in use.
   */
  media: (sha256: string, ext: string) => `media/${sha256.slice(0, 32)}.${ext}`,
  /**
   * PRIVATE — a photo or PDF sent in a support conversation. WHAM stores these at a
   * public URL; a customer's photo of their parcel, their ID or their receipt is as
   * private as the chat it was sent in. Grouped per thread, nonced per upload.
   */
  chatAttachment: (threadId: string, nonce: string, ext: string) =>
    `private/chat/${threadId}/${nonce}.${ext}`,
} as const
