import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { VISITS_TOKEN_HEADER, visitsToken } from '@/lib/visitors/collect-token'

const createMany = vi.fn()
const fileDueDays = vi.fn()
vi.mock('@/lib/db/client', () => ({ db: { visitEvent: { createMany } } }))
vi.mock('@/lib/visitors/flush', () => ({ fileDueDays }))
vi.mock('next/server', async (importOriginal) => ({
  ...(await importOriginal<typeof import('next/server')>()),
  connection: async () => {},
}))

/**
 * A fresh copy of the route per test: it remembers when it last considered filing,
 * in module state, exactly so it does not do that on every batch.
 */
async function freshRoute() {
  vi.resetModules()
  return (await import('@/app/api/visits/collect/route')).POST
}

const SECRET = 's'.repeat(40)
const previous = process.env.ADMIN_SESSION_SECRET
const VID = '0f8fad5b-d9cb-469f-a165-70867728950e'
const event = (overrides: Record<string, unknown> = {}) => ({
  v: VID,
  t: Date.UTC(2026, 8, 11, 12),
  p: '/shop',
  d: 'mobile',
  b: 'Safari',
  o: 'iOS',
  ...overrides,
})

async function post(body: unknown, token?: string, route?: Awaited<ReturnType<typeof freshRoute>>) {
  const handler = route ?? (await freshRoute())
  return handler(
    new Request('https://shop.test/api/visits/collect', {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...(token === undefined ? {} : { [VISITS_TOKEN_HEADER]: token }) },
      body: JSON.stringify(body),
    }),
  )
}

beforeEach(() => {
  process.env.ADMIN_SESSION_SECRET = SECRET
  createMany.mockReset().mockResolvedValue({ count: 0 })
  fileDueDays.mockReset().mockResolvedValue({ filed: [], deferred: [], pruned: 0 })
})
afterEach(() => {
  process.env.ADMIN_SESSION_SECRET = previous
})

describe('/api/visits/collect', () => {
  it('stores a batch from the proxy, keyed by the day each view happened', async () => {
    const response = await post({ events: [event(), event({ t: Date.UTC(2026, 8, 12, 1) })] }, visitsToken(SECRET))
    expect(response.status).toBe(200)
    const rows = createMany.mock.calls[0]?.[0].data as { day: Date; payload: { p: string } }[]
    expect(rows).toHaveLength(2)
    expect(rows[0]?.day.toISOString()).toBe('2026-09-11T00:00:00.000Z')
    expect(rows[1]?.day.toISOString()).toBe('2026-09-12T00:00:00.000Z')
  })

  /*
    A public endpoint that writes to the database is an invitation to fill it with
    invented visits, so the token is the only thing that opens it.
  */
  it('is a plain 404 to anyone without the proxy’s token', async () => {
    for (const token of [undefined, '', 'guess', visitsToken('another-secret-of-at-least-32-chars!!')]) {
      expect((await post({ events: [event()] }, token)).status).toBe(404)
    }
    expect(createMany).not.toHaveBeenCalled()
  })

  it('drops anything that is not a well-formed event', async () => {
    await post({ events: [event(), { v: 'nope' }, 'rubbish', 42, event({ p: 'no-slash' })] }, visitsToken(SECRET))
    expect(createMany.mock.calls[0]?.[0].data).toHaveLength(1)
  })

  it('says so quietly when the table is not there yet', async () => {
    createMany.mockRejectedValue(Object.assign(new Error('missing'), { code: 'P2021' }))
    const response = await post({ events: [event()] }, visitsToken(SECRET))
    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({ stored: 0, pending: 'migration' })
  })

  it('files finished days now and then, so no scheduler is needed', async () => {
    fileDueDays.mockResolvedValue({ filed: [{ day: '2026-09-11' }], deferred: [], pruned: 0 })
    const route = await freshRoute()
    const first = await post({ events: [event()] }, visitsToken(SECRET), route)
    expect(await first.json()).toMatchObject({ filed: ['2026-09-11'] })
    // Not on every batch: once an hour per instance is enough.
    const second = await post({ events: [event()] }, visitsToken(SECRET), route)
    expect(await second.json()).not.toHaveProperty('filed')
    expect(fileDueDays).toHaveBeenCalledOnce()
  })
})
