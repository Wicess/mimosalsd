import { describe, expect, it } from 'vitest'
import {
  darkTheme,
  lightTheme,
  fontSize,
  spacing,
  touchTarget,
  zIndex,
  type SemanticTheme,
} from '@/lib/design/tokens'

/**
 * WCAG 2.2 contrast verification.
 *
 * Saturated "psychedelic" palettes fail contrast by default, and this site's entire
 * conversion argument is trust — a buyer who cannot read the legality notice is a
 * buyer we have failed twice over. So the palette is verified, not asserted, and the
 * verification runs in CI so it cannot silently regress when someone "tweaks a colour".
 */

function srgbToLinear(channel: number): number {
  const c = channel / 255
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
}

function relativeLuminance(hex: string): number {
  const clean = hex.replace('#', '')
  const r = Number.parseInt(clean.slice(0, 2), 16)
  const g = Number.parseInt(clean.slice(2, 4), 16)
  const b = Number.parseInt(clean.slice(4, 6), 16)
  return (
    0.2126 * srgbToLinear(r) + 0.7152 * srgbToLinear(g) + 0.0722 * srgbToLinear(b)
  )
}

export function contrastRatio(fg: string, bg: string): number {
  const l1 = relativeLuminance(fg)
  const l2 = relativeLuminance(bg)
  const [lighter, darker] = l1 > l2 ? [l1, l2] : [l2, l1]
  return (lighter + 0.05) / (darker + 0.05)
}

const AA_NORMAL = 4.5
/** Non-text UI components and graphical objects — WCAG 1.4.11. */
const AA_NON_TEXT = 3.0

function round(n: number): number {
  return Math.round(n * 100) / 100
}

/**
 * Every pair a user actually reads, in both themes.
 *
 * The foreground x surface matrix is exhaustive by construction. An earlier version
 * spot-checked pairs and missed `subtle on surface`, which shipped at 4.4:1 in dark
 * mode inside the age gate — caught by Lighthouse, not by this file. Enumerating the
 * cross product means a new surface cannot be introduced without being checked
 * against every text colour.
 */
const SURFACES = ['background', 'surface', 'surfaceSunken', 'surfaceData'] as const
const TEXT_COLORS = ['foreground', 'foregroundMuted', 'foregroundSubtle'] as const

function textPairs(t: SemanticTheme): Array<[string, string, string, number]> {
  const matrix: Array<[string, string, string, number]> = []
  for (const text of TEXT_COLORS) {
    for (const surface of SURFACES) {
      matrix.push([`${text} on ${surface}`, t[text], t[surface], AA_NORMAL])
    }
  }
  return [
    ...matrix,
    ['primary link on background', t.primary, t.background, AA_NORMAL],
    ['primary link on surface', t.primary, t.surface, AA_NORMAL],
    ['text on primary fill', t.onPrimary, t.primary, AA_NORMAL],
    ['text on accent fill (CTA)', t.onAccent, t.accent, AA_NORMAL],
    ['primary on its muted bg', t.primary, t.primaryMuted, AA_NORMAL],
    // `accent` is a fill, `accentFg` is the text value of the same colour — see the
    // note on the accent tokens. Asserting `accent on accentMuted` would demand one
    // value be legible against a tint of itself, which no light-value accent can do.
    ['accent text on its muted bg', t.accentFg, t.accentMuted, AA_NORMAL],
    ['accent text on surface', t.accentFg, t.surface, AA_NORMAL],
    // Compliance status surfaces. If any of these fail, someone misreads whether we
    // can legally ship to them.
    ['success text on success bg', t.successFg, t.successBg, AA_NORMAL],
    ['warning text on warning bg', t.warningFg, t.warningBg, AA_NORMAL],
    ['danger text on danger bg', t.dangerFg, t.dangerBg, AA_NORMAL],
    ['info text on info bg', t.infoFg, t.infoBg, AA_NORMAL],
  ]
}

function nonTextPairs(t: SemanticTheme): Array<[string, string, string, number]> {
  return [
    ['border on background', t.borderStrong, t.background, AA_NON_TEXT],
    ['data border on data surface', t.borderData, t.surfaceData, AA_NON_TEXT],
    ['focus ring on background', t.ring, t.background, AA_NON_TEXT],
    ['focus ring on surface', t.ring, t.surface, AA_NON_TEXT],
  ]
}

describe.each([
  ['light', lightTheme],
  ['dark', darkTheme],
])('%s theme — WCAG 2.2 AA text contrast', (themeName, theme) => {
  it.each(textPairs(theme))(
    '%s meets AA',
    (label, fg, bg, minimum) => {
      const ratio = contrastRatio(fg, bg)
      expect(
        ratio,
        `${themeName}: ${label} — ${fg} on ${bg} is ${round(ratio)}:1, needs ${minimum}:1`,
      ).toBeGreaterThanOrEqual(minimum)
    },
  )
})

describe.each([
  ['light', lightTheme],
  ['dark', darkTheme],
])('%s theme — WCAG 1.4.11 non-text contrast', (themeName, theme) => {
  it.each(nonTextPairs(theme))('%s meets 3:1', (label, fg, bg, minimum) => {
    const ratio = contrastRatio(fg, bg)
    expect(
      ratio,
      `${themeName}: ${label} — ${fg} on ${bg} is ${round(ratio)}:1, needs ${minimum}:1`,
    ).toBeGreaterThanOrEqual(minimum)
  })
})

describe('contrast helper', () => {
  it('computes the known reference ratios', () => {
    expect(round(contrastRatio('#000000', '#FFFFFF'))).toBe(21)
    expect(round(contrastRatio('#FFFFFF', '#FFFFFF'))).toBe(1)
  })

  it('is symmetric', () => {
    expect(contrastRatio('#130F1B', '#FAF8F5')).toBeCloseTo(
      contrastRatio('#FAF8F5', '#130F1B'),
    )
  })
})

describe('scale integrity', () => {
  it('keeps mobile body text at 16px minimum — below it iOS auto-zooms on focus', () => {
    expect(fontSize.base).toContain('clamp(1rem')
  })

  it('builds spacing on a 4px rhythm', () => {
    expect(spacing[1]).toBe('0.25rem')
    expect(spacing[2]).toBe('0.5rem')
    expect(spacing[4]).toBe('1rem')
  })

  it('meets the 44px touch-target floor', () => {
    expect(Number.parseInt(touchTarget.min, 10)).toBeGreaterThanOrEqual(44)
  })

  it('orders the z-index scale strictly, with the age gate on top', () => {
    const values = Object.values(zIndex)
    expect([...values].sort((a, b) => a - b)).toEqual(values)
    expect(zIndex.ageGate).toBe(Math.max(...values))
  })

  it('has no duplicate z-index values — that is how stacking bugs start', () => {
    const values = Object.values(zIndex)
    expect(new Set(values).size).toBe(values.length)
  })
})

describe('theme parity', () => {
  it('defines exactly the same token names in both themes', () => {
    expect(Object.keys(darkTheme).sort()).toEqual(Object.keys(lightTheme).sort())
  })

  it('uses distinct values per theme — dark is not a copy of light', () => {
    expect(darkTheme.background).not.toBe(lightTheme.background)
    expect(darkTheme.foreground).not.toBe(lightTheme.foreground)
  })

  it('inverts figure and ground correctly', () => {
    expect(relativeLuminance(lightTheme.background)).toBeGreaterThan(
      relativeLuminance(lightTheme.foreground),
    )
    expect(relativeLuminance(darkTheme.background)).toBeLessThan(
      relativeLuminance(darkTheme.foreground),
    )
  })
})
