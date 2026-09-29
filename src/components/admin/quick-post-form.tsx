'use client'

import Link from 'next/link'
import { useActionState, useEffect, useId, useRef, useState, useSyncExternalStore } from 'react'
import { CameraIcon, PlusIcon, TrashIcon } from '@/components/ui/icon'
import { quickPostProduct, type PostedProductState } from '@/app/actions/admin-posted-products'
import { Button } from '@/components/ui/button'
import { Select as SiteSelect } from '@/components/ui/select'
import type { CategoryOption } from '@/components/admin/posted-product-form'
import { sizeOptions } from '@/lib/catalog/sizing'
import { url } from '@/lib/seo/routes'

const FIELD =
  'mt-1 min-h-11 w-full rounded-md border border-border-strong bg-surface px-3 text-[16px] text-foreground placeholder:text-foreground-subtle md:text-sm'
const LABEL = 'text-sm font-medium text-foreground'
const HINT = 'text-xs text-foreground-muted'

const MAX_PHOTOS = 6
/** Vercel refuses a request body over 4.5 MB, so every photo together stays under this. */
const TOTAL_BUDGET = 4 * 1024 * 1024

async function shrink(file: File, edge: number, quality: number): Promise<File> {
  if (!file.type.startsWith('image/')) return file
  try {
    const bitmap = await createImageBitmap(file)
    const scale = Math.min(1, edge / Math.max(bitmap.width, bitmap.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(bitmap.width * scale)
    canvas.height = Math.round(bitmap.height * scale)
    const context = canvas.getContext('2d')
    if (!context) return file
    context.fillStyle = 'white'
    context.fillRect(0, 0, canvas.width, canvas.height)
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality))
    if (!blob || blob.size >= file.size) return file
    return new File([blob], file.name.replace(/\.\w+$/, '') + '.jpg', { type: 'image/jpeg' })
  } catch {
    return file
  }
}

/** Shrink chosen photos, harder if they would not fit in one post together. */
export async function shrinkList(chosen: readonly File[]): Promise<File[]> {
  const capped = chosen.slice(0, MAX_PHOTOS)
  let files = await Promise.all(capped.map((f) => shrink(f, 1800, 0.84)))
  const total = () => files.reduce((sum, f) => sum + f.size, 0)
  if (total() > TOTAL_BUDGET) files = await Promise.all(capped.map((f) => shrink(f, 1280, 0.76)))
  if (total() > TOTAL_BUDGET) files = await Promise.all(capped.map((f) => shrink(f, 960, 0.7)))
  return files
}

/** Files back into the FileList shape a form input posts. */
function asFileList(files: readonly File[]): FileList {
  const transfer = new DataTransfer()
  for (const file of files) transfer.items.add(file)
  return transfer.files
}

/**
 * Choosing photos from a phone.
 *
 * The plain file input reads "Choose Files / No file chosen": it says nothing about
 * what was picked, and on a phone it is one small target. This is two full-size
 * buttons — the photo library, and the camera on a device that has one — with a
 * thumbnail of everything chosen, each removable, the first marked as the main
 * photo. The files themselves are held in a hidden input, shrunk on the way in
 * (a phone photo is several megabytes and the whole post has to fit in 4.5MB).
 */
export function PhotoPicker({
  id,
  label = 'Photos',
  preparing,
  setPreparing,
}: {
  id: string
  label?: string
  preparing: boolean
  setPreparing: (value: boolean) => void
}) {
  /** Each chosen photo with the preview URL made for it, so neither can be orphaned. */
  const [photos, setPhotos] = useState<{ file: File; url: string }[]>([])
  const holder = useRef<HTMLInputElement>(null)
  const library = useRef<HTMLInputElement>(null)
  const camera = useRef<HTMLInputElement>(null)

  // A camera button only where there is a camera to open, and not while the server
  // renders, where there is no navigator to ask.
  const hasCamera = useSyncExternalStore(
    () => () => {},
    () => navigator.maxTouchPoints > 0,
    () => false,
  )

  // Each set of preview URLs is released when it is replaced, and when the form goes.
  useEffect(() => () => photos.forEach((photo) => URL.revokeObjectURL(photo.url)), [photos])

  function replace(next: File[]) {
    setPhotos(next.map((file) => ({ file, url: URL.createObjectURL(file) })))
    if (holder.current) holder.current.files = asFileList(next)
  }

  async function take(chosen: FileList | null) {
    if (!chosen?.length) return
    setPreparing(true)
    // Shrunk as a set: six photos have to fit in one post together.
    replace(await shrinkList([...photos.map((p) => p.file), ...chosen]))
    setPreparing(false)
  }

  const room = MAX_PHOTOS - photos.length
  const BUTTON =
    'inline-flex min-h-11 flex-1 cursor-pointer items-center justify-center gap-2 rounded-md border border-border-strong bg-surface px-4 text-sm font-medium text-foreground disabled:opacity-50 md:flex-none'

  return (
    <div>
      <span className={LABEL} id={`${id}-photos-label`}>
        {label}
      </span>
      {/* The input that actually posts. The buttons below fill it. */}
      <input
        ref={holder}
        id={`${id}-photos`}
        name="photos"
        type="file"
        accept="image/jpeg,image/png,image/webp,image/avif,image/heic,image/heif"
        multiple
        hidden
        aria-hidden
        tabIndex={-1}
      />
      <input
        ref={library}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(e) => {
          void take(e.currentTarget.files)
          e.currentTarget.value = ''
        }}
      />
      <input
        ref={camera}
        type="file"
        accept="image/*"
        capture="environment"
        hidden
        onChange={(e) => {
          void take(e.currentTarget.files)
          e.currentTarget.value = ''
        }}
      />

      {photos.length > 0 ? (
        <ul className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6" aria-labelledby={`${id}-photos-label`}>
          {photos.map((photo, index) => (
            <li key={photo.url} className="relative aspect-square overflow-hidden rounded-md border border-border bg-surface-sunken">
              {/* eslint-disable-next-line @next/next/no-img-element -- a local file, not a served image */}
              <img src={photo.url} alt={`Photo ${index + 1}`} className="size-full object-cover" />
              {index === 0 ? (
                <span className="absolute inset-x-0 bottom-0 bg-stone-950/70 py-0.5 text-center text-[10px] font-medium text-white">
                  Main
                </span>
              ) : null}
              <button
                type="button"
                onClick={() => replace(photos.filter((_, i) => i !== index).map((p) => p.file))}
                aria-label={`Remove photo ${index + 1}`}
                className="absolute top-1 right-1 inline-flex size-8 items-center justify-center rounded-full bg-stone-950/70 text-white"
              >
                <TrashIcon className="size-4" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="mt-2 flex gap-2">
        <button type="button" className={BUTTON} disabled={room <= 0 || preparing} onClick={() => library.current?.click()}>
          <PlusIcon className="size-4" />
          {photos.length ? 'Add more' : 'Add photos'}
        </button>
        {hasCamera ? (
          <button type="button" className={BUTTON} disabled={room <= 0 || preparing} onClick={() => camera.current?.click()}>
            <CameraIcon className="size-4" />
            Take photo
          </button>
        ) : null}
      </div>
      <p className={`mt-1 ${HINT}`}>
        {preparing
          ? 'Preparing the photos…'
          : photos.length
            ? `${photos.length} of ${MAX_PHOTOS} chosen. The first is the main photo.`
            : `Up to ${MAX_PHOTOS}. The first is the main photo.`}
      </p>
    </div>
  )
}

/**
 * Posting a product in five fields (owner, 2026-09-14): name, category, price, stock
 * and photos, with optional notes. The page itself — description, advantages,
 * FAQs, sources, links, search title and description, photo descriptions — is
 * written automatically when it is posted.
 */
export function QuickPostForm({ categories, claudeReady }: { categories: readonly CategoryOption[]; claudeReady: boolean }) {
  const [state, formAction, pending] = useActionState<PostedProductState, FormData>(quickPostProduct, {})
  const notice = useRef<HTMLDivElement>(null)
  const posted = state.posted

  // Posting happens from the bottom of the form; bring the confirmation into view.
  useEffect(() => {
    if (posted) notice.current?.scrollIntoView({ block: 'center' })
  }, [posted])

  return (
    <div className="space-y-5">
      {posted ? (
        <div ref={notice} role="status" className="rounded-lg border border-success-fg/40 bg-surface p-4 text-sm">
          <p className="font-medium text-success-fg">Saved and live: {posted.name}</p>
          <p className="mt-1 text-foreground-muted">
            The page was written and saved for you. There is nothing else to save.
            {posted.rewriting ? ' Claude is writing a fuller page in the background; it saves itself and goes live in a minute or two.' : ''}
          </p>
          <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
            <a href={url.product(posted.slug)} target="_blank" rel="noreferrer" className="font-medium text-foreground underline underline-offset-4">
              View live page
            </a>
            <Link href={`/admin/products/${posted.slug}`} className="text-foreground-muted underline underline-offset-4">
              See what was written
            </Link>
          </p>
        </div>
      ) : null}
      {/* A new product gets a fresh form: remounting clears the price and photos too. */}
      <QuickPostFields
        key={posted?.slug ?? 'new'}
        categories={categories}
        claudeReady={claudeReady}
        state={state}
        formAction={formAction}
        pending={pending}
      />
    </div>
  )
}

function QuickPostFields({
  categories,
  claudeReady,
  state,
  formAction,
  pending,
}: {
  categories: readonly CategoryOption[]
  claudeReady: boolean
  state: PostedProductState
  formAction: (formData: FormData) => void
  pending: boolean
}) {
  const [categorySlug, setCategorySlug] = useState(categories[0]?.slug ?? '')
  const [price, setPrice] = useState('')
  const [preparing, setPreparing] = useState(false)
  const id = useId()

  const category = categories.find((c) => c.slug === categorySlug)
  const isVape = category?.productLine === 'VAPE'
  const cents = Math.round(Number(price.replace(/[$,\s]/g, '')) * 100)
  const sizes = !isVape && Number.isFinite(cents) && cents > 0 ? sizeOptions({ poundPriceCents: cents, defaultKey: 'f4' }) : []

  return (
    <form action={formAction} className="space-y-5">
      {state.error ? (
        <p role="alert" className="rounded-md border border-danger-fg/40 p-3 text-sm text-danger-fg">
          {state.error}
        </p>
      ) : null}

      <section className="space-y-4 rounded-lg border border-border bg-surface p-3.5 md:p-5">
        <div>
          <label htmlFor={`${id}-name`} className={LABEL}>
            Product name
          </label>
          <input id={`${id}-name`} name="name" required minLength={3} maxLength={120} className={FIELD} placeholder="Mimosa Hostilis Root Bark, Fine Powder" />
        </div>

        <div className="grid gap-4 md:grid-cols-2">
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
          <label className="text-sm">
            <span className={LABEL}>{isVape ? 'Price per unit' : 'Price per pound'}</span>
            <input
              name="price"
              inputMode="decimal"
              required
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder={isVape ? '24.99' : '140.00'}
              className={FIELD}
            />
          </label>
        </div>

        {sizes.length ? (
          <ul className="grid grid-cols-2 gap-2 sm:grid-cols-4" aria-label="Size prices">
            {sizes.map((size) => (
              <li key={size.key} className="rounded-md border border-border bg-surface-sunken px-3 py-2 text-sm">
                <span className={`block ${HINT}`}>{size.label}</span>
                <span className="tabular font-semibold text-foreground">${(size.priceCents / 100).toFixed(2)}</span>
              </li>
            ))}
          </ul>
        ) : null}

        <PhotoPicker id={id} preparing={preparing} setPreparing={setPreparing} />

        <div className="grid gap-4 md:grid-cols-2">
          <label className="text-sm">
            <span className={LABEL}>Stock</span>
            <SiteSelect
              name="stock"
              defaultValue="in"
              placeholder="In stock"
              options={[
                { value: 'in', label: 'In stock' },
                { value: 'out', label: 'Out of stock' },
              ]}
            />
          </label>
          <label className="flex min-h-11 cursor-pointer items-center gap-3 self-end rounded-md border border-border-strong bg-surface px-3 text-sm text-foreground md:mb-0">
            <input type="checkbox" name="isFeatured" className="size-5 shrink-0" />
            Feature it on the home page
          </label>
        </div>

        <div>
          <label htmlFor={`${id}-notes`} className={LABEL}>
            Anything the writer should know <span className="font-normal text-foreground-muted">(optional)</span>
          </label>
          <textarea
            id={`${id}-notes`}
            name="notes"
            rows={3}
            maxLength={1000}
            placeholder="Facts only you know: where it comes from, the cut, the flavour. No health claims."
            className="mt-1 w-full rounded-md border border-border-strong bg-surface p-3 text-[16px] text-foreground placeholder:text-foreground-subtle md:text-sm"
          />
        </div>
      </section>

      <details className="rounded-lg border border-border bg-surface-sunken text-sm leading-relaxed text-foreground-muted">
        <summary className="flex min-h-11 cursor-pointer items-center px-4 font-medium text-foreground">
          What gets written for you
        </summary>
        <div className="border-t border-border px-4 py-3">
        <p>
          The page address, title and search description, the short description, a detailed description with
          advantages, questions and answers, outside sources and links to your other pages and products, a
          description of every photo, and the share image. Everything is checked against the compliance lexicon first.
        </p>
        <p className="mt-2 text-xs">
          {claudeReady
            ? 'Claude writes the page and looks at the photos. It appears within a minute or two of posting; the built-in writer covers it until then.'
            : 'Written now by the built-in writer. Add ANTHROPIC_API_KEY in Vercel to have Claude write richer pages that describe the photos.'}
        </p>
        </div>
      </details>

      {/*
        On a phone the button stays on the screen, above the home indicator, however
        far down the form you are. On a computer it sits where it always did.
      */}
      <div className="sticky bottom-0 -mx-4 border-t border-border bg-background/95 px-4 pt-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] backdrop-blur md:static md:mx-0 md:border-0 md:bg-transparent md:p-0 md:backdrop-blur-none">
        <Button type="submit" variant="accent" size="lg" fullWidth loading={pending} disabled={preparing} className="md:w-auto">
          {pending ? 'Posting and writing the page…' : 'Post the product'}
        </Button>
      </div>
    </form>
  )
}
