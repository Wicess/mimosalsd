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

/*
  SAMPLE DATA (2026-09-27). Roles and wording are stand-ins so this section of the
  design renders; the photographs are flat placeholders, not people. All of it is
  replaced with the client's own before launch — see docs/00-LAUNCH-CHECKLIST.md.
*/
export const TEAM: readonly TeamMember[] = [
  {
    id: 'compliance',
    role: 'Compliance',
    accountableFor: 'Sample copy: who keeps the state positions current, and what is checked before a page is published.',
    photo: '/team/compliance.jpg',
  },
  {
    id: 'quality',
    role: 'Quality',
    accountableFor: 'Sample copy: who handles batch records, and what is checked before a batch is offered for sale.',
    photo: '/team/quality.jpg',
  },
  {
    id: 'fulfilment',
    role: 'Fulfilment',
    accountableFor: 'Sample copy: who packs an order, what the packaging shows, and when tracking is sent.',
    photo: '/team/fulfilment.jpg',
  },
  {
    id: 'support',
    role: 'Support',
    accountableFor: 'Sample copy: who answers the chat and the contact form, and how quickly.',
    photo: '/team/support.jpg',
  },
  {
    id: 'editorial',
    role: 'Editorial',
    accountableFor: 'Sample copy: who writes the guides, and what every claim on them has to be backed by.',
    photo: '/team/editorial.jpg',
  },
]

/** True once real photography exists, which switches the caption off. */
export const TEAM_PHOTOS_PUBLISHED = TEAM.some((m) => Boolean(m.photo))
