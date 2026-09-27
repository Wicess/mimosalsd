import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const flushVisits = vi.fn()
const reportError = vi.fn()
vi.mock('@/lib/visitors/flush', () => ({ flushVisits }))
vi.mock('@/lib/observability/report-error', () => ({ reportError }))
vi.mock('next/server', async (importOriginal) => ({
  ...(await importOriginal<typeof import('next/server')>()),
  connection: async () => {},
}))

const { GET } = await import('@/app/api/cron/flush-visits/route')
const SECRET = 'cron-secret-value'
const call = (authorization?: string) =>
  GET(new Request('https://shop.test/api/cron/flush-visits', { headers: authorization ? { authorization } : {} }))

beforeEach(() => {
  process.env.CRON_SECRET = SECRET
  flushVisits.mockReset().mockResolvedValue({ configured: true, filed: [], deferred: [], pruned: 0 })
  reportError.mockReset()
})
afterEach(() => {
  delete process.env.CRON_SECRET
})

describe('/api/cron/flush-visits', () => {
  it('runs the filing for Vercel’s cron', async () => {
    const response = await call(`Bearer ${SECRET}`)
    expect(response.status).toBe(200)
    expect(flushVisits).toHaveBeenCalledOnce()
  })

  it('refuses anyone without the secret', async () => {
    for (const header of [undefined, 'Bearer wrong', SECRET, `Bearer ${SECRET}x`]) {
      expect((await call(header)).status).toBe(401)
    }
    expect(flushVisits).not.toHaveBeenCalled()
  })

  it('refuses to run at all with no secret configured', async () => {
    delete process.env.CRON_SECRET
    expect((await call('Bearer ')).status).toBe(503)
    expect(flushVisits).not.toHaveBeenCalled()
  })

  it('reports a failed filing and says it will be retried', async () => {
    flushVisits.mockRejectedValue(new Error('database unreachable'))
    const response = await call(`Bearer ${SECRET}`)
    expect(response.status).toBe(500)
    expect(reportError).toHaveBeenCalledOnce()
  })
})
