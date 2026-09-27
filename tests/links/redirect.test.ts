import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { destination, onSiteTarget, readTarget } from '@/lib/links/redirect'

const SITE = 'https://mimosalsd.test'

describe('readTarget', () => {
  it('takes a path or a full URL on this site, and stores a path either way', () => {
    expect(readTarget('/shop/amanita', SITE)).toEqual({ ok: true, value: '/shop/amanita' })
    expect(readTarget('  https://www.mimosalsd.test/guides/x?a=1#top  ', SITE)).toEqual({
      ok: true,
      value: '/guides/x?a=1#top',
    })
  })

  /*
    The route already refuses to follow these, but refusing them only there means
    the form accepts a link that quietly lands everyone on the homepage — it looks
    like it works until somebody checks where the traffic went.
  */
  it('refuses at the keyboard what the route would refuse to follow', () => {
    for (const bad of ['https://evil.test/login', '//evil.test/login', 'javascript:alert(1)', '   ']) {
      const result = readTarget(bad, SITE)
      expect(result.ok, bad).toBe(false)
      if (!result.ok) expect(result.error).toMatch(/^(A tracking link|Give the link)/)
    }
  })
})

describe('onSiteTarget', () => {
  it('follows paths and full URLs on this site, with or without www', () => {
    expect(onSiteTarget('/shop/amanita', SITE)?.pathname).toBe('/shop/amanita')
    expect(onSiteTarget('https://mimosalsd.test/guides/x', SITE)?.pathname).toBe('/guides/x')
    expect(onSiteTarget('https://www.mimosalsd.test/guides/x', SITE)).not.toBeNull()
  })

  /*
    Followed blindly, /r/ would be an open redirect: a trusted address that
    forwards anywhere, which is exactly what a phishing message wants.
  */
  it('never follows a target off this site', () => {
    for (const bad of [
      'https://evil.test/login',
      '//evil.test/login',
      'https://mimosalsd.test.evil.test/',
      'javascript:alert(1)',
      'data:text/html,hi',
    ]) {
      expect(onSiteTarget(bad, SITE), bad).toBeNull()
    }
  })
})

describe('destination', () => {
  const link = { slug: 'reddit-dye', source: 'reddit' }

  it('tags the landing page with the campaign', () => {
    const to = destination('/blog/natural-dyeing-with-mimosa-hostilis', SITE, link)
    expect(to.pathname).toBe('/blog/natural-dyeing-with-mimosa-hostilis')
    expect(Object.fromEntries(to.searchParams)).toEqual({
      utm_source: 'reddit',
      utm_medium: 'link',
      utm_campaign: 'reddit-dye',
    })
  })

  it('keeps tags the admin already wrote into the target', () => {
    const to = destination('/shop?utm_source=newsletter&utm_campaign=fall', SITE, link)
    expect(to.searchParams.get('utm_source')).toBe('newsletter')
    expect(to.searchParams.get('utm_campaign')).toBe('fall')
  })

  it('sends an off-site target to the homepage instead, still tagged', () => {
    const to = destination('https://evil.test/x', SITE, { slug: 'x-link', source: null })
    expect(to.origin).toBe(SITE)
    expect(to.pathname).toBe('/')
    expect(to.searchParams.get('utm_source')).toBe('x-link')
  })
})

const findUnique = vi.fn()
const update = vi.fn()
const afters: (() => Promise<unknown>)[] = []
vi.mock('@/lib/db/client', () => ({ db: { trackingLink: { findUnique, update } } }))
vi.mock('next/server', async (importOriginal) => ({
  ...(await importOriginal<typeof import('next/server')>()),
  after: (task: () => Promise<unknown>) => afters.push(task),
}))

describe('GET /r/[slug]', () => {
  const PERSON = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) Mobile/15E148 Safari/604.1'

  beforeEach(() => {
    findUnique.mockReset()
    update.mockReset().mockResolvedValue({})
    afters.length = 0
  })

  async function visit(slug: string, userAgent = PERSON) {
    const { GET } = await import('@/app/r/[slug]/route')
    const response = await GET(new NextRequest(`${SITE}/r/${slug}`, { headers: { 'user-agent': userAgent } }), {
      params: Promise.resolve({ slug }),
    })
    for (const task of afters) await task()
    return {
      status: response.status,
      location: new URL(response.headers.get('location') ?? ''),
      ref: response.cookies.get('ref'),
    }
  }

  const active = { id: 'l1', slug: 'reddit-dye', source: 'reddit', targetUrl: '/shop/mimosa-hostilis', isActive: true }

  it('sends a person to the page and counts the click after responding', async () => {
    findUnique.mockResolvedValue(active)
    const { status, location } = await visit('reddit-dye')
    expect(status).toBe(302)
    expect(location.pathname).toBe('/shop/mimosa-hostilis')
    expect(location.searchParams.get('utm_campaign')).toBe('reddit-dye')
    expect(update).toHaveBeenCalledWith({
      where: { id: 'l1' },
      data: { clicks: { increment: 1 }, lastClickAt: expect.any(Date) },
    })
  })

  it('leaves a person the cookie that credits whoever sent them', async () => {
    findUnique.mockResolvedValue(active)
    const { ref } = await visit('reddit-dye')
    expect(ref?.value).toMatch(/^reddit-dye\.\d+$/)
    expect(ref?.httpOnly).toBe(true)
    expect(ref?.maxAge).toBe(30 * 24 * 60 * 60)
  })

  it('gives a crawler no cookie, and a retired link none either', async () => {
    findUnique.mockResolvedValue(active)
    expect((await visit('reddit-dye', 'Mozilla/5.0 (compatible; Googlebot/2.1)')).ref).toBeUndefined()
    findUnique.mockResolvedValue({ ...active, isActive: false })
    expect((await visit('reddit-dye')).ref).toBeUndefined()
  })

  it('does not count a link preview or crawler', async () => {
    findUnique.mockResolvedValue(active)
    const { location } = await visit('reddit-dye', 'Slackbot-LinkExpanding 1.0 (+https://api.slack.com/robots)')
    expect(location.pathname).toBe('/shop/mimosa-hostilis')
    expect(update).not.toHaveBeenCalled()
  })

  it('lands a retired or unknown link on the homepage, uncounted', async () => {
    findUnique.mockResolvedValue({ ...active, isActive: false })
    expect((await visit('reddit-dye')).location.pathname).toBe('/')
    findUnique.mockResolvedValue(null)
    expect((await visit('nothing-here')).location.pathname).toBe('/')
    expect(update).not.toHaveBeenCalled()
  })

  it('does not even look up a slug no link could have', async () => {
    expect((await visit('NOT..valid')).location.pathname).toBe('/')
    expect(findUnique).not.toHaveBeenCalled()
  })
})
