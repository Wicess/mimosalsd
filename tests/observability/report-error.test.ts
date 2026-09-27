import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * The reporter's contract, which is mostly about what it REFUSES to do.
 *
 * It runs after something has already gone wrong, so every guarantee here is about not
 * making things worse: not throwing, not writing a row per occurrence during a crash
 * loop, not ringing a phone every second, and not pushing an alert down the very
 * channel that just failed.
 */
const upsert = vi.fn().mockResolvedValue({})
const notify = vi.fn().mockResolvedValue(true)

vi.mock('@/lib/db/client', () => ({ db: { errorLog: { upsert } } }))
vi.mock('@/lib/notify/ntfy', () => ({ notify }))

const { reportError, resetErrorReporter } = await import('@/lib/observability/report-error')

/** The window the reporter coalesces writes over, from report-error.ts. */
const COALESCE_MS = 60_000
const NOTIFY_MS = 15 * 60_000

function upsertArgs(call = 0) {
  return upsert.mock.calls[call]?.[0] as {
    where: { fingerprint: string }
    create: Record<string, unknown>
    update: Record<string, unknown>
  }
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-09-10T09:00:00Z'))
  resetErrorReporter()
  upsert.mockClear()
  notify.mockClear()
  // The reporter logs unconditionally; silencing it keeps the test output readable.
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('writing', () => {
  it('records the error with its source, severity and route', async () => {
    await reportError(new TypeError('x is not a function'), {
      source: 'render',
      severity: 'FATAL',
      routePath: '/product/[slug]',
      requestPath: '/product/mhrb-powder',
      method: 'GET',
    })

    const args = upsertArgs()
    expect(args.create).toMatchObject({
      severity: 'FATAL',
      source: 'render',
      name: 'TypeError',
      message: 'x is not a function',
      routePath: '/product/[slug]',
      requestPath: '/product/mhrb-powder',
      method: 'GET',
      count: 1,
    })
  })

  it('redacts a secret nested inside the context object', async () => {
    // The context is JSON round-tripped through the redactor precisely so a key one
    // level down is caught, not just one in the message.
    await reportError(new Error('send failed'), {
      source: 'mail',
      context: { provider: 'brevo', config: { key: 'xkeysib-e04d225ca298b085cf9ff77-abcdef' } },
    })

    const serialised = JSON.stringify(upsertArgs().create.context)
    expect(serialised).not.toContain('abcdef')
    expect(serialised).toContain('brevo')
  })

  it('re-opens a resolved row when the same error happens again', async () => {
    // An error someone ticked off last week that is firing again right now must not
    // stay hidden behind its own resolution.
    await reportError(new Error('boom'), { source: 'action' })
    expect(upsertArgs().update).toMatchObject({ resolvedAt: null, resolvedBy: null })
  })
})

describe('coalescing', () => {
  it('writes once for a storm of the same error, keeping every occurrence in the count', async () => {
    for (let i = 0; i < 50; i++) {
      await reportError(new Error('database unreachable'), { source: 'db' })
    }
    // 50 occurrences, ONE write. Neon bills by how long it stays awake.
    expect(upsert).toHaveBeenCalledTimes(1)
    expect(upsertArgs().create.count).toBe(1)

    // The other 49 are not dropped — they land on the next write past the window.
    vi.setSystemTime(Date.now() + COALESCE_MS + 1)
    await reportError(new Error('database unreachable'), { source: 'db' })
    expect(upsert).toHaveBeenCalledTimes(2)
    expect(upsertArgs(1).update).toMatchObject({ count: { increment: 50 } })
  })

  it('does not coalesce two genuinely different errors', async () => {
    await reportError(new Error('mail failed'), { source: 'mail' })
    await reportError(new Error('database unreachable'), { source: 'db' })
    expect(upsert).toHaveBeenCalledTimes(2)
    expect(upsertArgs(0).where.fingerprint).not.toBe(upsertArgs(1).where.fingerprint)
  })

  it('groups the same bug across differing ids into one row', async () => {
    await reportError(new Error('Order 202608-A1B2C3 not found'), { source: 'action' })
    await reportError(new Error('Order 202609-D4E5F6 not found'), { source: 'action' })
    expect(upsert).toHaveBeenCalledTimes(1)
  })
})

describe('notifying', () => {
  it('pushes to the errors topic with a link to the admin log', async () => {
    await reportError(new Error('checkout exploded'), {
      source: 'action',
      severity: 'FATAL',
    })
    expect(notify).toHaveBeenCalledTimes(1)
    expect(notify.mock.calls[0]?.[0]).toMatchObject({
      topic: 'errors',
    })
    expect(String(notify.mock.calls[0]?.[0].clickUrl)).toContain('/admin/errors')
  })

  it('throttles repeat pushes for the same fingerprint', async () => {
    await reportError(new Error('same bug'), { source: 'db' })
    expect(notify).toHaveBeenCalledTimes(1)

    // A new write window, but still inside the notify window: it writes, silently.
    vi.setSystemTime(Date.now() + COALESCE_MS + 1)
    await reportError(new Error('same bug'), { source: 'db' })
    expect(upsert).toHaveBeenCalledTimes(2)
    expect(notify).toHaveBeenCalledTimes(1)

    // Past the notify window it rings again — a bug still firing after 15 minutes is
    // worth being told about a second time.
    vi.setSystemTime(Date.now() + NOTIFY_MS + 1)
    await reportError(new Error('same bug'), { source: 'db' })
    expect(notify).toHaveBeenCalledTimes(2)
  })

  it('never pushes about a failure in the notifier itself', async () => {
    // Alerting about a dead ntfy through ntfy either fails identically or loops.
    await reportError(new Error('ntfy unreachable'), { source: 'ntfy', push: false })
    expect(notify).not.toHaveBeenCalled()
    // It is still recorded, so it shows up in the admin list.
    expect(upsert).toHaveBeenCalledTimes(1)
  })
})

describe('never making things worse', () => {
  it('resolves even when the database write fails', async () => {
    // The most likely reason to be reporting an error is that the database is down.
    upsert.mockRejectedValueOnce(new Error('connection refused'))
    await expect(
      reportError(new Error('original problem'), { source: 'render' }),
    ).resolves.toBeUndefined()
  })

  it('resolves even when the push fails', async () => {
    notify.mockRejectedValueOnce(new Error('ntfy down'))
    await expect(
      reportError(new Error('original problem'), { source: 'render' }),
    ).resolves.toBeUndefined()
  })

  it('still writes the row when only the push fails', async () => {
    // Settled independently, so one dead channel cannot suppress the other.
    notify.mockRejectedValueOnce(new Error('ntfy down'))
    await reportError(new Error('original problem'), { source: 'render' })
    expect(upsert).toHaveBeenCalledTimes(1)
  })

  it('handles a thrown non-Error without throwing', async () => {
    await expect(reportError('just a string', { source: 'client' })).resolves.toBeUndefined()
    await expect(reportError(null, { source: 'client' })).resolves.toBeUndefined()
    expect(upsert).toHaveBeenCalledTimes(2)
  })
})
