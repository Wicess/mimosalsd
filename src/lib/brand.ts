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
    'Mimosa hostilis and sassafras root bark sold as raw material for natural dyeing, soap and craft, in powder, shredded and stripped cuts. Orders are placed as a request rather than paid on the site: the order is checked against the address it is going to, then payment instructions follow. United States only.',

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
   * PENDING — the client's own founder, if they want one published.
   *
   * Every field is empty on purpose, and the sections that use it omit themselves
   * rather than show a stranger. A person, a photograph or a credential carried over
   * from another company would be a misrepresentation on a business selling
   * age-restricted goods, not a design detail.
   */
  proprietor: {
    // SAMPLE DATA: stand-ins so the founder section renders. Replaced with the
    // client's own before launch, or emptied so the section omits itself.
    name: 'Sample Name' as string,
    postNominal: '' as string,
    role: 'Founder' as string,
    title: 'sample one-line description of the founder' as string,
    statement:
      'Sample copy: one sentence from the founder about what this business does differently, replaced before launch.' as string,
    portrait: '/team/founder.jpg' as string,
    signature: '' as string,
  },

  /**
   * PENDING — the client's own trading history. Zero means the site says nothing
   * about how long it has traded or how many customers it has served, which is the
   * only honest default for a business opening its doors.
   */
  track: {
    yearsInBusiness: 0,
    customers: 0,
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
 * homepage, /about and llms.txt cannot drift apart: "in business for more than 10
 * years, with more than 10,000 customers across the United States".
 */
export function trackRecord(): string {
  const { yearsInBusiness, customers } = BRAND.track
  // Nothing to say until the client supplies real figures: a new business claiming
  // years and customers it has not had is the plainest kind of false statement.
  if (yearsInBusiness <= 0 || customers <= 0) return ''
  return `in business for more than ${yearsInBusiness} years, with more than ${customers.toLocaleString('en-US')} customers across the United States`
}
