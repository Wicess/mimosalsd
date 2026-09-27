import { describe, expect, it } from 'vitest'
import {
  isTheme,
  THEMES,
  THEME_INIT_SCRIPT,
  THEME_STORAGE_KEY,
} from '@/lib/design/theme'

/**
 * The theme preference has three states, and "system" is the default rather than a
 * third colour. Getting that wrong is what produces a toggle that throws away the
 * device preference the first time it is touched and never gives it back.
 */
describe('theme values', () => {
  it('offers system, light and dark — in that order', () => {
    expect([...THEMES]).toEqual(['system', 'light', 'dark'])
  })

  it('accepts only the three known values', () => {
    for (const t of THEMES) expect(isTheme(t)).toBe(true)
    for (const bad of ['', 'auto', 'Dark', null, undefined, 0, {}]) {
      expect(isTheme(bad), String(bad)).toBe(false)
    }
  })
})

/**
 * The inline script runs before first paint and before any framework code. If it
 * throws, the page renders unstyled or in the wrong theme, so it is held to a
 * narrower contract than ordinary code.
 */
describe('the pre-paint init script', () => {
  it('reads the same storage key the client writes', () => {
    expect(THEME_INIT_SCRIPT).toContain(JSON.stringify(THEME_STORAGE_KEY))
  })

  it('only ever applies an explicit light or dark choice', () => {
    // "system" is the absence of the attribute — the script must not set it.
    expect(THEME_INIT_SCRIPT).toContain('"light"')
    expect(THEME_INIT_SCRIPT).toContain('"dark"')
    expect(THEME_INIT_SCRIPT).not.toContain('"system"')
  })

  it('swallows its own errors — blocked storage must not break the page', () => {
    expect(THEME_INIT_SCRIPT).toMatch(/try\{[\s\S]*\}catch\(e\)\{\}/)
  })

  it('is an IIFE, so it leaks nothing into the global scope', () => {
    expect(THEME_INIT_SCRIPT.startsWith('(function(){')).toBe(true)
    expect(THEME_INIT_SCRIPT.endsWith('})()')).toBe(true)
  })

  it('stays small enough to be worth inlining on every page', () => {
    expect(THEME_INIT_SCRIPT.length).toBeLessThan(400)
  })

  it('sets color-scheme too, so form controls follow the choice', () => {
    expect(THEME_INIT_SCRIPT).toContain('colorScheme')
  })

  /** It runs before React and outside a module — a stray import would throw. */
  it('references nothing it cannot reach at that point', () => {
    expect(THEME_INIT_SCRIPT).not.toMatch(/\bimport\b|\brequire\(/)
  })
})
