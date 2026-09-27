'use server'

import { createHash } from 'node:crypto'
import { requireArea } from '@/lib/admin/guard'
import { recordAdminAction } from '@/lib/admin/audit'
import { keys, publicUrl, putObject } from '@/lib/storage/r2'
import { sniffFileType } from '@/lib/storage/file-type'
import { MAX_UPLOAD_BYTES } from '@/lib/storage/upload-limits'
import { reportError } from '@/lib/observability/report-error'

/**
 * ─────────────────────────────────────────────────────────────────────────────
 *  MEDIA UPLOAD — operator files into R2, addressed by their own content.
 *
 *  ── Why the browser's Content-Type is ignored ──────────────────────────────
 *  `file.type` is whatever the client said it was. A form post is a public HTTP
 *  endpoint; the picker's `accept` attribute is a convenience for the operator and
 *  not a control. So the type is decided by SNIFFING THE BYTES, and a file whose
 *  leading bytes do not match one of the formats below is refused however it was
 *  labelled. The extension written to R2 comes from the sniff, never from the
 *  filename — otherwise `payload.html.jpg` lands on our CDN origin as HTML.
 *
 *  ── Why SVG is not on the list ─────────────────────────────────────────────
 *  An SVG is a document that can carry `<script>`, and it would be served from our
 *  own public host, meaning any script inside it runs in our origin. The site's CSP
 *  restricts `script-src` to 'self' — which is exactly what a hosted SVG would be.
 *  There is no version of this that is worth the icon.
 *
 *  ── Why the whole file is read into memory ─────────────────────────────────
 *  The hash has to cover every byte before the key exists, so the upload cannot be
 *  streamed to a destination that is not yet known. That is fine at an 8 MB cap and
 *  would not be at 800 MB; the cap is what makes the simple version correct.
 * ─────────────────────────────────────────────────────────────────────────────
 */

export type MediaUploadState = {
  error?: string
  ok?: string
  /** Public CDN URL of the stored object, for the operator to copy. */
  url?: string
}

const fail = (error: string): MediaUploadState => ({ error })

/**
 * 8 MB.
 *
 * Generous for a product photograph and a certificate PDF, and small enough that
 * reading the whole thing into memory to hash it is not a way to exhaust a
 * serverless function.
 */
// See upload-limits.ts: 8 MB here was never reachable, on Vercel or anywhere.
const MAX_BYTES = MAX_UPLOAD_BYTES

export async function uploadMedia(
  _previous: MediaUploadState,
  formData: FormData,
): Promise<MediaUploadState> {
  const guard = await requireArea('/admin/media')
  if (!guard.ok) return fail(guard.error)

  const file = formData.get('file')
  if (!(file instanceof File) || file.size === 0) {
    return fail('Choose a file to upload.')
  }
  if (file.size > MAX_BYTES) {
    return fail(
      `That file is ${(file.size / 1024 / 1024).toFixed(1)} MB. The limit is ${MAX_BYTES / 1024 / 1024} MB.`,
    )
  }

  const bytes = new Uint8Array(await file.arrayBuffer())
  const signature = sniffFileType(bytes)
  if (!signature) {
    return fail(
      'That is not a file type we accept. Upload a JPEG, PNG, GIF, WebP, AVIF or PDF — checked by content, not by extension.',
    )
  }

  const sha256 = createHash('sha256').update(bytes).digest('hex')
  const key = keys.media(sha256, signature.ext)

  try {
    /*
      Unconditional put, no existence check first.

      The key is the hash, so re-uploading the same file writes identical bytes to
      the same key — the operation is idempotent by construction. A HEAD request to
      find that out would cost a round trip on every upload to save a write that is
      already harmless.
    */
    await putObject(key, bytes, signature.contentType)
    const url = publicUrl(key)

    await recordAdminAction({
      entityType: 'Media',
      entityId: key,
      action: 'CREATE',
      actor: guard.identity,
      after: {
        key,
        contentType: signature.contentType,
        bytes: file.size,
        // The operator's filename, kept for recognisability. It is NOT what the
        // stored object is called — the key comes from the hash.
        originalName: file.name.slice(0, 200),
      },
      reason: `Uploaded ${signature.ext.toUpperCase()} (${(file.size / 1024).toFixed(0)} KB)`,
    })

    return { ok: 'Uploaded.', url }
  } catch (error) {
    await reportError(error, {
      source: 'action',
      routePath: '/admin/media',
      context: { stage: 'upload-media', ext: signature.ext, bytes: file.size },
    })
    return fail('The upload failed. It has been logged.')
  }
}
