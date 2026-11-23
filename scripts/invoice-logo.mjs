#!/usr/bin/env node
/**
 * The wordmark cut out for white paper.   node scripts/invoice-logo.mjs
 *
 * Owner, 2026-11-23: the invoice showed the logo on its black plate
 * (logo-email.png); it should show just the logo. public/brand/logo.png is already
 * keyed to transparency, but it keeps the original's dark glow as faint, dark,
 * semi-transparent pixels — invisible on the dark site, a grey smudge under the
 * letters on white. This drops them: alpha below 64 goes, 160 and above stays solid,
 * and the ramp between keeps the letters' own dark-green outline (alpha ~140) crisp.
 *
 * Writes public/brand/logo-invoice.png, trimmed to the letters.
 */
import sharp from 'sharp'

const SOURCE = 'public/brand/logo.png'
const OUT = 'public/brand/logo-invoice.png'

// Raw pixels, one pass each: sharp orders the operations inside a single pipeline
// itself, so the alpha curve is applied to an alpha band that is already extracted.
const { data, info } = await sharp(SOURCE).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
const out = Buffer.from(data)
for (let i = 3; i < out.length; i += 4) {
  // 64 → 0 and 160 → 255, linear between.
  out[i] = Math.max(0, Math.min(255, Math.round(((out[i] - 64) * 255) / 96)))
}

await sharp(out, { raw: { width: info.width, height: info.height, channels: 4 } })
  .trim({ background: { r: 0, g: 0, b: 0, alpha: 0 } })
  .png({ compressionLevel: 9 })
  .toFile(OUT)
const { width, height } = await sharp(OUT).metadata()
console.log(`  ✓ ${OUT} (${width}x${height})`)
