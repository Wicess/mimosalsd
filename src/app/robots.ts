import type { MetadataRoute } from 'next'
import { absoluteUrl } from '@/lib/seo/routes'

/**
 * AI crawlers are explicitly allowed.
 *
 * Roughly 40% of information-seeking queries now begin in an AI interface, and paid
 * advertising is prohibited in this category — so AI citation is not a side channel,
 * it is a primary one. Blocking these agents to "protect content" would be a
 * strategic error.
 */
/*
  Each vendor now splits training, search indexing and user-requested fetches across
  separate agents, and a block for one says nothing about the others. The search and
  user agents are the ones that put a page in front of a reader with a citation, so
  they are named here as well as the training ones (2026-09-18: Claude-SearchBot,
  Claude-User, Perplexity-User added). Anything unnamed still falls to `*`, which
  allows the same public paths.
*/
const AI_CRAWLERS = [
  'GPTBot', 'OAI-SearchBot', 'ChatGPT-User',
  'ClaudeBot', 'Claude-SearchBot', 'Claude-User', 'Claude-Web', 'anthropic-ai',
  'PerplexityBot', 'Perplexity-User', 'Google-Extended', 'CCBot', 'Applebot-Extended',
]

const PRIVATE_PATHS = ['/admin', '/api', '/account', '/checkout', '/order/', '/cart']

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: '*', allow: '/', disallow: PRIVATE_PATHS },
      ...AI_CRAWLERS.map((userAgent) => ({
        userAgent,
        allow: '/',
        disallow: PRIVATE_PATHS,
      })),
    ],
    sitemap: absoluteUrl('/sitemap.xml'),
    /*
      No `host` directive.

      It emitted a `Host:` line with a full URL, which was wrong twice over. The
      directive takes a bare hostname — no scheme, no trailing slash — and it is a
      Yandex convention that Google and Bing have never read. Yandex itself
      deprecated it in 2018 in favour of a 301, which this site already does: the
      apex redirects to www, and the canonical tags name www.

      So it named the wrong format, for an engine this US-only catalogue does not
      serve, to say something the redirect already says. Removed rather than
      corrected. If a future reader is tempted to add it back, that is the reason
      not to.
    */
  }
}
