import { getAllStateLegality } from '@/lib/legality/state-pages'
import { JURISDICTIONS } from '@/lib/compliance/jurisdictions'
import { url } from '@/lib/seo/routes'
import { CheckIcon } from '@/components/ui/icon'
import { SectionHeading } from '@/components/layout/section-heading'

/**
 * The states we ship to (owner, 2026-09-19).
 *
 * Only the states where every product line ships, each with a tick: a buyer scanning
 * for their state sees a yes, not a legend to decode. Read from the live state rules,
 * the same record the state pages use, so the list and the count move the day a rule
 * changes rather than when someone remembers to edit a string.
 *
 * Every entry links to that state's page, so the section stays the crawlable hub for
 * the state pages it always was.
 *
 * ── A RULED INDEX, NOT A GRID OF BUTTONS (2026-09-28) ────────────────────────────
 * It was fifty-one bordered, filled cards with a green badge on each, capped at
 * `max-w-5xl`. Three things were wrong with that, and the third is the one that
 * mattered.
 *
 * The cap was leaving a third of a 1900px display empty while the list ran eleven
 * rows deep. Auto-fill against the shell's own width fixes both at once: the columns
 * multiply as the screen grows, so the same fifty-one entries settle into six rows on
 * a desktop and the section loses a third of its height without a single value being
 * tuned per breakpoint.
 *
 * The badge was a filled circle per row. Fifty-one identical green pills is not
 * fifty-one pieces of information — every entry in this list is a yes, so the ink was
 * decoration. A hairline tick still answers the buyer's question and stops shouting.
 *
 * And a box around each name made a directory look like fifty-one buttons. A list of
 * every US state is an INDEX, and an index is set with rules, not frames: the
 * horizontal hairlines carry the scan, the gaps between columns separate them, and
 * the names are the only ink that isn't structural. Same information, a third of the
 * height, and it reads as a reference table rather than a wall of chrome.
 */
export function LegalityChecker() {
  const shipsEverything = new Set(
    getAllStateLegality()
      .filter((s) => s.verdicts.length > 0 && s.verdicts.every((v) => v.rule.status === 'ALLOWED'))
      .map((s) => s.code),
  )
  const states = JURISDICTIONS.filter((j) => shipsEverything.has(j.code))
  if (states.length === 0) return null

  return (
    <section
      aria-labelledby="ship-to-your-state"
      className="border-y border-border bg-surface-sunken py-[clamp(2.75rem,4.5vw,4rem)]"
    >
      <div className="shell">
        <SectionHeading
          id="ship-to-your-state"
          className="mb-7"
          title="We ship to your state"
          summary={`Everything in the shop ships to these ${states.length} states. Tap yours for delivery times and what arrives at your door.`}
        />

        {/*
          `auto-fill` rather than a breakpoint ladder: the column count follows the
          shell's real width, so this needs no tuning at 1440, 1600 or 1900px. The
          10.5rem floor is the width at which the longest label — District of
          Columbia, truncated — still reads beside its code.
        */}
        <ul className="grid grid-cols-[repeat(auto-fill,minmax(10.5rem,1fr))] gap-x-7 border-t border-border lg:gap-x-9">
          {states.map((j) => (
            <li key={j.code} className="border-b border-border">
              <a
                href={url.legalityState(j.slug)}
                className="group flex min-h-11 items-center gap-2.5 rounded-sm px-1 py-2 transition-colors duration-[160ms] ease-[var(--ease-standard)] hover:bg-surface focus-visible:outline-2 focus-visible:outline-offset-2 motion-reduce:transition-none"
              >
                <CheckIcon aria-hidden className="size-3.5 shrink-0 text-success-fg" />
                <span className="min-w-0 truncate text-[0.9375rem] text-foreground underline-offset-4 group-hover:underline">
                  {j.name}
                </span>
                <span className="tabular ml-auto shrink-0 text-xs text-foreground-subtle">{j.code}</span>
              </a>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
