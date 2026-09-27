import { readFileSync } from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { describe, expect, it } from 'vitest'

/**
 * The real public/sw.js, run in a sandbox with a stand-in `self`.
 *
 * It is plain JavaScript served as-is, so there is no module to import: the file
 * is executed here exactly as a browser would and its listeners captured, then its
 * fetch handler is called with the few fields it actually reads. A copy of the
 * rules in a test would only prove the copy agrees with itself.
 */
const ORIGIN = 'https://snypegate.test'

function loadWorker() {
  const source = readFileSync(path.join(process.cwd(), 'public/sw.js'), 'utf8')
  const listeners = new Map<string, (event: unknown) => void>()
  const cache = {
    entries: new Map<string, Response>(),
    async match(request: Request | string) {
      const key = typeof request === 'string' ? new URL(request, ORIGIN).toString() : request.url
      return this.entries.get(key)
    },
    async put(request: Request, response: Response) {
      this.entries.set(request.url, response)
    },
    async add() {},
  }
  const shown: { title: string; options: Record<string, unknown> }[] = []
  const opened: string[] = []
  const badges: number[] = []
  const windows: { url: string; focus: () => Promise<unknown>; navigate?: (url: string) => Promise<unknown> }[] = []
  const self = {
    location: { origin: ORIGIN },
    addEventListener: (type: string, handler: (event: unknown) => void) => listeners.set(type, handler),
    skipWaiting: async () => {},
    clients: {
      claim: async () => {},
      matchAll: async () => windows,
      openWindow: async (url: string) => {
        opened.push(url)
      },
    },
    registration: {
      showNotification: async (title: string, options: Record<string, unknown>) => {
        shown.push({ title, options })
      },
    },
    navigator: {
      setAppBadge: async (count: number) => {
        badges.push(count)
      },
      clearAppBadge: async () => {
        badges.push(0)
      },
    },
  }
  const caches = {
    async open() {
      return cache
    },
    async match(request: Request | string) {
      return cache.match(request)
    },
    async keys() {
      return []
    },
    async delete() {
      return true
    },
  }

  let fetched: Request[] = []
  let networkFails = false
  const context = vm.createContext({
    self,
    caches,
    Request,
    Response,
    URL,
    fetch: async (request: Request) => {
      fetched.push(request)
      if (networkFails) throw new Error('offline')
      return new Response('live', { status: 200 })
    },
  })
  vm.runInContext(source, context)

  /** What the worker does with one request: the response, or null if it ignored it. */
  async function handle(url: string, init: { method?: string; mode?: string } = {}) {
    // A stub, not a Request: Node refuses to construct mode 'navigate', which is
    // exactly the mode a page load has and the one the worker branches on.
    const request = { url: new URL(url, ORIGIN).toString(), method: init.method ?? 'GET', mode: init.mode ?? 'no-cors' }
    // Held on an object: TypeScript cannot see that a callback assigns to a local.
    const captured: { response?: Promise<Response> } = {}
    listeners.get('fetch')?.({
      request,
      respondWith: (value: Promise<Response>) => {
        captured.response = value
      },
    })
    return captured.response ? await captured.response : null
  }

  /** Dispatch a push or a notification tap, and wait for everything the worker started. */
  async function dispatch(type: 'push' | 'notificationclick', event: Record<string, unknown>) {
    const pending: Promise<unknown>[] = []
    listeners.get(type)?.({ ...event, waitUntil: (value: Promise<unknown>) => pending.push(value) })
    await Promise.all(pending)
  }

  return {
    handle,
    dispatch,
    shown,
    opened,
    badges,
    windows,
    cache,
    get fetched() {
      return fetched
    },
    goOffline() {
      networkFails = true
    },
    reset() {
      fetched = []
    },
  }
}

/** What a browser sets for a page load. */
const PAGE = { mode: 'navigate' }

describe('the service worker', () => {
  it('leaves the admin, the API and tracking links entirely alone', async () => {
    const worker = loadWorker()
    for (const url of ['/admin', '/admin/orders', '/api/chat', '/r/reddit-dye', '/sw.js']) {
      expect(await worker.handle(url, PAGE), url).toBeNull()
    }
  })

  it('ignores other origins and anything that is not a GET', async () => {
    const worker = loadWorker()
    expect(await worker.handle('https://other.test/thing', PAGE)).toBeNull()
    expect(await worker.handle('/checkout', { method: 'POST', mode: 'navigate' })).toBeNull()
  })

  /*
    What may lawfully ship to a state is edited in the admin and takes effect on
    the next request. A cached page would tell someone we ship what we do not.
  */
  it('never answers a page from the cache while there is a network', async () => {
    const worker = loadWorker()
    const first = await worker.handle('/shop/amanita', PAGE)
    expect(await first?.text()).toBe('live')
    worker.reset()
    await worker.handle('/shop/amanita', PAGE)
    expect(worker.fetched).toHaveLength(1) // asked the network again, every time
    expect(worker.cache.entries.size).toBe(0) // and kept nothing
  })

  it('falls back to the offline page only when the network is gone', async () => {
    const worker = loadWorker()
    worker.cache.entries.set(`${ORIGIN}/offline`, new Response('offline page', { status: 200 }))
    worker.goOffline()
    const response = await worker.handle('/shop/amanita', PAGE)
    expect(await response?.text()).toBe('offline page')
  })

  it('says so plainly when even the offline page is missing', async () => {
    const worker = loadWorker()
    worker.goOffline()
    const response = await worker.handle('/', PAGE)
    expect(response?.status).toBe(503)
    expect(await response?.text()).toMatch(/offline/i)
  })

  /*
    /public keeps its filenames when a file is replaced — the logo, the founder's
    portrait — so a cached copy would pin the old picture on a returning visitor.
  */
  it('does not cache anything outside the content-hashed build output', async () => {
    const worker = loadWorker()
    expect(await worker.handle('/brand/logo.png')).toBeNull()
    expect(await worker.handle('/videos/hero.webm')).toBeNull()
    expect(worker.cache.entries.size).toBe(0)
  })

  it('keeps content-hashed build assets and serves them from the cache', async () => {
    const worker = loadWorker()
    const asset = '/_next/static/chunks/main-abc123.js'
    expect(await (await worker.handle(asset))?.text()).toBe('live')
    expect(worker.cache.entries.size).toBe(1)
    worker.reset()
    expect(await (await worker.handle(asset))?.text()).toBe('live')
    expect(worker.fetched).toHaveLength(0) // second time, no request at all
  })

  describe('push notifications', () => {
    const pushOf = (payload: unknown) => ({
      data: {
        json: () => (typeof payload === 'string' ? JSON.parse(payload) : payload),
        text: () => String(payload),
      },
    })

    it('shows the message with the app icon, the status-bar badge and where to go', async () => {
      const worker = loadWorker()
      await worker.dispatch('push', pushOf({ title: 'New reply from SnypeGate', body: 'Your order is packed', url: '/account/chat', tag: 'chat-reply' }))
      expect(worker.shown).toHaveLength(1)
      const { title, options } = worker.shown[0]!
      expect(title).toBe('New reply from SnypeGate')
      expect(options.body).toBe('Your order is packed')
      expect(options.icon).toBe('/brand/app-icon-192.png')
      expect(options.badge).toBe('/brand/notification-badge-96.png')
      expect(options.tag).toBe('chat-reply')
      expect(options.renotify).toBe(true)
      expect((options.data as { url: string }).url).toBe(`${ORIGIN}/account/chat`)
    })

    /* Safari revokes the subscription of a site that receives a push and shows nothing. */
    it('still shows a notification when the payload is empty or unreadable', async () => {
      const worker = loadWorker()
      await worker.dispatch('push', {})
      await worker.dispatch('push', { data: { json: () => { throw new Error('not json') }, text: () => 'plain words' } })
      expect(worker.shown.map((n) => n.title)).toEqual(['SnypeGate', 'SnypeGate'])
      expect(worker.shown[1]!.options.body).toBe('plain words')
      expect(worker.shown[0]!.options.renotify).toBeUndefined()
    })

    it('never opens another site, whatever the payload says', async () => {
      const worker = loadWorker()
      await worker.dispatch('push', pushOf({ title: 'x', url: 'https://evil.test/login' }))
      await worker.dispatch('push', pushOf({ title: 'x', url: 'javascript:alert(1)' }))
      await worker.dispatch('push', pushOf({ title: 'x', tag: 'chat-reply' }))
      const urls = worker.shown.map((n) => (n.options.data as { url: string }).url)
      expect(urls[0]).toBe(`${ORIGIN}/`)
      expect(urls[1]).not.toContain('javascript')
      expect(urls[2]).toBe(`${ORIGIN}/account/chat`)
    })

    it('sets the app-icon count when the message carries one', async () => {
      const worker = loadWorker()
      await worker.dispatch('push', pushOf({ title: 'x', badgeCount: 3 }))
      expect(worker.badges).toEqual([3])
    })

    it('opens the page on tap when no window of the site is open', async () => {
      const worker = loadWorker()
      let closed = false
      await worker.dispatch('notificationclick', {
        notification: { data: { url: `${ORIGIN}/order/abc` }, close: () => { closed = true } },
      })
      expect(closed).toBe(true)
      expect(worker.opened).toEqual([`${ORIGIN}/order/abc`])
      expect(worker.badges).toEqual([0])
    })

    it('brings an open window forward and takes it to the page instead of opening a second one', async () => {
      const worker = loadWorker()
      const visited: string[] = []
      const win = {
        url: `${ORIGIN}/shop`,
        focus: async () => win,
        navigate: async (url: string) => {
          visited.push(url)
        },
      }
      worker.windows.push(win)
      await worker.dispatch('notificationclick', {
        notification: { data: { url: `${ORIGIN}/account/chat` }, close: () => {} },
      })
      expect(visited).toEqual([`${ORIGIN}/account/chat`])
      expect(worker.opened).toEqual([])
    })

    it('opens the page when the open window cannot be navigated', async () => {
      const worker = loadWorker()
      const win = {
        url: `${ORIGIN}/shop`,
        focus: async () => win,
        navigate: async () => {
          throw new TypeError('not controlled')
        },
      }
      worker.windows.push(win)
      await worker.dispatch('notificationclick', { notification: { data: { url: `${ORIGIN}/faq` }, close: () => {} } })
      expect(worker.opened).toEqual([`${ORIGIN}/faq`])
    })
  })
})
