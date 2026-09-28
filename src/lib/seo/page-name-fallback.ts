/**
 * A readable name for a site address without looking anything up: the fixed pages
 * by name, and anything else from its last segment ("/locations/fort-worth" reads
 * "Locations · Fort worth"). Pure, so it is safe anywhere and tested on its own.
 *
 * An order page is named but never spelled out: its address carries the customer's
 * private order token.
 */
const FIXED: Record<string, string> = {
  '/': 'Home',
  '/shop': 'Shop',
  '/blog': 'Blogs',
  '/guides': 'Guides',
  '/about': 'About us',
  '/faq': 'FAQ',
  '/contact': 'Contact',
  '/bulk': 'Bulk orders',
  '/cart': 'Cart',
  '/checkout': 'Checkout',
  '/account': 'Profile',
  '/account/chat': 'Profile · Chat',
  '/account/orders': 'Profile · Orders',
  '/account/subscription': 'Profile · Subscription',
  '/where-we-ship': 'Where we ship',
  '/lab-results': 'Lab results',
  '/locations': 'Locations',
  '/shop-near-me': 'Shop near me',
  '/legal-disclaimer': 'Legal disclaimer',
  '/offline': 'Offline page',
}

const SECTION: Record<string, string> = {
  product: 'Product',
  shop: 'Shop',
  blog: 'Blog',
  guides: 'Guide',
  policies: 'Policy',
  legality: 'Legality',
  'lab-results': 'Lab results',
  locations: 'Locations',
}

const readable = (slug: string) => {
  const words = decodeURIComponent(slug).replace(/[-_]+/g, ' ').trim()
  return words.charAt(0).toUpperCase() + words.slice(1)
}

export function pageNameFallback(path: string): string {
  const clean = path.split('?')[0]!.replace(/\/+$/, '') || '/'
  if (FIXED[clean]) return FIXED[clean]
  const [, root, ...rest] = clean.split('/')
  if (root === 'order') return 'Order status'
  if (!root) return clean
  if (rest.length === 0) return readable(root)
  const section = SECTION[root] ?? readable(root)
  return root === 'lab-results' ? `${section} · ${rest.join('/').toUpperCase()}` : `${section} · ${readable(rest[rest.length - 1]!)}`
}

/** Whether the admin should link to it: an order page is a customer's private address. */
export function isLinkablePage(path: string): boolean {
  return !path.startsWith('/order/') && !path.startsWith('/account')
}
