#!/usr/bin/env node
/**
 * The square profile picture for the company's email account.   node scripts/email-avatar.mjs
 *
 * The "Mi" monogram — the M and the mushroom-capped i — the same mark as every app
 * icon (scripts/brand-icons.mjs), with its pixels taken from the ORIGINAL artwork
 * for about 1.3x the detail of the 900px wordmark, on black with a soft green glow.
 * The full wordmark is unreadable at the 32–48px an inbox shows.
 *
 * Mail clients crop the picture to a circle, so the mark sits well inside it: every
 * corner of the art is within the circle the crop leaves.
 *
 * Writes public/brand/email-avatar-1024.png (1024x1024, what Gmail, Google
 * Workspace, Outlook and Brevo all accept), and a 512 copy for smaller upload limits.
 */
import sharp from 'sharp'

const SOURCE = 'assets/logo-source.jpg'

/*
  The wordmark's letters span x 113–1258, y 239–532 in the 1376x768 original and
  x 12–889, y 7–232 in public/brand/logo.png: a scale of about 1.305.

  The original's letters sit in a haze that fades into black, and any rectangle cut
  from it shows the haze ending in a hard edge. So the SHAPE comes from logo.png,
  where the ground and haze are already keyed out, cut with brand-icons.mjs's mask
  tightened by five pixels beside the i's stem (x 250, not 255, for y 70–160): the
  i ends at x 247, and at this size the next m's faint left edge at x 254 shows, and the PIXELS come from the original under that shape, scaled up
  to match. A soft glow is then drawn back in, round the letters only.
*/
const WORDMARK = 'public/brand/logo.png'
const MARK = { left: 8, top: 0, width: 284, height: 251 }
const MARK_MASK = `<svg xmlns="http://www.w3.org/2000/svg" width="${MARK.width}" height="${MARK.height}">
  <polygon points="0,0 ${264 - MARK.left},0 ${264 - MARK.left},70 ${250 - MARK.left},70 ${250 - MARK.left},160 ${255 - MARK.left},160 ${255 - MARK.left},178 ${MARK.width},178 ${MARK.width},${MARK.height} 0,${MARK.height}" fill="#fff"/>
</svg>`
const SCALE_X = 1.305
const SCALE_Y = 1.303
const SRC = {
  left: Math.round(113 + (MARK.left - 12) * SCALE_X),
  top: Math.round(239 + (MARK.top - 7) * SCALE_Y),
  width: Math.round(MARK.width * SCALE_X),
  height: Math.round(MARK.height * SCALE_Y),
}

// The "Mi" shape, keyed, from the wordmark, scaled to the original's size.
const shape = await sharp(
  await sharp(WORDMARK)
    .extract(MARK)
    .ensureAlpha()
    .composite([{ input: Buffer.from(MARK_MASK), blend: 'dest-in' }])
    .png()
    .toBuffer(),
)
  .resize(SRC.width, SRC.height, { kernel: 'lanczos3' })
  .png()
  .toBuffer()

// The original's pixels under that shape (dest-in keeps them only where the shape is),
// trimmed to the letters.
const masked = await sharp(SOURCE)
  .extract(SRC)
  .ensureAlpha()
  .composite([{ input: shape, blend: 'dest-in' }])
  .png()
  .toBuffer()
const art = await sharp(masked).trim().png().toBuffer()

/** The site's green, for the glow (--shine in globals.css). */
const GLOW = { r: 0x6c, g: 0xc0, b: 0x00 }

/** The mark centred on black with a soft green glow, scaled to `share` of the width. */
async function avatar(size, share = 0.66) {
  const scaled = await sharp(art)
    .resize(Math.round(size * share), Math.round(size * share), { fit: 'inside', kernel: 'lanczos3' })
    .toBuffer()
  const { width, height } = await sharp(scaled).metadata()
  const left = Math.round((size - width) / 2)
  const top = Math.round((size - height) / 2)

  // The glow: the letters' silhouette in green, blurred well past their edges, at 45%.
  const pad = Math.round(size * 0.08)
  const silhouette = await sharp({ create: { width, height, channels: 4, background: { ...GLOW, alpha: 1 } } })
    .composite([{ input: scaled, blend: 'dest-in' }])
    .png()
    .toBuffer()
  const blurred = await sharp(silhouette)
    .extend({ top: pad, bottom: pad, left: pad, right: pad, background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .blur(size * 0.022)
    .png()
    .toBuffer()
  const glow = await sharp(blurred)
    .composite([
      { input: Buffer.from([0, 0, 0, Math.round(255 * 0.45)]), raw: { width: 1, height: 1, channels: 4 }, tile: true, blend: 'dest-in' },
    ])
    .png()
    .toBuffer()

  return sharp({ create: { width: size, height: size, channels: 3, background: '#000000' } })
    .composite([
      { input: glow, left: left - pad, top: top - pad },
      { input: scaled, left, top },
    ])
    .png()
}

for (const size of [1024, 512]) {
  const file = `public/brand/email-avatar-${size}.png`
  await (await avatar(size)).toFile(file)
  console.log('  ✓', file)
}
