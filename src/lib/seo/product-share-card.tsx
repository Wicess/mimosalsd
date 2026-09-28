/* eslint-disable @next/next/no-img-element -- Satori renders plain <img>; next/image does not exist inside an ImageResponse. */
import { ImageResponse } from 'next/og'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { BRAND } from '@/lib/brand'
import { getMergedProduct } from '@/lib/catalog/merged'
import { displayImageFor } from '@/lib/catalog/sample-images'
import { listPrice } from '@/lib/catalog/types'
import { formatCents } from '@/lib/utils'

/**
 * Each product's own share card (owner, 2026-09-14), served at
 * /product/<slug>/share-image.
 *
 * It was `opengraph-image.tsx` inside the product route, which Next serves at a
 * hashed address (`opengraph-image-13euf5`) and attaches only when a page sets no
 * image of its own. pageMetadata always sets one, so every product shared the site
 * card and the product card was never seen. A route handler gives it a stable URL
 * the product page can name. Owner check, 2026-09-28.
 * its photo, its name and its one
 * fixed price, so a link pasted into a chat or a social post shows the product
 * rather than the site's general card. Made automatically for every product,
 * posted or built in. Colours are the dark theme's tokens, as on the site card.
 */

const SUNKEN = '#0b0e09'
const PAPER = '#f4f6f1'
const MUTED = '#b3baa4'
const ACCENT = '#e6d283'
const RULE = '#363e2e'

export async function productShareCard(params: Promise<{ slug: string }>): Promise<ImageResponse> {
  const { slug } = await params
  const product = await getMergedProduct(slug)
  const badge = await readFile(join(process.cwd(), 'assets/logo-badge.png'))
  const photo = product ? displayImageFor(product) : undefined
  const price = product ? listPrice(product) : undefined

  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', background: SUNKEN, fontFamily: 'sans-serif' }}>
        <div style={{ width: 560, height: 630, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#141a10' }}>
          {photo && !photo.isSample ? (
            <img alt="" src={photo.src} width={560} height={630} style={{ objectFit: 'cover' }} />
          ) : (
            <img alt="" src={`data:image/png;base64,${badge.toString('base64')}`} width={320} height={320} />
          )}
        </div>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '0 64px', gap: 22 }}>
          <div style={{ display: 'flex', fontSize: 24, color: ACCENT, letterSpacing: 4, textTransform: 'uppercase' }}>{BRAND.name}</div>
          <div style={{ display: 'flex', fontSize: 54, lineHeight: 1.1, color: PAPER, fontWeight: 700 }}>{product?.name ?? BRAND.name}</div>
          {price && price.cents > 0 ? (
            <div style={{ display: 'flex', fontSize: 36, color: PAPER }}>
              {formatCents(price.cents)}
              <span style={{ marginLeft: 12, color: MUTED }}>{price.per === 'lb' ? 'per lb · 1/4 to 1 lb' : 'each'}</span>
            </div>
          ) : null}
          <div style={{ display: 'flex', height: 2, width: 96, background: RULE }} />
          <div style={{ display: 'flex', fontSize: 24, color: MUTED }}>Sold by weight · Ships from California to US addresses</div>
        </div>
      </div>
    ),
    { width: 1200, height: 630 },
  )
}
