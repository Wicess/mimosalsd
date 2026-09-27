import { describe, expect, it } from 'vitest'
import { detectPlatform, installMethodFor, isLikelyBot } from '@/components/pwa/platform'
import { stepsFor } from '@/components/pwa/install-guide'

/** Real user-agent strings, as each browser sends them. */
const UA = {
  // iOS 26 froze the OS version at 18_6; only Safari's Version/ moves.
  iphoneSafari26: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Mobile/15E148 Safari/604.1',
  iphoneSafari18: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1',
  // iPadOS asks for the desktop site by default and says Macintosh.
  ipadDesktopMode: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15',
  iphoneChrome: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/139.0.7258.76 Mobile/15E148 Safari/604.1',
  iphoneInstagram: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 390.0.0.28.85 (iPhone15,3; iOS 18_6; en_US; en; scale=3.00; 1290x2796; 745689)',
  iphoneFacebook: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [FBAN/FBIOS;FBAV/520.0.0.38.101;FBBV/7654321;FBDV/iPhone15,2]',
  iphoneTiktok: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 musical_ly_41.2.0 JsSdk/2.0 NetType/WIFI Channel/App Store ByteLocale/en Region/US',
  androidChrome: 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Mobile Safari/537.36',
  androidSamsung: 'Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/28.0 Chrome/130.0.0.0 Mobile Safari/537.36',
  androidWebview: 'Mozilla/5.0 (Linux; Android 14; Pixel 8; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/139.0.0.0 Mobile Safari/537.36',
  windowsChrome: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36',
  windowsEdge: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36 Edg/139.0.0.0',
  macSafari: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Safari/605.1.15',
  firefoxDesktop: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:142.0) Gecko/20100101 Firefox/142.0',
}

describe('detectPlatform', () => {
  it('reads iPhone Safari, including the iOS 26 version from Safari rather than the OS', () => {
    expect(detectPlatform(UA.iphoneSafari26)).toMatchObject({ os: 'ios', browser: 'safari', inApp: null, safariVersion: 26, ipad: false })
    expect(detectPlatform(UA.iphoneSafari18).safariVersion).toBe(18)
  })

  it('recognises an iPad that reports itself as a Mac, by its touch screen', () => {
    expect(detectPlatform(UA.ipadDesktopMode, 5)).toMatchObject({ os: 'ios', ipad: true, browser: 'safari' })
    expect(detectPlatform(UA.ipadDesktopMode, 0)).toMatchObject({ os: 'desktop', mac: true, browser: 'safari' })
  })

  it('tells Chrome on iPhone from Safari', () => {
    expect(detectPlatform(UA.iphoneChrome)).toMatchObject({ os: 'ios', browser: 'chrome', inApp: null })
  })

  it('spots the in-app browsers that cannot install', () => {
    expect(detectPlatform(UA.iphoneInstagram).inApp).toBe('instagram')
    expect(detectPlatform(UA.iphoneFacebook).inApp).toBe('facebook')
    expect(detectPlatform(UA.iphoneTiktok).inApp).toBe('tiktok')
    expect(detectPlatform(UA.androidWebview).inApp).toBe('webview')
  })

  it('reads Android and desktop browsers', () => {
    expect(detectPlatform(UA.androidChrome)).toMatchObject({ os: 'android', browser: 'chrome', inApp: null })
    expect(detectPlatform(UA.androidSamsung)).toMatchObject({ os: 'android', browser: 'samsung' })
    expect(detectPlatform(UA.windowsChrome)).toMatchObject({ os: 'desktop', browser: 'chrome' })
    expect(detectPlatform(UA.windowsEdge)).toMatchObject({ os: 'desktop', browser: 'edge' })
    expect(detectPlatform(UA.firefoxDesktop)).toMatchObject({ os: 'desktop', browser: 'firefox' })
  })
})

describe('installMethodFor', () => {
  const method = (ua: string, hasPrompt = false, touch = 0) => installMethodFor(detectPlatform(ua, touch), hasPrompt)

  it('uses the browser dialog whenever the browser offers one', () => {
    expect(method(UA.androidChrome, true)).toBe('prompt')
    expect(method(UA.windowsEdge, true)).toBe('prompt')
  })

  it('sends every iPhone browser to the Share sheet', () => {
    expect(method(UA.iphoneSafari26)).toBe('ios-safari')
    expect(method(UA.iphoneChrome)).toBe('ios-browser')
    expect(method(UA.ipadDesktopMode, false, 5)).toBe('ios-safari')
  })

  it('sends in-app browsers out to the real browser first, even with a prompt', () => {
    expect(method(UA.iphoneInstagram)).toBe('in-app')
    expect(method(UA.androidWebview, true)).toBe('in-app')
  })

  it('falls back to the menu, the Dock, or nothing', () => {
    expect(method(UA.androidSamsung)).toBe('android-menu')
    expect(method(UA.windowsChrome)).toBe('desktop-menu')
    expect(method('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15')).toBe('mac-dock')
    expect(method(UA.firefoxDesktop)).toBe('none')
  })
})

describe('the install guide steps', () => {
  const text = (node: unknown): string => {
    if (node == null || typeof node === 'boolean') return ''
    if (typeof node === 'string' || typeof node === 'number') return String(node)
    if (Array.isArray(node)) return node.map(text).join('')
    const element = node as { type?: unknown; props?: { children?: unknown; 'aria-label'?: string } }
    if (typeof element.type === 'function') return text((element.type as (p: unknown) => unknown)(element.props))
    const props = element.props
    return props?.['aria-label'] ? `[${props['aria-label']}]` : text(props?.children)
  }
  const stepsText = (ua: string, touch = 0) => {
    const platform = detectPlatform(ua, touch)
    const { steps, pointer } = stepsFor(installMethodFor(platform, false), platform)
    return { lines: steps.map((s) => text(s.text) + (s.hint ? ` (${text(s.hint)})` : '')), pointer }
  }

  it('iOS 26 Safari: ••• then Share, Add to Home Screen, Open as Web App — arrow at the bottom right', () => {
    const { lines, pointer } = stepsText(UA.iphoneSafari26)
    expect(lines[0]).toContain('[More]')
    expect(lines[0]).toContain('Share')
    expect(lines[1]).toContain('Add to Home Screen')
    expect(lines[2]).toContain('Open as Web App')
    expect(pointer).toBe('right')
  })

  it('older iPhone Safari: Share in the bottom toolbar — arrow in the middle', () => {
    const { lines, pointer } = stepsText(UA.iphoneSafari18)
    expect(lines[0]).toContain('bottom of the screen')
    expect(lines[2]).not.toContain('Open as Web App')
    expect(pointer).toBe('center')
  })

  it('iPad: Share at the top right, no arrow', () => {
    const { lines, pointer } = stepsText(UA.ipadDesktopMode, 5)
    expect(lines[0]).toContain('top right')
    expect(pointer).toBeNull()
  })

  it('Instagram: open in Safari first', () => {
    const { lines } = stepsText(UA.iphoneInstagram)
    expect(lines.join(' ')).toContain('Instagram')
    expect(lines.join(' ')).toContain('Open in Safari')
  })

  it('Samsung Internet: its own menu', () => {
    expect(stepsText(UA.androidSamsung).lines[0]).toContain('≡')
  })
})

describe('isLikelyBot', () => {
  it('keeps crawlers and audit tools away from the prompts', () => {
    expect(isLikelyBot('Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)')).toBe(true)
    expect(isLikelyBot('Mozilla/5.0 (Linux; Android 11; moto g power (2022)) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Mobile Safari/537.36 Chrome-Lighthouse')).toBe(true)
    expect(isLikelyBot(UA.iphoneSafari26)).toBe(false)
  })
})
