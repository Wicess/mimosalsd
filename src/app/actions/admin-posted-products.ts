'use server'

import { revalidatePath, revalidateTag, updateTag } from 'next/cache'
import { after } from 'next/server'
import { redirect } from 'next/navigation'
import { recordAdminAction } from '@/lib/admin/audit'
import { requireArea } from '@/lib/admin/guard'
import { PRODUCTS } from '@/lib/catalog/catalog.data'
import { CATALOG_TAG } from '@/lib/catalog/merged'
import {
  buildDocument,
  copyForScan,
  parseDollars,
  readPostedForm,
  type PostedFormInput,
} from '@/lib/catalog/posted-form'
import {
  claudeCopy,
  claudeWriterConfigured,
  lexiconRefusals,
  photosForClaude,
  productLinks,
  quickCopy,
  type WriteInput,
} from '@/lib/catalog/autowrite'
import type { WrittenCopy } from '@/lib/catalog/autowrite/types'
import { submitUrl } from '@/lib/seo/indexnow'
import {
  categoryForSlug,
  postedDocumentSchema,
  uniqueSlug,
} from '@/lib/catalog/posted-product'
import type { ProductImage } from '@/lib/catalog/types'
import { scanText } from '@/lib/compliance/lexicon'
import { db } from '@/lib/db/client'
import { isMissingTableError } from '@/lib/db/errors'
import { reportError } from '@/lib/observability/report-error'
import { prepareProductPhoto } from '@/lib/storage/product-photo'
import { putObject } from '@/lib/storage/r2'
import { url } from '@/lib/seo/routes'

/**
 * ─────────────────────────────────────────────────────────────────────────────
 *  POSTING PRODUCTS FROM THE ADMIN PANEL.
 *
 *  Every step that decides whether a product may go live runs here, in this
 *  order, on the server: area permission, a real authored category, the form's
 *  own rules, the compliance lexicon, the photo, the stored schema. Only then is
 *  anything written, and every write, refusals included, is audited.
 *
 *  ── The lexicon is the only gate this copy meets ───────────────────────────
 *  CI scans the repository and never sees the database (CLAUDE.md rule 4), so a
 *  health claim or a controlled-substance name typed here is stopped here or
 *  nowhere. Directives are ignored for the same reason: in a form field a
 *  `compliance-allow` is an off switch, typed by the person being checked.
 * ─────────────────────────────────────────────────────────────────────────────
 */

export type PostedProductState = {
  error?: string
  ok?: string
  /** A quick post that saved: the form clears for the next one and says where this one is. */
  posted?: { slug: string; name: string; rewriting: boolean }
}

const AREA = '/admin/products'

/** Slugs a product may not take: `new` is the admin route that posts one. */
const RESERVED_SLUGS = ['new']

const NOT_MIGRATED =
  'Posting needs the PostedProduct table, and database migration 0010_posted_products has not been applied yet. Apply it, then post again. Nothing was saved.'

const fail = (error: string): PostedProductState => ({ error })

type Actor = { userId: string; email: string }

/** The lexicon, run as the only gate it is. A refusal is recorded, not only returned. */
async function lexiconGate(
  input: PostedFormInput,
  productLine: NonNullable<ReturnType<typeof categoryForSlug>>['productLine'],
  slug: string,
  actor: Actor,
): Promise<string | null> {
  const scan = scanText(copyForScan(input), {
    productLines: [productLine],
    honourDirectives: false,
  })
  if (scan.clean) return null

  // One mention per term: DMT, for one, sits in two tiers on root-bark copy.
  const terms = [...new Map(scan.blocking.map((m) => [m.term.toLowerCase(), m])).values()]
    .map((m) => `“${m.term}” (${m.reason})`)
    .join('; ')
  await recordAdminAction({
    entityType: 'PostedProduct',
    entityId: slug,
    action: 'PUBLISH_BLOCKED',
    actor,
    reason: `Lexicon refused the copy: ${terms}`,
  })
  return `Blocked by the compliance lexicon: ${terms}. Reword and post again.`
}

const MAX_PHOTOS = 6

/** Every uploaded photo, re-encoded and stored, up to six, with the bytes kept for the writer. */
async function uploadedPhotos(
  formData: FormData,
): Promise<{ images: ProductImage[]; bytes: Uint8Array[] } | { error: string }> {
  const files = formData.getAll('photos').filter((f): f is File => f instanceof File && f.size > 0)
  if (files.length > MAX_PHOTOS) return { error: `Up to ${MAX_PHOTOS} photos per product. Choose fewer and post again.` }
  const images: ProductImage[] = []
  const bytes: Uint8Array[] = []
  for (const [index, file] of files.entries()) {
    const prepared = await prepareProductPhoto(new Uint8Array(await file.arrayBuffer()))
    if ('error' in prepared) return { error: `Photo ${index + 1}: ${prepared.error}` }
    await putObject(prepared.key, prepared.bytes, 'image/jpeg')
    images.push({ objectKey: prepared.key, alt: 'Product photo', width: prepared.width, height: prepared.height })
    bytes.push(prepared.bytes)
  }
  return { images, bytes }
}

/** The document for a product, with the writer's copy on it. */
function documentWith(
  slug: string,
  line: NonNullable<ReturnType<typeof categoryForSlug>>['productLine'],
  base: { categorySlug: string; name: string; priceCents: number; inStock: boolean; isFeatured: boolean; notes: string; batchCodes?: readonly string[] },
  images: readonly ProductImage[],
  copy: WrittenCopy,
) {
  const input: PostedFormInput = {
    categorySlug: base.categorySlug,
    name: base.name,
    shortDescription: copy.shortDescription,
    description: copy.description,
    specs: (copy.specs ?? []).map(([label, value]) => [label, value]),
    priceCents: base.priceCents,
    inStock: base.inStock,
    batchCodes: base.batchCodes ?? [],
    isFeatured: base.isFeatured,
    onStateDirectory: false,
    photoAlt: '',
    removePhoto: false,
  }
  const withAlts = images.map((image, i) => ({ ...image, alt: (copy.imageAlts[i] ?? base.name).slice(0, 200) }))
  const built = buildDocument(slug, input, withAlts, line)
  if (!built.ok) return built
  const parsed = postedDocumentSchema.safeParse({
    ...built.value,
    ...(base.notes ? { notes: base.notes } : {}),
    content: copy.content,
    seo: copy.seo,
    writer: copy.writer,
    writtenAt: copy.writtenAt,
  })
  return parsed.success
    ? { ok: true as const, value: parsed.data }
    : { ok: false as const, error: `The written page did not validate (${parsed.error.issues[0]?.path.join('.')}). Nothing was saved.` }
}

/**
 * After the response: Claude rewrites the page from the same facts and the photos,
 * and the product is updated only if that copy passes every check. Runs out of the
 * owner's way, so posting never waits on it.
 */
function rewriteLater(slug: string, categorySlug: string, input: WriteInput, bytes: readonly Uint8Array[]) {
  if (!claudeWriterConfigured()) return
  after(async () => {
    try {
      const better = await claudeCopy(input, await photosForClaude(bytes))
      if (!better) return
      await applyCopy(slug, better)
      revalidateTag(CATALOG_TAG, { expire: 0 })
      revalidatePath(url.product(slug))
      revalidatePath(url.category(categorySlug))
    } catch (error) {
      await reportError(error, { source: 'action', severity: 'WARN', context: { stage: 'claude-rewrite', slug } }).catch(() => undefined)
    }
  })
}

/** Put a writer's copy on a stored product, keeping everything else as it is. */
async function applyCopy(slug: string, copy: WrittenCopy): Promise<boolean> {
  const row = await db.postedProduct.findUnique({ where: { slug } })
  if (!row) return false
  const current = postedDocumentSchema.safeParse(row.document)
  if (!current.success) return false
  const doc = current.data
  const next = postedDocumentSchema.safeParse({
    ...doc,
    shortDescription: copy.shortDescription,
    description: copy.description,
    images: doc.images.map((image, i) => ({ ...image, alt: (copy.imageAlts[i] ?? doc.name).slice(0, 200) })),
    // Researched specifications fill an empty table; a table the owner wrote is theirs and stays.
    ...(copy.specs?.length && doc.specs.length === 0 ? { specs: copy.specs.map(([label, value]) => [label, value]) } : {}),
    content: copy.content,
    seo: copy.seo,
    writer: copy.writer,
    writtenAt: copy.writtenAt,
  })
  if (!next.success) return false
  await db.postedProduct.update({ where: { slug }, data: { document: next.data } })
  return true
}

function writeInputFor(
  name: string,
  slug: string,
  category: NonNullable<ReturnType<typeof categoryForSlug>>,
  priceCents: number,
  notes: string,
  imageCount: number,
  links: WriteInput['links'],
): WriteInput {
  return {
    name,
    line: category.productLine,
    categoryName: category.name,
    categoryPath: url.category(category.slug),
    categorySlug: category.slug,
    productSlug: slug,
    priceCents,
    notes,
    imageCount,
    links,
  }
}

function publish(slug: string, categorySlug: string): void {
  updateTag(CATALOG_TAG)
  revalidatePath(url.product(slug))
  revalidatePath(url.category(categorySlug))
  revalidatePath(url.shop())
  revalidatePath('/')
  revalidatePath(AREA)
  revalidatePath(`${AREA}/${slug}`)
}

// ── Post ───────────────────────────────────────────────────────────────────

export async function createPostedProduct(
  _previous: PostedProductState,
  formData: FormData,
): Promise<PostedProductState> {
  const guard = await requireArea(AREA)
  if (!guard.ok) return fail(guard.error)

  const read = readPostedForm(formData)
  if (!read.ok) return fail(read.error)
  const input = read.value

  const category = categoryForSlug(input.categorySlug)
  if (!category) return fail('Choose a category.')

  let slug: string
  try {
    const posted = await db.postedProduct.findMany({ select: { slug: true } })
    const taken = new Set([
      ...PRODUCTS.map((p) => p.slug),
      ...posted.map((p) => p.slug),
      ...RESERVED_SLUGS,
    ])
    slug = uniqueSlug(input.name, taken)
  } catch (error) {
    if (isMissingTableError(error)) return fail(NOT_MIGRATED)
    throw error
  }

  const refused = await lexiconGate(input, category.productLine, slug, guard.identity)
  if (refused) return fail(refused)

  try {
    const photos = await uploadedPhotos(formData)
    if ('error' in photos) return fail(photos.error)

    const doc = buildDocument(slug, input, photos.images.map((image) => ({ ...image, alt: input.photoAlt || input.name })), category.productLine)
    if (!doc.ok) return fail(doc.error)

    await db.postedProduct.create({
      data: {
        slug,
        categorySlug: category.slug,
        document: doc.value,
        isActive: true,
        createdBy: guard.identity.email,
        updatedBy: guard.identity.email,
      },
    })
    await recordAdminAction({
      entityType: 'PostedProduct',
      entityId: slug,
      action: 'CREATE',
      actor: guard.identity,
      after: { categorySlug: category.slug, document: doc.value },
      reason: `Posted into ${category.name}`,
    })
    publish(slug, category.slug)
  } catch (error) {
    if (isMissingTableError(error)) return fail(NOT_MIGRATED)
    await reportError(error, { source: 'action', routePath: `${AREA}/new`, context: { slug } })
    return fail('The product could not be saved. It has been logged.')
  }

  // Outside the try: redirect() works by throwing, and must not be caught.
  redirect(`${AREA}/${slug}?posted=1`)
}

// ── Quick post: name, price, category, photos; the page is written automatically ──

/**
 * The owner's quick post (2026-09-14). Five fields; everything else is written:
 * description, short description, advantages, FAQs, sources, internal links, search
 * title and description, and one description per photo. The built-in writer's copy
 * goes live at once; Claude's replaces it moments later when it is configured.
 */
export async function quickPostProduct(
  _previous: PostedProductState,
  formData: FormData,
): Promise<PostedProductState> {
  const guard = await requireArea(AREA)
  if (!guard.ok) return fail(guard.error)

  const name = String(formData.get('name') ?? '').trim()
  const notes = String(formData.get('notes') ?? '').trim().slice(0, 1000)
  const priceCents = parseDollars(String(formData.get('price') ?? ''))
  const category = categoryForSlug(String(formData.get('categorySlug') ?? ''))
  if (!category) return fail('Choose a category.')
  if (name.length < 3 || name.length > 120) return fail('Give the product a name of 3 to 120 characters.')
  if (priceCents === null) {
    return fail(`Set the price ${category.productLine === 'VAPE' ? 'per unit' : 'per pound'}, written like 140 or 24.99.`)
  }

  // The owner's own words meet the lexicon first: they go into the page.
  const ownWords = scanText(`${name}\n${notes}`, { productLines: [category.productLine], honourDirectives: false })
  if (!ownWords.clean) {
    const terms = [...new Set(ownWords.blocking.map((m) => `“${m.term}” (${m.reason})`))].join('; ')
    return fail(`Blocked by the compliance lexicon: ${terms}. Reword and post again.`)
  }

  let slug: string
  try {
    const posted = await db.postedProduct.findMany({ select: { slug: true } })
    slug = uniqueSlug(name, new Set([...PRODUCTS.map((p) => p.slug), ...posted.map((p) => p.slug), ...RESERVED_SLUGS]))
  } catch (error) {
    if (isMissingTableError(error)) return fail(NOT_MIGRATED)
    throw error
  }

  let input: WriteInput
  let bytes: Uint8Array[] = []
  try {
    const photos = await uploadedPhotos(formData)
    if ('error' in photos) return fail(photos.error)
    bytes = photos.bytes

    input = writeInputFor(name, slug, category, priceCents, notes, photos.images.length, await productLinks(category.productLine, category.slug, slug))
    const copy = quickCopy(input)
    const refused = lexiconRefusals(copy, category.productLine)
    if (refused.length) return fail(`The written page was refused by the compliance lexicon (${refused.join(', ')}). Nothing was saved.`)

    const doc = documentWith(
      slug,
      category.productLine,
      { categorySlug: category.slug, name, priceCents, inStock: formData.get('stock') !== 'out', isFeatured: formData.get('isFeatured') === 'on', notes },
      photos.images,
      copy,
    )
    if (!doc.ok) return fail(doc.error)

    await db.postedProduct.create({
      data: { slug, categorySlug: category.slug, document: doc.value, isActive: true, createdBy: guard.identity.email, updatedBy: guard.identity.email },
    })
    await recordAdminAction({
      entityType: 'PostedProduct',
      entityId: slug,
      action: 'CREATE',
      actor: guard.identity,
      after: { categorySlug: category.slug, document: doc.value },
      reason: `Quick-posted into ${category.name}; page written automatically`,
    })
    publish(slug, category.slug)
  } catch (error) {
    if (isMissingTableError(error)) return fail(NOT_MIGRATED)
    await reportError(error, { source: 'action', routePath: `${AREA}/new`, context: { slug } })
    return fail('The product could not be saved. It has been logged.')
  }

  // Search engines hear about the new page at once; Claude rewrites it after the response.
  after(() => submitUrl(url.product(slug)).catch(() => undefined))
  rewriteLater(slug, category.slug, input, bytes)
  // Saved and live already: stay on the form, ready for the next product, rather than open an editor with a Save button.
  return { ok: 'Saved and live.', posted: { slug, name, rewriting: claudeWriterConfigured() } }
}

/** Rewrite a posted product's page now, with Claude when configured, from its stored name, price and photos. */
export async function rewritePostedProduct(
  _previous: PostedProductState,
  formData: FormData,
): Promise<PostedProductState> {
  const guard = await requireArea(AREA)
  if (!guard.ok) return fail(guard.error)
  return rewriteOne(String(formData.get('slug') ?? '').trim(), guard.identity)
}

export type RewriteStep =
  | { done: true; total: number }
  | { done: false; slug: string; name: string; index: number; total: number; result: PostedProductState }

/**
 * Research and rewrite the NEXT posted product after `after`, one per call
 * (owner, 2026-09-15). The admin page calls this in a loop while it is open, so
 * each call fits comfortably inside a single function's time limit and the owner
 * watches the progress; closing the page simply stops after the current product.
 */
export async function rewriteNextPostedProduct(after: string | null): Promise<RewriteStep | { error: string }> {
  const guard = await requireArea(AREA)
  if (!guard.ok) return { error: guard.error }
  if (!claudeWriterConfigured()) return { error: 'Add ANTHROPIC_API_KEY in Vercel first: research and rewriting need Claude.' }
  const rows = await db.postedProduct.findMany({ select: { slug: true, document: true }, orderBy: { slug: 'asc' } })
  const index = after === null ? 0 : rows.findIndex((row) => row.slug === after) + 1
  const row = rows[index]
  if (!row || index === 0 && after !== null) return { done: true, total: rows.length }
  const name = postedDocumentSchema.safeParse(row.document).data?.name ?? row.slug
  return { done: false, slug: row.slug, name, index: index + 1, total: rows.length, result: await rewriteOne(row.slug, guard.identity) }
}

async function rewriteOne(slug: string, identity: Actor): Promise<PostedProductState> {
  try {
    const row = await db.postedProduct.findUnique({ where: { slug } })
    if (!row) return fail('That product no longer exists.')
    const category = categoryForSlug(row.categorySlug)
    const parsed = postedDocumentSchema.safeParse(row.document)
    if (!category || !parsed.success) return fail('This product cannot be rewritten: its category or stored page is not valid.')
    const doc = parsed.data
    const priceCents = doc.poundPriceCents ?? doc.variants[0]?.priceCents ?? 0
    const input = writeInputFor(doc.name, slug, category, priceCents, doc.notes ?? '', doc.images.length, await productLinks(category.productLine, category.slug, slug))

    // The stored photos, fetched back from the public CDN for Claude to look at.
    const host = (process.env.NEXT_PUBLIC_R2_PUBLIC_HOST || process.env.R2_PUBLIC_HOST)?.replace(/^https?:\/\//, '').replace(/\/$/, '')
    const bytes = host
      ? (
          await Promise.all(
            doc.images.map((image) =>
              fetch(`https://${host}/${image.objectKey}`)
                .then(async (res) => (res.ok ? new Uint8Array(await res.arrayBuffer()) : null))
                .catch(() => null),
            ),
          )
        ).filter((b) => b !== null) as Uint8Array[]
      : []

    const copy = (await claudeCopy(input, await photosForClaude(bytes))) ?? quickCopy(input)
    const refused = lexiconRefusals(copy, category.productLine)
    if (refused.length) return fail(`The rewritten page was refused by the compliance lexicon (${refused.join(', ')}). The page was left as it was.`)
    if (!(await applyCopy(slug, copy))) return fail('The rewritten page did not validate. The page was left as it was.')
    await recordAdminAction({
      entityType: 'PostedProduct',
      entityId: slug,
      action: 'UPDATE',
      actor: identity,
      reason: `Page rewritten automatically (${copy.writer === 'claude' ? 'Claude' : 'built-in writer'})`,
    })
    publish(slug, category.slug)
    return {
      ok:
        copy.writer === 'claude'
          ? 'Rewritten by Claude, checked and saved. The shop shows it now.'
          : claudeWriterConfigured()
            ? 'Claude could not write it this time, so the built-in writer did. Saved; the shop shows it now.'
            : 'Rewritten by the built-in writer and saved. Add ANTHROPIC_API_KEY to have Claude write it.',
    }
  } catch (error) {
    if (isMissingTableError(error)) return fail(NOT_MIGRATED)
    await reportError(error, { source: 'action', routePath: `${AREA}/${slug}`, context: { slug, stage: 'rewrite' } })
    return fail('The page could not be rewritten. It has been logged.')
  }
}

// ── Edit ───────────────────────────────────────────────────────────────────

export async function updatePostedProduct(
  _previous: PostedProductState,
  formData: FormData,
): Promise<PostedProductState> {
  const guard = await requireArea(AREA)
  if (!guard.ok) return fail(guard.error)

  const slug = String(formData.get('slug') ?? '').trim()
  const read = readPostedForm(formData)
  if (!read.ok) return fail(read.error)
  const typed = read.value

  const category = categoryForSlug(typed.categorySlug)
  if (!category) return fail('Choose a category.')

  try {
    const existing = await db.postedProduct.findUnique({ where: { slug } })
    if (!existing) return fail('That product no longer exists.')
    const before = postedDocumentSchema.safeParse(existing.document)
    const previous = before.success ? before.data : undefined

    /*
      A copy box the owner did not touch keeps what is stored NOW, not what the form
      opened with. The automatic writer can finish after the form opened, and saving a
      price or stock change must not put the older writing back over it. The form sends
      each box as it opened; without that, the stored copy is the comparison.
    */
    const changed = (field: 'description' | 'shortDescription'): boolean => {
      const opened = formData.get(`${field}Opened`)
      const was = typeof opened === 'string' ? opened : (previous?.[field] ?? '')
      return was.trim() !== typed[field].trim()
    }
    const input = previous
      ? {
          ...typed,
          description: changed('description') ? typed.description : previous.description,
          shortDescription: changed('shortDescription') ? typed.shortDescription : previous.shortDescription,
        }
      : typed

    const refused = await lexiconGate(input, category.productLine, slug, guard.identity)
    if (refused) return fail(refused)

    // Keep the stored photos unless they are replaced or removed. New photos replace all of them.
    const kept = before.success && !input.removePhoto ? before.data.images : []
    const uploaded = await uploadedPhotos(formData)
    if ('error' in uploaded) return fail(uploaded.error)
    const images = uploaded.images.length
      ? uploaded.images.map((image, i) => ({ ...image, alt: uploaded.images.length > 1 ? `${input.name}, photo ${i + 1} of ${uploaded.images.length}` : input.name }))
      : kept.map((image, i) => (i === 0 && input.photoAlt ? { ...image, alt: input.photoAlt } : image))

    const built = buildDocument(slug, input, images, category.productLine)
    if (!built.ok) return fail(built.error)

    /*
      What the automatic writer wrote survives a save. If the owner rewrote the
      description by hand, their words become the page's sections; the questions,
      sources and search details stay.
    */
    const handEdited = previous !== undefined && changed('description')
    const merged = postedDocumentSchema.safeParse({
      ...built.value,
      ...(previous?.notes ? { notes: previous.notes } : {}),
      ...(previous?.seo ? { seo: previous.seo } : {}),
      ...(previous?.writer ? { writer: previous.writer, writtenAt: previous.writtenAt } : {}),
      ...(previous?.content
        ? {
            content: handEdited
              ? {
                  ...previous.content,
                  sections: [
                    {
                      heading: `About ${input.name}`,
                      paragraphs: input.description.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean).slice(0, 8),
                    },
                  ],
                }
              : previous.content,
          }
        : {}),
    })
    if (!merged.success) return fail('The changes did not validate. Nothing was saved.')
    const doc = { ok: true as const, value: merged.data }

    await db.postedProduct.update({
      where: { slug },
      data: {
        categorySlug: category.slug,
        document: doc.value,
        updatedBy: guard.identity.email,
      },
    })
    await recordAdminAction({
      entityType: 'PostedProduct',
      entityId: slug,
      action: 'UPDATE',
      actor: guard.identity,
      before: { categorySlug: existing.categorySlug, document: existing.document },
      after: { categorySlug: category.slug, document: doc.value },
    })
    publish(slug, category.slug)
    if (existing.categorySlug !== category.slug) revalidatePath(url.category(existing.categorySlug))
  } catch (error) {
    if (isMissingTableError(error)) return fail(NOT_MIGRATED)
    await reportError(error, { source: 'action', routePath: `${AREA}/${slug}`, context: { slug } })
    return fail('The changes could not be saved. They have been logged.')
  }
  return { ok: 'Saved. The shop shows the change now.' }
}

// ── Take down / put back ───────────────────────────────────────────────────

export async function setPostedProductActive(
  _previous: PostedProductState,
  formData: FormData,
): Promise<PostedProductState> {
  const guard = await requireArea(AREA)
  if (!guard.ok) return fail(guard.error)

  const slug = String(formData.get('slug') ?? '').trim()
  const isActive = formData.get('isActive') === 'true'

  try {
    const existing = await db.postedProduct.findUnique({ where: { slug } })
    if (!existing) return fail('That product no longer exists.')
    if (existing.isActive === isActive) return { ok: isActive ? 'Already live.' : 'Already hidden.' }

    await db.postedProduct.update({
      where: { slug },
      data: { isActive, updatedBy: guard.identity.email },
    })
    await recordAdminAction({
      entityType: 'PostedProduct',
      entityId: slug,
      action: isActive ? 'PUBLISH' : 'UNPUBLISH',
      actor: guard.identity,
      before: { isActive: existing.isActive },
      after: { isActive },
    })
    publish(slug, existing.categorySlug)
  } catch (error) {
    if (isMissingTableError(error)) return fail(NOT_MIGRATED)
    await reportError(error, { source: 'action', routePath: `${AREA}/${slug}`, context: { slug } })
    return fail('That could not be changed. It has been logged.')
  }
  return {
    ok: isActive
      ? 'Live again. It is back in the shop.'
      : 'Hidden. It has left the shop, and within a minute its page returns 404.',
  }
}

/**
 * Delete a posted product for good, from the products list.
 *
 * Orders are not touched: an order line keeps its own copy of the product and size
 * names, so past orders read the same after the product is gone. The photos stay in
 * storage, because a photo is stored under its content hash and the same file can
 * belong to another product or post.
 */
export async function deletePostedProduct(formData: FormData): Promise<void> {
  const guard = await requireArea(AREA)
  if (!guard.ok) return

  const slug = String(formData.get('slug') ?? '').trim()
  if (!slug) return

  try {
    const existing = await db.postedProduct.findUnique({ where: { slug } })
    if (!existing) return

    await db.postedProduct.delete({ where: { slug } })
    await recordAdminAction({
      entityType: 'PostedProduct',
      entityId: slug,
      action: 'DELETE',
      actor: guard.identity,
      // The whole product, so a deletion made by mistake can be put back from the trail.
      before: { categorySlug: existing.categorySlug, isActive: existing.isActive, document: existing.document },
      reason: 'Deleted from the products list',
    })
    publish(slug, existing.categorySlug)
  } catch (error) {
    if (isMissingTableError(error)) return
    await reportError(error, { source: 'action', routePath: AREA, context: { stage: 'delete-posted-product', slug } })
  }
}
