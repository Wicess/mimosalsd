/**
 * Canonical URL taxonomy.
 *
 * URLs are the hardest thing to change after launch and the most damaging to get
 * wrong, and organic search is this business's ONLY acquisition channel. So the
 * taxonomy is declared once, here, and every link, sitemap entry and canonical tag
 * derives from it. Nothing constructs a URL by string concatenation elsewhere.
 *
 * Rule: one intent, one URL. Two pages targeting the same primary query cannibalise
 * each other — the most common self-inflicted wound in commerce SEO.
 *
 * SECOND RULE, learned the hard way: a route declared here MUST have a page behind
 * it. Ten entries below once described pages that did not exist; because they were
 * `INDEX` and `inSitemap`, the sitemap submitted ten URLs that returned 404 and the
 * footer linked eight of them from every page on the site. The manifest was tested
 * for internal consistency and passed, because nothing checked it against the app
 * directory. `tests/seo/routes.test.ts` now does. Do not add an entry here for a page
 * you are about to build — add it when the page exists.
 */

export type IndexPolicy =
  | 'INDEX' // indexable, in the sitemap
  | 'NOINDEX_FOLLOW' // crawlable for link equity, kept out of the index
  | 'NOINDEX_NOFOLLOW' // private

export interface RouteDefinition {
  readonly id: string
  readonly pattern: string
  /** The single primary search intent this URL owns. */
  readonly primaryIntent: string
  readonly indexPolicy: IndexPolicy
  readonly inSitemap: boolean
  /** Sitemap priority, 0–1. */
  readonly priority: number
  readonly changeFrequency:
    | 'always' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'never'
}

export const ROUTES = {
  home: { id: 'home', pattern: '/', primaryIntent: 'brand + category entry', indexPolicy: 'INDEX', inSitemap: true, priority: 1.0, changeFrequency: 'daily' },
  shop: { id: 'shop', pattern: '/shop', primaryIntent: 'buy legal psychedelics and botanicals online', indexPolicy: 'INDEX', inSitemap: true, priority: 0.9, changeFrequency: 'daily' },
  category: { id: 'category', pattern: '/shop/[category]', primaryIntent: 'buy [product line] online', indexPolicy: 'INDEX', inSitemap: true, priority: 0.95, changeFrequency: 'daily' },
  product: { id: 'product', pattern: '/product/[slug]', primaryIntent: 'buy [specific product]', indexPolicy: 'INDEX', inSitemap: true, priority: 0.9, changeFrequency: 'weekly' },

  locationsHub: { id: 'locations-hub', pattern: '/locations', primaryIntent: 'store locations and pickup points', indexPolicy: 'INDEX', inSitemap: true, priority: 0.7, changeFrequency: 'monthly' },
  location: { id: 'location', pattern: '/locations/[city]', primaryIntent: '[product] in [city]', indexPolicy: 'INDEX', inSitemap: true, priority: 0.7, changeFrequency: 'monthly' },

  shopNearMe: { id: 'shop-near-me', pattern: '/shop-near-me', primaryIntent: 'what ships to my location (utility, not a keyword page)', indexPolicy: 'INDEX', inSitemap: true, priority: 0.6, changeFrequency: 'monthly' },

  legalityHub: { id: 'legality-hub', pattern: '/where-we-ship', primaryIntent: 'where to buy [product] in the united states', indexPolicy: 'INDEX', inSitemap: true, priority: 0.9, changeFrequency: 'weekly' },
  legalityState: { id: 'legality-state', pattern: '/where-we-ship/[state]', primaryIntent: 'buy [product] in [state or city]', indexPolicy: 'INDEX', inSitemap: true, priority: 0.9, changeFrequency: 'weekly' },


  labResults: { id: 'lab-results', pattern: '/lab-results', primaryIntent: 'certificate of analysis lookup', indexPolicy: 'INDEX', inSitemap: true, priority: 0.3, changeFrequency: 'weekly' },
  labBatch: { id: 'lab-batch', pattern: '/lab-results/[batch]', primaryIntent: 'COA for batch [code]', indexPolicy: 'INDEX', inSitemap: true, priority: 0.5, changeFrequency: 'yearly' },

  blog: { id: 'blog', pattern: '/blog', primaryIntent: 'educational content hub', indexPolicy: 'INDEX', inSitemap: true, priority: 0.6, changeFrequency: 'daily' },
  blogPost: { id: 'blog-post', pattern: '/blog/[slug]', primaryIntent: 'per-article informational query', indexPolicy: 'INDEX', inSitemap: true, priority: 0.7, changeFrequency: 'monthly' },
  guide: { id: 'guide', pattern: '/guides/[slug]', primaryIntent: 'comprehensive pillar query', indexPolicy: 'INDEX', inSitemap: true, priority: 0.8, changeFrequency: 'monthly' },

  about: { id: 'about', pattern: '/about', primaryIntent: 'who is [brand]', indexPolicy: 'INDEX', inSitemap: true, priority: 0.5, changeFrequency: 'yearly' },
  faq: { id: 'faq', pattern: '/faq', primaryIntent: 'common purchase questions', indexPolicy: 'INDEX', inSitemap: true, priority: 0.6, changeFrequency: 'monthly' },
  contact: { id: 'contact', pattern: '/contact', primaryIntent: 'contact the seller', indexPolicy: 'INDEX', inSitemap: true, priority: 0.4, changeFrequency: 'yearly' },
  bulk: { id: 'bulk', pattern: '/bulk', primaryIntent: 'wholesale / bulk purchase', indexPolicy: 'INDEX', inSitemap: true, priority: 0.8, changeFrequency: 'monthly' },

  shippingPolicy: { id: 'shipping-policy', pattern: '/policies/shipping', primaryIntent: 'shipping and delivery terms', indexPolicy: 'INDEX', inSitemap: true, priority: 0.5, changeFrequency: 'monthly' },
  returnsPolicy: { id: 'returns-policy', pattern: '/policies/returns', primaryIntent: 'returns and refunds', indexPolicy: 'INDEX', inSitemap: true, priority: 0.4, changeFrequency: 'yearly' },
  purchasePolicy: { id: 'purchase-policy', pattern: '/policies/purchase', primaryIntent: 'purchase terms and order process', indexPolicy: 'INDEX', inSitemap: true, priority: 0.4, changeFrequency: 'yearly' },
  privacyPolicy: { id: 'privacy-policy', pattern: '/policies/privacy', primaryIntent: 'privacy and data handling', indexPolicy: 'INDEX', inSitemap: true, priority: 0.3, changeFrequency: 'yearly' },
  terms: { id: 'terms', pattern: '/policies/terms', primaryIntent: 'terms of service', indexPolicy: 'INDEX', inSitemap: true, priority: 0.3, changeFrequency: 'yearly' },
  legalDisclaimer: { id: 'legal-disclaimer', pattern: '/legal-disclaimer', primaryIntent: 'legal disclaimer and FDA statement', indexPolicy: 'INDEX', inSitemap: true, priority: 0.4, changeFrequency: 'yearly' },

  // Transactional and private surfaces. Never indexed — they have no search intent,
  // they dilute crawl budget, and account pages leak PII into the index if mishandled.
  cart: { id: 'cart', pattern: '/cart', primaryIntent: 'n/a', indexPolicy: 'NOINDEX_FOLLOW', inSitemap: false, priority: 0, changeFrequency: 'never' },
  checkout: { id: 'checkout', pattern: '/checkout', primaryIntent: 'n/a', indexPolicy: 'NOINDEX_NOFOLLOW', inSitemap: false, priority: 0, changeFrequency: 'never' },
  orderStatus: { id: 'order-status', pattern: '/order/[token]', primaryIntent: 'n/a', indexPolicy: 'NOINDEX_NOFOLLOW', inSitemap: false, priority: 0, changeFrequency: 'never' },
  account: { id: 'account', pattern: '/account', primaryIntent: 'n/a', indexPolicy: 'NOINDEX_NOFOLLOW', inSitemap: false, priority: 0, changeFrequency: 'never' },
  admin: { id: 'admin', pattern: '/admin', primaryIntent: 'n/a', indexPolicy: 'NOINDEX_NOFOLLOW', inSitemap: false, priority: 0, changeFrequency: 'never' },
} as const satisfies Record<string, RouteDefinition>

export type RouteId = (typeof ROUTES)[keyof typeof ROUTES]['id']

// ── URL builders. Nothing in the app concatenates a path by hand. ─────────────

export const url = {
  home: () => '/',
  shop: () => '/shop',
  category: (slug: string) => `/shop/${slug}`,
  product: (slug: string) => `/product/${slug}`,
  locationsHub: () => '/locations',
  location: (citySlug: string) => `/locations/${citySlug}`,
  legalityHub: () => '/where-we-ship',
  shopNearMe: () => '/shop-near-me',
  legalityState: (stateSlug: string) => `/where-we-ship/${stateSlug}`,
  labResults: () => '/lab-results',
  labBatch: (batchCode: string) => `/lab-results/${batchCode.toLowerCase()}`,
  blog: () => '/blog',
  blogPost: (slug: string) => `/blog/${slug}`,
  guide: (slug: string) => `/guides/${slug}`,
  about: () => '/about',
  faq: () => '/faq',
  contact: () => '/contact',
  bulk: () => '/bulk',
  cart: () => '/cart',
  checkout: () => '/checkout',
  orderStatus: (token: string) => `/order/${token}`,
  account: () => '/account',
  accountOrders: () => '/account/orders',
  accountSubscription: () => '/account/subscription',
  accountChat: () => '/account/chat',
  policy: (name: 'shipping' | 'returns' | 'purchase' | 'privacy' | 'terms') =>
    `/policies/${name}`,
  legalDisclaimer: () => '/legal-disclaimer',
} as const

export function absoluteUrl(path: string): string {
  // `??` is not enough here. An env var that exists but is empty — a common
  // misconfiguration on hosted platforms — would make `new URL(path, '')` throw,
  // taking down every canonical tag and the sitemap with it. Treat empty as unset.
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim()
  const base = configured && configured.length > 0 ? configured : 'http://localhost:3000'
  return new URL(path, base).toString()
}

/**
 * Filtered/faceted URLs must be crawlable for link equity but kept out of the index.
 * Without this, every filter combination becomes an indexable near-duplicate and the
 * crawl budget drains into a combinatorial hole.
 */
export function indexPolicyFor(pathname: string, searchParams?: URLSearchParams): IndexPolicy {
  if (searchParams && [...searchParams.keys()].some((k) => FACET_PARAMS.has(k))) {
    return 'NOINDEX_FOLLOW'
  }
  const match = Object.values(ROUTES).find((r) => matchesPattern(pathname, r.pattern))
  return match?.indexPolicy ?? 'INDEX'
}

export const FACET_PARAMS = new Set([
  'sort', 'price', 'strength', 'form', 'availability', 'page', 'q', 'filter',
])

function matchesPattern(pathname: string, pattern: string): boolean {
  const p = pattern.split('/').filter(Boolean)
  const s = pathname.split('/').filter(Boolean)
  if (p.length !== s.length) return false
  return p.every((seg, i) => seg.startsWith('[') || seg === s[i])
}

/**
 * ── INTERNAL LINKING RULES ─────────────────────────────────────────────────
 *
 * Authority should flow in a loop, not a tree. These rules are implemented by
 * components (Step 8 onward) so links are GENERATED, never hand-maintained — a
 * hand-maintained internal link graph rots within one content cycle.
 */
export const LINKING_RULES = {
  /** Every PDP links out to its COA batch, its category, and its legality context. */
  product: ['labBatch', 'category', 'legalityState', 'shippingPolicy'],
  /** Every state page links to the SKUs that ship there and to neighbouring states. */
  legalityState: ['category', 'product', 'legalityState', 'shopNearMe', 'locationsHub'],
  /** Every location links to its state page and to what it stocks. */
  location: ['legalityState', 'category', 'shopNearMe'],
  /** Every post links up to its pillar guide and out to recommended products. */
  blogPost: ['guide', 'product', 'legalityHub'],
  /** Every guide links down to its cluster posts and out to the shop. */
  guide: ['blogPost', 'category', 'legalityHub'],
  /** Every batch page links back to the products it covers. */
  labBatch: ['product', 'labResults'],
} as const satisfies Partial<Record<RouteId | string, readonly string[]>>
