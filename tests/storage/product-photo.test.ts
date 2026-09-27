import sharp from 'sharp'
import { describe, expect, it } from 'vitest'
import { prepareProductPhoto } from '@/lib/storage/product-photo'
import { MAX_UPLOAD_BYTES } from '@/lib/storage/upload-limits'

/** A small photo the way a phone writes one: EXIF with a GPS position, rotated by tag. */
async function phonePhoto(width = 640, height = 480): Promise<Buffer> {
  return sharp({
    create: { width, height, channels: 3, background: { r: 120, g: 30, b: 20 } },
  })
    // Orientation through withMetadata: withExif's own Orientation field is
    // overwritten with 1 when the file is written, so it would test nothing.
    .withMetadata({ orientation: 6 })
    .withExifMerge({
      IFD0: { Make: 'PhoneCo', Model: 'Pocket 12' },
      IFD3: {
        GPSLatitudeRef: 'N',
        GPSLatitude: '30/1 16/1 0/1',
        GPSLongitudeRef: 'W',
        GPSLongitude: '97/1 44/1 0/1',
      },
    })
    .jpeg()
    .toBuffer()
}

describe('prepareProductPhoto', () => {
  it('strips EXIF, GPS included, from what it stores', async () => {
    const input = await phonePhoto()
    const before = await sharp(input).metadata()
    // The fixture really carries what a phone writes: an EXIF block naming the device.
    expect(before.exif?.includes(Buffer.from('PhoneCo'))).toBe(true)
    expect(before.orientation).toBe(6)

    const out = await prepareProductPhoto(input)
    if ('error' in out) throw new Error(out.error)

    const meta = await sharp(out.bytes).metadata()
    expect(meta.exif).toBeUndefined()
    expect(meta.format).toBe('jpeg')
    // Not just unparsed: absent from every byte of the stored file.
    expect(out.bytes.includes(Buffer.from('PhoneCo'))).toBe(false)
  })

  it('applies the orientation tag before dropping it', async () => {
    // Orientation 6 means "rotate 90° clockwise": 640x480 as stored, 480x640 as seen.
    const out = await prepareProductPhoto(await phonePhoto(640, 480))
    if ('error' in out) throw new Error(out.error)
    expect([out.width, out.height]).toEqual([480, 640])
  })

  // Real encoding work, so it gets headroom: at 4000px it passed alone in about a
  // second and timed out at the default 5s while a production build shared the CPU.
  // 2600px is just enough to prove the cap and a fraction of the work.
  it('caps the longest edge at 2400px and never enlarges', { timeout: 20_000 }, async () => {
    const big = await sharp({
      create: { width: 2600, height: 1950, channels: 3, background: { r: 1, g: 2, b: 3 } },
    })
      .jpeg()
      .toBuffer()
    const large = await prepareProductPhoto(big)
    if ('error' in large) throw new Error(large.error)
    expect([large.width, large.height]).toEqual([2400, 1800])

    const small = await prepareProductPhoto(await phonePhoto(300, 200))
    if ('error' in small) throw new Error(small.error)
    expect(Math.max(small.width, small.height)).toBe(300)
  })

  it('flattens transparency onto white rather than black', async () => {
    const clear = await sharp({
      create: { width: 8, height: 8, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
    })
      .png()
      .toBuffer()
    const out = await prepareProductPhoto(clear)
    if ('error' in out) throw new Error(out.error)
    const { data } = await sharp(out.bytes).raw().toBuffer({ resolveWithObject: true })
    expect(data[0]).toBeGreaterThan(245)
  })

  it('keys by the hash of the output, under media/, as .jpg', async () => {
    const input = await phonePhoto()
    const a = await prepareProductPhoto(input)
    const b = await prepareProductPhoto(input)
    if ('error' in a || 'error' in b) throw new Error('unexpected refusal')
    expect(a.key).toMatch(/^media\/[0-9a-f]{32}\.jpg$/)
    expect(a.key).toBe(b.key)
  })

  it('refuses what is not a photo, judged by content', async () => {
    const pdf = new TextEncoder().encode('%PDF-1.7 not a photo')
    expect(await prepareProductPhoto(pdf)).toEqual({ error: expect.stringMatching(/not a photo/) })
    const text = new TextEncoder().encode('just words, named photo.jpg')
    expect(await prepareProductPhoto(text)).toEqual({ error: expect.stringMatching(/not a photo/) })
  })

  it('refuses an empty file and one over the limit', async () => {
    expect(await prepareProductPhoto(new Uint8Array())).toEqual({
      error: expect.stringMatching(/Choose a photo/),
    })
    const tooBig = new Uint8Array(MAX_UPLOAD_BYTES + 1)
    tooBig.set([0xff, 0xd8, 0xff])
    expect(await prepareProductPhoto(tooBig)).toEqual({ error: expect.stringMatching(/limit/) })
  })

  it('refuses a file that claims to be a JPEG and is not one', async () => {
    const fake = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 1, 2, 3])
    expect(await prepareProductPhoto(fake)).toEqual({
      error: expect.stringMatching(/could not be read/),
    })
  })
})
