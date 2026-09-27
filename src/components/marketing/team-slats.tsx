'use client'

import { useState } from 'react'
import Image from 'next/image'
import { ChatIcon, FlaskIcon, PencilIcon, ShieldIcon, TruckIcon, UserIcon } from '@/components/ui/icon'
import { TEAM, TEAM_PHOTOS_PUBLISHED, type TeamMember } from '@/lib/content/team'

/**
 * The team, as an accordion of vertical panels.
 *
 * One panel is open and shows its subject in full; the rest stand as narrow
 * slats with their label turned on its side. Moving between them widens one and
 * narrows the others, which is the whole interaction — there is nothing to
 * click through and nothing to dismiss.
 *
 * Why this rather than a row of cards: a card grid gives five equal things equal
 * weight and asks the reader to choose one to care about, which on an About page
 * they will not do. An accordion has already chosen, and reading the second one
 * costs a single movement.
 *
 * Behaviour that matters:
 *
 *   · Every panel's text is in the DOM at all times. Collapsing is VISUAL only,
 *     so a screen reader gets all five roles in order and none of this costs a
 *     non-sighted reader anything.
 *   · Opening is driven by focus as well as hover, so a keyboard tab through the
 *     row does exactly what a mouse does.
 *   · Below `md` the slats become a plain grid. Five vertical panels on a 375px
 *     screen is 75px each, which is not a photograph of anyone.
 *   · The widths transition; nothing else does, and the transition is dropped
 *     under `prefers-reduced-motion`.
 */
export function TeamSlats() {
  const [openId, setOpenId] = useState<string>(TEAM[0]?.id ?? '')

  return (
    <section aria-labelledby="team-heading" className="mt-16">
      <h2 id="team-heading" className="font-display text-3xl text-foreground">
        Our team
      </h2>
      <p className="mt-3 max-w-[60ch] leading-relaxed text-foreground-muted">
        The people who work alongside our founder. Each of them is responsible for a
        part of the business you can check from the outside.
      </p>

      {/* Phones: a plain list. Slats need width to be slats. */}
      <div className="mt-8 grid gap-3 md:hidden">
        {TEAM.map((member) => (
          <article
            key={member.id}
            className="overflow-hidden rounded-xl border border-border bg-surface"
          >
            {/* 4:3, not 16:9: a wide box cropped a standing portrait down to the chin. */}
            <div className="relative aspect-[4/3] w-full">
              <Portrait member={member} />
            </div>
            <div className="p-4">
              <h3 className="font-display text-lg text-foreground">
                {member.name ?? member.role}
              </h3>
              {member.name && (
                <p className="text-xs font-medium tracking-[0.18em] text-foreground-subtle uppercase">
                  {member.role}
                </p>
              )}
              <p className="mt-2 text-sm leading-relaxed text-foreground-muted">
                {member.accountableFor}
              </p>
            </div>
          </article>
        ))}
      </div>

      {/* Tablet and up: the accordion. */}
      <div className="mt-8 hidden gap-2 md:flex md:h-[26rem] lg:h-[30rem]">
        {TEAM.map((member) => {
          const open = member.id === openId
          return (
            <button
              key={member.id}
              type="button"
              aria-expanded={open}
              onMouseEnter={() => setOpenId(member.id)}
              onFocus={() => setOpenId(member.id)}
              onClick={() => setOpenId(member.id)}
              style={{ flexGrow: open ? 5 : 1 }}
              className="group relative min-w-0 basis-0 overflow-hidden rounded-xl border border-border text-left transition-[flex-grow] duration-500 ease-out focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none motion-reduce:transition-none"
            >
              <Portrait member={member} open={open} />

              {/*
                A scrim, not a colour block. It only has to hold white text over
                the top of a photograph we have not seen yet, and it is drawn from
                the bottom so the face — when there is one — stays uncovered.
              */}
              <span
                aria-hidden
                className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-stone-950/85 via-stone-950/40 to-transparent"
              />

              {/* Collapsed: the label on its side, reading up the slat. */}
              <span
                aria-hidden
                className={[
                  'absolute bottom-5 left-1/2 -translate-x-1/2 whitespace-nowrap text-sm font-medium tracking-[0.18em] text-white uppercase transition-opacity duration-300 [writing-mode:vertical-rl] [text-orientation:mixed] motion-reduce:transition-none',
                  open ? 'opacity-0' : 'opacity-90',
                ].join(' ')}
              >
                {member.role}
              </span>

              {/* Open: the full caption. */}
              <span
                className={[
                  'absolute inset-x-0 bottom-0 p-5 transition-opacity duration-300 motion-reduce:transition-none',
                  open ? 'opacity-100 delay-150' : 'pointer-events-none opacity-0',
                ].join(' ')}
              >
                <span className="block text-xs font-medium tracking-[0.18em] text-white/70 uppercase">
                  {member.role}
                </span>
                {member.name && (
                  <span className="mt-1 block font-display text-2xl text-white">
                    {member.name}
                  </span>
                )}
                <span className="mt-2 block max-w-[46ch] text-sm leading-relaxed text-white/85">
                  {member.accountableFor}
                </span>
              </span>
            </button>
          )
        })}
      </div>

      {!TEAM_PHOTOS_PUBLISHED && (
        <p className="mt-4 text-sm leading-relaxed text-foreground-subtle">
          <strong className="font-medium text-foreground-muted">
            Photography not published yet.
          </strong>{' '}
          These panels show each role rather than a stock photograph of someone who
          does not work here. Real portraits replace them as they are taken.
        </p>
      )}
    </section>
  )
}

/**
 * The panel image, or the designed stand-in for it.
 *
 * The stand-in is not an empty grey box: it is a tinted field carrying the role
 * at display size, which reads as a deliberate state rather than a failed image
 * — and the alternative, a stock face with an invented name under it on a site
 * selling age-restricted goods, is a misrepresentation rather than a
 * placeholder.
 *
 * The hue is derived from the id so the five panels differ from one another and
 * are stable across renders. It is applied as an opacity over a token surface,
 * never a hardcoded colour.
 */
function Portrait({ member, open }: { member: TeamMember; open?: boolean }) {
  if (member.photo) {
    return (
      <Image
        src={member.photo}
        alt={member.name ? `${member.name}, ${member.role}` : member.role}
        fill
        sizes="(max-width: 767px) 100vw, 40vw"
        style={{ objectPosition: member.photoPosition ?? '50% 20%' }}
        className={[
          'object-cover transition-[filter] duration-500 motion-reduce:transition-none',
          open === false ? 'grayscale' : 'grayscale-0',
        ].join(' ')}
      />
    )
  }

  /*
    No photograph yet. The owner has supplied the founder's portrait but none for the
    team, and a stock face presented as an employee would be a misrepresentation. So
    the panel carries the role's own icon on the site's colours instead of an empty
    grey field that reads as a broken image. Add `photo` in lib/content/team.ts and
    the real portrait replaces it.
  */
  const Icon = ROLE_ICONS[member.id] ?? UserIcon
  return (
    <span
      aria-hidden
      className="absolute inset-0 flex flex-col items-center justify-center gap-4 overflow-hidden bg-linear-to-br from-primary-muted via-surface to-surface-sunken"
    >
      <span className="absolute -top-16 -right-16 size-56 rounded-full bg-accent/10 blur-2xl" />
      <span
        className={[
          'relative grid place-items-center rounded-full border border-border-strong bg-surface/70 text-accent-fg shadow-sm transition-[width,height] duration-300 motion-reduce:transition-none',
          open === false ? 'size-12' : 'size-16 md:size-20',
        ].join(' ')}
      >
        <Icon className={open === false ? 'size-5' : 'size-7 md:size-9'} />
      </span>
      {/*
        The role, set at display size — but only on the OPEN panel. A 90px-wide slat
        cannot hold "Research & Editorial"; the vertical label does that job there.
      */}
      <span
        className={[
          'relative px-6 text-center font-display text-2xl leading-[1.1] text-balance text-foreground transition-opacity duration-300 motion-reduce:transition-none lg:text-3xl',
          open === false ? 'hidden' : 'opacity-100 delay-150',
        ].join(' ')}
      >
        {member.role}
      </span>
    </span>
  )
}

const ROLE_ICONS: Record<string, (props: { className?: string }) => React.ReactNode> = {
  compliance: ShieldIcon,
  quality: FlaskIcon,
  fulfilment: TruckIcon,
  support: ChatIcon,
  editorial: PencilIcon,
}
