import { describe, expect, it } from 'vitest'
import robots from '@/app/robots'

/*
  robots.txt is small, rarely edited, and read by every crawler that reaches the
  site — which is a bad combination, because a mistake in it is both invisible in
  review and expensive in effect.

  It emitted `Host: https://www.snypegate.com/` until 2026-09-17: the wrong format
  for a directive Google and Bing have never read, saying what the apex-to-www
  redirect already says. Removed rather than corrected.

  CLAUDE.md rule 10 is the other half of this file — AI citation is a primary
  acquisition channel here, so the named AI crawlers must stay allowed.
*/
describe('robots.txt', () => {
  const txt = robots()
  const rules = Array.isArray(txt.rules) ? txt.rules : [txt.rules]

  it('declares the sitemap on the canonical host', () => {
    const sitemap = Array.isArray(txt.sitemap) ? txt.sitemap[0] : txt.sitemap
    expect(sitemap).toMatch(/^https?:\/\/[^/]+\/sitemap\.xml$/)
  })

  it('emits no host directive', () => {
    // Yandex-only, deprecated in 2018, and it was emitting a scheme and a trailing
    // slash where the directive takes a bare hostname.
    expect(txt.host).toBeUndefined()
  })

  it('allows every AI crawler CLAUDE.md rule 10 names', () => {
    const agents = rules.flatMap((r) => (Array.isArray(r.userAgent) ? r.userAgent : [r.userAgent ?? '']))
    for (const bot of ['GPTBot', 'ClaudeBot', 'PerplexityBot', 'Google-Extended', 'CCBot', 'OAI-SearchBot', 'Claude-SearchBot', 'Claude-User', 'Perplexity-User']) {
      expect(agents, `${bot} must stay crawlable`).toContain(bot)
    }
  })

  it('never disallows the whole site for anyone', () => {
    for (const rule of rules) {
      const disallow = Array.isArray(rule.disallow) ? rule.disallow : rule.disallow ? [rule.disallow] : []
      expect(disallow, String(rule.userAgent)).not.toContain('/')
    }
  })

  it('keeps the private areas out of every rule, not just the wildcard', () => {
    // An AI crawler given its own block inherits nothing from `*`, so each block
    // has to carry the disallow list itself or admin becomes crawlable for it.
    for (const rule of rules) {
      const disallow = Array.isArray(rule.disallow) ? rule.disallow : rule.disallow ? [rule.disallow] : []
      for (const path of ['/admin', '/api', '/account', '/checkout', '/cart']) {
        expect(disallow, `${String(rule.userAgent)} may not crawl ${path}`).toContain(path)
      }
    }
  })

  it('allows the root for every declared agent', () => {
    for (const rule of rules) {
      const allow = Array.isArray(rule.allow) ? rule.allow : rule.allow ? [rule.allow] : []
      expect(allow, String(rule.userAgent)).toContain('/')
    }
  })
})
