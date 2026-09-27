import { after, NextResponse, type NextRequest } from 'next/server'
import { db } from '@/lib/db/client'
import { destination } from '@/lib/links/redirect'
import {
  ATTRIBUTION_COOKIE,
  ATTRIBUTION_MAX_AGE_SECONDS,
  encodeAttribution,
} from '@/lib/promoters/attribution'
import { crawlerName } from '@/lib/visitors/user-agent'

/**
 * /r/<slug>: a tracking link from the admin (/admin/links). Counts the click and
 * sends the visitor to the link's page on this site, tagged with the campaign
 * (lib/links/redirect.ts says why it never leaves the site).
 *
 * A retired or unknown link still lands somewhere useful, the homepage, rather
 * than a 404: it was probably printed somewhere nobody can edit.
 *
 * Link-preview fetchers (Slack, iMessage, X) and crawlers are sent on without
 * being counted: a link pasted into one busy channel would otherwise score dozens
 * of "clicks" before a single person opened it.
 *
 * A person also leaves with a cookie naming the link and the moment they clicked
 * it, so an order in the next thirty days can be credited to whoever sent them
 * (lib/promoters/attribution.ts). Crawlers get no cookie, as everywhere else.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const origin = request.nextUrl.origin
  const link = /^[a-z0-9-]{2,40}$/.test(slug)
    ? await db.trackingLink.findUnique({
        where: { slug },
        select: { id: true, slug: true, source: true, targetUrl: true, isActive: true },
      })
    : null

  const to =
    link && link.isActive
      ? destination(link.targetUrl, origin, link)
      : new URL('/', origin)

  const crawler = crawlerName(request.headers.get('user-agent'))
  if (link?.isActive && !crawler) {
    // After the response: the visitor never waits on the counter.
    after(async () => {
      await db.trackingLink
        .update({ where: { id: link.id }, data: { clicks: { increment: 1 }, lastClickAt: new Date() } })
        .catch(() => {})
    })
  }

  const response = new NextResponse(null, {
    status: 302,
    headers: { location: to.toString(), 'cache-control': 'no-store', 'x-robots-tag': 'noindex' },
  })
  if (link?.isActive && !crawler) {
    response.cookies.set(ATTRIBUTION_COOKIE, encodeAttribution(link.slug, new Date()), {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: ATTRIBUTION_MAX_AGE_SECONDS,
      path: '/',
    })
  }
  return response
}
