import { createHash } from 'node:crypto'
import sharp from 'sharp'
import { sniffFileType } from './file-type'
import { MAX_UPLOAD_BYTES } from './upload-limits'

/**
 * ─────────────────────────────────────────────────────────────────────────────
 *  A PRODUCT PHOTOGRAPH, MADE SAFE TO PUBLISH.
 *
 *  Every upload is decoded and re-encoded, never stored as sent. The reason is
 *  what a phone puts in a photograph: EXIF carries the GPS position it was taken
 *  at, the device, and the time. The stored file is public (its URL goes into
 *  the product's structured data, which crawlers fetch as-is), so a photo shot at
 *  home would publish where the business keeps its stock. Re-encoding keeps the
 *  pixels and drops everything else.
 *
 *  Also normalised on the way through: rotated as the phone intended (before the
 *  tag that says how is dropped), no edge longer than 2400px, transparency
 *  flattened onto white, and saved as JPEG. The key is the hash of the OUTPUT, so
 *  the same photo uploaded twice is stored once.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const PHOTO_TYPES = new Set(['jpg', 'png', 'webp', 'avif', 'gif'])
const LONGEST_EDGE = 2400

export interface PreparedPhoto {
  readonly key: string
  readonly bytes: Buffer
  readonly width: number
  readonly height: number
}

export async function prepareProductPhoto(
  input: Uint8Array,
): Promise<PreparedPhoto | { readonly error: string }> {
  if (input.byteLength === 0) return { error: 'Choose a photo to upload.' }
  if (input.byteLength > MAX_UPLOAD_BYTES) {
    return {
      error: `That photo is ${(input.byteLength / 1024 / 1024).toFixed(1)} MB. The limit is ${MAX_UPLOAD_BYTES / 1024 / 1024} MB.`,
    }
  }

  // Checked by content, not by name or declared type.
  const signature = sniffFileType(input)
  if (!signature || !PHOTO_TYPES.has(signature.ext)) {
    return { error: 'That is not a photo we accept. Upload a JPEG, PNG, WebP, AVIF or GIF.' }
  }

  try {
    const { data, info } = await sharp(input, { failOn: 'error', limitInputPixels: 64_000_000 })
      .rotate()
      .resize({
        width: LONGEST_EDGE,
        height: LONGEST_EDGE,
        fit: 'inside',
        withoutEnlargement: true,
      })
      .flatten({ background: { r: 255, g: 255, b: 255 } })
      .jpeg({ quality: 85, mozjpeg: true })
      .toBuffer({ resolveWithObject: true })

    const sha256 = createHash('sha256').update(data).digest('hex')
    return {
      key: `media/${sha256.slice(0, 32)}.jpg`,
      bytes: data,
      width: info.width,
      height: info.height,
    }
  } catch {
    return { error: 'That photo could not be read. Export it again as a JPEG and retry.' }
  }
}
