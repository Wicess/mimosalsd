import type { SortKey } from '@/lib/catalog/types'
import { Select } from '@/components/ui/select'

const SORT_LABELS: Record<Exclude<SortKey, 'newest'>, string> = {
  featured: 'Featured',
  'price-asc': 'Price: low to high',
  'price-desc': 'Price: high to low',
  rating: 'Highest rated',
}

/**
 * Search, sort and availability controls.
 *
 * A plain GET form, and therefore a SERVER component. The previous version was a
 * client component with a debounced router push and a hand-rolled window timer —
 * shipping JavaScript, and a stray global, to do what a form submission does natively.
 *
 * State stays in the URL, so a filtered view is shareable and the back button restores
 * it. Any URL carrying these params is served `X-Robots-Tag: noindex, follow` by the
 * header rules in next.config.ts, and canonicals point them at the clean URL: filters
 * must be shareable, but every filter combination becoming an indexable near-duplicate
 * would drain crawl budget into a combinatorial hole.
 */
export function ShopControls({
  sort,
  query,
  availabilityFilterEnabled,
  availabilityActive,
}: {
  sort: SortKey
  query: string
  availabilityFilterEnabled: boolean
  availabilityActive: boolean
}) {
  return (
    /*
      A single soft panel, centred, rather than a row of controls between two
      full-width rules.

      The rules were the loudest thing on the page: two hairlines running the
      whole width to frame four small controls, directly under a centred title.
      Gathering them into one rounded surface makes the row read as one object
      and lets the title above it stay the thing you look at first.
    */
    <form
      method="GET"
      className="mx-auto flex w-full max-w-3xl flex-wrap items-center justify-center gap-2 rounded-2xl border border-border bg-surface-sunken p-2"
    >
      <label className="flex min-h-11 min-w-0 flex-1 items-center gap-2 rounded-xl border border-border-strong bg-surface px-3.5">
        <span className="sr-only">Search products</span>
        <input
          type="search"
          name="q"
          defaultValue={query}
          placeholder="Search products"
          // 16px minimum — below it iOS auto-zooms on focus.
          className="min-h-11 w-full bg-transparent text-base text-foreground focus:outline-none"
        />
      </label>

      <div className="flex shrink-0 items-center gap-2 pl-2 text-sm">
        <span id="shop-sort-label" className="text-foreground-muted">Sort</span>
        <Select
          name="sort"
          labelId="shop-sort-label"
          size="sm"
          defaultValue={sort in SORT_LABELS ? sort : 'featured'}
          placeholder="Featured"
          options={(Object.keys(SORT_LABELS) as Array<keyof typeof SORT_LABELS>).map((key) => ({
            value: key,
            label: SORT_LABELS[key],
          }))}
          className="w-44 md:w-48"
        />
      </div>

      {availabilityFilterEnabled && (
        <label className="flex min-h-11 shrink-0 cursor-pointer items-center gap-2 px-2 text-sm text-foreground">
          <input
            type="checkbox"
            name="availability"
            value="mine"
            defaultChecked={availabilityActive}
            className="size-4 accent-[var(--primary)]"
          />
          Only what ships to me
        </label>
      )}

      <button
        type="submit"
        className="inline-flex min-h-11 shrink-0 cursor-pointer items-center rounded-xl bg-primary px-5 text-sm font-medium text-on-primary transition-[background-color,scale] duration-150 ease-[var(--ease-standard)] hover:bg-primary-hover active:scale-[0.97] motion-reduce:transition-none"
      >
        Apply
      </button>
    </form>
  )
}
