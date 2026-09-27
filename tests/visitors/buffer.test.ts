import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { bufferedCount, record, resetBuffer } from '@/lib/visitors/buffer'
import { VISITS_TOKEN_HEADER, visitsToken } from '@/lib/visitors/collect-token'
import type { VisitEvent } from '@/lib/visitors/page-view'

const SECRET = 's'.repeat(40)
const ORIGIN = 'https://shop.test'
const previous = process.env.ADMIN_SESSION_SECRET

const event = (n: number): VisitEvent =>
  ({ v: `0f8fad5b-d9cb-469f-a165-7086772895${String(n).padStart(2, '0')}`, t: 1, p: '/', d: 'mobile', b: 'Safari', o: 'iOS' }) as VisitEvent

function collector({ fail = false }: { fail?: boolean } = {}) {
  const batches: { events: VisitEvent[]; token: string | null }[] = []
  const fetcher = (async (_url: string | URL, init?: RequestInit) => {
    if (fail) throw new Error('unreachable')
    const body = JSON.parse(String(init?.body)) as { events: VisitEvent[] }
    batches.push({ events: body.events, token: new Headers(init?.headers).get(VISITS_TOKEN_HEADER) })
    return new Response('{}', { status: 200 })
  }) as unknown as typeof fetch
  return { fetcher, batches }
}

/** A settle timer that never fires: the size and age rules on their own. */
const never = () => new Promise<void>(() => {})

beforeEach(() => {
  process.env.ADMIN_SESSION_SECRET = SECRET
  resetBuffer()
})
afterEach(() => {
  process.env.ADMIN_SESSION_SECRET = previous
  resetBuffer()
})

describe('the visit buffer', () => {
  it('holds views until the batch is worth sending', async () => {
    const { fetcher, batches } = collector()
    // The first view schedules the one settle send; the rest ride on it.
    expect(record(event(0), ORIGIN, { now: 1_000, fetcher, sleep: never })).not.toBeNull()
    for (let i = 1; i < 24; i++) expect(record(event(i), ORIGIN, { now: 1_000, fetcher, sleep: never })).toBeNull()
    expect(bufferedCount()).toBe(24)
    expect(batches).toHaveLength(0)

    await record(event(24), ORIGIN, { now: 1_000, fetcher, sleep: never })
    expect(batches).toHaveLength(1)
    expect(batches[0]?.events).toHaveLength(25)
    expect(batches[0]?.token).toBe(visitsToken(SECRET))
    expect(bufferedCount()).toBe(0)
  })

  it('sends a small batch once it has waited long enough', async () => {
    const { fetcher, batches } = collector()
    record(event(1), ORIGIN, { now: 0, fetcher, sleep: never })
    expect(record(event(2), ORIGIN, { now: 30_000, fetcher, sleep: never })).toBeNull()
    await record(event(3), ORIGIN, { now: 61_000, fetcher, sleep: never })
    expect(batches[0]?.events).toHaveLength(3)
  })

  it('keeps a batch the collector could not take, and sends it next time', async () => {
    const down = collector({ fail: true })
    for (let i = 0; i < 25; i++) void record(event(i), ORIGIN, { now: 1_000, fetcher: down.fetcher, sleep: never })
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(bufferedCount()).toBe(25)

    const up = collector()
    await record(event(99), ORIGIN, { now: 70_000, fetcher: up.fetcher, sleep: never })
    expect(up.batches[0]?.events).toHaveLength(26)
    expect(bufferedCount()).toBe(0)
  })

  it('never grows without limit while the collector is down', async () => {
    const down = collector({ fail: true })
    for (let i = 0; i < 700; i++) await Promise.race([record(event(i % 90), ORIGIN, { now: 1_000 + i * 10, fetcher: down.fetcher, sleep: never }), Promise.resolve()])
    expect(bufferedCount()).toBeLessThanOrEqual(500)
  })

  it('records nothing when the admin secret is missing — it signs the batch', async () => {
    delete process.env.ADMIN_SESSION_SECRET
    const { fetcher, batches } = collector()
    for (let i = 0; i < 30; i++) record(event(i), ORIGIN, { now: 1_000, fetcher, sleep: never })
    expect(batches).toHaveLength(0)
  })

  /*
    Owner, 2026-09-19: browsed several pages, the log showed one. Held views were only
    sent when another request reached the same instance, which on a quiet site may
    never happen before the instance is recycled.
  */
  it('sends a lone view a few seconds later, with nothing else arriving to carry it', async () => {
    const { fetcher, batches } = collector()
    await record(event(1), ORIGIN, { now: 1_000, fetcher, sleep: () => Promise.resolve() })
    expect(batches).toHaveLength(1)
    expect(batches[0]?.events).toHaveLength(1)
    expect(bufferedCount()).toBe(0)
  })

  it('carries every view that arrives while it waits in one batch, one write per burst', async () => {
    const { fetcher, batches } = collector()
    let fire: () => void = () => {}
    const sleep = () => new Promise<void>((resolve) => { fire = resolve })
    const settle = record(event(1), ORIGIN, { now: 1_000, fetcher, sleep })
    expect(record(event(2), ORIGIN, { now: 2_000, fetcher, sleep })).toBeNull()
    expect(record(event(3), ORIGIN, { now: 3_000, fetcher, sleep })).toBeNull()
    fire()
    await settle
    expect(batches).toHaveLength(1)
    expect(batches[0]?.events).toHaveLength(3)
  })

  it('schedules the next settle once the last one has sent', async () => {
    const { fetcher, batches } = collector()
    await record(event(1), ORIGIN, { now: 1_000, fetcher, sleep: () => Promise.resolve() })
    await record(event(2), ORIGIN, { now: 9_000, fetcher, sleep: () => Promise.resolve() })
    expect(batches.map((b) => b.events.length)).toEqual([1, 1])
  })
})
