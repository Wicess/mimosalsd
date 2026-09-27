/*
 * ─────────────────────────────────────────────────────────────────────────────
 *  SERVICE WORKER — installability, an offline page, and push notifications.
 *
 *  ── What it must never do ──────────────────────────────────────────────────
 *  Serve a cached page. What may lawfully ship to a state is edited in the admin
 *  and takes effect on the next request; prices and stock move the same way. A
 *  cached HTML page would tell someone we ship what we no longer ship. So every
 *  document goes to the network, and the cache holds exactly one page: the one
 *  shown when there is no network at all.
 *
 *  Build assets under /_next/static are content-hashed — a changed file has a
 *  changed URL — so they are safe to keep, and serving them from the cache saves
 *  a request on every visit, which is also the one meter this site pays by.
 *
 *  Nothing else is cached, and /public in particular is not: the logo and the
 *  photographs keep their filenames when they are replaced, so a cached copy
 *  would pin the old picture on a returning visitor until this file changed.
 *
 *  The admin, the API and tracking links are never intercepted: an operator must
 *  always be talking to the live server, and /r/ exists to be counted.
 *
 *  ── Push ──────────────────────────────────────────────────────────────────
 *  A push arrives here even when no page of the site is open, and every one of
 *  them MUST end in a visible notification: Safari revokes the subscription of a
 *  site that receives a push and shows nothing, and Chrome shows its own generic
 *  "site updated in the background" instead. So a push with a payload this file
 *  cannot read still shows something. The payload is built by lib/push/payload.ts.
 *
 *  Plain JavaScript on purpose: it is served from /public as-is, with no build
 *  step between what is written here and what runs.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const VERSION = 'v2'
const CACHE = `mimosalsd-${VERSION}`
const OFFLINE_URL = '/offline'

/** Which of the three behaviours a request gets. Kept pure, and tested. */
function strategyFor(url, request) {
  if (request.method !== 'GET') return 'ignore'
  if (url.origin !== self.location.origin) return 'ignore'
  if (
    url.pathname === '/sw.js' ||
    url.pathname.startsWith('/admin') ||
    url.pathname.startsWith('/api/') ||
    url.pathname.startsWith('/r/')
  ) {
    return 'ignore'
  }
  if (url.pathname.startsWith('/_next/static/')) return 'asset'
  return request.mode === 'navigate' ? 'document' : 'ignore'
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.add(new Request(OFFLINE_URL, { cache: 'reload' })))
      .then(() => self.skipWaiting())
      .catch(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url)
  const strategy = strategyFor(url, event.request)
  if (strategy === 'ignore') return

  if (strategy === 'asset') {
    event.respondWith(
      caches.open(CACHE).then(async (cache) => {
        const hit = await cache.match(event.request)
        if (hit) return hit
        const response = await fetch(event.request)
        if (response.ok) cache.put(event.request, response.clone())
        return response
      }),
    )
    return
  }

  // A document: the network decides, always. The cache is the last resort.
  event.respondWith(
    fetch(event.request).catch(async () => {
      const cached = await caches.match(OFFLINE_URL)
      return (
        cached ??
        new Response('You are offline.', { status: 503, headers: { 'content-type': 'text/plain; charset=utf-8' } })
      )
    }),
  )
})

const APP_ICON = '/brand/app-icon-192.png'
// Android draws this white-on-transparent in the status bar, the way it draws every
// messaging app's small icon. Other platforms ignore it.
const STATUS_BAR_BADGE = '/brand/notification-badge-96.png'

/** A same-site path to open, never another site. Kept pure, and tested. */
function notificationTarget(data) {
  const fallback = data && data.tag === 'chat-reply' ? '/account/chat' : '/'
  const raw = data && typeof data.url === 'string' ? data.url : fallback
  try {
    const url = new URL(raw, self.location.origin)
    return url.origin === self.location.origin ? url.href : new URL(fallback, self.location.origin).href
  } catch {
    return new URL(fallback, self.location.origin).href
  }
}

/** What to show for one push. Kept pure, and tested. */
function notificationFor(payload) {
  const data = payload && typeof payload === 'object' ? payload : {}
  const title = typeof data.title === 'string' && data.title ? data.title : 'MIMOSALSD'
  const options = {
    body: typeof data.body === 'string' ? data.body : '',
    icon: APP_ICON,
    badge: STATUS_BAR_BADGE,
    // Buzz like a message arriving. Ignored where the platform decides for itself.
    vibrate: [180, 80, 180],
    timestamp: Date.now(),
    data: { url: notificationTarget(data), tag: typeof data.tag === 'string' ? data.tag : undefined },
  }
  if (typeof data.tag === 'string' && data.tag) {
    // Same tag: replace the earlier notification rather than stack another, and
    // still alert, so a second reply in a conversation is not silent.
    options.tag = data.tag
    options.renotify = true
  }
  return { title, options, badgeCount: typeof data.badgeCount === 'number' ? data.badgeCount : 0 }
}

function readPayload(event) {
  if (!event.data) return {}
  try {
    return event.data.json()
  } catch {
    try {
      return { body: event.data.text() }
    } catch {
      return {}
    }
  }
}

self.addEventListener('push', (event) => {
  const { title, options, badgeCount } = notificationFor(readPayload(event))
  const shown = self.registration.showNotification(title, options)
  // The red count on the app icon, where the platform has one (an installed app on
  // iPhone, Android launchers that show dots, desktop Chrome and Edge).
  const badge =
    badgeCount > 0 && self.navigator && typeof self.navigator.setAppBadge === 'function'
      ? self.navigator.setAppBadge(badgeCount).catch(() => {})
      : Promise.resolve()
  event.waitUntil(Promise.all([shown, badge]))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const target = notificationTarget(event.notification.data)
  event.waitUntil(
    (async () => {
      if (self.navigator && typeof self.navigator.clearAppBadge === 'function') {
        await self.navigator.clearAppBadge().catch(() => {})
      }
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      // Reuse an open window of the site, the way a messaging app comes to the front
      // rather than opening a second copy of itself.
      const open = windows.find((client) => new URL(client.url).origin === self.location.origin)
      if (open) {
        try {
          const focused = await open.focus()
          if (open.url !== target && typeof focused.navigate === 'function') await focused.navigate(target)
          return
        } catch {
          // An uncontrolled window cannot be navigated from here; open the page instead.
        }
      }
      await self.clients.openWindow(target)
    })(),
  )
})

/*
 * The browser replaced its push subscription (keys expire or are rotated). Without
 * this the old endpoint starts failing and the person silently stops receiving
 * anything until they turn notifications on again by hand.
 */
self.addEventListener('pushsubscriptionchange', (event) => {
  event.waitUntil(
    (async () => {
      const response = await fetch('/api/push/subscribe', { credentials: 'same-origin' })
      if (!response.ok) return
      const { publicKey } = await response.json()
      const padded = (publicKey + '==='.slice((publicKey.length + 3) % 4)).replace(/-/g, '+').replace(/_/g, '/')
      const key = Uint8Array.from(atob(padded), (c) => c.charCodeAt(0))
      const subscription =
        event.newSubscription ||
        (await self.registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key }))
      await fetch('/api/push/subscribe', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...subscription.toJSON(),
          replaces: event.oldSubscription ? event.oldSubscription.endpoint : undefined,
        }),
      })
    })().catch(() => {}),
  )
})
