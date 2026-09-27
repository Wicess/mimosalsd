import { BRAND } from '@/lib/brand'
import { absoluteUrl, url } from '@/lib/seo/routes'

/**
 * Structured data builders.
 *
 * Every JSON-LD node the site emits is built here rather than hand-written per page,
 * for the same reason URLs are: a hand-maintained graph drifts from the page it
 * describes within one content cycle, and a schema that contradicts the visible page
 * is worse than no schema at all — it is a manual-action risk.
 *
 * Rule enforced by construction: a breadcrumb node is built from the SAME crumb list
 * the page renders visibly, so the two cannot disagree.
 */

/**
 * The organisation's stable identifier.
 *
 * Bing §16 asks for clear, consistent entity definition, and the way you say "the
 * publisher of this article and the seller of this product are the same organisation"
 * in JSON-LD is to give that organisation one `@id` and point at it from everywhere
 * else. Without it each page declares a fresh, unlinked Organization and the engine
 * has to infer they are the same company from the name alone.
 *
 * The fragment is arbitrary but must never change — it is the join key.
 */
export function organizationId(): string {
  return absoluteUrl('/#organization')
}

/** A reference to the organisation, for `publisher` and `seller` fields. */
export function organizationRef() {
  return { '@id': organizationId() } as const
}

export interface Crumb {
  readonly name: string
  /** Site-relative path. Absolutised here so no caller has to remember to. */
  readonly path: string
}

/**
 * BreadcrumbList.
 *
 * Google shows this in place of the raw URL in results, and it is one of the
 * strongest hierarchy signals available to an answer engine trying to work out how a
 * site is organised. The home page is deliberately NOT included: Google's guidance is
 * that the trail starts at the first level below the site root, and every one of our
 * trails already begins at a real hub.
 */
export function breadcrumbList(crumbs: readonly Crumb[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: crumbs.map((c, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: c.name,
      item: absoluteUrl(c.path),
    })),
  } as const
}

export interface ListedItem {
  readonly name: string
  readonly path: string
}

/**
 * ItemList for a collection page.
 *
 * Emitted as a `CollectionPage` with the list nested inside, rather than a bare
 * `ItemList`, so the node describes what the page IS as well as what it contains.
 * Items are referenced by URL only — the full Product node lives on the product page,
 * and duplicating it here would create two competing definitions of the same entity.
 */
export function collectionPage(args: {
  readonly name: string
  readonly description: string
  readonly path: string
  readonly items: readonly ListedItem[]
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: args.name,
    description: args.description,
    url: absoluteUrl(args.path),
    isPartOf: { '@id': absoluteUrl('/#website') },
    mainEntity: {
      '@type': 'ItemList',
      numberOfItems: args.items.length,
      itemListElement: args.items.map((item, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        name: item.name,
        url: absoluteUrl(item.path),
      })),
    },
  } as const
}

/**
 * Organization.
 *
 * `sameAs`, `logo`, `telephone` and the contact point are all emitted CONDITIONALLY.
 * `BRAND` ships with empty placeholders until launch, and an empty `sameAs: []` or a
 * logo pointing at a domain that does not resolve is worse than omitting the field —
 * it is a broken entity claim rather than an absent one. They light up on their own
 * the moment the real values land in `brand.ts`.
 */
/** `email` is the company address as set in the admin — read with getCompanyEmail(). */
export function organization(email: string) {
  /*
   * `BRAND` is `as const`, so every social handle currently narrows to the literal
   * type `''`. Widening to string here keeps this a runtime check rather than one
   * TypeScript resolves to "always empty" against the placeholder values — the whole
   * point is that it starts emitting the moment real handles land.
   */
  const sameAs = (Object.values(BRAND.social) as readonly string[]).filter(
    (handle) => handle.length > 0,
  )

  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    '@id': organizationId(),
    name: BRAND.name,
    legalName: BRAND.legalName,
    ...founder(),
    url: absoluteUrl('/'),
    description: BRAND.description,
    email,
    areaServed: { '@type': 'Country', name: 'United States' },
    /*
      Region and country always; the street and locality only once a real postal
      address is set. A PostalAddress with a region alone is valid and is what the
      business can honestly claim today — an invented street would be a false entity
      claim, which is worse than an incomplete one.
    */
    address: {
      '@type': 'PostalAddress',
      ...(BRAND.postalAddress ? { streetAddress: BRAND.postalAddress } : {}),
      addressRegion: BRAND.location.regionCode,
      addressCountry: BRAND.location.country,
    },
    ...(BRAND.phone ? { telephone: BRAND.phone } : {}),
    ...(sameAs.length > 0 ? { sameAs } : {}),
    contactPoint: [
      {
        '@type': 'ContactPoint',
        contactType: 'customer support',
        email,
        areaServed: 'US',
        availableLanguage: 'English',
      },
    ],
  } as const
}

/**
 * The founder, nested in Organization, only once `BRAND.proprietor` names a real
 * person. Every property is one the page shows: the name and post-nominal, the role,
 * the one-line title and the portrait. No founding date is emitted, because the
 * owner gave a floor ("more than 10 years"), not a year.
 */
function founder() {
  const { name, postNominal, role, title, portrait } = BRAND.proprietor
  if (!name) return {}
  return {
    founder: {
      '@type': 'Person',
      name,
      ...(postNominal ? { honorificSuffix: postNominal } : {}),
      jobTitle: role,
      ...(title ? { description: `${title.charAt(0).toUpperCase()}${title.slice(1)}.` } : {}),
      ...(portrait ? { image: absoluteUrl(portrait) } : {}),
    },
  } as const
}

export function website() {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': absoluteUrl('/#website'),
    name: BRAND.name,
    url: absoluteUrl('/'),
    publisher: organizationRef(),
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: `${absoluteUrl(url.shop())}?q={search_term_string}`,
      },
      'query-input': 'required name=search_term_string',
    },
  } as const
}

export interface FaqEntry {
  readonly question: string
  readonly answer: string
}

/**
 * FAQPage.
 *
 * Only ever built from questions and answers that are RENDERED on the page. Marking
 * up an answer a visitor cannot read is the same violation as marking up a review
 * that is not shown.
 */
export function faqPage(entries: readonly FaqEntry[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: entries.map((e) => ({
      '@type': 'Question',
      name: e.question,
      acceptedAnswer: { '@type': 'Answer', text: e.answer },
    })),
  } as const
}

/** Serialise for `dangerouslySetInnerHTML`, escaping the one sequence that can break out. */
export function jsonLdScript(data: unknown): string {
  return JSON.stringify(data).replace(/</g, '\\u003c')
}
