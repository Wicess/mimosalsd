import { afterEach, describe, expect, it, vi } from 'vitest'
import { indexNowKey, isValidKey, submitUrl, submitUrls } from '@/lib/seo/indexnow'

/**
 * IndexNow is how Bing learns a URL changed rather than waiting to be re-crawled, and
 * its guidelines reference it for discovery, updates, deletions and freshness. It is
 * also easy to have "working" while silently rejected — a malformed key or a key file
 * that has drifted from the submitted key both fail as a bare 403.
 */
describe('key validation', () => {
  it('accepts 8–128 hex characters', () => {
    expect(isValidKey('a'.repeat(8))).toBe(true)
    expect(isValidKey('0123456789abcdef')).toBe(true)
    expect(isValidKey('F'.repeat(128))).toBe(true)
  })

  it('rejects keys IndexNow will not accept', () => {
    expect(isValidKey('short')).toBe(false)
    expect(isValidKey('g'.repeat(16)), 'g is not hex').toBe(false)
    expect(isValidKey('a'.repeat(129)), 'too long').toBe(false)
    expect(isValidKey('has-a-dash-in-it')).toBe(false)
    expect(isValidKey('')).toBe(false)
  })

  it('treats an empty env var as unset, not as an empty key', () => {
    vi.stubEnv('INDEXNOW_KEY', '   ')
    expect(indexNowKey()).toBeUndefined()
  })
})

describe('submission guards', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  it('refuses to submit when no key is configured', async () => {
    vi.stubEnv('INDEXNOW_KEY', '')
    const result = await submitUrl('/where-we-ship/texas')
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toMatch(/not set/i)
  })

  it('refuses a malformed key rather than letting Bing 422 it', async () => {
    vi.stubEnv('INDEXNOW_KEY', 'not-a-hex-key')
    const result = await submitUrl('/where-we-ship/texas')
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toMatch(/hex/i)
  })

  /**
   * Submitting localhost is not a failure worth surfacing on every dev save, and it
   * is never something IndexNow can accept.
   */
  it('quietly refuses localhost instead of calling out', async () => {
    vi.stubEnv('INDEXNOW_KEY', 'a'.repeat(32))
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'http://localhost:3000')
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)

    const result = await submitUrl('/where-we-ship/texas')
    expect(result.ok).toBe(false)
    expect(fetchSpy, 'must not reach the network').not.toHaveBeenCalled()
  })

  it('rejects a batch spanning more than one host', async () => {
    vi.stubEnv('INDEXNOW_KEY', 'a'.repeat(32))
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://example.com')
    const result = await submitUrls([
      'https://example.com/a',
      'https://elsewhere.com/b',
    ])
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toMatch(/more than one host/i)
  })

  it('rejects a batch over the 10,000 URL limit', async () => {
    vi.stubEnv('INDEXNOW_KEY', 'a'.repeat(32))
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://example.com')
    const many = Array.from({ length: 10_001 }, (_, i) => `/p/${i}`)
    const result = await submitUrls(many)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toMatch(/exceeds/i)
  })

  it('rejects an empty submission', async () => {
    vi.stubEnv('INDEXNOW_KEY', 'a'.repeat(32))
    expect((await submitUrls([])).ok).toBe(false)
  })
})

describe('a successful submission', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  it('sends host, key, keyLocation and absolute URLs', async () => {
    vi.stubEnv('INDEXNOW_KEY', 'b'.repeat(32))
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://example.com')
    // Capture the request rather than reaching into the mock's call tuple — it reads
    // better and keeps both arguments genuinely used.
    const sent: { endpoint?: string; init?: RequestInit } = {}
    vi.stubGlobal('fetch', async (endpoint: string, init: RequestInit) => {
      sent.endpoint = endpoint
      sent.init = init
      return new Response(null, { status: 200 })
    })

    const result = await submitUrl('/where-we-ship/texas')

    expect(result.ok).toBe(true)
    expect(sent.endpoint).toBe('https://api.indexnow.org/IndexNow')
    const body = JSON.parse(sent.init!.body as string)
    expect(body.host).toBe('example.com')
    expect(body.key).toBe('b'.repeat(32))
    // The key file must be where Bing will look for it, or the submission 403s.
    expect(body.keyLocation).toBe('https://example.com/indexnow-key.txt')
    expect(body.urlList).toEqual(['https://example.com/where-we-ship/texas'])
  })

  it('translates Bing status codes into something actionable', async () => {
    vi.stubEnv('INDEXNOW_KEY', 'c'.repeat(32))
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://example.com')
    vi.stubGlobal('fetch', async () => new Response(null, { status: 403 }))

    const result = await submitUrl('/a')
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.status).toBe(403)
      expect(result.reason).toMatch(/key file/i)
    }
  })

  /** A search-engine ping must never take down the action that triggered it. */
  it('returns a failure rather than throwing when the network dies', async () => {
    vi.stubEnv('INDEXNOW_KEY', 'd'.repeat(32))
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://example.com')
    vi.stubGlobal('fetch', async () => { throw new Error('ECONNRESET') })

    await expect(submitUrl('/a')).resolves.toMatchObject({ ok: false })
  })
})
