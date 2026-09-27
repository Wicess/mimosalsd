import { NextResponse } from 'next/server'
import { z } from 'zod'
import { reportError } from '@/lib/observability/report-error'

/**
 * Ingest an error the browser saw.
 *
 * `onRequestError` in instrumentation.ts catches everything that breaks on the server.
 * It cannot see a hydration mismatch, a chunk that failed to download, or a click
 * handler that threw on a customer's phone — and on a storefront whose only
 * acquisition channel is organic search, a page that server-renders fine and then dies
 * during hydration is the worst kind of failure: healthy in every server log, entirely
 * broken for the visitor.
 *
 * A route handler rather than a Server Action because `instrumentation-client.ts` is
 * not part of the React client graph — importing an action from it pulled `server-only`
 * into the browser bundle and failed the build. See components/errors/report.ts.
 *
 * PUBLIC and unauthenticated, because the errors worth hearing about happen to people
 * who are not logged in. That makes it an obvious way to write junk into the database,
 * so it is deliberately hostile to abuse:
 *
 *  · Zod caps every field, so a report cannot be used as storage.
 *  · A per-process budget bounds how many distinct rows can be created per minute,
 *    no matter how many browsers are shouting.
 *  · reportError redacts, fingerprints and coalesces on top of that.
 *
 * It always answers 204. Whether a report was accepted, rate-limited or rejected is
 * information the caller has no use for and an attacker could measure.
 */

const schema = z.object({
  name: z.string().trim().max(120).default('Error'),
  message: z.string().trim().min(1).max(1000),
  stack: z.string().trim().max(4000).optional(),
  digest: z.string().trim().max(120).optional(),
  path: z.string().trim().max(512).optional(),
  boundary: z.enum(['global', 'site', 'admin', 'window', 'promise']).default('window'),
})

/**
 * Distinct client-sourced reports allowed per minute in this process.
 *
 * Generous for real traffic — a genuine bug coalesces to one fingerprint and costs one
 * slot. Only a flood of DIFFERENT messages, which is what abuse looks like, exhausts it.
 */
const BUDGET_PER_MINUTE = 60
const WINDOW_MS = 60_000

let windowStartedAt = 0
let spentInWindow = 0

function withinBudget(): boolean {
  const now = Date.now()
  if (now - windowStartedAt >= WINDOW_MS) {
    windowStartedAt = now
    spentInWindow = 0
  }
  if (spentInWindow >= BUDGET_PER_MINUTE) return false
  spentInWindow += 1
  return true
}

const NO_CONTENT = new NextResponse(null, { status: 204 })

export async function POST(request: Request): Promise<NextResponse> {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NO_CONTENT
  }

  const parsed = schema.safeParse(body)
  if (!parsed.success) return NO_CONTENT
  if (!withinBudget()) return NO_CONTENT

  const { name, message, stack, digest, path, boundary } = parsed.data

  // Rebuilt as a real Error so describeThrown treats it like any other, and the stack
  // the browser sent is redacted on the same path as a server stack.
  const error = new Error(message)
  error.name = name
  if (stack) error.stack = stack

  await reportError(error, {
    source: 'client',
    // A client error did not kill the request — the server already returned 200.
    // Marking it FATAL would drown the genuinely dead routes in the admin list.
    severity: 'ERROR',
    ...(path ? { requestPath: path } : {}),
    ...(digest ? { digest } : {}),
    context: { boundary },
  })

  return NO_CONTENT
}
