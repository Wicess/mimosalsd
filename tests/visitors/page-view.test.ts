import { describe, expect, it } from 'vitest'
import {
  buildVisitEvent,
  CRAWLER_VISITOR,
  externalReferrer,
  isCountablePageView,
  parseVisitEvent,
  trackedPath,
} from '@/lib/visitors/page-view'
import { crawlerName, looksAutomated, parseUserAgent } from '@/lib/visitors/user-agent'

const VID = '0f8fad5b-d9cb-469f-a165-70867728950e'
const IPHONE =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1'
const LINUX_CHROME =
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'

const h = (init: Record<string, string> = {}) => new Headers(init)

describe('isCountablePageView', () => {
  it('counts a document load and a client-side navigation', () => {
    expect(isCountablePageView('GET', '/shop', h({ 'sec-fetch-dest': 'document' }))).toBe(true)
    expect(isCountablePageView('GET', '/shop', h({ rsc: '1', 'sec-fetch-dest': 'empty' }))).toBe(true)
    // No fetch metadata at all: an older browser, or a crawler.
    expect(isCountablePageView('GET', '/shop', h())).toBe(true)
  })

  /*
    Measured on the live site, 2026-09-19: once public/sw.js is installed, a page it
    forwards arrives as dest "empty", mode "navigate". Only the first page of a visit
    was being counted.
  */
  it('counts a navigation forwarded by the service worker', () => {
    expect(isCountablePageView('GET', '/shop', h({ 'sec-fetch-dest': 'empty', 'sec-fetch-mode': 'navigate' }))).toBe(true)
  })

  it('still ignores a plain fetch that is not a navigation', () => {
    expect(isCountablePageView('GET', '/shop', h({ 'sec-fetch-dest': 'empty', 'sec-fetch-mode': 'cors' }))).toBe(false)
  })

  it('still ignores a prefetch, even one that claims to navigate', () => {
    expect(isCountablePageView('GET', '/shop', h({ 'sec-fetch-mode': 'navigate', 'sec-purpose': 'prefetch;prerender' }))).toBe(false)
  })

  /*
    Prefetches are pages nobody opened. Counting them would inflate every figure
    by however many links happened to be on screen.
  */
  it('never counts a prefetch, from the router or the browser', () => {
    for (const headers of <Record<string, string>[]>[
      { rsc: '1', 'next-router-prefetch': '1' },
      { rsc: '1', 'next-router-segment-prefetch': '/_tree' },
      { 'sec-purpose': 'prefetch;prerender' },
      { purpose: 'prefetch' },
      { 'x-purpose': 'preview' },
      { 'next-hmr-refresh': '1' },
    ]) {
      expect(isCountablePageView('GET', '/shop', h(headers))).toBe(false)
    }
  })

  /*
    A crawler sends no fetch metadata, so it is counted on trust — and /sw.js,
    a lab report PDF or the manifest would otherwise be filed as a page read.
  */
  it('never counts a file, even when nothing says it is one', () => {
    for (const path of ['/sw.js', '/lab-results/batch-24.pdf', '/manifest.webmanifest', '/llms.txt', '/sitemap.xml']) {
      expect(isCountablePageView('GET', path, h()), path).toBe(false)
    }
    // A page is still a page: no extension, dots and all.
    expect(isCountablePageView('GET', '/guides/how-to-read-a-certificate-of-analysis', h())).toBe(true)
  })

  it('never counts the admin, API routes, assets or anything but GET', () => {
    expect(isCountablePageView('GET', '/admin', h())).toBe(false)
    expect(isCountablePageView('GET', '/admin/orders', h())).toBe(false)
    expect(isCountablePageView('GET', '/api/chat', h())).toBe(false)
    expect(isCountablePageView('GET', '/_next/data/x.json', h())).toBe(false)
    expect(isCountablePageView('POST', '/checkout', h())).toBe(false)
    expect(isCountablePageView('HEAD', '/', h())).toBe(false)
    expect(isCountablePageView('GET', '/logo.png', h({ 'sec-fetch-dest': 'image' }))).toBe(false)
  })
})

describe('trackedPath', () => {
  it('never records an order token, which is a key to someone’s order', () => {
    expect(trackedPath('/order/7b1c0e8a-secret-token')).toBe('/order/[token]')
    expect(trackedPath('/order/abc/')).toBe('/order/[token]')
  })

  it('drops a trailing slash and caps the length', () => {
    expect(trackedPath('/shop/amanita/')).toBe('/shop/amanita')
    expect(trackedPath('/')).toBe('/')
    expect(trackedPath(`/${'x'.repeat(500)}`)).toHaveLength(200)
  })
})

describe('externalReferrer', () => {
  it('keeps only another site’s host, never the page', () => {
    expect(externalReferrer('https://www.google.com/search?q=private+words', 'shop.test')).toBe('google.com')
    expect(externalReferrer('https://shop.test/blog', 'shop.test')).toBeUndefined()
    expect(externalReferrer('https://www.shop.test/blog', 'shop.test:443')).toBeUndefined()
    expect(externalReferrer('not a url', 'shop.test')).toBeUndefined()
    expect(externalReferrer(null, 'shop.test')).toBeUndefined()
  })
})

describe('buildVisitEvent', () => {
  const build = (headers: Record<string, string>, search = '', minted = false) =>
    buildVisitEvent({
      visitorId: VID,
      minted,
      now: Date.UTC(2026, 8, 11, 12),
      pathname: '/shop/amanita',
      search: new URLSearchParams(search),
      host: 'shop.test',
      headers: h(headers),
    })

  it('records location, device and campaign — and no address or user-agent', () => {
    const event = build(
      {
        'user-agent': IPHONE,
        referer: 'https://www.reddit.com/r/x',
        'x-vercel-ip-country': 'us',
        'x-vercel-ip-country-region': 'tx',
        'x-vercel-ip-city': 'San%20Antonio',
        'x-forwarded-for': '203.0.113.7',
      },
      'utm_source=newsletter&utm_medium=email&utm_campaign=fall&email=someone%40x.com',
      true,
    )
    expect(event).toEqual({
      v: VID,
      t: Date.UTC(2026, 8, 11, 12),
      p: '/shop/amanita',
      r: 'reddit.com',
      us: 'newsletter',
      um: 'email',
      uc: 'fall',
      c: 'US',
      g: 'TX',
      ci: 'San Antonio',
      d: 'mobile',
      b: 'Safari',
      o: 'iOS',
      n: 1,
    })
    const stored = JSON.stringify(event)
    expect(stored).not.toContain('203.0.113.7')
    expect(stored).not.toContain('Mozilla')
    expect(stored).not.toContain('someone')
  })

  it('files a self-named crawler under its name, with no visitor behind it', () => {
    const event = build({ 'user-agent': 'Mozilla/5.0 (compatible; GPTBot/1.2; +https://openai.com/gptbot)' }, '', true)
    expect(event.v).toBe(CRAWLER_VISITOR)
    expect(event.k).toBe('GPTBot')
    expect(event.n).toBeUndefined()
  })

  it('flags a headless-looking client without dropping it', () => {
    expect(build({ 'user-agent': LINUX_CHROME }).a).toBe(1)
    // The same browser arriving from a real referrer is a person until shown otherwise.
    expect(build({ 'user-agent': LINUX_CHROME, referer: 'https://duckduckgo.com/' }).a).toBeUndefined()
  })

  it('round-trips through the buffer', () => {
    const event = build({ 'user-agent': IPHONE })
    expect(parseVisitEvent(JSON.stringify(event))).toEqual(event)
  })
})

describe('parseVisitEvent', () => {
  it('refuses anything that is not a well-formed event', () => {
    for (const raw of [
      null,
      42,
      'not json',
      '[]',
      JSON.stringify({ v: 'not-a-uuid', t: 1, p: '/', d: 'mobile', b: 'x', o: 'y' }),
      JSON.stringify({ v: VID, t: 'soon', p: '/', d: 'mobile', b: 'x', o: 'y' }),
      JSON.stringify({ v: VID, t: 1, p: 'no-slash', d: 'mobile', b: 'x', o: 'y' }),
      JSON.stringify({ v: VID, t: 1, p: '/', d: 'fridge', b: 'x', o: 'y' }),
    ]) {
      expect(parseVisitEvent(raw)).toBeNull()
    }
  })
})

describe('user-agent parsing', () => {
  it('reads coarse device, browser and system', () => {
    expect(parseUserAgent(IPHONE)).toEqual({ device: 'mobile', browser: 'Safari', os: 'iOS' })
    expect(parseUserAgent(LINUX_CHROME)).toEqual({ device: 'desktop', browser: 'Chrome', os: 'Linux' })
    expect(parseUserAgent(null)).toEqual({ device: 'desktop', browser: 'Other', os: 'Other' })
  })

  it('names the crawlers this business cares about', () => {
    expect(crawlerName('Mozilla/5.0 (compatible; ClaudeBot/1.0; +claudebot@anthropic.com)')).toBe('ClaudeBot')
    expect(crawlerName('Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; ChatGPT-User/1.0)')).toBe('ChatGPT-User')
    expect(crawlerName('Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)')).toBe('Googlebot')
    expect(crawlerName('Mozilla/5.0 (compatible; PerplexityBot/1.0)')).toBe('PerplexityBot')
    expect(crawlerName('python-requests/2.31')).toBe('Other automated')
    expect(crawlerName(IPHONE)).toBeNull()
  })

  it('spots Safari on a system Safari does not ship for', () => {
    expect(looksAutomated({ device: 'desktop', browser: 'Safari', os: 'Windows' }, 'google.com')).toBe(true)
    expect(looksAutomated({ device: 'mobile', browser: 'Safari', os: 'iOS' }, null)).toBe(false)
  })
})

describe('location from the host’s IP lookup', () => {
  it('keeps ZIP code, coordinates and time zone, and drops nonsense', () => {
    const event = buildVisitEvent({
      visitorId: VID,
      minted: false,
      now: 1,
      pathname: '/',
      search: new URLSearchParams(),
      host: 'shop.test',
      headers: h({
        'user-agent': IPHONE,
        'x-vercel-ip-postal-code': '78201',
        'x-vercel-ip-latitude': '29.46893',
        'x-vercel-ip-longitude': '-98.52839',
        'x-vercel-ip-timezone': 'America/Chicago',
      }),
    })
    expect([event.z, event.la, event.lo, event.tz]).toEqual(['78201', 29.4689, -98.5284, 'America/Chicago'])
    const bad = parseVisitEvent(JSON.stringify({ ...event, la: 'north', lo: 999, z: 5 }))
    expect(bad).not.toBeNull()
    expect([bad!.la, bad!.lo, bad!.z]).toEqual([undefined, undefined, undefined])
  })
})
