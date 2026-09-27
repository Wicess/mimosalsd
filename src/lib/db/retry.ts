/**
 * Retry for transient database failures.
 *
 * `src/lib/db/neon.ts` covers the raw HTTP driver, but Prisma goes through the Neon
 * WebSocket adapter and does not inherit that. Serverless database access fails this
 * way for real — cold starts, DNS, edge blips — and it was observed here: an admin
 * sign-in failed outright because one `findUnique` threw.
 *
 * Only connection-level failures are retried. A genuine query error (constraint
 * violation, bad SQL) returns immediately; retrying it would just delay the report.
 */
const TRANSIENT = [
  'fetch failed',
  'ECONNRESET',
  'ETIMEDOUT',
  'EAI_AGAIN',
  'socket hang up',
  'Connection terminated',
  'Closed connection',
  'WebSocket',
  'Server has closed the connection',
]

export function isTransientDbError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? '')
  // Prisma sometimes surfaces an adapter failure with an empty message; treat an
  // unhelpfully blank error from the driver as transient rather than as a real result.
  if (message.trim() === '' || message === 'undefined') return true
  return TRANSIENT.some((t) => message.includes(t))
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))

export async function dbRetry<T>(
  operation: () => Promise<T>,
  { attempts = 3, baseDelayMs = 150 }: { attempts?: number; baseDelayMs?: number } = {},
): Promise<T> {
  let last: unknown
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await operation()
    } catch (error) {
      last = error
      if (!isTransientDbError(error) || attempt === attempts) throw error
      await wait(baseDelayMs * 2 ** (attempt - 1) + Math.random() * 60)
    }
  }
  throw last
}
