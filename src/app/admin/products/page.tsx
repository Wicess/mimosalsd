import Link from 'next/link'
import { listMergedProductsForAdmin } from '@/lib/catalog/merged'
import { listPrice } from '@/lib/catalog/types'
import { AdminPage, Cell, DataTable, Row } from '@/components/admin/shell'
import { Badge } from '@/components/ui/badge'
import { formatCents } from '@/lib/utils'
import { url } from '@/lib/seo/routes'
import { authoredProduct } from '@/lib/catalog/authored'
import { InlineAction } from '@/components/admin/forms'
import { deletePostedProduct, togglePostedProductActive } from '@/app/actions/admin-posted-products'
import { setProductVisibility } from '@/app/actions/admin-products'
import { RewriteAllButton } from '@/components/admin/rewrite-all'
import { claudeWriterConfigured } from '@/lib/catalog/autowrite'

export const metadata = { title: 'Products' }

// "Research & rewrite all" runs one product per server action from this page: web search plus writing needs the room.
export const maxDuration = 300

/**
 * The catalogue, as it currently reads.
 *
 * Shows the MERGED product — authored data with operator edits applied — because that
 * is what a customer sees. A list showing the authored values next to an "edit" link
 * that changes something else would be actively misleading.
 *
 * "Edited" marks a product whose displayed values differ from the authored ones, so
 * it is obvious at a glance which products have been changed away from the source.
 */

function isEdited(slug: string, merged: { name: string; isActive: boolean }): boolean {
  const authored = authoredProduct(slug)
  if (!authored) return true
  const authoredPrice = listPrice(authored).cents
  const mergedPrice = listPrice(merged as never).cents
  return (
    authored.name !== merged.name ||
    authored.isActive !== merged.isActive ||
    authoredPrice !== mergedPrice
  )
}

type MergedProduct = Awaited<ReturnType<typeof listMergedProductsForAdmin>>[number]

/** Edit, View, and Hide/Show or Delete. The same set on a phone and on a computer. */
function ProductActions({ p }: { p: MergedProduct }) {
  return (
    <>
      <Link
        href={`/admin/products/${p.slug}`}
        className="inline-flex min-h-11 items-center font-medium text-foreground underline underline-offset-4 lg:min-h-0"
      >
        Edit
      </Link>
      <a
        href={url.product(p.slug)}
        target="_blank"
        rel="noreferrer"
        className="inline-flex min-h-11 items-center text-foreground-muted underline underline-offset-4 lg:min-h-0"
      >
        View
      </a>
      {authoredProduct(p.slug) ? (
        // Built-in products live in the catalogue file: they can be hidden, not deleted.
        p.isActive ? (
          <InlineAction
            action={setProductVisibility}
            label="Hide"
            fields={{ slug: p.slug, show: 'false' }}
            variant="danger"
            confirm={`Hide "${p.name}"? It leaves the shop and its page returns 404 within a minute. Built-in products cannot be deleted; Show puts it back.`}
          />
        ) : (
          listPrice(p).cents > 0 && (
            <InlineAction action={setProductVisibility} label="Show" fields={{ slug: p.slug, show: 'true' }} />
          )
        )
      ) : (
        <>
        <InlineAction
          action={togglePostedProductActive}
          label={p.isActive ? 'Hide' : 'Show'}
          fields={{ slug: p.slug, isActive: p.isActive ? 'false' : 'true' }}
          variant={p.isActive ? 'danger' : 'secondary'}
          {...(p.isActive ? { confirm: `Hide "${p.name}"? It leaves the shop and its page returns 404 within a minute. Show puts it back.` } : {})}
        />
        <InlineAction
          action={deletePostedProduct}
          label="Delete"
          fields={{ slug: p.slug }}
          variant="danger"
          confirm={`Delete "${p.name}" for good? Its page and written copy are removed. Past orders keep their line. This cannot be undone.`}
        />
        </>
      )}
    </>
  )
}

/** Everything about a product that is worth a badge, in one row of small chips. */
function Flags({ p }: { p: MergedProduct }) {
  return (
    <>
      {!p.isActive && <Badge tone="danger">inactive</Badge>}
      {authoredProduct(p.slug) ? isEdited(p.slug, p) && <Badge tone="info">edited</Badge> : <Badge tone="accent">posted</Badge>}
      {p.isFeatured && <Badge tone="accent">featured</Badge>}
      {p.notForHumanConsumption && <Badge tone="neutral">not for consumption</Badge>}
      {p.ageRestricted && <Badge tone="warning">21+</Badge>}
      {p.pactRegulated && <Badge tone="danger">PACT</Badge>}
      {p.directoryStates.length > 0 && <Badge tone="info">directory: {p.directoryStates.join(' ')}</Badge>}
    </>
  )
}

function Price({ p }: { p: MergedProduct }) {
  const price = listPrice(p)
  if (price.cents <= 0) return <Badge tone="warning">set a price</Badge>
  return (
    <>
      {formatCents(price.cents)}
      <span className="text-xs font-normal text-foreground-muted"> {price.per === 'lb' ? 'per lb' : 'each'}</span>
    </>
  )
}

/**
 * The phone list. The shared DataTable turns each row into a labelled card, which
 * for a product runs to five rows of label-and-value and around 280px a product —
 * thirteen products made a 3,700px page. This says the same in a quarter of the
 * height: the name and the price on one line, everything else as small chips, with
 * the actions where a thumb can reach them.
 */
function PhoneList({ products }: { products: readonly MergedProduct[] }) {
  return (
    <ul className="space-y-2 lg:hidden">
      {products.map((p) => (
        <li key={p.slug} className="rounded-lg border border-border bg-surface p-3">
          <div className="flex items-start gap-3">
            {/* Name and details are one target, so a thumb cannot miss between them. */}
            <Link href={`/admin/products/${p.slug}`} className="min-w-0 flex-1">
              <span className="block font-medium text-foreground">{p.name}</span>
              <span className="mt-0.5 block truncate text-xs text-foreground-subtle">
                {p.slug} · {p.productLine.replace(/_/g, ' ').toLowerCase()} · {p.fulfillmentChannel.replace(/_/g, ' ').toLowerCase()}
              </span>
            </Link>
            <span className="tabular shrink-0 text-sm font-semibold text-foreground">
              <Price p={p} />
            </span>
          </div>
          <div className="mt-2 flex flex-wrap gap-1">
            <Flags p={p} />
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-4 border-t border-border pt-2 text-sm">
            <ProductActions p={p} />
          </div>
        </li>
      ))}
    </ul>
  )
}

async function Products() {
  const products = await listMergedProductsForAdmin()

  return (
    <>
      <PhoneList products={products} />
      <div className="hidden lg:block">
    <DataTable headers={['Product', 'Line', 'Channel', 'Price', 'Flags', '']}>
      {products.map((p) => (
        <Row key={p.slug}>
          <Cell>
            <Link
              href={`/admin/products/${p.slug}`}
              className="font-medium text-foreground underline underline-offset-4"
            >
              {p.name}
            </Link>
            <span className="mt-0.5 block text-xs text-foreground-subtle">{p.slug}</span>
          </Cell>
          <Cell className="text-foreground-muted">
            {p.productLine.replace(/_/g, ' ').toLowerCase()}
          </Cell>
          <Cell>
            <Badge tone={p.fulfillmentChannel === 'PARCEL' ? 'neutral' : 'warning'}>
              {p.fulfillmentChannel.replace(/_/g, ' ').toLowerCase()}
            </Badge>
          </Cell>
          <Cell className="tabular font-medium text-foreground">
            <Price p={p} />
          </Cell>
          <Cell>
            <div className="flex flex-wrap gap-1">
              <Flags p={p} />
            </div>
          </Cell>
          <Cell label="Actions">
            <div className="flex flex-wrap items-center gap-3">
              <ProductActions p={p} />
            </div>
          </Cell>
        </Row>
      ))}
    </DataTable>
      </div>
    </>
  )
}

export default function AdminProductsPage() {
  return (
    <AdminPage
      title="Products"
      description="Every product on the site, editable. Clearing a field on a built-in product restores the authored original; products marked posted were added here. Compliance flags drive cart behaviour, not just labelling."
      actions={
        <div className="flex flex-wrap items-start gap-3">
          <RewriteAllButton ready={claudeWriterConfigured()} />
          <Link
            href="/admin/products/new"
            className="inline-flex min-h-11 items-center rounded-md bg-accent px-4 text-sm font-medium text-on-accent hover:opacity-90"
          >
            Post a product
          </Link>
        </div>
      }
    >
      <Products />
    </AdminPage>
  )
}
