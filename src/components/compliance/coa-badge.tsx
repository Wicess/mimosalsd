import { FlaskIcon } from '@/components/ui/icon'
import { url } from '@/lib/seo/routes'
import { cn } from '@/lib/utils'

/**
 * Batch lab-test badge.
 *
 * Competitors bury COAs in a PDF drawer, often absent from browse entirely — the #1
 * thing buyers are told to check is invisible where they actually shop. Surfacing the
 * batch code on the card and the PDP, linked to the full panel, is the cheapest trust
 * win available in this category.
 */
export function CoaBadge({
  batchCode,
  labName,
  isoAccredited,
  className,
}: {
  batchCode: string
  labName?: string
  isoAccredited?: boolean
  className?: string
}) {
  return (
    <a
      href={url.labBatch(batchCode)}
      className={cn(
        'inline-flex min-h-11 items-center gap-2 rounded-md border border-border-data bg-surface-data px-3 py-2 text-sm text-foreground transition-colors hover:border-primary',
        className,
      )}
    >
      <FlaskIcon className="size-4 text-primary" />
      <span className="font-medium">Lab tested</span>
      <span className="tabular text-foreground-muted">{batchCode}</span>
      {isoAccredited && (
        <span className="rounded-sm bg-primary-muted px-1.5 py-0.5 text-xs font-medium text-primary">
          ISO 17025
        </span>
      )}
      {labName && <span className="sr-only">Tested by {labName}</span>}
    </a>
  )
}
