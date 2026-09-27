import { SAMPLE_IMAGES, imageSrc, type SampleImage } from '@/lib/catalog/sample-images'
import { heroAlt, heroSrc, isHeroKey } from './hero-image'

/**
 * The two pictures every blog carries: a main image at the top, and one inside the
 * post. Chosen from the site's own product photographs by what the post is about —
 * nothing invented, and each photograph's alt text is the catalogue's own, which
 * describes what is actually in the frame.
 */
export interface PostImages {
  readonly main: SampleImage
  readonly inline: SampleImage
}

const RULES: readonly { match: RegExp; main: string; inline: string }[] = [
  { match: /pact|vape|vapor/, main: 'disposable-vape', inline: 'amanita-gummies' },
  { match: /mimosa|dye|dyeing|bark/, main: 'mhrb-shredded', inline: 'mhrb-powder' },
  { match: /muscimol|amanita|mushroom/, main: 'amanita-caps', inline: 'amanita-powder' },
  { match: /test|batch|certificate|analysis|quality/, main: 'amanita-capsules', inline: 'mhrb-powder' },
  { match: /ship|delivery|restriction/, main: 'amanita-gummies', inline: 'disposable-vape' },
]

const POOL = Object.keys(SAMPLE_IMAGES)

export function postImages(post: { readonly slug: string; readonly title: string; readonly category?: string }): PostImages {
  const topic = `${post.slug} ${post.title} ${post.category ?? ''}`.toLowerCase()
  const rule = RULES.find((r) => r.match.test(topic))
  if (rule && SAMPLE_IMAGES[rule.main] && SAMPLE_IMAGES[rule.inline]) {
    return { main: SAMPLE_IMAGES[rule.main]!, inline: SAMPLE_IMAGES[rule.inline]! }
  }
  // No topic match: a stable pair for this slug, never the same photograph twice.
  let hash = 0
  for (const char of post.slug) hash = (hash * 31 + char.charCodeAt(0)) >>> 0
  const first = hash % POOL.length
  return {
    main: SAMPLE_IMAGES[POOL[first]!]!,
    inline: SAMPLE_IMAGES[POOL[(first + 1) % POOL.length]!]!,
  }
}

/** Other blogs to link from this one: same category first, then the most recent. */
export function relatedPosts<T extends { readonly slug: string; readonly category?: string; readonly updatedAt: string }>(
  current: T,
  all: readonly T[],
  count = 3,
): T[] {
  const others = all.filter((post) => post.slug !== current.slug)
  const byDate = (a: T, b: T) => b.updatedAt.localeCompare(a.updatedAt)
  const same = others.filter((post) => post.category && post.category === current.category).sort(byDate)
  const rest = others.filter((post) => !same.includes(post)).sort(byDate)
  return [...same, ...rest].slice(0, count)
}

/**
 * The picture a card shows for an article: its own hero when it has one, and only
 * otherwise the topic photograph above.
 *
 * The "More blogs" strip on an article page read `postImages()` directly, so three
 * cards in the same category drew the same stock photograph — and never the article's
 * own picture, once every article had one (owner, 2026-09-27). The blog index had the
 * rule inline; both now read it from here, so they cannot drift apart again.
 */
export function postCardImage(post: {
  readonly slug: string
  readonly title: string
  readonly category?: string
  readonly heroImageKey?: string
}): { readonly src: string; readonly alt: string } {
  const uploaded = post.heroImageKey && isHeroKey(post.heroImageKey) ? heroSrc(post.heroImageKey) : undefined
  if (uploaded) return { src: uploaded, alt: heroAlt(post.title) }
  const cover = postImages(post).main
  return { src: imageSrc(cover), alt: cover.alt }
}
