import { neon, type NeonQueryFunction } from '@neondatabase/serverless'

/*
 * Deliberately NOT marked `server-only`: this module is also imported by the
 * migration and seed CLI scripts, which are plain Node processes rather than React
 * Server Component contexts. DATABASE_URL is not NEXT_PUBLIC_-prefixed, so it is
 * absent from any client bundle and this module cannot function there.
 */

/**
 * Neon HTTP client with retry.
 *
 * Two reasons this exists rather than a bare `neon(url)`:
 *
 *  1. Neon endpoints resolve IPv6-only and the HTTP transport occasionally throws a
 *     bare `TypeError: fetch failed` on a cold path. It is transient — the same query
 *     succeeds on retry — but an unretried failure surfaces to a customer as a broken
 *     page.
 *  2. Serverless HTTP database access is inherently more failure-prone than a pooled
 *     TCP connection: cold starts, DNS, and edge network blips all show up as fetch
 *     errors. Retrying transient failures is table stakes, not defensive padding.
 *
 * Retries only connection-level failures. A genuine SQL error (syntax, constraint
 * violation) is returned immediately — retrying it would just delay the report.
 */
export interface RetryOptions {
  readonly attempts?: number
  readonly baseDelayMs?: number
}

function isTransient(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error)
  return (
    message.includes('fetch failed') ||
    message.includes('ECONNRESET') ||
    message.includes('ETIMEDOUT') ||
    message.includes('EAI_AGAIN') ||
    message.includes('socket hang up')
  )
}

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

export async function withRetry<T>(
  operation: () => Promise<T>,
  { attempts = 4, baseDelayMs = 120 }: RetryOptions = {},
): Promise<T> {
  let lastError: unknown
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await operation()
    } catch (error) {
      lastError = error
      if (!isTransient(error) || attempt === attempts) throw error
      // Exponential backoff with a small jitter, so concurrent callers do not
      // retry in lockstep and amplify the blip they are recovering from.
      await delay(baseDelayMs * 2 ** (attempt - 1) + Math.random() * 50)
    }
  }
  throw lastError
}

let client: NeonQueryFunction<false, false> | undefined

export function sql(): NeonQueryFunction<false, false> {
  if (!client) {
    const url = process.env.DATABASE_URL
    if (!url) throw new Error('DATABASE_URL is not set')
    client = neon(url)
  }
  return client
}

/** Run a raw statement with transient-failure retry. */
export function query<T = Record<string, unknown>>(
  statement: string,
  params: readonly unknown[] = [],
): Promise<T[]> {
  return withRetry(async () => {
    const result = await sql().query(statement, params as unknown[])
    return result as T[]
  })
}
