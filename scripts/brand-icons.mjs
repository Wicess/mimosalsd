#!/usr/bin/env node
/**
 * Regenerate every icon slot from the wordmark.   node scripts/brand-icons.mjs
 *
 * The mark is "Mi" — the M and the mushroom-capped i — cut from public/brand/logo.png.
 * The first set cut the M alone, and the M's right leg runs into the i, so the crop
 * sliced the letter two-thirds of the way across and every home screen showed a
 * broken M. Taking the i as well keeps the letter whole and carries the mushroom,
 * which is the most recognisable detail in the wordmark.
 *
 * Output filenames carry a version (`-v2`). An installed app re-downloads its icon
 * only when the URL changes; new art under an old name may never reach a phone.
 */
import sharp from 'sharp'
import { writeFile } from 'node:fs/promises'

const WORDMARK = 'public/brand/logo.png'
/**
 * "Mi" in the 900×251 wordmark. The letters overlap, so no straight cut is clean:
 * the i ends at x≈255 where the next m begins, but the M's tail swoops on under that
 * m to x≈288, below its feet (y≈178), and the mushroom cap overhangs to x≈264 above
 * the m's shoulder (y≈70). The mask follows those three edges.
 */
const MARK = { left: 8, top: 0, width: 284, height: 251 }
const MASK = `<svg xmlns="http://www.w3.org/2000/svg" width="${MARK.width}" height="${MARK.height}">
  <polygon points="0,0 ${264 - MARK.left},0 ${264 - MARK.left},70 ${255 - MARK.left},70 ${255 - MARK.left},178 ${MARK.width},178 ${MARK.width},${MARK.height} 0,${MARK.height}" fill="#fff"/>
</svg>`

/** Sampled from the first badge so the look does not change, only the letter. */
const DISC = '#141a11'
const RING = '#e6d282'
const PLATE = '#0b0e09'

const cut = await sharp(await sharp(WORDMARK).extract(MARK).png().toBuffer())
  .composite([{ input: Buffer.from(MASK), blend: 'dest-in' }])
  .png()
  .toBuffer()
const art = await sharp(cut).trim().png().toBuffer()

/** The art scaled to fit a `box`-pixel square, centred on a transparent canvas of `size`. */
async function artOn(size, box) {
  const scaled = await sharp(art).resize(box, box, { fit: 'inside' }).toBuffer()
  const { width, height } = await sharp(scaled).metadata()
  return { input: scaled, left: Math.round((size - width) / 2), top: Math.round((size - height) / 2) }
}

/** Round badge on transparency: dark disc, citron hairline, the mark inside. */
async function badge(size) {
  const r = size / 2
  const stroke = Math.max(1, Math.round(size / 128))
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
    <circle cx="${r}" cy="${r}" r="${r - stroke}" fill="${DISC}" stroke="${RING}" stroke-width="${stroke}"/>
  </svg>`
  return sharp(Buffer.from(svg)).composite([await artOn(size, Math.round(size * 0.62))]).png()
}

/** Full-bleed plate for maskable and Apple icons: the mark inside the 80% safe zone. */
async function plate(size) {
  return sharp({ create: { width: size, height: size, channels: 4, background: PLATE } })
    .composite([await artOn(size, Math.round(size * 0.58))])
    .png()
}

/** White silhouette on transparency — Android draws notification badges as a mask. */
async function silhouette(size) {
  const { input, left, top } = await artOn(size, Math.round(size * 0.86))
  const alpha = await sharp(input).ensureAlpha().extractChannel('alpha').toBuffer()
  const { width, height } = await sharp(input).metadata()
  const white = await sharp({ create: { width, height, channels: 3, background: '#ffffff' } })
    .joinChannel(alpha)
    .png()
    .toBuffer()
  return sharp({ create: { width: size, height: size, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: white, left, top }])
    .png()
}

/** A .ico holding PNG-encoded frames, which every current browser reads. */
async function ico(sizes) {
  const frames = await Promise.all(sizes.map(async (s) => (await badge(s)).toBuffer()))
  const header = Buffer.alloc(6 + 16 * frames.length)
  header.writeUInt16LE(0, 0)
  header.writeUInt16LE(1, 2)
  header.writeUInt16LE(frames.length, 4)
  let offset = header.length
  frames.forEach((png, i) => {
    const e = 6 + 16 * i
    header.writeUInt8(sizes[i] >= 256 ? 0 : sizes[i], e)
    header.writeUInt8(sizes[i] >= 256 ? 0 : sizes[i], e + 1)
    header.writeUInt16LE(1, e + 4)
    header.writeUInt16LE(32, e + 6)
    header.writeUInt32LE(png.length, e + 8)
    header.writeUInt32LE(offset, e + 12)
    offset += png.length
  })
  return Buffer.concat([header, ...frames])
}

const out = [
  ['public/brand/app-icon-v2-192.png', () => badge(192)],
  ['public/brand/app-icon-v2-512.png', () => badge(512)],
  ['public/brand/app-icon-maskable-v2-192.png', () => plate(192)],
  ['public/brand/app-icon-maskable-v2-512.png', () => plate(512)],
  ['public/brand/mark-v2.png', () => badge(512)],
  ['public/brand/notification-badge-v2-96.png', () => silhouette(96)],
  ['src/app/icon.png', () => badge(256)],
  ['src/app/apple-icon.png', () => plate(180)],
  ['assets/logo-badge.png', () => badge(760)],
]
for (const [file, make] of out) {
  await (await make()).toFile(file)
  console.log('  ✓', file)
}
await writeFile('src/app/favicon.ico', await ico([16, 32, 48]))
console.log('  ✓ src/app/favicon.ico')
