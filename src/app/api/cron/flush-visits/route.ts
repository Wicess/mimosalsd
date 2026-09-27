import { timingSafeEqual } from 'node:crypto'
import { connection } from 'next/server'
import { reportError } from '@/lib/observability/report-error'
import { flushVisits } from '@/lib/visitors/flush'

/**
 * Files yesterday's visits (and any backlog) — see lib/visitors/flush.ts.
 *
 * Optional. The filing also runs by itself from the collection endpoint, about
 * once an hour, so visits are filed with or without a cron. This route exists so
 * the work can be scheduled (vercel.json) when CRON_SECRET is set; without that
 * secret it refuses, rather than letting anyone on the internet trigger it.
 */
export const maxDuration = 300

function authorised(header: string | null, secret: string): boolean {
  const given = Buffer.from(header ?? '')
  const expected = Buffer.from(`Bearer ${secret}`)
  return given.length === expected.length && timingSafeEqual(given, expected)
}

export async function GET(request: Request): Promise<Response> {
  await connection()
  const headers = { 'cache-control': 'no-store' }

  const secret = process.env.CRON_SECRET
  if (!secret) {
    return Response.json({ error: 'CRON_SECRET is not set.' }, { status: 503, headers })
  }
  if (!authorised(request.headers.get('authorization'), secret)) {
    return new Response('Unauthorized', { status: 401, headers })
  }

  try {
    return Response.json(await flushVisits(), { headers })
  } catch (error) {
    // The buffer is untouched for any day not committed; tomorrow's run retries.
    await reportError(error, {
      source: 'route',
      routePath: '/api/cron/flush-visits',
      method: 'GET',
      context: { job: 'flush-visits' },
    })
    return Response.json({ error: 'Filing failed; it will be retried on the next run.' }, { status: 500, headers })
  }
}
