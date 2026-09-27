/**
 * The people behind the business.
 *
 * ROLES, not invented names. This site's entire argument is that what it
 * publishes can be checked — a lab report per batch, a statute per state — and a
 * page of stock faces with fabricated names under them contradicts that argument
 * more loudly than any of it makes it. `src/components/marketing/proprietor.tsx`
 * already refuses to render an invented owner for the same reason.
 *
 * So each entry names a real function of the business and says what that function
 * is accountable for. Add `name` and `photo` as real people are ready to be
 * named, and the section fills in on its own: `name` replaces the role as the
 * headline, and `photo` replaces the typographic panel.
 *
 * `photo` is a URL, not a local path. Product and people imagery is served from
 * object storage (`src/lib/storage/r2.ts` → `publicUrl(key)`), so a photograph
 * that lands here should be an R2 public URL rather than a file committed into
 * /public.
 */
export interface TeamMember {
  /** Stable key. Used for React keys and the expand state — never re-point it. */
  readonly id: string
  /** The function. Always present; it is what we can honestly publish today. */
  readonly role: string
  /** The person, once there is one to name. */
  readonly name?: string
  /** One sentence: what this role is accountable for. */
  readonly accountableFor: string
  /** Path under /public, or an R2 public URL. Empty until photography exists. */
  readonly photo?: string
  /**
   * Where the face is, as a CSS object-position ("50% 10%" = centre, near the top).
   * The panels crop the photograph to fill their box, and a centred crop of a tall
   * portrait cuts the head off on a phone.
   */
  readonly photoPosition?: string
}

export const TEAM: readonly TeamMember[] = [
  {
    id: 'compliance',
    // Supplied by the owner on 2026-09-13.
    photo: '/team/compliance.jpg',
    photoPosition: '50% 5%',
    role: 'Compliance',
    accountableFor:
      'Owns the state rules. Every position we publish carries the statute behind it and the date it was last reviewed, and the cart reads the same record the legality pages do.',
  },
  {
    id: 'quality',
    // Supplied by the owner on 2026-09-13.
    photo: '/team/quality.jpg',
    photoPosition: '56% 40%',
    role: 'Quality & Lab',
    accountableFor:
      'Commissions the laboratory panel for every batch and files it against the batch code, then releases certified copies to verified buyers who ask — potency, heavy metals, pesticides, mycotoxins, solvents and microbials, not potency alone.',
  },
  {
    id: 'fulfilment',
    // Supplied by the owner on 2026-09-13.
    photo: '/team/fulfilment.jpg',
    photoPosition: '51% 30%',
    role: 'Fulfilment',
    accountableFor:
      'Packs and routes every order, and splits a cart by fulfilment channel so PACT-regulated products travel on the carrier that may lawfully carry them.',
  },
  {
    id: 'support',
    // Supplied by the owner on 2026-09-13.
    photo: '/team/support.jpg',
    photoPosition: '45% 40%',
    role: 'Customer Support',
    accountableFor:
      'Reads every message a person sends us and answers within one business day. Verifies every payment by hand before an order moves.',
  },
  {
    id: 'editorial',
    // Supplied by the owner on 2026-09-13.
    photo: '/team/editorial.jpg',
    photoPosition: '50% 44%',
    role: 'Research & Editorial',
    accountableFor:
      'Writes the guides and the per-state pages, and cites what they rely on. No health claims, ever — the automated check runs before anything can publish.',
  },
]

/** True once real photography exists, which switches the caption off. */
export const TEAM_PHOTOS_PUBLISHED = TEAM.some((m) => Boolean(m.photo))
