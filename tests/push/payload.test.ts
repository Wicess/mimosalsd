import { describe, expect, it } from 'vitest'
import { BODY_MAX, buildPayload, isAllowedPushEndpoint, platformFromUserAgent, safePushPath, TITLE_MAX } from '@/lib/push/payload'

const SITE = 'https://www.mimosalsd.com'

describe('safePushPath', () => {
  it('keeps a path on this site, with its query and hash', () => {
    expect(safePushPath('/order/abc?x=1#pay', SITE)).toBe('/order/abc?x=1#pay')
    expect(safePushPath('shop', SITE)).toBe('/shop')
    expect(safePushPath('https://www.mimosalsd.com/faq', SITE)).toBe('/faq')
  })

  it('never lets a notification open another site', () => {
    for (const hostile of ['https://evil.test/', '//evil.test/x', '\\\\evil.test', 'javascript:alert(1)', 'data:text/html,hi']) {
      expect(safePushPath(hostile, SITE), hostile).toBe('/')
    }
    expect(safePushPath('', SITE)).toBe('/')
    expect(safePushPath(null, SITE)).toBe('/')
  })
})

describe('buildPayload', () => {
  it('produces exactly the fields the service worker reads', () => {
    const json = JSON.parse(buildPayload({ title: ' New  reply ', body: 'Hello\nthere', url: '/account/chat', tag: 'chat-reply', badgeCount: 2 }, SITE))
    expect(json).toEqual({ title: 'New reply', body: 'Hello there', url: '/account/chat', tag: 'chat-reply', badgeCount: 2 })
  })

  it('clips long text so the encrypted message stays inside a push service limit', () => {
    const json = JSON.parse(buildPayload({ title: 'T'.repeat(500), body: 'B'.repeat(5000), url: '/' }, SITE))
    expect(json.title.length).toBe(TITLE_MAX)
    expect(json.body.length).toBe(BODY_MAX)
    expect(json.body.endsWith('…')).toBe(true)
    expect(Buffer.byteLength(JSON.stringify(json))).toBeLessThan(3000)
  })

  it('falls back to the brand name for an empty title and leaves out empty extras', () => {
    const json = JSON.parse(buildPayload({ title: '   ', body: '', url: 'https://evil.test', badgeCount: 0 }, SITE))
    expect(json).toEqual({ title: 'MIMOSALSD', body: '', url: '/' })
  })
})

describe('isAllowedPushEndpoint', () => {
  it('accepts the real browser push services', () => {
    for (const endpoint of [
      'https://fcm.googleapis.com/fcm/send/dQw4w9WgXcQ:APA91b',
      'https://updates.push.services.mozilla.com/wpush/v2/gAAAA',
      'https://web.push.apple.com/QGuQyavXutnMH',
      'https://wns2-par02p.notify.windows.com/w/?token=BQYAAAB',
    ]) {
      expect(isAllowedPushEndpoint(endpoint), endpoint).toBe(true)
    }
  })

  /* The server POSTs to whatever a subscription names; it must not be pointable at anything else. */
  it('refuses anything else the server could be made to call', () => {
    for (const endpoint of [
      'http://fcm.googleapis.com/fcm/send/x',
      'https://169.254.169.254/latest/meta-data',
      'https://localhost/push',
      'https://googleapis.com.evil.test/x',
      'https://evilgoogleapis.com/x',
      'https://.googleapis.com/x',
      'https://user:pw@fcm.googleapis.com/x',
      'https://fcm.googleapis.com:8443/x',
      'not a url',
    ]) {
      expect(isAllowedPushEndpoint(endpoint), endpoint).toBe(false)
    }
  })
})

describe('platformFromUserAgent', () => {
  it('sorts phones from computers', () => {
    expect(platformFromUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15')).toBe('ios')
    expect(platformFromUserAgent('Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36')).toBe('android')
    expect(platformFromUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64)')).toBe('desktop')
    expect(platformFromUserAgent(null)).toBe('desktop')
  })
})
