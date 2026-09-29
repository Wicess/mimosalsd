import 'server-only'

import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { ImageResponse } from 'next/og'
import sharp from 'sharp'
import { BRAND } from '@/lib/brand'
import { formatCents } from '@/lib/utils'
import { formatUtc } from '@/lib/payments/instructions'
import type { InvoiceData } from './data'

/**
 * ─────────────────────────────────────────────────────────────────────────────
 *  THE INVOICE IMAGE — a PNG drawn on the server with next/og (Satori + Resvg).
 *
 *  A PNG and not a PDF because it goes into the customer's chat, where it shows as a
 *  picture they can open with one tap on a phone, and into an email, where every
 *  client can preview it. It never carries information that is not also written
 *  out as text beside it (the chat message and the email body): an image cannot be
 *  read by a screen reader, searched or copied, and a $Cashtag has to be copyable.
 *
 *  Light, whatever the site's theme: it is a document, forwarded, printed and
 *  screenshotted, and dark ink on white survives all of that.
 *
 *  Satori lays out flexbox only, needs an explicit height, and cannot wrap text to
 *  an unknown size. So the page is drawn taller than it can need, from a generous
 *  line-count estimate, and the empty space below the footer is cropped off with
 *  sharp afterwards. Every invoice ends the same distance below its last line.
 *
 *  Fonts are the site's own, Inter and Space Grotesk, as static TTFs in ./fonts.
 *  They are read from disk, so next.config traces that folder into the routes that
 *  render invoices; without it they would exist locally and be missing on Vercel.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const WIDTH = 1080
const PAD = 64
const INNER = WIDTH - PAD * 2

const INK = '#16181a'
const MUTED = '#5b6168'
const RULE = '#e3e6df'
const GREEN = '#3f8a00'
const GREEN_TINT = '#f3fae8'
const GREEN_EDGE = '#cfe8a8'
const AMBER_TINT = '#fdf6e3'
const AMBER_EDGE = '#f0dfa6'
const AMBER_INK = '#6b5a0d'

const FONT_DIR = join(process.cwd(), 'src/lib/invoices/fonts')

let assets:
  | Promise<{ fonts: { name: string; data: Buffer; weight: 400 | 600 | 700; style: 'normal' }[]; logo: string }>
  | undefined

/** Read once per server instance: fonts and logo do not change between invoices. */
function loadAssets() {
  assets ??= (async () => {
    const [regular, semibold, bold, grotesk, logo] = await Promise.all([
      readFile(join(FONT_DIR, 'Inter-Regular.ttf')),
      readFile(join(FONT_DIR, 'Inter-SemiBold.ttf')),
      readFile(join(FONT_DIR, 'Inter-Bold.ttf')),
      readFile(join(FONT_DIR, 'SpaceGrotesk-Bold.ttf')),
      readFile(join(process.cwd(), 'public/brand/logo-email.png')),
    ])
    return {
      fonts: [
        { name: 'Inter', data: regular, weight: 400 as const, style: 'normal' as const },
        { name: 'Inter', data: semibold, weight: 600 as const, style: 'normal' as const },
        { name: 'Inter', data: bold, weight: 700 as const, style: 'normal' as const },
        { name: 'Grotesk', data: grotesk, weight: 700 as const, style: 'normal' as const },
      ],
      logo: `data:image/png;base64,${logo.toString('base64')}`,
    }
  })()
  return assets
}

/** A deliberately generous line count: over-estimating costs only cropped whitespace. */
function lines(text: string, fontPx: number, widthPx: number): number {
  const perLine = Math.max(8, Math.floor(widthPx / (fontPx * 0.58)))
  return Math.max(1, Math.ceil(text.length / perLine))
}

function estimateHeight(d: InvoiceData): number {
  let h = PAD * 2 + 12
  h += 260 // header: logo, title, Order ID, date
  h += 60 + lines(bannerText(d), 26, INNER - 64) * 38 // status banner
  h += 70 + d.shipTo.length * 36 + 40 // bill to
  h += 64 // table header
  for (const line of d.lines) h += 40 + lines(`${line.name} ${line.variant}`, 26, 560) * 38
  h += 8 * 50 + 90 // totals: up to subtotal, shipping, coupon, subscriber, app, Bitcoin, total, and the method line
  if (d.payment) {
    const p = d.payment
    h += 110
    for (const row of p.summary) h += 30 + lines(row.value, 28, INNER - 330) * 40
    if (p.requirement) h += 40 + lines(p.requirement, 24, INNER - 80) * 34
    h += 70
    for (const step of p.steps) h += 20 + lines(step, 24, INNER - 120) * 36
    h += 70
    for (const w of p.warnings) h += 18 + lines(w, 22, INNER - 110) * 33
    h += 60 + lines(p.safety, 22, INNER - 80) * 33
  }
  h += 220 // footer
  return Math.ceil(h * 1.08)
}

function bannerText(d: InvoiceData): string {
  return d.stage === 'RECEIVED'
    ? `Thank you, ${d.customerName}. We have your order and are verifying it now. Your ${d.methodLabel} payment details will arrive in the chat on our site and by email.`
    : `Your order is verified. Pay ${formatCents(d.totalCents)} by ${d.methodLabel} using the details below.`
}

export async function renderInvoicePng(d: InvoiceData): Promise<Buffer> {
  const { fonts, logo } = await loadAssets()
  const height = estimateHeight(d)
  const p = d.payment

  const row = (label: string, value: string, strong = false) => (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        padding: strong ? '18px 0 0' : '8px 0',
        borderTop: strong ? `2px solid ${INK}` : 'none',
        marginTop: strong ? 10 : 0,
      }}
    >
      <span style={{ fontSize: strong ? 30 : 25, color: strong ? INK : MUTED, fontWeight: strong ? 700 : 400 }}>{label}</span>
      <span style={{ fontSize: strong ? 34 : 25, color: INK, fontWeight: strong ? 700 : 600 }}>{value}</span>
    </div>
  )

  const element = (
    <div style={{ width: WIDTH, height, display: 'flex', flexDirection: 'column', backgroundColor: '#ffffff', fontFamily: 'Inter', color: INK }}>
      <div style={{ height: 12, width: WIDTH, backgroundImage: `linear-gradient(90deg, ${GREEN}, #8fe000)` }} />
      <div style={{ display: 'flex', flexDirection: 'column', padding: `48px ${PAD}px ${PAD}px` }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {/* Satori draws this into a PNG; next/image does not apply outside a page. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={logo} width={264} height={116} alt="" />
            <span style={{ fontSize: 22, color: MUTED, marginTop: 10 }}>{`${BRAND.legalName} · mimosalsd.com`}</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
            <span style={{ fontFamily: 'Grotesk', fontSize: 50, letterSpacing: 2, color: INK }}>INVOICE</span>
            <span style={{ fontSize: 22, color: MUTED, marginTop: 14 }}>Order ID</span>
            <span style={{ fontSize: 36, fontWeight: 700, color: INK }}>{d.orderId}</span>
            <span style={{ fontSize: 22, color: MUTED, marginTop: 8 }}>{`Issued ${formatUtc(d.issuedAt)}`}</span>
          </div>
        </div>

        {/* Status */}
        <div
          style={{
            display: 'flex',
            marginTop: 36,
            padding: '22px 30px',
            borderRadius: 16,
            backgroundColor: d.stage === 'RECEIVED' ? '#eef0f2' : GREEN_TINT,
            border: `2px solid ${d.stage === 'RECEIVED' ? '#dfe3e6' : GREEN_EDGE}`,
          }}
        >
          <span style={{ fontSize: 26, lineHeight: 1.45, color: INK }}>{bannerText(d)}</span>
        </div>

        {/* Bill to */}
        <div style={{ display: 'flex', flexDirection: 'column', marginTop: 36 }}>
          <span style={{ fontSize: 20, color: MUTED, letterSpacing: 2 }}>SHIP TO</span>
          <span style={{ fontSize: 28, fontWeight: 600, marginTop: 8 }}>{d.customerName}</span>
          {d.shipTo.map((line) => (
            <span key={line} style={{ fontSize: 25, color: MUTED, marginTop: 4 }}>{line}</span>
          ))}
        </div>

        {/* Items */}
        <div style={{ display: 'flex', marginTop: 36, paddingBottom: 12, borderBottom: `2px solid ${INK}` }}>
          <span style={{ width: 560, fontSize: 20, color: MUTED, letterSpacing: 2 }}>ITEM</span>
          {/* Satori ignores textAlign on a flex item; alignment is done with justifyContent. */}
          <div style={{ width: 100, display: 'flex', justifyContent: 'center' }}>
            <span style={{ fontSize: 20, color: MUTED, letterSpacing: 2 }}>QTY</span>
          </div>
          <div style={{ flex: 1, display: 'flex', justifyContent: 'flex-end' }}>
            <span style={{ fontSize: 20, color: MUTED, letterSpacing: 2 }}>AMOUNT</span>
          </div>
        </div>
        {d.lines.map((line, i) => (
          <div key={`${line.name}-${i}`} style={{ display: 'flex', alignItems: 'flex-start', padding: '18px 0', borderBottom: `1px solid ${RULE}` }}>
            <div style={{ width: 560, display: 'flex', flexDirection: 'column', paddingRight: 20 }}>
              <span style={{ fontSize: 26, fontWeight: 600, lineHeight: 1.35 }}>{line.name}</span>
              <span style={{ fontSize: 22, color: MUTED, marginTop: 2 }}>{`${line.variant} · ${formatCents(line.unitCents)} each`}</span>
            </div>
            <div style={{ width: 100, display: 'flex', justifyContent: 'center' }}>
              <span style={{ fontSize: 26 }}>{String(line.quantity)}</span>
            </div>
            <div style={{ flex: 1, display: 'flex', justifyContent: 'flex-end' }}>
              <span style={{ fontSize: 26, fontWeight: 600 }}>{formatCents(line.lineCents)}</span>
            </div>
          </div>
        ))}

        {/* Totals */}
        <div style={{ display: 'flex', flexDirection: 'column', marginTop: 18, marginLeft: 420 }}>
          {row('Subtotal', formatCents(d.subtotalCents))}
          {row('Shipping', d.shippingCents === 0 ? 'Free' : formatCents(d.shippingCents))}
          {d.discountCents > 0 ? row(d.couponCode ? `Coupon ${d.couponCode}` : 'Discount', `-${formatCents(d.discountCents)}`) : null}
          {d.subscriberDiscountCents > 0 ? row('Subscriber discount', `-${formatCents(d.subscriberDiscountCents)}`) : null}
          {d.appDiscountCents > 0 ? row('App discount', `-${formatCents(d.appDiscountCents)}`) : null}
          {d.paymentDiscountCents > 0 ? row('Bitcoin discount', `-${formatCents(d.paymentDiscountCents)}`) : null}
          {row('Total', formatCents(d.totalCents), true)}
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 10 }}>
            <span style={{ fontSize: 21, color: MUTED }}>{`Paying by ${d.methodLabel}`}</span>
          </div>
        </div>

        {/* How to pay */}
        {p ? (
          <div style={{ display: 'flex', flexDirection: 'column', marginTop: 44 }}>
            <span style={{ fontFamily: 'Grotesk', fontSize: 38, color: INK }}>{p.headline}</span>
            <div style={{ display: 'flex', flexDirection: 'column', marginTop: 20, padding: '14px 30px', borderRadius: 16, backgroundColor: GREEN_TINT, border: `2px solid ${GREEN_EDGE}` }}>
              {p.summary.map((r, i) => (
                <div key={r.label} style={{ display: 'flex', alignItems: 'flex-start', padding: '14px 0', borderTop: i === 0 ? 'none' : `1px solid ${GREEN_EDGE}` }}>
                  <span style={{ width: 240, fontSize: 24, color: MUTED, paddingTop: 3 }}>{r.label}</span>
                  <span style={{ flex: 1, fontSize: 28, fontWeight: 700, color: INK, lineHeight: 1.35, wordBreak: 'break-all' }}>{r.value}</span>
                </div>
              ))}
            </div>
            {p.requirement ? (
              <span style={{ fontSize: 24, color: INK, marginTop: 18, lineHeight: 1.4 }}>{p.requirement}</span>
            ) : null}

            <span style={{ fontSize: 20, color: MUTED, letterSpacing: 2, marginTop: 30 }}>HOW TO PAY</span>
            {p.steps.map((step, i) => (
              <div key={step} style={{ display: 'flex', alignItems: 'flex-start', marginTop: 14 }}>
                <div style={{ display: 'flex', width: 44, height: 44, borderRadius: 22, backgroundColor: GREEN, color: '#ffffff', alignItems: 'center', justifyContent: 'center', fontSize: 22, fontWeight: 700, marginRight: 20, flexShrink: 0 }}>
                  {String(i + 1)}
                </div>
                <span style={{ flex: 1, fontSize: 24, lineHeight: 1.45, color: INK, paddingTop: 6 }}>{step}</span>
              </div>
            ))}

            <div style={{ display: 'flex', flexDirection: 'column', marginTop: 30, padding: '20px 28px', borderRadius: 16, backgroundColor: AMBER_TINT, border: `2px solid ${AMBER_EDGE}` }}>
              <span style={{ fontSize: 20, color: AMBER_INK, letterSpacing: 2, fontWeight: 700 }}>PLEASE NOTE</span>
              {p.warnings.map((w) => (
                <span key={w} style={{ fontSize: 22, lineHeight: 1.45, color: AMBER_INK, marginTop: 10 }}>{`• ${w}`}</span>
              ))}
            </div>
            <span style={{ fontSize: 22, lineHeight: 1.45, color: MUTED, marginTop: 22 }}>{p.safety}</span>
          </div>
        ) : null}

        {/* Footer */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 48, paddingTop: 22, borderTop: `1px solid ${RULE}` }}>
          <span style={{ fontSize: 21, color: MUTED }}>{`Order ID ${d.orderId}`}</span>
          <span style={{ fontSize: 21, color: MUTED }}>Questions? Reply in your order chat.</span>
        </div>
        <div style={{ display: 'flex', height: 8, width: 8, backgroundColor: '#ffffff', marginTop: 4 }} data-end="" />
      </div>
    </div>
  )

  const response = new ImageResponse(element, { width: WIDTH, height, fonts })
  const png = Buffer.from(await response.arrayBuffer())
  return cropToContent(png)
}

/** Crop the unused white below the footer, keeping a fixed margin under the last line. */
async function cropToContent(png: Buffer): Promise<Buffer> {
  const image = sharp(png)
  const { data, info } = await image.raw().toBuffer({ resolveWithObject: true })
  const { width, height, channels } = info
  let last = 0
  for (let y = height - 1; y >= 0; y--) {
    const offset = y * width * channels
    let blank = true
    for (let x = 0; x < width * channels; x += channels) {
      if (data[offset + x]! < 250 || data[offset + x + 1]! < 250 || data[offset + x + 2]! < 250) {
        blank = false
        break
      }
    }
    if (!blank) {
      last = y
      break
    }
  }
  const cropHeight = Math.min(height, last + 1 + PAD)
  return sharp(png).extract({ left: 0, top: 0, width, height: cropHeight }).png({ compressionLevel: 9 }).toBuffer()
}
