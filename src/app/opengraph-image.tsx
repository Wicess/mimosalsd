import { ImageResponse } from 'next/og'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { BRAND } from '@/lib/brand'

/**
 * Default social share card, inherited by every route that does not define its own.
 *
 * ── Why the mark is a pre-rendered file ─────────────────────────────────────
 * The circular badge is baked with sharp and read from `assets/`, not clipped
 * here. Satori — the renderer behind ImageResponse — has partial support for
 * `border-radius` with `overflow:hidden`, and a share card that renders a
 * square-cornered logo on one platform's crawler and a circle on another is
 * worse than no card. Masking it once, ahead of time, makes the circle a
 * property of the asset rather than of the renderer.
 *
 * It lives in `assets/` rather than `public/` deliberately: this file reads it
 * from disk, and `public/` is served by the CDN rather than guaranteed to sit in
 * the function's filesystem. `assets/` is the path Next's own documentation uses
 * for exactly this, so file tracing includes it in the deployment.
 *
 * ── Why the text is deliberately plain ──────────────────────────────────────
 * No custom font is loaded. The logo already carries the brand's voice; the
 * supporting lines only have to be legible at thumbnail size in a Slack unfurl,
 * and shipping a webfont into the image function to style two sentences costs
 * more than it returns.
 */
export const alt = `${BRAND.name} — ${BRAND.tagline}`
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

const badge = await readFile(join(process.cwd(), 'assets/logo-badge.png'))

// The dark theme's own tokens, so a share card and the site it links to match.
const SUNKEN = '#0b0e09'
const PAPER = '#f4f6f1'
const MUTED = '#b3baa4'
const ACCENT = '#e6d283'
const RULE = '#363e2e'

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          gap: 64,
          background: SUNKEN,
          backgroundImage: `radial-gradient(60% 90% at 88% -10%, rgba(230,210,131,0.16), transparent 62%)`,
          padding: '0 76px',
          fontFamily: 'sans-serif',
        }}
      >
        <img
          src={`data:image/png;base64,${badge.toString('base64')}`}
          width={380}
          height={380}
          alt=""
          style={{ display: 'block', flexShrink: 0 }}
        />

        <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
          {/*
            One sentence per line, split explicitly — the same reason the homepage
            hero does it. "State-Verified" carries a real hyphen, which is a legal
            break point, so left to itself the renderer set "Lab-Tested. State-" on
            one line and "Verified." on the next. Three sentences, three lines.
          */}
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {BRAND.tagline.split(/(?<=\.)\s+/).map((sentence) => (
              <div
                key={sentence}
                style={{
                  display: 'flex',
                  fontSize: 52,
                  lineHeight: 1.16,
                  color: PAPER,
                  letterSpacing: '-0.02em',
                }}
              >
                {sentence}
              </div>
            ))}
          </div>

          {/*
            Named the amanita category until 2026-09-17. Every listing in it is a
            Psilocybe cubensis strain, so the card was repeating the same mislabel
            the product pages carried — on the one asset that renders every time
            somebody pastes a link. It now names only what it can stand behind.
          */}
          <div style={{ display: 'flex', fontSize: 25, color: MUTED, marginTop: 24 }}>
            Mimosa hostilis root bark · Powder · Shredded · Whole
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 14,
              marginTop: 34,
              paddingTop: 26,
              borderTop: `2px solid ${RULE}`,
              fontSize: 23,
            }}
          >
            {/*
              Said "All 50 states & DC" until 2026-09-17, which stopped being true the
              day the vape line was closed in twenty-five of them. Availability is
              decided per line and per address from `state_rules` at checkout, so the
              card says that rather than naming a number that goes stale silently.
            */}
            <div style={{ display: 'flex', color: ACCENT }}>Ships from California</div>
            {/*
              Satori counts an interpolation next to adjacent text as two children
              and then requires an explicit `display`. Kept as one interpolated
              string so the node only ever has one child.
            */}
            <div style={{ display: 'flex', color: MUTED }}>
              {`· ${BRAND.minimumAge}+ · US only`}
            </div>
          </div>
        </div>
      </div>
    ),
    size,
  )
}
