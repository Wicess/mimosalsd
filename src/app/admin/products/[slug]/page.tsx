import { notFound } from 'next/navigation'
import { getOverrideRecord } from '@/lib/catalog/merged'
import { AdminPage } from '@/components/admin/shell'
import {
  ProductEditor,
  type AuthoredProduct,
  type OverrideValues,
} from '@/components/admin/product-editor'
import { url } from '@/lib/seo/routes'
import { PostedProductForm } from '@/components/admin/posted-product-form'
import { postedForEditing, postingOptions } from '@/lib/catalog/posted-admin'
import { authoredProduct } from '@/lib/catalog/authored'
import { AutowritePanel } from '@/components/admin/autowrite-panel'
import { claudeWriterConfigured } from '@/lib/catalog/autowrite'

export const maxDuration = 300

export const metadata = { title: 'Edit product' }

/**
 * Edit one product.
 *
 * Reads the AUTHORED product from the in-memory catalogue and the override row
 * separately, rather than the merged result. The form has to show both: the value in
 * the box is the operator's edit, and the placeholder behind it is what the product
 * falls back to if that box is cleared. A merged product cannot express that
 * difference — every field would look edited.
 */

function toAuthored(slug: string): AuthoredProduct | undefined {
  const p = authoredProduct(slug)
  if (!p) return undefined
  return {
    slug: p.slug,
    name: p.name,
    shortDescription: p.shortDescription,
    description: p.description,
    specs: p.specs,
    productLine: p.productLine,
    fulfillmentChannel: p.fulfillmentChannel,
    notForHumanConsumption: p.notForHumanConsumption,
    ageRestricted: p.ageRestricted,
    pactRegulated: p.pactRegulated,
    directoryStates: p.directoryStates,
    isActive: p.isActive,
    isFeatured: p.isFeatured,
    ...(p.sizing
      ? {
          sizing: {
            poundPriceCents: p.sizing.poundPriceCents,
            defaultKey: p.sizing.defaultKey,
          },
        }
      : {}),
    variants: p.variants.map((v) => ({
      sku: v.sku,
      name: v.name,
      priceCents: v.priceCents,
    })),
  }
}

async function Editor({ slug }: { slug: string }) {
  const authored = toAuthored(slug)
  if (!authored) notFound()

  const row = await getOverrideRecord(slug)

  const override: OverrideValues | null = row
    ? {
        name: row.name,
        shortDescription: row.shortDescription,
        description: row.description,
        specs: Array.isArray(row.specs)
          ? (row.specs as Array<[string, string]>)
          : null,
        poundPriceCents: row.poundPriceCents ?? null,
        defaultSizeKey: row.defaultSizeKey,
        variantPrices:
          row.variantPrices && typeof row.variantPrices === 'object'
            ? (row.variantPrices as Record<string, number>)
            : null,
        notForHumanConsumption: row.notForHumanConsumption,
        ageRestricted: row.ageRestricted,
        pactRegulated: row.pactRegulated,
        fulfillmentChannel: row.fulfillmentChannel,
        directoryStates: Array.isArray(row.directoryStates)
          ? (row.directoryStates as string[])
          : null,
        isActive: row.isActive,
        isFeatured: row.isFeatured,
        updatedBy: (row as { updatedBy?: string | null }).updatedBy ?? null,
        updatedAt: null,
      }
    : null

  return <ProductEditor authored={authored} override={override} />
}

export default async function AdminProductEditPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const authored = toAuthored(slug)
  if (!authored) return <PostedProductEditPage slug={slug} />

  return (
    <AdminPage
      title={authored.name}
      description={`Editing /${slug}. Empty fields inherit from the authored catalogue, so clearing a box restores its original value rather than blanking the page.`}
      actions={
        <a
          href={url.product(slug)}
          target="_blank"
          rel="noreferrer"
          className="inline-flex min-h-11 items-center rounded-md border border-border-strong bg-surface px-4 text-sm font-medium text-foreground hover:bg-surface-sunken"
        >
          View live page
        </a>
      }
    >
      <Editor slug={slug} />
    </AdminPage>
  )
}

/**
 * A product posted from the admin panel. There is nothing authored behind it, so
 * this is the same form that posted it, filled in, rather than the overlay editor.
 */
async function PostedProductEditPage({ slug }: { slug: string }) {
  const values = await postedForEditing(slug)
  if (values === 'not-migrated' || !values) notFound()
  const { categories, batches } = postingOptions()
  return (
    <AdminPage
      title={values.name}
      description={`Posted from the admin panel, at /product/${slug}. The address never changes, even if the name does.`}
      actions={
        <a
          href={url.product(slug)}
          target="_blank"
          rel="noreferrer"
          className="inline-flex min-h-11 items-center rounded-md border border-border-strong bg-surface px-4 text-sm font-medium text-foreground hover:bg-surface-sunken"
        >
          View live page
        </a>
      }
    >
      {values.written ? <AutowritePanel slug={slug} written={values.written} claudeReady={claudeWriterConfigured()} /> : null}
      {/* Keyed by when the page was written, so a rewrite shows its new copy in the boxes at once. */}
      <PostedProductForm key={values.written?.writtenAt ?? 'form'} mode="edit" categories={categories} batches={batches} values={values} />
    </AdminPage>
  )
}
