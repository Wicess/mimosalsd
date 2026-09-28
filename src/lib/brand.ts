/**
 * Brand configuration — the single place the business identity is defined.
 *
 * Everything user-facing reads from here so that naming the company is a one-line
 * change, not a find-and-replace across templates, emails, schema and seed data.
 * Values marked PENDING must be supplied before launch; Step 20 gates on it.
 */
export const BRAND = {
  name: 'MIMOSALSD',
  /** PENDING — the registered entity, once the client supplies it. */
  legalName: 'MIMOSALSD',
  /*
    Three sentences, and it must stay three: the homepage hero splits this on
    sentence boundaries and sets each one on its own line.

    Every clause has to be something a buyer can check on the page they land on —
    what the material is, how it is sold, where it goes. Adjectives are what every
    other site in this category leads with, and they are the first thing a cautious
    buyer discounts.
  */
  tagline: 'Botanical raw material. Sold by the pound. Shipped inside the United States.',
  description:
    'Mimosa hostilis and sassafras root bark sold as raw material for natural dyeing, soap and craft, in powder, shredded and whole cuts. Orders are placed as a request rather than paid on the site: the order is checked against the address it is going to, then payment instructions follow. United States only.',

  /**
   * The registered domain. Display and mailto links only — canonical URLs come from
   * NEXT_PUBLIC_SITE_URL.
   */
  domain: 'mimosalsd.com',

  /**
   * The company's ONE email address. Every contact link, email footer, reply-to and
   * form delivery uses this single mailbox.
   *
   * This is the DEFAULT; the address in use is set in Admin → Settings and read with
   * `getCompanyEmail()`. This value applies until one is saved there.
   */
  email: 'sales@mimosalsd.com',
  /**
   * The contact number (owner, 2026-09-27).
   *
   * Two forms on purpose: `phone` is what a person reads, `phoneE164` is what a
   * `tel:` link and schema.org's `telephone` want. Deriving one from the other at
   * every call site is how a site ends up with three different spellings of the
   * same number.
   */
  phone: '+1 (608) 556-4932' as string,
  phoneE164: '+16085564932' as string,
  /**
   * PENDING — the client's own postal address, set in Admin → Settings.
   *
   * CAN-SPAM requires a valid postal address in every commercial email, so email
   * blasts refuse to send while this is empty. It is not invented here: a made-up
   * address on marketing mail is a false statement, not a placeholder.
   */
  postalAddress: '' as string,

  /**
   * Where the business operates from (owner, 2026-09-27: the main branch is in
   * California, and it ships to every state).
   *
   * The region is a fact the site can state and a search engine can use — "ships from
   * California" is a real query, and Organization schema takes an address with a
   * region and no street. The street address is deliberately NOT here: it belongs to
   * `postalAddress` above, which is what CAN-SPAM and a Google Business Profile
   * require, and neither is satisfied by a region.
   */
  location: {
    region: 'California',
    regionCode: 'CA',
    country: 'US',
  },

  social: {
    linkedin: '' as string,
    instagram: '' as string,
    x: '' as string,
  },

  /** Company policy. Individual state rules may raise this, never lower it. */
  minimumAge: 21,

  /** Free shipping threshold in integer cents. Parcel-eligible subtotal only. */
  freeShippingThresholdCents: 10_000,

  /**
   * The owner, as the client supplied him (2026-09-28): Dr Kevin Turner, CEO, a PhD in
   * business and chemical engineering specialising in fumes, more than 30 years in the
   * industry, more than ten businesses.
   *
   * `statement` is written in the third person on purpose. It is set in display type
   * under "About the proprietor", and a first-person sentence there reads as a quote —
   * one he never gave. Swap in his own words when he supplies some.
   */
  proprietor: {
    name: 'Kevin Turner' as string,
    postNominal: 'PhD' as string,
    role: 'Owner & CEO' as string,
    title: 'chemical engineer, with a PhD in business and chemical engineering specialising in fumes' as string,
    statement:
      'Dr Turner has spent more than thirty years in this industry and built more than ten businesses. MIMOSALSD is the one he runs today.' as string,
    portrait: '/team/founder-kevin-turner.jpg' as string,
    signature: '' as string,
  },

  /**
   * The client's own trading history (2026-09-28): in business since 2010, 70,000
   * customers across the United States.
   *
   * The founding year, not a count of years: a count goes stale every January, a year
   * does not. `trackRecord()` and Organization schema both read it.
   */
  track: {
    foundedYear: 2010,
    customers: 70_000,
  },

  /** Developer credit rendered in the footer. */
  developer: {
    label: 'Developed by',
    name: 'W!CE',
    email: 'kenj52974@gmail.com',
    ariaLabel: 'Contact the developer, W!CE',
  },
} as const

export type Brand = typeof BRAND

/** "John McKenedy, PhD": the proprietor's name as it is set in full; '' until there is one. */
export function proprietorFullName(): string {
  const { name, postNominal } = BRAND.proprietor
  return name && postNominal ? `${name}, ${postNominal}` : name
}

/**
 * The track record as one sentence, for every surface that states it, so the
 * homepage, /about and llms.txt cannot drift apart: "in business since 2010, with
 * 70,000 customers across the United States".
 */
export function trackRecord(): string {
  const { foundedYear, customers } = BRAND.track
  // Nothing to say without real figures: a business claiming years and customers it
  // has not had is the plainest kind of false statement.
  if (foundedYear <= 0 || customers <= 0) return ''
  return `in business since ${foundedYear}, with ${customers.toLocaleString('en-US')} customers across the United States`
}
