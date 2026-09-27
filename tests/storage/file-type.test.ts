import { describe, expect, it } from 'vitest'
import { FILE_SIGNATURES, sniffFileType } from '@/lib/storage/file-type'
import { keys } from '@/lib/storage/r2'

const bytes = (...values: number[]) => new Uint8Array(values)

/** A real-ish header followed by filler, so length checks are exercised. */
function withPadding(head: number[], length = 64): Uint8Array {
  const out = new Uint8Array(length)
  out.set(head, 0)
  return out
}

const JPEG = withPadding([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10])
const PNG = withPadding([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
const GIF = withPadding([0x47, 0x49, 0x46, 0x38, 0x39, 0x61])
const PDF = withPadding([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37])
// RIFF, four length bytes, WEBP
const WEBP = withPadding([
  0x52, 0x49, 0x46, 0x46, 0x24, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50,
])
// four length bytes, then ftypavif
const AVIF = withPadding([
  0x00, 0x00, 0x00, 0x20, 0x66, 0x74, 0x79, 0x70, 0x61, 0x76, 0x69, 0x66,
])

describe('sniffFileType', () => {
  it('identifies each accepted format from its bytes', () => {
    expect(sniffFileType(JPEG)?.ext).toBe('jpg')
    expect(sniffFileType(PNG)?.ext).toBe('png')
    expect(sniffFileType(GIF)?.ext).toBe('gif')
    expect(sniffFileType(WEBP)?.ext).toBe('webp')
    expect(sniffFileType(AVIF)?.ext).toBe('avif')
    expect(sniffFileType(PDF)?.ext).toBe('pdf')
  })

  it('returns the content type it will be stored and served with', () => {
    expect(sniffFileType(PNG)?.contentType).toBe('image/png')
    expect(sniffFileType(PDF)?.contentType).toBe('application/pdf')
  })

  /*
    ── The case this whole module exists for ────────────────────────────────
    `File.type` and the filename are both attacker-controlled in a form post. An
    endpoint that trusts either writes attacker HTML to our CDN origin, where our
    own CSP grants `script-src 'self'`. The bytes are the only thing that is not a
    claim, so a file called `photo.jpg` announcing `image/jpeg` is still refused
    when it opens with `<!DOCTYPE html>`.
  */
  describe('refuses what it cannot identify', () => {
    it('refuses HTML however it is labelled', () => {
      const html = new TextEncoder().encode('<!DOCTYPE html><script>alert(1)</script>')
      expect(sniffFileType(html)).toBeNull()
    })

    it('refuses SVG — it is a script-capable document, not an image', () => {
      const svg = new TextEncoder().encode(
        '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>',
      )
      expect(sniffFileType(svg)).toBeNull()
    })

    it('has no SVG signature to match in the first place', () => {
      expect(FILE_SIGNATURES.some((s) => s.ext === 'svg')).toBe(false)
    })

    it('refuses an empty file', () => {
      expect(sniffFileType(new Uint8Array(0))).toBeNull()
    })

    it('refuses a file shorter than the signature it would match', () => {
      // The first two bytes of a PNG header and nothing else.
      expect(sniffFileType(bytes(0x89, 0x50))).toBeNull()
    })

    it('refuses a RIFF container that is not WebP', () => {
      // RIFF????WAVE — a sound file wearing the same outer box as a WebP.
      const wav = withPadding([
        0x52, 0x49, 0x46, 0x46, 0x24, 0x00, 0x00, 0x00, 0x57, 0x41, 0x56, 0x45,
      ])
      expect(sniffFileType(wav)).toBeNull()
    })

    it('refuses an ISO container that is not AVIF', () => {
      // ????ftypmp42 — an MP4, which is a valid container and not something we serve.
      const mp4 = withPadding([
        0x00, 0x00, 0x00, 0x20, 0x66, 0x74, 0x79, 0x70, 0x6d, 0x70, 0x34, 0x32,
      ])
      expect(sniffFileType(mp4)).toBeNull()
    })

    it('refuses a ZIP, which is what an Office document really is', () => {
      expect(sniffFileType(withPadding([0x50, 0x4b, 0x03, 0x04]))).toBeNull()
    })
  })
})

describe('the media key', () => {
  it('is derived from the hash, never from the filename', () => {
    const hash = 'a'.repeat(64)
    expect(keys.media(hash, 'png')).toBe(`media/${'a'.repeat(32)}.png`)
  })

  /*
    `putObject` stamps public objects `immutable, max-age=31536000`. That is only
    true if a key never changes meaning — so identical bytes must land on the same
    key, and different bytes must not.
  */
  it('is stable for the same content and distinct for different content', () => {
    const a = 'a'.repeat(64)
    const b = 'b'.repeat(64)
    expect(keys.media(a, 'jpg')).toBe(keys.media(a, 'jpg'))
    expect(keys.media(a, 'jpg')).not.toBe(keys.media(b, 'jpg'))
  })

  it('stays in the public namespace, not the private one', () => {
    // `publicUrl` throws for anything under receipts/ or private/. Media is public
    // by definition — an operator uploads it in order to link to it.
    expect(keys.media('c'.repeat(64), 'pdf').startsWith('media/')).toBe(true)
  })
})
