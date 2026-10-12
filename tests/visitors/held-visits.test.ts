import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { VISITS_TOKEN_HEADER, visitsToken } from '@/lib/visitors/collect-token'

/**
 * Page views wait in object storage so that browsing never wakes the database
 * (lib/visitors/held-visits.ts). R2 is replaced here by a map with the same four
 * operations; what is under test is what goes in, what comes back, and that
 * Postgres is touched only as the fallback.
 */
const store = new Map<string, string>()
let configured = true
let refuse = false
vi.mock('server-only', () => ({}))
vi.mock('@/lib/storage/r2', () => ({
  isConfigured: () => configured,
  putObject: async (key: string, body: string) => {
    if (refuse) throw new Error('R2 is down')
    store.set(key, body)
  },
  listKeys: async (prefix: string) => [...store.keys()].filter((key) => key.startsWith(prefix)).sort(),
  getObjectText: async (key: string) => store.get(key) ?? null,
  deleteObjects: async (keys: string[]) => {
    for (const key of keys) store.delete(key)
  },
}))

const createMany = vi.fn()
const fileDueDays = vi.fn()
vi.mock('@/lib/db/client', () => ({ db: { visitEvent: { createMany } } }))
vi.mock('@/lib/visitors/flush', () => ({ fileDueDays }))
vi.mock('next/server', async (importOriginal) => ({
  ...(await importOriginal<typeof import('next/server')>()),
  connection: async () => {},
}))

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

async function freshRoute() {
  vi.resetModules()
  return (await import('@/app/api/visits/collect/route')).POST
}
async function post(events: unknown[], route?: Awaited<ReturnType<typeof freshRoute>>) {
  const handler = route ?? (await freshRoute())
  return handler(
    new Request('https://shop.test/api/visits/collect', {
      method: 'POST',
      headers: { 'content-type': 'application/json', [VISITS_TOKEN_HEADER]: visitsToken(SECRET) },
      body: JSON.stringify({ events }),
    }),
  )
}

beforeEach(() => {
  process.env.ADMIN_SESSION_SECRET = SECRET
  store.clear()
  configured = true
  refuse = false
  createMany.mockReset().mockResolvedValue({ count: 0 })
  fileDueDays.mockReset().mockResolvedValue({ filed: [], deferred: [], pruned: 0 })
})
afterEach(() => {
  process.env.ADMIN_SESSION_SECRET = previous
  vi.useRealTimers()
})

describe('page views held in object storage', () => {
  it('stores a batch as one private object per day, and never writes to Postgres', async () => {
    const response = await post([event(), event({ p: '/about' }), event({ t: Date.UTC(2026, 8, 12, 1) })])
    expect(await response.json()).toMatchObject({ stored: 3 })
    expect(createMany).not.toHaveBeenCalled()
    const keys = [...store.keys()].sort()
    expect(keys).toHaveLength(2)
    expect(keys[0]).toMatch(/^private\/visits\/2026-09-11\/.+\.json$/)
    expect(keys[1]).toMatch(/^private\/visits\/2026-09-12\/.+\.json$/)
  })

  it('reads a day back whole, with the keys to clear once it is filed', async () => {
    await post([event(), event({ p: '/about' })])
    await post([event({ p: '/faq' })])
    const { heldDays, readHeldDay, clearHeld } = await import('@/lib/visitors/held-visits')
    expect(await heldDays()).toEqual(['2026-09-11'])
    const day = await readHeldDay('2026-09-11')
    expect(day.events.map((e) => e.p).sort()).toEqual(['/about', '/faq', '/shop'])
    expect(day.keys).toHaveLength(2)
    await clearHeld(day.keys)
    expect(store.size).toBe(0)
    expect((await readHeldDay('2026-09-11')).events).toEqual([])
  })

  it('skips an object that is not a batch of events rather than failing the day', async () => {
    await post([event()])
    store.set('private/visits/2026-09-11/0-broken.json', '{not json')
    store.set('private/visits/2026-09-11/0-wrong.json', JSON.stringify([{ v: 'nope' }, 42]))
    const { readHeldDay } = await import('@/lib/visitors/held-visits')
    expect((await readHeldDay('2026-09-11')).events).toHaveLength(1)
  })

  // The owner's rule: reduce how often data is written, never drop it.
  it('falls back to Postgres when R2 refuses the batch', async () => {
    refuse = true
    const response = await post([event()])
    expect(await response.json()).toMatchObject({ stored: 1 })
    expect(createMany.mock.calls[0]?.[0].data).toHaveLength(1)
  })

  it('uses Postgres as before when R2 is not configured', async () => {
    configured = false
    await post([event()])
    expect(createMany).toHaveBeenCalledOnce()
    expect(store.size).toBe(0)
  })

  it('asks Postgres to file only when a finished day is waiting', async () => {
    vi.useFakeTimers({ now: Date.UTC(2026, 8, 11, 13), toFake: ['Date'] })
    // Today only: nothing is due, so the database is left asleep.
    await post([event()])
    expect(fileDueDays).not.toHaveBeenCalled()

    vi.setSystemTime(Date.UTC(2026, 8, 12, 4))
    fileDueDays.mockResolvedValue({ filed: [{ day: '2026-09-11' }], deferred: [], pruned: 0 })
    const route = await freshRoute()
    const response = await post([event({ t: Date.UTC(2026, 8, 12, 4) })], route)
    expect(await response.json()).toMatchObject({ filed: ['2026-09-11'] })
    expect(fileDueDays).toHaveBeenCalledOnce()
  })
})
