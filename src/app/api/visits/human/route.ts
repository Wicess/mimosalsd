import { z } from 'zod'
import { HUMAN_KIND } from '@/lib/visitors/activity'
import { recordActivity } from '@/lib/visitors/record-activity'
import { crawlerName } from '@/lib/visitors/user-agent'

/**
 * A person was here: the page ran and someone used it (components/visitors/
 * human-check.tsx). Recorded once per visitor, for the visitor cookie the request
 * carries, and only from this site's own pages — a request from anywhere else, or
 * from a client that names itself a crawler, is ignored. The answer is the same
 * either way, so nothing can be learned by probing it.
 *
 * Not a lock: a determined script can send this too. It is one more thing a bot
 * has to deliberately fake, on top of running the page, and the ones that fill a
 * visitor list never bother.
 */
const schema = z.object({ path: z.string().max(200).regex(/^\//).optional() })

function fromThisSite(request: Request): boolean {
  const site = request.headers.get('sec-fetch-site')
  if (site) return site === 'same-origin'
  // Browsers without Fetch Metadata (older Safari) still send Origin on a POST.
  const origin = request.headers.get('origin')
  if (!origin) return false
  try {
    return new URL(origin).host === new URL(request.url).host
  } catch {
    return false
  }
}

export async function POST(request: Request): Promise<Response> {
  const userAgent = request.headers.get('user-agent')
  const parsed = schema.safeParse(await request.json().catch(() => null))
  if (parsed.success && userAgent && !crawlerName(userAgent) && fromThisSite(request)) {
    await recordActivity(HUMAN_KIND, { path: parsed.data.path ?? null })
  }
  return new Response(null, { status: 204, headers: { 'cache-control': 'no-store' } })
}
