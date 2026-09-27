import { describe, expect, it, vi } from 'vitest'
import { dbRetry, isTransientDbError } from '@/lib/db/retry'

describe('transient failure detection', () => {
  it('treats connection-level failures as transient', () => {
    for (const m of [
      'fetch failed',
      'read ECONNRESET',
      'connect ETIMEDOUT',
      'getaddrinfo EAI_AGAIN',
      'socket hang up',
      'Connection terminated unexpectedly',
      'WebSocket was closed before the connection',
    ]) {
      expect(isTransientDbError(new Error(m)), m).toBe(true)
    }
  })

  it('treats an empty driver error as transient', () => {
    // Prisma surfaced an adapter failure as literally `prisma:error undefined`, which
    // is a network problem wearing no message at all — not a real query result.
    expect(isTransientDbError(new Error(''))).toBe(true)
    expect(isTransientDbError(undefined)).toBe(true)
  })

  it('does NOT retry a genuine query error', () => {
    for (const m of [
      'Unique constraint failed on the fields: (`email`)',
      'Foreign key constraint violated',
      'Record to update not found',
    ]) {
      expect(isTransientDbError(new Error(m)), m).toBe(false)
    }
  })
})

describe('dbRetry', () => {
  it('returns the first successful result without retrying', async () => {
    const op = vi.fn().mockResolvedValue('ok')
    expect(await dbRetry(op)).toBe('ok')
    expect(op).toHaveBeenCalledTimes(1)
  })

  it('recovers from a transient failure', async () => {
    const op = vi
      .fn()
      .mockRejectedValueOnce(new Error('fetch failed'))
      .mockResolvedValue('recovered')
    expect(await dbRetry(op, { baseDelayMs: 1 })).toBe('recovered')
    expect(op).toHaveBeenCalledTimes(2)
  })

  it('gives up after the attempt limit and rethrows', async () => {
    const op = vi.fn().mockRejectedValue(new Error('fetch failed'))
    await expect(dbRetry(op, { attempts: 3, baseDelayMs: 1 })).rejects.toThrow('fetch failed')
    expect(op).toHaveBeenCalledTimes(3)
  })

  it('does not retry a constraint violation — that would only delay the report', async () => {
    const op = vi.fn().mockRejectedValue(new Error('Unique constraint failed'))
    await expect(dbRetry(op, { baseDelayMs: 1 })).rejects.toThrow('Unique constraint')
    expect(op).toHaveBeenCalledTimes(1)
  })
})
