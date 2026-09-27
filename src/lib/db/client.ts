import { PrismaNeon } from '@prisma/adapter-neon'
import { dbRetry } from './retry'
import { neonConfig } from '@neondatabase/serverless'
import { PrismaClient, type Prisma } from '@prisma/client'
import ws from 'ws'

/*
 * The Neon adapter connects over a WebSocket. Node 20 has no global WebSocket
 * (it landed in Node 22), so the constructor has to be supplied explicitly or every
 * query fails with an opaque "All attempts to open a WebSocket failed".
 */
if (typeof globalThis.WebSocket === 'undefined') {
  neonConfig.webSocketConstructor = ws
}

/**
 * Prisma client, over the Neon serverless adapter.
 *
 * The adapter matters for two reasons, not one:
 *
 *  1. Neon endpoints resolve IPv6-only, and Prisma's default TCP query engine cannot
 *     always reach them. The adapter goes over HTTPS.
 *  2. On serverless hosting, a TCP pool per lambda exhausts Neon's connection limit
 *     quickly. HTTP has no persistent connection to exhaust.
 *
 * The singleton exists because Next dev hot-reloads modules, which would otherwise
 * construct a new client on every file change.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient }

function createClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) throw new Error('DATABASE_URL is not set')

  /*
   * A Postgres on this machine is reached directly, not through the Neon adapter,
   * which speaks WebSocket to Neon's proxy and cannot talk to a plain server. This
   * is what lets a developer run the app against a throwaway local database instead
   * of the one in .env, which is production. A Neon URL never matches.
   */
  const local = /@(localhost|127\.0\.0\.1)(:\d+)?\//.test(connectionString)
  const options: Prisma.PrismaClientOptions = {
    ...(local ? { datasourceUrl: connectionString } : { adapter: new PrismaNeon({ connectionString }) }),
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  }
  const base = new PrismaClient(options)

  /*
   * Retry transient failures on EVERY query, not just the ones someone remembered to
   * wrap.
   *
   * Serverless database access over HTTP/WebSocket fails this way for real — cold
   * starts, DNS, edge blips — and it was observed here: a sign-in failed outright, and
   * an unhandled adapter error took the whole server process down. Sprinkling retries
   * at call sites would have left every page added later unprotected.
   *
   * Genuine query errors (constraint violations, bad input) are not retried; see
   * isTransientDbError.
   */
  return base.$extends({
    query: {
      $allModels: {
        $allOperations: ({ args, query }) => dbRetry(() => query(args)),
      },
    },
  }) as unknown as PrismaClient
}

export const db = globalForPrisma.prisma ?? createClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db
