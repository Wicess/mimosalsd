import { publishedGuides, publishedPosts } from '@/lib/content/content.data'
import { listMergedProducts } from '@/lib/catalog/merged'
import type { ProductLine } from '@/lib/compliance/types'
import { Badge } from '@/components/ui/badge'
import { ButtonLink } from '@/components/ui/button'
import { url } from '@/lib/seo/routes'

/**
 * Which product line is a piece of content about?
 *
 * Derived from the products it already recommends rather than from a new field on
 * every post. The relationship exists in the data twice over — an article about
 * muscimol recommends Amanita capsules, not root bark — so asking authors to also
 * tag it would create a second copy that can disagree with the first.
 */
function linesFor(
  item: { readonly recommendedProductSlugs: readonly string[] },
  lineOf: ReadonlyMap<string, ProductLine>,
) {
  const lines = new Set<ProductLine>()
  for (const slug of item.recommendedProductSlugs) {
    const line = lineOf.get(slug)
    if (line) lines.add(line)
  }
  return lines
}

/**
 * Guides and articles, below a set of products.
 *
 * Not filler. Acquisition here is entirely organic, and the two things that has
 * to produce are a reason to trust the shop and a reason for anything to link to
 * it — a shelf of products does neither. A buyer who has just read four price
 * tags and is not ready to commit has, right here, the piece that answers the
 * question actually stopping them: what this material is, how to read the report
 * that comes with it, why one mushroom is lawful and another is not.
 *
 * It is also the internal linking that makes the guides rank at all. A guide with
 * no inbound links from the commercial pages is a guide the crawler reaches last
 * and weights least.
 *
 * `exclude` keeps a guide off its own page, so a product page cross-linking to
 * three articles never lists the one already open above it.
 *
 * ── Where the band went ─────────────────────────────────────────────────────
 * This drew its own rule and tinted panel until the whole site adopted the
 * homepage's full-bleed bands. The page wraps it in a `PageSection` now; nesting
 * a rounded panel inside a tinted band would be a box inside a box.
 *
 * The action is a real button rather than a text link. It is the one thing in the
 * band worth doing if none of the three cards is the right one, and a underlined
 * phrase tucked beside the heading was not carrying that.
 */
export async function GuidesStrip({
  heading = 'Read before you buy',
  summary = 'Informative first. We publish what we can verify and cite what we rely on.',
  exclude = [],
  limit = 3,
  productLine,
  className,
}: {
  heading?: string
  summary?: string
  exclude?: readonly string[]
  limit?: number
  /**
   * Put this line's own writing first.
   *
   * Without it the strip took the first three items in authoring order, which meant
   * the Amanita category page recommended three articles about root bark. That is a
   * bad recommendation to a reader and a worse signal to a crawler: a commercial page
   * whose only outbound links are to an unrelated subject.
   *
   * Relevant items lead; the rest backfill. It never renders short, because a strip
   * that empties out on a line with little coverage is a worse outcome than a strip
   * whose third card is merely adjacent.
   */
  productLine?: ProductLine
  className?: string
}) {
  const candidates = [...publishedGuides(), ...publishedPosts()].filter(
    (item) => !exclude.includes(item.slug),
  )

  const lineOf = new Map(
    productLine ? (await listMergedProducts()).map((p) => [p.slug, p.productLine] as const) : [],
  )
  const items = (
    productLine
      ? [
          ...candidates.filter((item) => linesFor(item, lineOf).has(productLine)),
          ...candidates.filter((item) => !linesFor(item, lineOf).has(productLine)),
        ]
      : candidates
  ).slice(0, limit)

  if (items.length === 0) return null

  return (
    <div className={className}>
        <h2
          id="guides-strip"
          className="font-display text-3xl leading-tight text-balance text-foreground"
        >
          {heading}
        </h2>
        <div aria-hidden className="mt-4 h-0.5 w-10 rounded-full bg-accent" />

        <p className="mt-5 max-w-[68ch] leading-relaxed text-pretty text-foreground-muted">
          {summary}
        </p>

        <div className="stagger mt-8 grid gap-5 md:grid-cols-3">
          {items.map((item) => {
            const isGuide = 'clusterSlugs' in item
            return (
              <a
                key={item.slug}
                href={isGuide ? url.guide(item.slug) : url.blogPost(item.slug)}
                /*
                  Border and lift, not a wide drop shadow. A 1px border under a
                  16px-blur shadow is the stock "floating card" that makes every
                  generated layout look the same; moving the card and firming its
                  edge says the same thing without it.
                */
                className="card-lift group/card rounded-xl border border-border bg-surface p-5"
              >
                <Badge tone="accent">{isGuide ? 'Guide' : 'Article'}</Badge>
                <h3 className="font-product mt-3 text-base leading-snug font-semibold tracking-[-0.01em] text-balance text-foreground">
                  {item.title}
                </h3>
                <p className="mt-2 line-clamp-4 text-sm leading-relaxed text-pretty text-foreground-muted">
                  {item.summary}
                </p>
              </a>
            )
          })}
        </div>

        <div className="mt-8">
          <ButtonLink href={url.blog()} variant="secondary">
            All guides &amp; articles
          </ButtonLink>
        </div>
    </div>
  )
}
