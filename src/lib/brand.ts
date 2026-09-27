/**
 * Brand configuration — the single place the business identity is defined.
 *
 * Everything user-facing reads from here so that naming the company is a one-line
 * change, not a find-and-replace across templates, emails, schema and seed data.
 * Values marked PENDING must be supplied before launch; Step 20 gates on it.
 */
export const BRAND = {
  name: 'SnypeGate',
  legalName: 'SnypeGate LLC',
  /*
    Three sentences, and it must stay three: the homepage hero splits this on
    sentence boundaries and sets each one on its own line.

    Every clause is a fact a visitor can go and check — a batch report, a cited
    statute, the packaging they receive. That is deliberate. "Premium" and
    "number one" are the two things a buyer in this category has read on every
    site that later sold them something untested, so the positioning is built
    from what is verifiable instead of from adjectives.
  */
  tagline: 'Lab-Tested. State-Verified. Discreetly Delivered.',
  description:
    'Disposable vapes, distributed direct, with Mimosa hostilis root bark and sassafras sold as raw botanical material for dyeing and craft. United States only: what can ship where is decided per product line at checkout, from state positions that carry the date a person last reviewed them. Every batch is lab-tested, and a certified copy of the report is issued to verified buyers on request.',

  /**
   * PENDING — confirm before launch.
   *
   * Assumed from the trading name so the contact addresses below are not left
   * reading `@example.com` on a live site. If the registered domain differs,
   * this line and the three addresses are the only places to change it.
   *
   * Note this is NOT what builds canonical URLs — those come from
   * NEXT_PUBLIC_SITE_URL. This value is for display and mailto links.
   */
  domain: 'snypegate.com',

  /**
   * The company's ONE email address — the owner's rule. There is no orders@, support@
   * or wholesale@: every contact link, email footer, reply-to and form delivery uses
   * this single mailbox.
   *
   * This is the DEFAULT. The address in use is set in Admin → Settings and read with
   * `getCompanyEmail()` (lib/site/company-email.server.ts); this value applies until
   * one is saved there, and wherever the database cannot be read (the proxy).
   */
  email: 'sales@snypegate.com',
  phone: '',
  /**
   * The DEFAULT postal address, one line. The owner sets the real one in
   * Admin → Settings (lib/site/postal-address.ts); this applies only until then.
   *
   * CAN-SPAM requires a valid postal address (a street address, a USPS box, or a
   * registered private mailbox) in every commercial email, so email blasts refuse to
   * send while this is empty. It is not invented here for the same reason the
   * proprietor's name is not: a made-up address on marketing mail is a false
   * statement, not a placeholder.
   */
  postalAddress: '',

  social: {
    linkedin: '', // matters for the bulk/B2B funnel — Copilot weights LinkedIn heavily
    instagram: '',
    x: '',
  },

  /** Company policy. Individual state rules may raise this, never lower it. */
  minimumAge: 21,

  /** Free shipping threshold in integer cents. Parcel-eligible subtotal only. */
  freeShippingThresholdCents: 10_000,

  /**
   * The person behind the business, for the "About the proprietor" section and the
   * founder story on /about.
   *
   * Supplied by the owner on 2026-09-11: the name, the credentials, the one-line
   * title and the photograph, which the owner confirmed is John himself and not a
   * stock image. Nothing here is invented, and nothing may be: a fabricated owner
   * attached to a real trading company is a misrepresentation, not a design detail,
   * on a business that sells age-restricted goods.
   *
   * `portrait` and `signature` are paths under /public. Leave one empty and the
   * section omits it rather than showing a stranger.
   */
  proprietor: {
    name: 'John McKenedy',
    /** Set after the name wherever it appears in full: "John McKenedy, PhD". */
    postNominal: 'PhD',
    role: 'Founder',
    /**
     * Who he is, in one phrase from the owner's own description. Written to follow
     * "a" mid-sentence; capitalised where it stands on its own line.
     */
    title: 'professional chemist and laboratory scientist from Kansas',
    /*
      One sentence, around thirty words, and it must survive the compliance lexicon
      like any other copy. It is set at display size, and display size is a volume
      control: five sentences of it is not a statement, it is shouting. Anything
      longer than this belongs on /about.
    */
    statement:
      'We keep what most distributors cannot produce — a lab report for every batch, filed against the code on your package and released to verified buyers who ask, and the legal position for every state, with the statute behind it.',
    portrait: '/brand/founder-john-mckenedy.jpg',
    signature: '',
  },

  /**
   * Track record, as floors the owner supplied on 2026-09-11 ("over 10 years",
   * "over 10,000 customers"). Always published as "more than", so the sentence stays
   * true as both grow. Raise them when the owner does; never round them up.
   */
  track: {
    yearsInBusiness: 10,
    customers: 10_000,
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
  return `in business for more than ${yearsInBusiness} years, with more than ${customers.toLocaleString('en-US')} customers across the United States`
}
