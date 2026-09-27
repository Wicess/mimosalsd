import { NOT_FOR_HUMAN_CONSUMPTION } from '@/lib/compliance/disclaimers'
import { AlertIcon } from '@/components/ui/icon'
import { cn } from '@/lib/utils'

/**
 * Mimosa Hostilis is lawful to sell ONLY as a non-consumable botanical.
 *
 * This banner is NOT dismissible and it renders ABOVE the Add-to-Cart button, not in
 * a footer or an accordion. That placement is the whole point: the legal basis for
 * the sale is that the buyer understood the intended use before they bought, and a
 * disclaimer they had to scroll past the buy button to find does not establish that.
 *
 * It is also styled to look designed rather than like a browser warning. In this
 * category, a page that looks careful IS the trust signal.
 *
 * REDUCED, NOT REMOVED. It was a bordered alert box with an icon and a heading,
 * the heaviest object above the buy button. It is now a single ruled line in the
 * same words — still non-dismissible, still above the button, still the first
 * thing read after the price. What went is the furniture, not the disclosure:
 * CLAUDE.md rule 3 requires this notice to be here, and the legal basis for the
 * sale is that the buyer saw it before they bought.
 */
const [LEAD, ...TAIL] = NOT_FOR_HUMAN_CONSUMPTION.split(/(?<=\.)\s+/)
const REST = ` ${TAIL.join(' ')}`

export function NotForConsumptionBanner({ className }: { className?: string }) {
  return (
    <p
      className={cn(
        'flex gap-2.5 border-y border-border py-3 text-sm leading-relaxed text-foreground-muted',
        className,
      )}
      role="note"
    >
      <AlertIcon className="mt-0.5 size-4 shrink-0 text-foreground-subtle" />
      {/*
        The constant already OPENS with "Botanical use only." — emphasising it
        meant setting the phrase twice in a row. Split the stored sentence rather
        than restating it, so the words on screen stay exactly the words the
        checkout attestation stores.
      */}
      <span>
        <span className="font-medium text-foreground">{LEAD}</span>
        {REST}
      </span>
    </p>
  )
}
