/**
 * ─────────────────────────────────────────────────────────────────────────────
 *  TRACKING LINKS — where /r/<slug> may send someone. Pure.
 *
 *  The admin has always said a link "becomes /r/<slug>", and nothing served that
 *  path: every link handed out returned a 404. The route is app/r/[slug].
 *
 *  ── On this site only ──────────────────────────────────────────────────────
 *  The admin form accepts any full URL. Followed blindly, /r/ would be an open
 *  redirect on this domain — a trusted address that forwards anywhere, which is
 *  exactly what a phishing message wants, and one stolen admin login away. So a
 *  target off this site is never followed; the visitor lands on the homepage.
 *
 *  ── Tagged for attribution ─────────────────────────────────────────────────
 *  The destination gets utm_source / utm_medium / utm_campaign unless it already
 *  has its own, so the visit is credited to the link by the same first-touch
 *  campaign fields every other visit uses.
 * ─────────────────────────────────────────────────────────────────────────────
 */

export interface LinkTags {
  readonly slug: string
  readonly source: string | null
}

/** The target as a URL on this site, or null when it points anywhere else. */
export function onSiteTarget(target: string, siteOrigin: string): URL | null {
  let url: URL
  try {
    url = new URL(target, siteOrigin)
  } catch {
    return null
  }
  const site = new URL(siteOrigin)
  const bare = (host: string) => host.toLowerCase().replace(/^www\./, '')
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null
  return bare(url.host) === bare(site.host) ? url : null
}

export type TargetResult = { ok: true; value: string } | { ok: false; error: string }

/**
 * The target as the admin form may store it: a path on this site, or a full URL
 * on this site, normalised to a path.
 *
 * The route already refuses to follow anywhere else, but refusing it only there
 * means the form accepts a link that quietly lands every visitor on the homepage
 * — it looks like it works until somebody checks where the traffic went. So the
 * same rule answers at the keyboard, where it can say why.
 */
export function readTarget(input: string, siteOrigin: string): TargetResult {
  const raw = input.trim()
  if (!raw) return { ok: false, error: 'Give the link somewhere to go, as a path like /shop.' }
  const url = onSiteTarget(raw, siteOrigin)
  if (!url) {
    return {
      ok: false,
      error: `A tracking link can only point at a page on this site. Write it as a path, like /shop/amanita: ${raw}`,
    }
  }
  return { ok: true, value: `${url.pathname}${url.search}${url.hash}` }
}

export function destination(target: string, siteOrigin: string, link: LinkTags): URL {
  const url = onSiteTarget(target, siteOrigin) ?? new URL('/', siteOrigin)
  // Keep the visitor on the address they reached us at, whatever host the admin typed.
  const out = new URL(`${url.pathname}${url.search}${url.hash}`, siteOrigin)
  const tags: [string, string][] = [
    ['utm_source', link.source?.trim() || link.slug],
    ['utm_medium', 'link'],
    ['utm_campaign', link.slug],
  ]
  if (!out.searchParams.has('utm_source')) {
    for (const [key, value] of tags) out.searchParams.set(key, value)
  }
  return out
}
