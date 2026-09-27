/**
 * ─────────────────────────────────────────────────────────────────────────────
 *  WHAT KIND OF CLIENT — parsed from the user-agent, which is then discarded.
 *
 *  Ported from WHAM (lib/analytics.ts, lib/bot-detection.ts), where these rules
 *  were tuned against real traffic. Coarse on purpose: three device classes and a
 *  handful of browser and OS families. Anything finer is a fingerprint, and the
 *  full user-agent is never stored.
 *
 *  ── Two kinds of automation ────────────────────────────────────────────────
 *  A crawler that NAMES itself (Googlebot, GPTBot, ClaudeBot) gets no visitor
 *  record at all, just a count by name per day — which crawlers read the site is
 *  worth knowing here, where AI citation is a primary channel. A client that
 *  merely LOOKS automated gets a normal record, flagged, and hidden by default.
 * ─────────────────────────────────────────────────────────────────────────────
 */

export type Device = 'mobile' | 'tablet' | 'desktop'

export interface ClientInfo {
  readonly device: Device
  readonly browser: string
  readonly os: string
}

export function parseUserAgent(userAgent: string | null | undefined): ClientInfo {
  const s = (userAgent ?? '').toLowerCase()

  let device: Device = 'desktop'
  if (/ipad|tablet/.test(s)) device = 'tablet'
  else if (/mobile|android|iphone|ipod/.test(s)) device = 'mobile'

  let browser = 'Other'
  if (/edg\//.test(s)) browser = 'Edge'
  else if (/opr\/|opera/.test(s)) browser = 'Opera'
  else if (/chrome|crios/.test(s)) browser = 'Chrome'
  else if (/firefox|fxios/.test(s)) browser = 'Firefox'
  else if (/safari/.test(s)) browser = 'Safari'

  let os = 'Other'
  if (/windows/.test(s)) os = 'Windows'
  else if (/iphone|ipad|ipod/.test(s)) os = 'iOS'
  else if (/android/.test(s)) os = 'Android'
  else if (/mac os x|macintosh/.test(s)) os = 'macOS'
  else if (/linux/.test(s)) os = 'Linux'

  return { device, browser, os }
}

/**
 * Named crawlers, most specific first: "chatgpt-user" must win over a generic
 * "bot" match, and the name is what the admin shows.
 */
const NAMED_CRAWLERS: readonly [token: string, name: string][] = [
  ['googlebot', 'Googlebot'],
  ['google-inspectiontool', 'Google Inspection'],
  ['googleother', 'GoogleOther'],
  ['bingbot', 'Bingbot'],
  ['gptbot', 'GPTBot'],
  ['oai-searchbot', 'OAI-SearchBot'],
  ['chatgpt-user', 'ChatGPT-User'],
  ['claudebot', 'ClaudeBot'],
  ['claude-user', 'Claude-User'],
  ['claude-searchbot', 'Claude-SearchBot'],
  ['anthropic-ai', 'anthropic-ai'],
  ['perplexitybot', 'PerplexityBot'],
  ['perplexity-user', 'Perplexity-User'],
  ['ccbot', 'CCBot'],
  ['applebot', 'Applebot'],
  ['duckduckbot', 'DuckDuckBot'],
  ['yandexbot', 'YandexBot'],
  ['baiduspider', 'Baiduspider'],
  ['bytespider', 'Bytespider'],
  ['amazonbot', 'Amazonbot'],
  ['meta-externalagent', 'Meta'],
  ['facebookexternalhit', 'Facebook'],
  ['twitterbot', 'Twitterbot'],
  ['slackbot', 'Slackbot'],
  ['discordbot', 'Discordbot'],
  ['ahrefsbot', 'AhrefsBot'],
  ['semrushbot', 'SemrushBot'],
  ['mj12bot', 'MJ12bot'],
  ['dotbot', 'DotBot'],
  ['petalbot', 'PetalBot'],
]

/** Generic self-identification (WHAM's list): a script or crawler, name unknown. */
const GENERIC_TOKENS = [
  'bot',
  'crawler',
  'spider',
  'crawling',
  'headless',
  'lighthouse',
  'slurp',
  'bingpreview',
  'python',
  'curl/',
  'wget/',
  'axios/',
  'go-http-client',
  'java/',
  'okhttp',
  'phantomjs',
  'puppeteer',
  'playwright',
  'scrapy',
  'httpclient',
  'dataprovider',
  'fetcher',
  'monitor',
  'scan',
]

/** The crawler's name if the user-agent says it is one, else null. */
export function crawlerName(userAgent: string | null | undefined): string | null {
  if (!userAgent) return null
  const s = userAgent.toLowerCase()
  for (const [token, name] of NAMED_CRAWLERS) if (s.includes(token)) return name
  return GENERIC_TOKENS.some((token) => s.includes(token)) ? 'Other automated' : null
}

/**
 * Looks automated without saying so. Two fingerprints WHAM saw in production:
 * desktop-Linux Chrome arriving with no referrer (headless fleets on datacenter
 * addresses — real desktop-Linux shoppers are a rounding error), and Safari on a
 * system Safari does not ship for, which is always a spoofed user-agent.
 *
 * Bot until proven human: sustained browsing clears it (see HUMAN_PAGE_VIEWS).
 */
export function looksAutomated(client: ClientInfo, externalReferrer: string | null): boolean {
  const headlessFleet =
    client.os === 'Linux' && client.browser === 'Chrome' && client.device === 'desktop' && !externalReferrer
  const impossible =
    client.browser === 'Safari' && (client.os === 'Android' || client.os === 'Windows' || client.os === 'Linux')
  return headlessFleet || impossible
}

/** Page views in a day past which a flagged visitor is treated as a person. */
export const HUMAN_PAGE_VIEWS = 4
