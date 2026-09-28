import { NextRequest, NextResponse } from 'next/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { trackVisit } from '@/lib/visitors/track'
import { bufferedCount, resetBuffer, setSettleWaitForTests } from '@/lib/visitors/buffer'
import { VISITOR_COOKIE } from '@/lib/visitors/cookie'
import { CRAWLER_VISITOR, type VisitEvent } from '@/lib/visitors/page-view'

const ORIGIN = 'https://shop.test'
const VID = '0f8fad5b-d9cb-469f-a165-70867728950e'
const SECRET = 's'.repeat(40)
const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 Version/17.4 Mobile/15E148 Safari/604.1'
const previous = process.env.ADMIN_SESSION_SECRET

let stored: VisitEvent[] = []

beforeEach(() => {
  process.env.ADMIN_SESSION_SECRET = SECRET
  stored = []
  resetBuffer()
  // The settle wait fires at once: a view is sent a few seconds after it arrives.
  setSettleWaitForTests(() => Promise.resolve())
  vi.stubGlobal('fetch', async (url: string | URL, init?: RequestInit) => {
    if (String(url).includes('/api/visits/collect')) {
      stored.push(...(JSON.parse(String(init?.body)) as { events: VisitEvent[] }).events)
      return new Response('{}', { status: 200 })
    }
    return Response.json({ ips: [] }) // the blocklist endpoint, for the proxy tests
  })
})

afterEach(() => {
  process.env.ADMIN_SESSION_SECRET = previous
  resetBuffer()
  vi.unstubAllGlobals()
})

async function track(path: string, headers: Record<string, string> = {}, cookie?: string) {
  const request = new NextRequest(`${ORIGIN}${path}`, {
    headers: { 'user-agent': IPHONE, 'sec-fetch-dest': 'document', ...headers, ...(cookie ? { cookie } : {}) },
  })
  const response = NextResponse.next()
  const pending: Promise<unknown>[] = []
  trackVisit(request, response, (promise) => pending.push(promise))
  await Promise.all(pending)
  return { response, sends: pending.length }
}

describe('trackVisit', () => {
  it('records a first visit and gives the browser its visitor cookie', async () => {
    const { response, sends } = await track('/shop?utm_source=news')
    // Sent under waitUntil once the settle wait is over, not held until some other
    // request happens to reach this instance (owner, 2026-09-19: views were lost).
    expect(sends).toBe(1)
    expect(stored).toHaveLength(1)
    expect(bufferedCount()).toBe(0)
    const minted = response.cookies.get(VISITOR_COOKIE)
    expect(minted?.value).toMatch(/^[0-9a-f-]{36}$/)
    expect(minted?.httpOnly).toBe(true)
  })

  it('sends every view under waitUntil, never on the request path', async () => {
    for (let i = 0; i < 25; i++) {
      const { sends } = await track('/shop')
      expect(sends).toBe(1) // handed to waitUntil, never awaited on the request path
    }
    expect(stored).toHaveLength(25)
    expect(stored[0]).toMatchObject({ p: '/shop', d: 'mobile' })
    expect(bufferedCount()).toBe(0)
  })

  it('reuses the cookie chat already set, without setting another', async () => {
    const { response } = await track('/', {}, `${VISITOR_COOKIE}=${VID}`)
    expect(response.cookies.get(VISITOR_COOKIE)).toBeUndefined()
    for (let i = 0; i < 24; i++) await track('/', {}, `${VISITOR_COOKIE}=${VID}`)
    expect(stored[0]?.v).toBe(VID)
    expect(stored[0]?.n).toBeUndefined()
  })

  it('counts a crawler by name and gives it no cookie', async () => {
    const crawler = { 'user-agent': 'Mozilla/5.0 (compatible; ClaudeBot/1.0)' }
    const { response } = await track('/', crawler)
    expect(response.cookies.get(VISITOR_COOKIE)).toBeUndefined()
    for (let i = 0; i < 24; i++) await track('/', crawler)
    expect(stored[0]).toMatchObject({ v: CRAWLER_VISITOR, k: 'ClaudeBot' })
  })

  it('ignores prefetches and the admin', async () => {
    await track('/shop', { rsc: '1', 'next-router-prefetch': '1' })
    await track('/admin/orders')
    expect(bufferedCount()).toBe(0)
  })

  it('does nothing at all — no cookie, nothing held — without the admin secret', async () => {
    delete process.env.ADMIN_SESSION_SECRET
    const { response } = await track('/')
    expect(response.cookies.get(VISITOR_COOKIE)).toBeUndefined()
    expect(bufferedCount()).toBe(0)
  })

  it('never lets a failed send reach the visitor', async () => {
    vi.stubGlobal('fetch', async () => {
      throw new Error('collector down')
    })
    for (let i = 0; i < 25; i++) await expect(track('/')).resolves.toBeDefined()
  })
})

describe('the proxy counts only pages it actually serves', () => {
  const run = async (path: string, headers: Record<string, string> = {}) => {
    const { proxy } = await import('@/proxy')
    const pending: Promise<unknown>[] = []
    const response = await proxy(
      new NextRequest(`${ORIGIN}${path}`, { headers: { 'user-agent': IPHONE, 'sec-fetch-dest': 'document', ...headers } }),
      { waitUntil: (p: Promise<unknown>) => pending.push(p) } as never,
    )
    await Promise.all(pending)
    return response
  }

  it('counts a real page', async () => {
    expect((await run('/shop/amanita')).status).toBe(200)
    expect(stored).toHaveLength(1)
  })

  it('does not count a 404', async () => {
    expect((await run('/where-we-ship/atlantis')).status).toBe(404)
    expect(bufferedCount()).toBe(0)
    expect(stored).toHaveLength(0)
  })

  it('records an order page by its route, never its token', async () => {
    await run('/order/abc123secrettoken')
    for (let i = 0; i < 24; i++) await run('/order/abc123secrettoken')
    expect(stored[0]?.p).toBe('/order/[token]')
    expect(JSON.stringify(stored)).not.toContain('abc123secrettoken')
  })
})
