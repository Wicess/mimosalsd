'use client'

import { useActionState, useId, useState } from 'react'
import {
  createPostedProduct,
  setPostedProductActive,
  updatePostedProduct,
  type PostedProductState,
} from '@/app/actions/admin-posted-products'
import { Button } from '@/components/ui/button'
import { Select as SiteSelect } from '@/components/ui/select'
import { sizeOptions } from '@/lib/catalog/sizing'
import { PhotoPicker } from '@/components/admin/quick-post-form'

/**
 * ─────────────────────────────────────────────────────────────────────────────
 *  POST A PRODUCT — and edit one that was posted.
 *
 *  One form for both, because a posted product has nothing authored behind it:
 *  what the form holds IS the product. (Authored products keep ProductEditor,
 *  where an empty box means "inherit" and that distinction matters.)
 *
 *  ── What the category decides ──────────────────────────────────────────────
 *  The compliance rules are shown, not offered. They follow from the category
 *  on the server whatever this form sends, and showing them here is so the
 *  operator knows what posting into a category commits the product to.
 *
 *  ── The photo is shrunk before it leaves the browser ───────────────────────
 *  Phone photos run 3–8 MB and the upload ceiling is 4 MB (Vercel's own limit
 *  on a request). Drawing the image to a canvas at no more than 2400px and
 *  re-encoding it brings it to a few hundred KB, and drops its metadata on the
 *  way. The server re-encodes it again regardless, which is the guarantee; this
 *  step is what lets a photo straight off the phone go through at all.
 * ─────────────────────────────────────────────────────────────────────────────
 */

export interface CategoryOption {
  readonly slug: string
  readonly label: string
  readonly productLine: string
  /** Plain-language consequences of posting into this category. */
  readonly rules: readonly string[]
}

export interface BatchOption {
  readonly code: string
  readonly label: string
  readonly productLines: readonly string[]
}

export interface PostedProductValues {
  readonly slug: string
  readonly categorySlug: string
  readonly name: string
  readonly shortDescription: string
  readonly description: string
  readonly specsText: string
  /** In dollars: the price of a pound, or of one unit for a disposable. */
  readonly price: string
  readonly inStock: boolean
  readonly batchCodes: readonly string[]
  readonly isFeatured: boolean
  readonly onStateDirectory: boolean
  readonly photoUrl?: string
  readonly photoAlt: string
  readonly isActive: boolean
  /** What the automatic writer produced, for the edit page's summary. */
  readonly written?: {
    readonly writer: 'claude' | 'template' | null
    readonly writtenAt: string | null
    readonly metaTitle: string | null
    readonly metaDescription: string | null
    readonly sections: number
    readonly faqs: number
    readonly sources: number
    readonly photos: number
  }
}

const INITIAL: PostedProductState = {}
const FIELD =
  'mt-1 min-h-11 w-full rounded-md border border-border-strong bg-surface px-3 text-[16px] text-foreground placeholder:text-foreground-subtle md:text-sm'
const AREA =
  'mt-1 w-full rounded-md border border-border-strong bg-surface p-3 text-[16px] leading-relaxed text-foreground placeholder:text-foreground-subtle md:text-sm'
const LABEL = 'text-sm font-medium text-foreground'
const HINT = 'text-xs text-foreground-muted'


/** "Price per pound" → "price-per-pound", so a section can be linked to. */
const anchorFor = (title: string) => title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

function Section({
  title,
  hint,
  children,
}: {
  title: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    // `scroll-mt-28` clears the phone's admin bar and the jump chips above it.
    <section id={anchorFor(title)} className="scroll-mt-28 rounded-lg border border-border bg-surface p-3.5 md:p-5">
      <h2 className="font-display text-lg text-foreground">{title}</h2>
      {hint ? <p className="mt-1 text-xs text-foreground-muted">{hint}</p> : null}
      <div className="mt-4 space-y-4">{children}</div>
    </section>
  )
}

/**
 * Jump chips, on a phone only.
 *
 * This form is one long column on a small screen — around 3,000px for a built-in
 * product — and the part you came to change is usually near the bottom. The chips
 * ride under the admin bar and take a thumb to any section in one tap. On a computer
 * the whole form is visible enough to need none of it.
 */
function SectionNav({ titles }: { titles: readonly string[] }) {
  return (
    <nav
      aria-label="Sections"
      className="sticky top-14 z-10 -mx-4 flex gap-2 overflow-x-auto border-b border-border bg-background/95 px-4 py-2 backdrop-blur [scrollbar-width:none] lg:hidden [&::-webkit-scrollbar]:hidden"
    >
      {titles.map((title) => (
        <a
          key={title}
          href={`#${anchorFor(title)}`}
          className="inline-flex min-h-10 shrink-0 items-center rounded-full border border-border-strong bg-surface px-3 text-xs font-medium text-foreground-muted"
        >
          {title}
        </a>
      ))}
    </nav>
  )
}

function Banner({ state }: { state: PostedProductState }) {
  const message = state.error ?? state.ok
  if (!message) return null
  return (
    <p
      role={state.error ? 'alert' : 'status'}
      className={`rounded-md border p-3 text-sm ${
        state.error ? 'border-danger-fg/40 text-danger-fg' : 'border-success-fg/40 text-success-fg'
      }`}
    >
      {message}
    </p>
  )
}



export function PostedProductForm({
  mode,
  categories,
  batches,
  values,
}: {
  mode: 'create' | 'edit'
  categories: readonly CategoryOption[]
  batches: readonly BatchOption[]
  values?: PostedProductValues
}) {
  const [state, formAction, pending] = useActionState(
    mode === 'create' ? createPostedProduct : updatePostedProduct,
    INITIAL,
  )
  const [categorySlug, setCategorySlug] = useState(values?.categorySlug ?? categories[0]?.slug ?? '')
  const [price, setPrice] = useState(values?.price ?? '')
  const [shrinking, setShrinking] = useState(false)
  const id = useId()

  const category = categories.find((c) => c.slug === categorySlug)
  const lineBatches = batches.filter(
    (b) => !category || b.productLines.length === 0 || b.productLines.includes(category.productLine),
  )
  const isVape = category?.productLine === 'VAPE'

  // The sizes, worked out as the price is typed.
  const typedCents = Math.round(Number(price.replace(/[$,\s]/g, '')) * 100)
  const sizes = !isVape && Number.isFinite(typedCents) && typedCents > 0 ? sizeOptions({ poundPriceCents: typedCents, defaultKey: 'f4' }) : []

  return (
    <div className="space-y-6">
      <Banner state={state} />

      <form action={formAction} className="space-y-6">
        {values ? <input type="hidden" name="slug" value={values.slug} /> : null}
        {/* The copy as it opened, so a save leaves newer automatic writing alone in a box nobody touched. */}
        {values ? <input type="hidden" name="shortDescriptionOpened" value={values.shortDescription} /> : null}
        {values ? <input type="hidden" name="descriptionOpened" value={values.description} /> : null}
        <SectionNav titles={['Category', 'Copy', isVape ? 'Price per unit' : 'Price per pound', 'Photo', 'Lab reports', 'Placement']} />

        <Section
          title="Category"
          hint="Where the product is listed, and which rules it follows. The rules come from the category and cannot be changed per product."
        >
          <div>
            <label htmlFor={`${id}-category`} className={LABEL}>
              Category
            </label>
            <SiteSelect
              id={`${id}-category`}
              name="categorySlug"
              defaultValue={categorySlug}
              onChange={setCategorySlug}
              placeholder="Choose…"
              options={categories.map((c) => ({ value: c.slug, label: c.label }))}
            />
          </div>
          {category ? (
            <ul className="space-y-1 rounded-md bg-surface-sunken p-3 text-sm text-foreground-muted">
              {category.rules.map((rule) => (
                <li key={rule} className="flex gap-2">
                  <span aria-hidden className="mt-2 h-1 w-1 shrink-0 rounded-full bg-foreground-subtle" />
                  {rule}
                </li>
              ))}
            </ul>
          ) : null}
          {isVape ? (
            <label className="flex items-start gap-2 text-sm text-foreground">
              <input
                type="checkbox"
                name="onStateDirectory"
                defaultChecked={values?.onStateDirectory ?? false}
                className="mt-1 size-6 shrink-0 md:size-4"
              />
              <span>
                Listed on the state vapor-product directories
                <span className={`block ${HINT}`}>
                  Tick only if this brand really is listed. It opens the directory states to this product.
                </span>
              </span>
            </label>
          ) : null}
        </Section>

        <Section
          title="Copy"
          hint="Scanned against the compliance lexicon before anything saves: no health or effect claims, no controlled substances, and no extraction or consumption language on root bark."
        >
          <div>
            <label htmlFor={`${id}-name`} className={LABEL}>
              Product name
            </label>
            <input
              id={`${id}-name`}
              name="name"
              required
              minLength={3}
              maxLength={120}
              defaultValue={values?.name}
              className={FIELD}
            />
            {mode === 'create' ? (
              <p className={`mt-1 ${HINT}`}>The page address is made from the name and never changes.</p>
            ) : null}
          </div>
          <div>
            <label htmlFor={`${id}-short`} className={LABEL}>
              Short description
            </label>
            <p className={HINT}>One or two lines, 20–300 characters. Used on cards and in search results.</p>
            <textarea
              id={`${id}-short`}
              name="shortDescription"
              rows={2}
              required
              minLength={20}
              maxLength={300}
              defaultValue={values?.shortDescription}
              className={AREA}
            />
          </div>
          <div>
            <label htmlFor={`${id}-description`} className={LABEL}>
              Full description
            </label>
            <textarea
              id={`${id}-description`}
              name="description"
              rows={7}
              required
              minLength={40}
              maxLength={20000}
              defaultValue={values?.description}
              className={AREA}
            />
          </div>
          <div>
            <label htmlFor={`${id}-specs`} className={LABEL}>
              Specifications
            </label>
            <p className={HINT}>One per line, as Label | Value. For example: Origin | Brazil</p>
            <textarea
              id={`${id}-specs`}
              name="specs"
              rows={4}
              defaultValue={values?.specsText}
              className={`${AREA} font-mono`}
            />
          </div>
        </Section>

        <Section
          title={isVape ? 'Price per unit' : 'Price per pound'}
          hint={
            isVape
              ? 'Disposables are sold by count: the customer picks how many, at this price each.'
              : 'Sold in 1/4, 1/3, 1/2 and 1 lb. Set the price of a full pound and every size is worked out from it.'
          }
        >
          <div className="grid gap-3 md:grid-cols-2">
            <label className="text-sm">
              <span className={LABEL}>{isVape ? 'Price per unit' : 'Price per pound'}</span>
              <input
                name="price"
                inputMode="decimal"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder={isVape ? '24.99' : '140.00'}
                required
                className={FIELD}
              />
            </label>
            <label className="text-sm">
              <span className={LABEL}>Stock</span>
              <SiteSelect
                name="stock"
                defaultValue={values?.inStock === false ? 'out' : 'in'}
                placeholder="In stock"
                options={[
                  { value: 'in', label: 'In stock' },
                  { value: 'out', label: 'Out of stock' },
                ]}
              />
            </label>
          </div>
          {sizes.length ? (
            <ul className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4" aria-label="Size prices">
              {sizes.map((size) => (
                <li key={size.key} className="rounded-md border border-border bg-surface-sunken px-3 py-2 text-sm">
                  <span className={`block ${HINT}`}>{size.label}</span>
                  <span className="tabular font-semibold text-foreground">${(size.priceCents / 100).toFixed(2)}</span>
                </li>
              ))}
            </ul>
          ) : null}
        </Section>

        <Section
          title="Photo"
          hint="A real photograph of this product. It is shrunk and stripped of location and camera data before it is stored."
        >
          {values?.photoUrl ? (
            <div className="flex items-start gap-4">
              {/* eslint-disable-next-line @next/next/no-img-element -- admin preview of an uploaded original */}
              <img src={values.photoUrl} alt="" className="h-24 w-24 rounded-md object-cover ring-1 ring-border" />
              <label className="flex min-h-11 items-center gap-2 text-sm text-foreground">
                <input type="checkbox" name="removePhoto" className="size-6 shrink-0 md:size-4" />
                Remove the photos
              </label>
            </div>
          ) : null}
          {/* The same picker as posting: thumbnails, a camera, and a thumb-sized target. */}
          <PhotoPicker
            id={id}
            label={values?.photoUrl ? 'Replace all photos with (up to 6)' : 'Photos (up to 6)'}
            preparing={shrinking}
            setPreparing={setShrinking}
          />
          <div>
            <label htmlFor={`${id}-alt`} className={LABEL}>
              Describe the photo
            </label>
            <p className={HINT}>For screen readers and image search. Leave empty to use the product name.</p>
            <input
              id={`${id}-alt`}
              name="photoAlt"
              maxLength={200}
              defaultValue={values?.photoAlt}
              className={FIELD}
            />
          </div>
        </Section>

        <Section
          title="Lab reports"
          hint="The batches this product is sold from. Their certificates are linked from the product page."
        >
          {lineBatches.length === 0 ? (
            <p className="text-sm text-foreground-muted">No batches recorded for this category yet.</p>
          ) : (
            <div className="grid gap-2 md:grid-cols-2">
              {lineBatches.map((b) => (
                <label key={b.code} className="flex min-h-11 items-center gap-2 text-sm text-foreground">
                  <input
                    type="checkbox"
                    name="batchCodes"
                    value={b.code}
                    defaultChecked={values?.batchCodes.includes(b.code)}
                    className="size-6 shrink-0 md:size-4"
                  />
                  {b.label}
                </label>
              ))}
            </div>
          )}
        </Section>

        <Section title="Placement">
          <label className="flex min-h-11 items-center gap-2 text-sm text-foreground">
            <input type="checkbox" name="isFeatured" defaultChecked={values?.isFeatured} className="size-6 shrink-0 md:size-4" />
            Featured: sorts to the front of the shop and the homepage
          </label>
        </Section>

        <Banner state={state} />
        {/* Within reach at the bottom of a phone screen, wherever you are in the form. */}
        <div className="sticky bottom-0 -mx-4 border-t border-border bg-background/95 px-4 pt-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] backdrop-blur sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:p-0 sm:backdrop-blur-none">
          <Button type="submit" variant="accent" loading={pending || shrinking} className="w-full sm:w-auto">
            {mode === 'create' ? 'Post product' : 'Save changes'}
          </Button>
        </div>
      </form>

      {values ? <VisibilityForm slug={values.slug} isActive={values.isActive} /> : null}
    </div>
  )
}

/** Its own form, so a stray Enter in the editor can never take a product down. */
function VisibilityForm({ slug, isActive }: { slug: string; isActive: boolean }) {
  const [state, action, pending] = useActionState(setPostedProductActive, INITIAL)
  return (
    <section className="rounded-lg border border-border bg-surface p-3.5 md:p-5">
      <h2 className="font-display text-lg text-foreground">Visibility</h2>
      <p className="mt-1 text-xs text-foreground-muted">
        {isActive
          ? 'Live in the shop. Hiding it takes it out of the shop and its page returns 404; the address is never reused.'
          : 'Hidden. Nobody can see or order it.'}
      </p>
      <form action={action} className="mt-3 space-y-3">
        <input type="hidden" name="slug" value={slug} />
        <input type="hidden" name="isActive" value={isActive ? 'false' : 'true'} />
        <Banner state={state} />
        <Button type="submit" variant="secondary" size="sm" loading={pending}>
          {isActive ? 'Hide from the shop' : 'Put back in the shop'}
        </Button>
      </form>
    </section>
  )
}
