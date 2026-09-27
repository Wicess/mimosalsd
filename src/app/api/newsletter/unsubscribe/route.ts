import { unsubscribeWithToken } from '@/lib/newsletter/unsubscribe-store'

/**
 * One-click unsubscribe (RFC 8058), for mail clients.
 *
 * The List-Unsubscribe header on every blast points here, and Gmail's or Apple
 * Mail's own "Unsubscribe" button POSTs to it. POST only: link scanners fetch
 * URLs with GET, and a GET that unsubscribed would opt out everyone whose mail
 * is scanned. A GET is sent to the page, which asks first.
 */
export async function POST(request: Request): Promise<Response> {
  const url = new URL(request.url)
  const outcome = await unsubscribeWithToken(url.searchParams.get('s') ?? '', url.searchParams.get('t') ?? '')
  const headers = { 'cache-control': 'no-store', 'content-type': 'text/plain; charset=utf-8' }
  if (outcome === 'invalid') return new Response('This unsubscribe link is not valid.', { status: 400, headers })
  return new Response('Unsubscribed.', { status: 200, headers })
}

export function GET(request: Request): Response {
  const url = new URL(request.url)
  return Response.redirect(new URL(`/unsubscribe${url.search}`, url), 303)
}
