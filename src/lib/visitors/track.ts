import type { NextRequest, NextResponse } from 'next/server'
import { isVisitorId, VISITOR_COOKIE, VISITOR_MAX_AGE } from './cookie'
import { record } from './buffer'
import { buildVisitEvent, isCountablePageView } from './page-view'
import { crawlerName } from './user-agent'

/**
 * Record one page view from the proxy.
 *
 * The view goes into an in-memory batch (lib/visitors/buffer.ts); when the batch
 * is due it is posted to our own collection endpoint, under `waitUntil`, so no
 * visitor ever waits and browsing costs no database write of its own.
 *
 * Does nothing at all — no cookie, no batch, no request — unless the admin is
 * configured, because the batch is signed with that secret. A crawler that names
 * itself gets no cookie; it is counted by name instead.
 */

export function trackVisit(
  request: NextRequest,
  response: NextResponse,
  waitUntil?: (promise: Promise<unknown>) => void,
): void {
  if (!process.env.ADMIN_SESSION_SECRET) return
  const { pathname, searchParams, host } = request.nextUrl
  if (!isCountablePageView(request.method, pathname, request.headers)) return

  let visitorId = request.cookies.get(VISITOR_COOKIE)?.value
  let minted = false
  if (!isVisitorId(visitorId) && !crawlerName(request.headers.get('user-agent'))) {
    visitorId = crypto.randomUUID()
    minted = true
    response.cookies.set(VISITOR_COOKIE, visitorId, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: VISITOR_MAX_AGE,
      path: '/',
    })
  }

  const event = buildVisitEvent({
    visitorId: visitorId ?? '',
    minted,
    now: Date.now(),
    pathname,
    search: searchParams,
    host,
    headers: request.headers,
  })

  // Null when the batch is simply held for later, which is most of the time.
  const sending = record(event, request.nextUrl.origin)
  if (sending && waitUntil) waitUntil(sending)
}
