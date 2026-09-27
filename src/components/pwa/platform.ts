/**
 * Which device and browser this is, and therefore HOW the site gets installed on it.
 * Pure functions of the user-agent, so every branch is tested with real strings.
 *
 * Why it matters: only Chrome-family browsers can show an install dialog from a
 * button. Everywhere else — every browser on an iPhone, Samsung Internet before
 * it fires its event, Safari on a Mac — installing is a menu the visitor has to
 * open, so the site's job is to say exactly which one. And an in-app browser
 * (Instagram, Facebook, TikTok) cannot install anything at all.
 *
 * Sources for the tokens: MDN's UA guide, Microsoft's Edge UA guidance, and the
 * inapp-spy rules (June 2026). Checked against WebKit's note that iOS 26 froze
 * the OS version in the UA at 18_6, so only Safari's `Version/` still moves.
 */
export type InApp = 'instagram' | 'facebook' | 'tiktok' | 'google' | 'linkedin' | 'snapchat' | 'webview'

export interface DevicePlatform {
  readonly os: 'ios' | 'android' | 'desktop'
  /** An iPad, including one that asks for the desktop site and reports as a Mac. */
  readonly ipad: boolean
  readonly mac: boolean
  readonly browser: 'safari' | 'chrome' | 'edge' | 'firefox' | 'samsung' | 'opera' | 'other'
  readonly inApp: InApp | null
  /** Safari's major version on Apple devices (`Version/26.0` → 26), where present. */
  readonly safariVersion: number | null
}

export function detectPlatform(userAgent: string, maxTouchPoints = 0): DevicePlatform {
  const ua = userAgent
  const ipad = /iPad/.test(ua) || (/Macintosh/.test(ua) && maxTouchPoints > 1)
  const ios = ipad || /iPhone|iPod/.test(ua)
  const android = !ios && /Android/.test(ua)
  const mac = !ios && /Macintosh/.test(ua)

  let inApp: InApp | null = null
  if (/\bInstagram/i.test(ua)) inApp = 'instagram'
  else if (/\bFB[\w_]+\/|\bFacebook/i.test(ua)) inApp = 'facebook'
  else if (/musical_ly|Bytedance|TikTok/i.test(ua)) inApp = 'tiktok'
  else if (/LinkedInApp/i.test(ua)) inApp = 'linkedin'
  else if (/Snapchat/i.test(ua)) inApp = 'snapchat'
  else if (ios && /\bGSA\//.test(ua)) inApp = 'google'
  // An embedded view: on iPhone there is no `Safari/` token, on Android a `; wv)`.
  // (An installed home-screen app has no `Safari/` token either; callers check
  // standalone mode before ever asking how to install.)
  else if ((ios && !/Safari\//.test(ua)) || (android && /; wv\)/.test(ua))) inApp = 'webview'

  let browser: DevicePlatform['browser'] = 'other'
  if (ios) {
    if (/CriOS\//.test(ua)) browser = 'chrome'
    else if (/EdgiOS\//.test(ua)) browser = 'edge'
    else if (/FxiOS\//.test(ua)) browser = 'firefox'
    else if (/OPT\/|OPiOS\//.test(ua)) browser = 'opera'
    else if (/Safari\//.test(ua)) browser = 'safari'
  } else if (/SamsungBrowser\//.test(ua)) browser = 'samsung'
  else if (/EdgA?\//.test(ua)) browser = 'edge'
  else if (/OPR\//.test(ua)) browser = 'opera'
  else if (/Firefox\//.test(ua)) browser = 'firefox'
  else if (/Chrome\//.test(ua)) browser = 'chrome'
  else if (/Safari\//.test(ua)) browser = 'safari'

  const version = /Version\/(\d+)/.exec(ua)
  return {
    os: ios ? 'ios' : android ? 'android' : 'desktop',
    ipad,
    mac,
    browser,
    inApp,
    safariVersion: (ios || mac) && version ? Number(version[1]) : null,
  }
}

/**
 * How installing works here.
 *
 *  prompt        the browser gave us its install dialog; one tap
 *  ios-safari    Share → Add to Home Screen, in Safari
 *  ios-browser   the same, from Chrome, Edge or Firefox on an iPhone (iOS 16.4+)
 *  in-app        cannot install; open the page in the real browser first
 *  android-menu  the browser menu's "Install app" / "Add to Home screen"
 *  desktop-menu  Chrome or Edge's address-bar install, before its event fired
 *  mac-dock      Safari 17+ on a Mac: File → Add to Dock
 *  none          this browser cannot install sites (Firefox on a computer)
 */
export type InstallMethod =
  | 'prompt'
  | 'ios-safari'
  | 'ios-browser'
  | 'in-app'
  | 'android-menu'
  | 'desktop-menu'
  | 'mac-dock'
  | 'none'

export function installMethodFor(platform: DevicePlatform, hasPrompt: boolean): InstallMethod {
  if (platform.inApp) return 'in-app'
  if (hasPrompt) return 'prompt'
  if (platform.os === 'ios') return platform.browser === 'safari' ? 'ios-safari' : 'ios-browser'
  if (platform.os === 'android') return 'android-menu'
  if (platform.browser === 'chrome' || platform.browser === 'edge') return 'desktop-menu'
  if (platform.mac && platform.browser === 'safari' && (platform.safariVersion ?? 0) >= 17) return 'mac-dock'
  return 'none'
}

/** Search engines and test robots never see the prompts. */
export function isLikelyBot(userAgent: string): boolean {
  return /bot|crawl|spider|slurp|lighthouse|headlesschrome|pagespeed|preview|facebookexternalhit|embedly|quora link/i.test(userAgent)
}
