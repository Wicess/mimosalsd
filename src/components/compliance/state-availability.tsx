import { canShipTo } from '@/lib/compliance/shipping'
import { jurisdictionName } from '@/lib/compliance/jurisdictions'
import type { ProductLine, UsJurisdictionCode } from '@/lib/compliance/types'
import { url } from '@/lib/seo/routes'
import { cn } from '@/lib/utils'
import { AlertIcon, CheckIcon, CrossIcon, ChevronRightIcon } from '@/components/ui/icon'

/**
 * Whether we can legally ship this line to this state — resolved on the PDP, long
 * before the cart.
 *
 * A customer must NEVER discover at checkout that we cannot ship to them. That is
 * the worst possible moment: they have invested effort, entered an address, and the
 * refusal reads as a bait-and-switch rather than as compliance.
 *
 * Status is never conveyed by colour alone (WCAG 1.4.1) — every state pairs colour
 * with an icon and an explicit text label. A misread here is not cosmetic; it is
 * someone believing we can ship where we cannot.
 */
export function StateAvailability({
  stateCode,
  productLine,
  onStateProductDirectory,
  className,
}: {
  stateCode: UsJurisdictionCode
  productLine: ProductLine
  onStateProductDirectory?: boolean
  className?: string
}) {
  const decision = canShipTo(stateCode, productLine, { onStateProductDirectory })
  const stateName = jurisdictionName(stateCode)
  const stateSlug = stateName.toLowerCase().replace(/\s+/g, '-')

  const tone = !decision.allowed
    ? 'danger'
    : decision.status === 'RESTRICTED'
      ? 'warning'
      : 'success'

  /*
    A blocked product is not an error, and it should not look like one.
    
    Red is the colour of "something went wrong". Nothing has: the law in that state
    says what it says, and telling someone plainly is the most trustworthy thing this
    site does. Rendering it as an alarm made a routine, accurate answer feel like a
    failure — so unavailability is now neutral, and red is reserved for things the
    visitor can actually act on, like a form error.

    WHAT DID NOT CHANGE: the verdict, the reason and the statute citation are all still
    published. Only the colour was doing the shouting.
  */
  const Icon = tone === 'danger' ? CrossIcon : tone === 'warning' ? AlertIcon : CheckIcon

  const headline = !decision.allowed
    ? `We can't ship this to ${stateName}`
    : decision.status === 'RESTRICTED'
      ? `Ships to ${stateName} with conditions`
      : `Ships to ${stateName}`

  return (
    <div
      className={cn(
        'rounded-lg border p-4',
        tone === 'success' && 'border-transparent bg-success-bg text-success-fg',
        tone === 'warning' && 'border-transparent bg-warning-bg text-warning-fg',
        tone === 'danger' && 'border-border bg-surface-sunken text-foreground',
        className,
      )}
    >
      <div className="flex gap-3">
        <Icon className="mt-0.5 size-5" />
        <div className="min-w-0 flex-1">
          <p className="font-semibold">{headline}</p>
          <p className="mt-1 text-sm leading-relaxed opacity-90 text-foreground-muted">
            {decision.reason}
          </p>

          {decision.rule.statuteCitation && (
            <p className="mt-2 text-xs opacity-75">
              <span className="font-medium">Authority:</span>{' '}
              {decision.rule.statuteCitation}
            </p>
          )}

          <a
            href={url.legalityState(stateSlug)}
            className="mt-3 inline-flex min-h-11 items-center gap-1 text-sm font-medium underline underline-offset-4"
          >
            {stateName} legal status
            <ChevronRightIcon className="size-4" />
          </a>
        </div>
      </div>
    </div>
  )
}
