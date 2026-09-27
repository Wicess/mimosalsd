import { freeShippingProgress } from '@/lib/compliance/shipping'
import type { ShipmentGroup } from '@/lib/compliance/types'
import { formatCents } from '@/lib/utils'

/**
 * Free-shipping progress.
 *
 * Computed on the PARCEL-eligible subtotal only, and it says so inline whenever the
 * cart contains excluded items. Discovering an exclusion at the payment step is the
 * single most avoidable trust failure in a cart — it reads as a bait-and-switch even
 * when the reason is a federal shipping regime.
 */
export function FreeShippingBar({ groups }: { groups: readonly ShipmentGroup[] }) {
  const progress = freeShippingProgress(groups)
  if (groups.length === 0) return null

  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-sm font-medium text-foreground">
          {progress.qualified
            ? 'Free standard shipping applied'
            : `${formatCents(progress.remainingCents)} to free standard shipping`}
        </p>
        <p className="tabular text-sm text-foreground-muted">
          {formatCents(progress.eligibleSubtotalCents)} / {formatCents(progress.thresholdCents)}
        </p>
      </div>

      <div
        className="mt-2 h-2 overflow-hidden rounded-full bg-surface-sunken"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(progress.progress * 100)}
        aria-label="Progress toward free shipping"
      >
        <div
          className="h-full rounded-full bg-primary transition-[width] duration-[240ms] motion-reduce:transition-none"
          style={{ width: `${progress.progress * 100}%` }}
        />
      </div>

      {progress.hasExcludedItems && (
        <p className="mt-2 text-xs leading-relaxed text-foreground-muted">
          Age-restricted shipments are excluded from free shipping. They travel with a
          specialist carrier, and that shipment is priced separately.
        </p>
      )}
    </div>
  )
}
