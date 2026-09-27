/**
 * ─────────────────────────────────────────────────────────────────────────────
 *  WHERE A VISITOR CAME FROM, BY PLATFORM (owner, 2026-09-14).
 *
 *  Two signals name a source. A tracking link tags the visit (utm_source is the
 *  platform picked when the link was made), and a click from a platform's own
 *  site leaves its address as the referrer. Both are folded into one platform, so
 *  Instagram means the bio link AND someone tapping the site in a story.
 *
 *  Pure, so the mapping is tested without a database.
 * ─────────────────────────────────────────────────────────────────────────────
 */

export interface Platform {
  readonly key: string
  readonly label: string
  /** Referrer hosts that mean this platform (subdomains included). */
  readonly hosts: readonly string[]
  /** Other spellings seen in utm_source. */
  readonly aliases: readonly string[]
  /** Offered when making a tracking link. */
  readonly forLinks: boolean
}

export const PLATFORMS: readonly Platform[] = [
  { key: 'instagram', label: 'Instagram', hosts: ['instagram.com'], aliases: ['ig', 'insta'], forLinks: true },
  { key: 'tiktok', label: 'TikTok', hosts: ['tiktok.com'], aliases: ['tt'], forLinks: true },
  { key: 'facebook', label: 'Facebook', hosts: ['facebook.com', 'fb.me', 'fb.com'], aliases: ['fb'], forLinks: true },
  { key: 'x', label: 'X (Twitter)', hosts: ['x.com', 'twitter.com', 't.co'], aliases: ['twitter', 'tw'], forLinks: true },
  { key: 'youtube', label: 'YouTube', hosts: ['youtube.com', 'youtu.be'], aliases: ['yt'], forLinks: true },
  { key: 'reddit', label: 'Reddit', hosts: ['reddit.com'], aliases: [], forLinks: true },
  { key: 'snapchat', label: 'Snapchat', hosts: ['snapchat.com'], aliases: ['snap'], forLinks: true },
  { key: 'pinterest', label: 'Pinterest', hosts: ['pinterest.com', 'pin.it'], aliases: [], forLinks: true },
  { key: 'threads', label: 'Threads', hosts: ['threads.net', 'threads.com'], aliases: [], forLinks: true },
  { key: 'telegram', label: 'Telegram', hosts: ['t.me', 'telegram.org', 'telegram.me'], aliases: ['tg'], forLinks: true },
  { key: 'whatsapp', label: 'WhatsApp', hosts: ['wa.me', 'whatsapp.com'], aliases: ['wa'], forLinks: true },
  { key: 'discord', label: 'Discord', hosts: ['discord.com', 'discord.gg', 'discordapp.com'], aliases: [], forLinks: true },
  { key: 'linkedin', label: 'LinkedIn', hosts: ['linkedin.com', 'lnkd.in'], aliases: [], forLinks: true },
  { key: 'email', label: 'Email', hosts: [], aliases: ['newsletter', 'mail'], forLinks: true },
  { key: 'other', label: 'Other', hosts: [], aliases: [], forLinks: true },
  { key: 'google', label: 'Google search', hosts: [], aliases: [], forLinks: false },
  { key: 'bing', label: 'Bing', hosts: ['bing.com'], aliases: [], forLinks: false },
  { key: 'duckduckgo', label: 'DuckDuckGo', hosts: ['duckduckgo.com'], aliases: ['ddg'], forLinks: false },
  { key: 'chatgpt', label: 'ChatGPT', hosts: ['chatgpt.com', 'chat.openai.com'], aliases: [], forLinks: false },
  { key: 'perplexity', label: 'Perplexity', hosts: ['perplexity.ai'], aliases: [], forLinks: false },
]

export const LINK_PLATFORMS = PLATFORMS.filter((p) => p.forLinks)

const byKey = new Map(PLATFORMS.map((p) => [p.key, p]))

export interface Source {
  /** A platform key, "direct", or "site:<host>" / "tag:<utm_source>" for anything else. */
  readonly key: string
  readonly label: string
}

export const DIRECT: Source = { key: 'direct', label: 'Direct' }

function hostOf(referrer: string): string | null {
  const raw = referrer.trim().toLowerCase()
  if (!raw) return null
  try {
    return new URL(raw.includes('://') ? raw : `https://${raw}`).hostname.replace(/^www\./, '')
  } catch {
    return null
  }
}

/** One visitor's source: the tracking link's platform first, then the referring site. */
export function sourceOf({ utmSource, referrer }: { utmSource?: string | null; referrer?: string | null }): Source {
  const tag = utmSource?.trim().toLowerCase()
  if (tag) {
    const platform = byKey.get(tag) ?? PLATFORMS.find((p) => p.aliases.includes(tag))
    if (platform) return { key: platform.key, label: platform.label }
  }
  const host = referrer ? hostOf(referrer) : null
  if (host) {
    if (/(^|\.)google\.[a-z.]+$/.test(host)) return { key: 'google', label: 'Google search' }
    const platform = PLATFORMS.find((p) => p.hosts.some((h) => host === h || host.endsWith(`.${h}`)))
    if (platform) return { key: platform.key, label: platform.label }
  }
  if (tag) return { key: `tag:${tag}`, label: tag }
  if (host) return { key: `site:${host}`, label: host }
  return DIRECT
}

export function platformLabel(key: string | null | undefined): string {
  if (!key) return 'Other'
  return byKey.get(key)?.label ?? key
}

/** A link address suggested from the platform and what it is for: "instagram-bio". */
export function suggestSlug(platform: string, label: string, random: () => number = Math.random): string {
  const words = label
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  const base = `${platform}-${words || Math.floor(random() * 36 ** 4).toString(36).padStart(4, '0')}`
  return base.slice(0, 40).replace(/-+$/g, '')
}
