/**
 * ─────────────────────────────────────────────────────────────────────────────
 *  FILE TYPE BY CONTENT, never by claim.
 *
 *  Pure and dependency-free so it can be unit-tested without a request, a bucket or
 *  a session — the same reason `routeExists` lives outside the proxy handler. A
 *  security check nobody can test in isolation is a security check nobody tests.
 *
 *  ── What this is defending against ─────────────────────────────────────────
 *  `File.type` in a form post is whatever the client typed. So is the filename. An
 *  upload endpoint that trusts either will happily write `evil.html` to the CDN
 *  origin with `Content-Type: image/png`, and some browsers will still sniff and
 *  render it — as our own origin, inside our own CSP, which permits `script-src
 *  'self'`. The extension stored in R2 therefore comes from THIS function and never
 *  from the uploaded name.
 *
 *  ── Why SVG is absent, and must stay absent ────────────────────────────────
 *  SVG is not an image format in the sense that matters here: it is an XML document
 *  that may contain `<script>`, and it would be served from our public host. There
 *  is no header we can set on an R2 object that makes hosting attacker-controlled
 *  script on our own domain acceptable. If vector artwork is ever needed, it gets
 *  converted to PNG at upload or served from a separate origin.
 * ─────────────────────────────────────────────────────────────────────────────
 */

export interface FileSignature {
  /** Extension written to R2. Derived here; never taken from the filename. */
  readonly ext: string
  readonly contentType: string
  /**
   * Where the magic sits.
   *
   * Non-zero for the container formats: a WebP declares itself at byte 8, after
   * `RIFF` and a four-byte length, and an AVIF at byte 4 after its box length.
   */
  readonly offset: number
  readonly magic: readonly number[]
}

export const FILE_SIGNATURES: readonly FileSignature[] = [
  { ext: 'jpg', contentType: 'image/jpeg', offset: 0, magic: [0xff, 0xd8, 0xff] },
  {
    ext: 'png',
    contentType: 'image/png',
    offset: 0,
    magic: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
  },
  { ext: 'gif', contentType: 'image/gif', offset: 0, magic: [0x47, 0x49, 0x46, 0x38] },
  // RIFF????WEBP — the four bytes between are the file length.
  { ext: 'webp', contentType: 'image/webp', offset: 8, magic: [0x57, 0x45, 0x42, 0x50] },
  // ????ftypavif
  {
    ext: 'avif',
    contentType: 'image/avif',
    offset: 4,
    magic: [0x66, 0x74, 0x79, 0x70, 0x61, 0x76, 0x69, 0x66],
  },
  { ext: 'pdf', contentType: 'application/pdf', offset: 0, magic: [0x25, 0x50, 0x44, 0x46] },
]

/**
 * Identify a file from its leading bytes, or return null.
 *
 * Null means REFUSE. There is deliberately no "unknown" fallback that stores the
 * file with a generic content type — an upload we cannot identify is an upload we
 * have no business serving from our own domain.
 */
export function sniffFileType(bytes: Uint8Array): FileSignature | null {
  for (const signature of FILE_SIGNATURES) {
    const end = signature.offset + signature.magic.length
    if (bytes.length < end) continue

    let matched = true
    for (let i = 0; i < signature.magic.length; i++) {
      if (bytes[signature.offset + i] !== signature.magic[i]) {
        matched = false
        break
      }
    }
    if (matched) return signature
  }
  return null
}
