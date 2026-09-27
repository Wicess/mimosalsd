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
    <section aria-labelledby="ship-to-your-state" className="border-y border-border bg-surface-sunken py-14">
      <div className="shell">
        <SectionHeading
          id="ship-to-your-state"
          title="We ship to your state"
          summary={`Everything in the shop ships to these ${states.length} states. Tap yours for delivery times and what arrives at your door.`}
        />

        <ul className="mx-auto grid max-w-5xl grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {states.map((j) => (
            <li key={j.code}>
              <a
                href={url.legalityState(j.slug)}
                className="group flex min-h-12 items-center gap-3 rounded-lg border border-border bg-surface px-3 py-2.5 transition-colors duration-[160ms] ease-[var(--ease-standard)] hover:border-success-fg/40 hover:bg-success-bg/40 motion-reduce:transition-none"
              >
                <span
                  aria-hidden
                  className="grid size-6 shrink-0 place-items-center rounded-full bg-success-bg text-success-fg"
                >
                  <CheckIcon className="size-3.5" />
                </span>
                <span className="min-w-0 truncate text-sm font-medium text-foreground">{j.name}</span>
                <span className="tabular ml-auto hidden text-xs text-foreground-subtle sm:inline">{j.code}</span>
              </a>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
