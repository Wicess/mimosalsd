import type { Category } from './types'

/**
 * ─────────────────────────────────────────────────────────────────────────────
 *  OPERATOR EDITS TO CATEGORY COPY, layered over the authored catalogue.
 *
 *  The same overlay contract as `overrides.ts` does for products, and it exists for
 *  the same reason: `src/proxy.ts` reads the authored catalogue SYNCHRONOUSLY on the
 *  edge so a missing slug returns a real 404 rather than a soft one, and the edge
 *  cannot reach Neon. An override changes a category; it can never add or remove one,
 *  so the set of valid slugs stays exactly what the authored file says.
 *
 *  NULL MEANS INHERIT. Clearing a field in the admin restores the authored value
 *  rather than blanking the page — no edit is a one-way door, and nothing an operator
 *  can do leaves a ranking page empty.
 *
 *  ── Why the overridable set is small ───────────────────────────────────────
 *  Only fields the CATEGORY PAGE renders. `name` is deliberately absent: it appears
 *  in the header nav, the homepage cards, the product breadcrumb, the sitemap and
 *  llms.txt, every one of which reads the authored catalogue synchronously. An
 *  overridable name would either put a database read behind the site header, or ship
 *  a rename visible on one page and stale on five. Both are worse than requiring a
 *  deploy to rename a category, which is the right weight for a sitewide label.
 * ─────────────────────────────────────────────────────────────────────────────
 */

export interface CategoryOverrideRecord {
  readonly slug: string
  readonly intro: string | null
  readonly detail: string | null
  readonly metaTitle: string | null
  readonly metaDesc: string | null
  readonly aboutHeading: string | null
  readonly aboutLede: string | null
}

/** Blank strings are inherit, same as null. An operator clearing a box means "revert". */
function pick(override: string | null | undefined, authored: string): string {
  const trimmed = override?.trim()
  return trimmed ? trimmed : authored
}

function pickOptional(
  override: string | null | undefined,
  authored: string | undefined,
): string | undefined {
  const trimmed = override?.trim()
  if (trimmed) return trimmed
  return authored
}

/**
 * Apply one override to one category.
 *
 * Pure, and exported so the merge can be unit-tested without a database — the same
 * reason `applyOverrides` is pure for products.
 */
export function applyCategoryOverride(
  category: Category,
  override: CategoryOverrideRecord | undefined,
): Category {
  if (!override) return category

  /*
    The About block is rebuilt rather than spread over.

    `about` is optional, and an override that set only `aboutLede` on a category
    with no authored `about` would otherwise produce a half-built object — a
    heading with no lede, blocks that do not exist, an empty spec sheet. If there
    is nothing authored to layer onto, the lede has nowhere to go and is ignored;
    the admin says so rather than accepting an edit that renders nothing.
  */
  const about = category.about
    ? {
        ...category.about,
        heading: pick(override.aboutHeading, category.about.heading),
        lede: pick(override.aboutLede, category.about.lede),
      }
    : category.about

  return {
    ...category,
    intro: pick(override.intro, category.intro),
    detail: pickOptional(override.detail, category.detail),
    metaTitle: pick(override.metaTitle, category.metaTitle),
    metaDesc: pick(override.metaDesc, category.metaDesc),
    ...(about ? { about } : {}),
  }
}

export function applyCategoryOverrides(
  categories: readonly Category[],
  overrides: ReadonlyMap<string, CategoryOverrideRecord>,
): readonly Category[] {
  if (overrides.size === 0) return categories
  return categories.map((category) =>
    applyCategoryOverride(category, overrides.get(category.slug)),
  )
}
