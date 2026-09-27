import { catalog } from '@/lib/catalog/repository'
import {
  getCategoryOverrideRecord,
  listMergedCategories,
  listMergedProducts,
} from '@/lib/catalog/merged'
import { AdminPage } from '@/components/admin/shell'
import { CategoryEditor } from '@/components/admin/category-editor'
import { Badge } from '@/components/ui/badge'
import { url } from '@/lib/seo/routes'

export const metadata = { title: 'Categories' }

/**
 * Category copy, editable without a deploy.
 *
 * ── Two readings of the same category, deliberately ─────────────────────────
 * The heading and the live preview come from the MERGED category — what the page
 * says right now. The editor's placeholders come from the AUTHORED one — what the
 * page would say with every override removed.
 *
 * That distinction is the whole overlay contract. Null means inherit, so an empty
 * input and an input holding the authored words are different instructions to the
 * save action, and an editor pre-filled from the merged value would silently pin
 * every field the first time anybody pressed Save.
 *
 * ── What is NOT editable here, and why ──────────────────────────────────────
 * The category NAME. It renders in the header nav, the homepage cards, the product
 * breadcrumb, the sitemap and llms.txt, all of which read the authored catalogue
 * synchronously — the same synchronous read the edge proxy depends on for real
 * 404s. Making it overridable would either put a database query behind the site
 * header or ship a rename that is right on one page and stale on five.
 */
async function CategoryPanels() {
  const [merged, products] = await Promise.all([listMergedCategories(), listMergedProducts()])

  /*
    Resolved BEFORE the render, not inside it.

    Mapping with an async callback hands React an array of Promises as children.
    It happens to work in some renderers and not others, and a page whose output
    depends on that is a page that breaks on a minor-version bump. `Promise.all`
    makes the data complete before a single element is built. The reads share one
    `use cache` entry, so this is still a single query, not one per category.
  */
  const overrides = new Map(
    await Promise.all(
      merged.map(
        async (category) =>
          [category.slug, await getCategoryOverrideRecord(category.slug)] as const,
      ),
    ),
  )

  return (
    <div className="space-y-6">
      {merged.map((category) => {
        const authored = catalog.getCategory(category.slug)
        if (!authored) return null
        const override = overrides.get(category.slug)
        const count = products.filter((p) => p.categorySlug === category.slug).length

        return (
          <section
            key={category.slug}
            className="rounded-lg border border-border bg-surface p-4 sm:p-5"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="font-display text-lg text-foreground">{category.name}</h2>
                <p className="mt-1 text-xs text-foreground-muted">
                  {count} product{count === 1 ? '' : 's'} ·{' '}
                  {category.productLine.replace(/_/g, ' ').toLowerCase()}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {override ? (
                  <Badge tone="accent">Edited</Badge>
                ) : (
                  <Badge tone="neutral">Authored</Badge>
                )}
                <a
                  href={url.category(category.slug)}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex min-h-11 items-center text-sm text-foreground-muted underline underline-offset-4 hover:text-foreground"
                >
                  View
                </a>
              </div>
            </div>

            <div className="mt-4 border-t border-border pt-4">
              <CategoryEditor
                slug={category.slug}
                hasAbout={Boolean(authored.about)}
                authored={{
                  intro: authored.intro,
                  ...(authored.detail ? { detail: authored.detail } : {}),
                  metaTitle: authored.metaTitle,
                  metaDesc: authored.metaDesc,
                  ...(authored.about
                    ? {
                        aboutHeading: authored.about.heading,
                        aboutLede: authored.about.lede,
                      }
                    : {}),
                }}
                override={
                  override
                    ? {
                        intro: override.intro,
                        detail: override.detail,
                        metaTitle: override.metaTitle,
                        metaDesc: override.metaDesc,
                        aboutHeading: override.aboutHeading,
                        aboutLede: override.aboutLede,
                      }
                    : null
                }
              />
            </div>
          </section>
        )
      })}
    </div>
  )
}

export default function AdminCategoriesPage() {
  return (
    <AdminPage
      title="Categories"
      description="Category copy is content, not scaffolding — these pages rank, and thin filler here costs real traffic. Every box is empty until you override it; the greyed text is what the page says today. Clearing a box restores it."
    >
      <CategoryPanels />
    </AdminPage>
  )
}
