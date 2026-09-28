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
  The client's own team (2026-09-28): one photograph per role, labelled by role, no
  names. So each panel is headed by its role, and `name` stays unset until the client
  supplies one. Each sentence says what the role does, not what it has achieved.
*/
export const TEAM: readonly TeamMember[] = [
  {
    id: 'compliance',
    role: 'Compliance',
    accountableFor:
      'Reads every product page, article and customer review before it goes live, and keeps what this site says to what the business can stand behind.',
    photo: '/team/compliance-portrait.jpg',
    photoPosition: '65% 25%',
  },
  {
    id: 'quality',
    role: 'Quality & Lab',
    accountableFor:
      'Checks each incoming batch against its paperwork, for cut, colour and weight, before it is listed for sale, and keeps the record for that batch.',
    photo: '/team/quality-portrait.jpg',
    photoPosition: '55% 30%',
  },
  {
    id: 'fulfilment',
    role: 'Fulfilment',
    accountableFor:
      'Weighs and packs each order, and sends the tracking number once the parcel is with the carrier.',
    photo: '/team/fulfilment-portrait.jpg',
    photoPosition: '40% 30%',
  },
  {
    id: 'support',
    role: 'Customer service',
    accountableFor:
      'Answers the live chat, the contact form and the phone, and follows an order from the request to the doorstep.',
    photo: '/team/support-portrait.jpg',
    photoPosition: '50% 50%',
  },
  {
    id: 'editorial',
    role: 'Research & editorial',
    accountableFor:
      'Researches and writes the guides and articles on this site, from dyeing with root bark to reading a product label.',
    photo: '/team/editorial-portrait.jpg',
    photoPosition: '55% 40%',
  },
]

/** True once real photography exists, which switches the caption off. */
export const TEAM_PHOTOS_PUBLISHED = TEAM.some((m) => Boolean(m.photo))
