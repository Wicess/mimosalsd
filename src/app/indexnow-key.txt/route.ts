import { notFound } from 'next/navigation'
import { indexNowKey } from '@/lib/seo/indexnow'

/**
 * The IndexNow key file.
 *
 * IndexNow proves host ownership by fetching a file on the host and checking its body
 * equals the submitted key. The default convention is `/<key>.txt`, but the protocol
 * lets a submission declare any `keyLocation` on the same host — so this serves the
 * key from ONE fixed path instead, and `submitUrls` points `keyLocation` here.
 *
 * That choice removes two problems. A `[key].txt` dynamic segment is not a shape the
 * App Router accepts, and a route that echoes whatever path it is given would be an
 * open reflector. A fixed path can only ever return the one configured key.
 *
 * Serving it from the SAME env var the submitter signs with removes the commonest
 * failure mode: a key file and a submission key that have drifted apart, which fails
 * as a silent 403 rather than as anything that looks like a problem.
 */
export async function GET() {
  const key = indexNowKey()
  if (!key) notFound()

  return new Response(key, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, s-maxage=86400',
    },
  })
}
