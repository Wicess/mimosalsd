/**
 * What goes inside a push, and where a push may be sent. Pure, and tested.
 *
 * The service worker (public/sw.js) reads exactly these fields. Keep the two in
 * step: a field added here that the worker does not read is simply ignored.
 */
export interface PushMessage {
  readonly title: string
  readonly body: string
  /** A path on this site. Tapping the notification opens it. */
  readonly url: string
  /**
   * Replaces an earlier notification with the same tag instead of stacking a new
   * one, and still buzzes (the worker sets `renotify`). One tag per chat thread is
   * what makes replies behave like a messaging app.
   */
  readonly tag?: string
  /** Shown as the red count on the app icon where the platform supports it. */
  readonly badgeCount?: number
}

export const TITLE_MAX = 80
export const BODY_MAX = 240

function clip(value: string, max: number): string {
  const clean = value.replace(/\s+/g, ' ').trim()
  return clean.length > max ? `${clean.slice(0, max - 1).trimEnd()}…` : clean
}

/**
 * A same-site path, or `/`. Absolute URLs to this site are reduced to their path;
 * anything else — another host, `javascript:`, a protocol-relative `//evil` — is
 * dropped, so a notification can only ever open this site.
 */
export function safePushPath(value: string | null | undefined, siteOrigin: string): string {
  const raw = (value ?? '').trim()
  if (!raw) return '/'
  try {
    const parsed = new URL(raw, siteOrigin)
    if (parsed.origin !== new URL(siteOrigin).origin) return '/'
    if (raw.startsWith('//') || raw.startsWith('\\')) return '/'
    return `${parsed.pathname}${parsed.search}${parsed.hash}`
  } catch {
    return '/'
  }
}

export function buildPayload(message: PushMessage, siteOrigin: string): string {
  const payload: Record<string, unknown> = {
    title: clip(message.title, TITLE_MAX) || 'SnypeGate',
    body: clip(message.body, BODY_MAX),
    url: safePushPath(message.url, siteOrigin),
  }
  if (message.tag) payload.tag = message.tag.slice(0, 64)
  if (typeof message.badgeCount === 'number' && message.badgeCount > 0) payload.badgeCount = Math.min(99, Math.floor(message.badgeCount))
  return JSON.stringify(payload)
}

/**
 * The browser push services. The server makes an outbound request to whatever
 * endpoint a subscription names, so accepting any URL would let anyone point this
 * server at an address of their choosing. Only these hosts are accepted:
 * Google (Chrome, Edge on Android, Samsung Internet, Opera, Brave), Mozilla,
 * Apple (Safari on iPhone, iPad and Mac) and Microsoft (Edge on Windows).
 */
const PUSH_HOST_SUFFIXES = ['.googleapis.com', '.mozilla.com', '.push.apple.com', '.notify.windows.com'] as const

export function isAllowedPushEndpoint(endpoint: string): boolean {
  let parsed: URL
  try {
    parsed = new URL(endpoint)
  } catch {
    return false
  }
  if (parsed.protocol !== 'https:' || parsed.username || parsed.password || parsed.port) return false
  const host = parsed.hostname.toLowerCase()
  return PUSH_HOST_SUFFIXES.some((suffix) => host.endsWith(suffix) && host.length > suffix.length)
}

/** ios | android | desktop, from the user-agent at subscribe time. Nothing finer is kept. */
export function platformFromUserAgent(userAgent: string | null | undefined): 'ios' | 'android' | 'desktop' {
  const ua = userAgent ?? ''
  if (/iPhone|iPad|iPod/i.test(ua)) return 'ios'
  if (/Android/i.test(ua)) return 'android'
  // iPadOS asks for the desktop site and reports as a Mac; the client says so explicitly.
  return 'desktop'
}
