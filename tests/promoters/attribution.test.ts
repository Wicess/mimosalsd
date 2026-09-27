import { describe, expect, it } from 'vitest'
import {
  ATTRIBUTION_MAX_AGE_SECONDS,
  encodeAttribution,
  parseAttribution,
} from '@/lib/promoters/attribution'

const NOW = new Date('2026-09-12T12:00:00Z')
const ago = (days: number) => new Date(NOW.getTime() - days * 24 * 60 * 60 * 1000)

describe('attribution cookie', () => {
  it('round-trips a click to the second', () => {
    const at = ago(3)
    const parsed = parseAttribution(encodeAttribution('reddit-dye', at), NOW)
    expect(parsed?.slug).toBe('reddit-dye')
    expect(parsed?.at.getTime()).toBe(Math.floor(at.getTime() / 1000) * 1000)
  })

  it('credits a click inside the window and forgets one outside it', () => {
    expect(parseAttribution(encodeAttribution('a-link', ago(29)), NOW)).not.toBeNull()
    expect(parseAttribution(encodeAttribution('a-link', ago(31)), NOW)).toBeNull()
    // Exactly on the boundary still counts.
    const edge = new Date(NOW.getTime() - ATTRIBUTION_MAX_AGE_SECONDS * 1000)
    expect(parseAttribution(encodeAttribution('a-link', edge), NOW)).not.toBeNull()
  })

  it('refuses anything malformed, forged or dated ahead', () => {
    for (const raw of [
      undefined,
      '',
      'no-timestamp',
      '.123',
      'UPPER.123',
      'a.link.slug',
      `${'x'.repeat(41)}.1770000000`,
      'a-link.not-a-number',
      'a-link.-5',
      encodeAttribution('a-link', new Date(NOW.getTime() + 60_000)),
    ]) {
      expect(parseAttribution(raw, NOW), String(raw)).toBeNull()
    }
  })
})
