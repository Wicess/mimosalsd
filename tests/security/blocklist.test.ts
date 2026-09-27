import { NextRequest } from 'next/server'
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  BLOCKED_IPS_PATH,
  BLOCKLIST_TOKEN_HEADER,
  blocklistExempt,
  blocklistToken,
  isBlockedIp,
  resetBlocklistCache,
} from '@/lib/security/blocklist'

const ORIGIN = 'https://shop.test'
const SECRET = 's'.repeat(40)
const previousSecret = process.env.ADMIN_SESSION_SECRET

beforeEach(() => {
  process.env.ADMIN_SESSION_SECRET = SECRET
  resetBlocklistCache()
  vi.unstubAllGlobals()
})

afterAll(() => {
  process.env.ADMIN_SESSION_SECRET = previousSecret
  vi.unstubAllGlobals()
})

/** A fetcher serving a fixed list, recording each call and the headers it sent. */
function endpoint(ips: string[] | null, status = 200) {
  const calls: { url: string; token: string | null }[] = []
  const fetcher = async (input: URL, init?: RequestInit) => {
    calls.push({ url: input.toString(), token: new Headers(init?.headers).get(BLOCKLIST_TOKEN_HEADER) })
    return Response.json({ ips }, { status })
  }
  return { fetcher, calls }
}

describe('blocklistExempt', () => {
  it('never blocks the list endpoint itself — the proxy would wait on its own refresh', () => {
    expect(blocklistExempt(BLOCKED_IPS_PATH)).toBe(true)
  })

  it('never blocks the admin, so an operator can always unblock', () => {
    for (const path of ['/admin', '/admin/login', '/admin/visitors/blocked', '/api/admin/chat/x']) {
      expect(blocklistExempt(path)).toBe(true)
    }
  })

  it('applies everywhere else, API routes included', () => {
    for (const path of ['/', '/checkout', '/product/x', '/api/chat', '/administrator', '/api/security/other']) {
      expect(blocklistExempt(path)).toBe(false)
    }
  })
})

describe('isBlockedIp', () => {
  it('answers from the list, proving the request is the proxy’s own', async () => {
    const { fetcher, calls } = endpoint(['203.0.113.7'])
    expect(await isBlockedIp('203.0.113.7', ORIGIN, { now: 0, fetcher })).toBe(true)
    expect(await isBlockedIp('198.51.100.1', ORIGIN, { now: 1, fetcher })).toBe(false)
    expect(calls).toHaveLength(1)
    expect(calls[0]?.url).toBe(`${ORIGIN}${BLOCKED_IPS_PATH}`)
    expect(calls[0]?.token).toBe(blocklistToken(SECRET))
  })

  /*
    The slug snapshots recheck a miss after ten seconds. Here nearly every lookup
    is a miss, so that would be a refetch every ten seconds under normal traffic.
  */
  it('trusts a miss for the whole minute, then refreshes once', async () => {
    const { fetcher, calls } = endpoint(['203.0.113.7'])
    await isBlockedIp('198.51.100.1', ORIGIN, { now: 0, fetcher })
    for (const now of [10_000, 30_000, 59_999]) {
      expect(await isBlockedIp('198.51.100.1', ORIGIN, { now, fetcher })).toBe(false)
    }
    expect(calls).toHaveLength(1)
    await isBlockedIp('198.51.100.1', ORIGIN, { now: 60_000, fetcher })
    expect(calls).toHaveLength(2)
  })

  it('fails open: unknown when the endpoint errors or answers nonsense', async () => {
    expect(await isBlockedIp('203.0.113.7', ORIGIN, { now: 0, fetcher: endpoint(null, 503).fetcher })).toBe('unknown')
    resetBlocklistCache()
    const garbage = async () => Response.json({ nope: true })
    expect(await isBlockedIp('203.0.113.7', ORIGIN, { now: 0, fetcher: garbage })).toBe('unknown')
  })

  it('keeps the list it had when a refresh fails', async () => {
    await isBlockedIp('x', ORIGIN, { now: 0, fetcher: endpoint(['203.0.113.7']).fetcher })
    const down = endpoint(null, 503)
    expect(await isBlockedIp('203.0.113.7', ORIGIN, { now: 61_000, fetcher: down.fetcher })).toBe(true)
  })
})

describe('the proxy', () => {
  async function run(path: string, ip: string, list: string[] | null = ['203.0.113.7']) {
    const { proxy } = await import('@/proxy')
    const { fetcher, calls } = endpoint(list, list ? 200 : 503)
    vi.stubGlobal('fetch', fetcher)
    const response = await proxy(
      new NextRequest(`${ORIGIN}${path}`, { headers: { 'x-forwarded-for': ip } }),
    )
    return { response, calls }
  }

  it('refuses a blocked address with a 403 and a way to reach a person', async () => {
    const { response } = await run('/', '203.0.113.7')
    expect(response.status).toBe(403)
    expect(response.headers.get('cache-control')).toBe('no-store')
    const body = await response.text()
    expect(body).toContain('Access restricted')
    expect(body).toContain('mailto:')
  })

  it('matches however the address was spelled on the way in', async () => {
    const { response } = await run('/shop', '::ffff:203.0.113.7')
    expect(response.status).toBe(403)
  })

  it('answers an API route in JSON', async () => {
    const { response } = await run('/api/chat', '203.0.113.7')
    expect(response.status).toBe(403)
    expect(response.headers.get('content-type')).toContain('application/json')
  })

  it('lets everyone else through', async () => {
    const { response } = await run('/', '198.51.100.1')
    expect(response.status).toBe(200)
  })

  it('lets a blocked address reach the admin, and never checks the list for it', async () => {
    const { response, calls } = await run('/admin/login', '203.0.113.7')
    expect(response.status).not.toBe(403)
    expect(calls).toHaveLength(0)
  })

  it('fails open when the list cannot be read', async () => {
    const { response } = await run('/', '203.0.113.7', null)
    expect(response.status).toBe(200)
  })

  it('does nothing at all when the admin is not configured', async () => {
    delete process.env.ADMIN_SESSION_SECRET
    const { response, calls } = await run('/', '203.0.113.7')
    expect(response.status).toBe(200)
    expect(calls).toHaveLength(0)
  })
})

describe('the list endpoint', () => {
  vi.mock('@/lib/security/blocked-ip-store', () => ({
    BLOCKED_IPS_TAG: 'blocked-ips',
    blockedIpsCached: async () => ['203.0.113.7'],
  }))
  vi.mock('next/server', async (importOriginal) => ({
    ...(await importOriginal<typeof import('next/server')>()),
    connection: async () => {},
  }))

  const call = async (token?: string) => {
    const { GET } = await import('@/app/api/security/blocked-ips/route')
    return GET(
      new Request(`${ORIGIN}${BLOCKED_IPS_PATH}`, {
        headers: token === undefined ? {} : { [BLOCKLIST_TOKEN_HEADER]: token },
      }),
    )
  }

  it('serves the list to the proxy’s token', async () => {
    const response = await call(blocklistToken(SECRET))
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ ips: ['203.0.113.7'] })
  })

  it('is a plain 404 to anyone else — people’s addresses are not public', async () => {
    for (const token of [undefined, '', 'guess', blocklistToken('another-secret-of-forty-chars-xxxxxxxxxx')]) {
      const response = await call(token)
      expect(response.status).toBe(404)
      expect(await response.text()).not.toContain('203.0.113.7')
    }
  })

  it('serves nobody when the admin is not configured', async () => {
    delete process.env.ADMIN_SESSION_SECRET
    expect((await call(blocklistToken(SECRET))).status).toBe(404)
  })
})
