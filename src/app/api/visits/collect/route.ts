import { randomUUID } from 'node:crypto'
import { Prisma } from '@prisma/client'
import { connection } from 'next/server'
import { db } from '@/lib/db/client'
import { isSchemaBehindError } from '@/lib/db/errors'
import { VISITS_TOKEN_HEADER, visitsTokenMatches } from '@/lib/visitors/collect-token'
import { parseVisitEvent } from '@/lib/visitors/page-view'
import { fileDueDays } from '@/lib/visitors/flush'

/**
 * Where the proxy posts a batch of page views (lib/visitors/buffer.ts).
 *
 * Answers only a request carrying the proxy's token; anyone else gets a plain
 * 404, because an open endpoint that writes to the database is an invitation to
 * fill it with invented visits.
 *
 * It also files finished days now and then, so the nightly aggregation happens
 * whether or not a cron is configured — see `fileDueDays`.
 */
export const maxDuration = 60

/** How often one instance will consider filing yesterday, at most. */
const FILE_CHECK_MS = 60 * 60 * 1000
let lastFiledCheck = 0

export async function POST(request: Request): Promise<Response> {
  await connection()
  const headers = { 'cache-control': 'no-store' }

  if (!visitsTokenMatches(request.headers.get(VISITS_TOKEN_HEADER), process.env.ADMIN_SESSION_SECRET)) {
    return new Response('Not found', { status: 404, headers })
  }

  let events: unknown[] = []
  try {
    const body = (await request.json()) as { events?: unknown }
    events = Array.isArray(body.events) ? body.events : []
  } catch {
    return Response.json({ error: 'Expected JSON.' }, { status: 400, headers })
  }

  // Re-validated here rather than trusted: this is a public endpoint, and only the
  // token says the caller is ours.
  const rows = events
    .slice(0, 1_000)
    .map((event) => parseVisitEvent(typeof event === 'string' ? event : JSON.stringify(event)))
    .filter((event) => event !== null)
    .map((event) => ({
      id: randomUUID(),
      day: new Date(`${new Date(event.t).toISOString().slice(0, 10)}T00:00:00Z`),
      // The event's own shape, stored as JSON: Prisma wants a plain JSON value here.
      payload: event as unknown as Prisma.InputJsonObject,
    }))

  try {
    if (rows.length > 0) await db.visitEvent.createMany({ data: rows })
  } catch (error) {
    // Before migration 0014 there is nowhere to put them. Say so quietly rather
    // than failing the proxy's background send on every batch.
    if (isSchemaBehindError(error)) {
      return Response.json({ stored: 0, pending: 'migration' }, { status: 200, headers })
    }
    throw error
  }

  const now = Date.now()
  let filed: string[] | undefined
  if (now - lastFiledCheck > FILE_CHECK_MS) {
    lastFiledCheck = now
    filed = (await fileDueDays().catch(() => ({ filed: [] }))).filed.map((day) => day.day)
  }

  return Response.json({ stored: rows.length, ...(filed ? { filed } : {}) }, { headers })
}
