import { describe, expect, it } from 'vitest'
import { sourceOf, suggestSlug } from '@/lib/links/platforms'

describe('where a visitor came from', () => {
  it('reads a tracking link platform, including other spellings', () => {
    expect(sourceOf({ utmSource: 'instagram' }).label).toBe('Instagram')
    expect(sourceOf({ utmSource: 'IG' }).label).toBe('Instagram')
    expect(sourceOf({ utmSource: 'twitter' }).key).toBe('x')
  })

  it('reads the referring site when there is no link', () => {
    expect(sourceOf({ referrer: 'l.instagram.com' }).key).toBe('instagram')
    expect(sourceOf({ referrer: 'https://www.google.co.uk/' }).key).toBe('google')
    expect(sourceOf({ referrer: 't.co' }).key).toBe('x')
    expect(sourceOf({ referrer: 'm.facebook.com' }).key).toBe('facebook')
    expect(sourceOf({ referrer: 'someblog.net' })).toEqual({ key: 'site:someblog.net', label: 'someblog.net' })
    expect(sourceOf({})).toEqual({ key: 'direct', label: 'Direct' })
  })

  it('prefers the link over the referrer, and keeps an unknown tag as it is', () => {
    expect(sourceOf({ utmSource: 'tiktok', referrer: 'google.com' }).key).toBe('tiktok')
    expect(sourceOf({ utmSource: 'forum' })).toEqual({ key: 'tag:forum', label: 'forum' })
  })

  it('suggests a link address from the platform and its purpose', () => {
    expect(suggestSlug('instagram', 'Bio link')).toBe('instagram-bio-link')
    expect(suggestSlug('tiktok', '')).toMatch(/^tiktok-[a-z0-9]{4}$/)
  })
})
