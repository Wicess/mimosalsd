'use server'

import { revalidatePath, updateTag } from 'next/cache'
import { getAdminIdentity } from '@/lib/admin/auth'
import { canAccessAdminPath } from '@/lib/admin/areas'
import { recordAdminAction } from '@/lib/admin/audit'
import { db } from '@/lib/db/client'
import { CATALOG_TAG } from '@/lib/catalog/merged'
import { scanText } from '@/lib/compliance/lexicon'
import { reportError } from '@/lib/observability/report-error'
import { url } from '@/lib/seo/routes'
import { SIZE_KEYS } from '@/lib/catalog/sizing'
import { authoredProduct } from '@/lib/catalog/authored'

export type ProductEditState = { error?: string; ok?: string }

const ADMIN_PATH = '/admin/products'

/**
 * Product editing, as an overlay over the authored catalogue.
 *
 * Three things here are load-bearing and none of them are obvious:
 *
 *  1. THE LEXICON GATES EVERY WORD. Product copy is exactly what rule 4 in CLAUDE.md
 *     covers — health claims sitewide, extraction and consumption terms on MHRB. An
 *     admin form is the easiest possible way to put "treats anxiety" on a product
 *     page, and CI cannot catch it because CI never sees the database. So the scan
 *     runs here, before the write, and refuses.
 *
 *  2. MONEY IS PARSED, NOT TRUSTED. Operators type dollars; the database stores
 *     integer cents. `28.1` must become 2810, not 281, and `28.999` must be refused
 *     rather than silently rounded into a price nobody chose.
 *
 *  3. CLEARING A FIELD RESTORES THE AUTHORED VALUE. An empty input writes NULL, and
 *     null means inherit. That is what makes every edit reversible without a deploy,
 *     and it is why "Reset" can simply delete the row.
 */

type CatalogueGuard =
  | { identity: { userId: string; email: string } }
  | { error: string }

async function guard(): Promise<CatalogueGuard> {
  const identity = await getAdminIdentity()
  if (!identity) return { error: 'Not signed in.' }
  if (!canAccessAdminPath(identity.role, identity.adminAreas, ADMIN_PATH)) {
    return { error: 'You do not have access to the catalogue.' }
  }
  return { identity: { userId: identity.userId, email: identity.email } }
}

/** Dollars as typed by a human -> integer cents. Undefined when blank. */
function parseMoney(raw: FormDataEntryValue | null): number | undefined | 'invalid' {
  const text = String(raw ?? '').trim().replace(/[$,\s]/g, '')
  if (text === '') return undefined
  if (!/^\d+(\.\d{1,2})?$/.test(text)) return 'invalid'
  const cents = Math.round(Number(text) * 100)
  return Number.isSafeInteger(cents) && cents > 0 ? cents : 'invalid'
}

function blankToNull(raw: FormDataEntryValue | null): string | null {
  const text = String(raw ?? '').trim()
  return text === '' ? null : text
}

function checkbox(form: FormData, key: string): boolean | null {
  // Three states, not two: "on", "off" and "inherit". A plain checkbox cannot express
  // the third, so the form uses a select and this maps it back.
  const value = String(form.get(key) ?? 'inherit')
  if (value === 'yes') return true
  if (value === 'no') return false
  return null
}

/** "Label | Value" per line -> [[label, value], ...]. Blank clears the override. */
function parseSpecs(raw: FormDataEntryValue | null): Array<[string, string]> | null {
  const text = String(raw ?? '').trim()
  if (text === '') return null
  const rows = text
    .split('\n')
    .map((line) => line.split('|'))
    .filter((parts) => parts.length >= 2)
    .map(
      (parts) =>
        [parts[0]!.trim(), parts.slice(1).join('|').trim()] as [string, string],
    )
    .filter(([label, value]) => label !== '' && value !== '')
  return rows.length > 0 ? rows : null
}

const CHANNELS = ['PARCEL', 'PACT_CARRIER', 'LOCAL_COURIER'] as const

export async function saveProduct(
  _previous: ProductEditState,
  formData: FormData,
): Promise<ProductEditState> {
  const auth = await guard()
  if ('error' in auth) return auth

  const slug = String(formData.get('slug') ?? '').trim()
  const base = authoredProduct(slug)
  if (!base) return { error: 'Unknown product.' }

  // ── Copy, gated by the compliance lexicon ──────────────────────────────────
  const name = blankToNull(formData.get('name'))
  const shortDescription = blankToNull(formData.get('shortDescription'))
  const description = blankToNull(formData.get('description'))
  const specs = parseSpecs(formData.get('specs'))

  const copy = [name, shortDescription, description, specs?.flat().join(' ')]
    .filter(Boolean)
    .join('\n')

  if (copy) {
    // Scoped to this product's line, so the MHRB-only extraction and consumption
    // terms are enforced on MHRB copy and not on gummies.
    // `honourDirectives: false`: a compliance-allow directive typed into this form
    // would otherwise switch the gate off for the words it names.
    const scan = scanText(copy, { productLines: [base.productLine], honourDirectives: false })
    if (!scan.clean) {
      const terms = scan.blocking.map((m) => `“${m.term}” (${m.reason})`).join('; ')
      /*
        The refusal is recorded, not just returned.

        CI scans the repository and never sees the database, so a health claim typed
        into this form is caught here or nowhere (CLAUDE.md rule 4). That makes this
        branch the only evidence the gate ran at all — and "we have a gate" is
        exactly the claim a regulator would ask us to demonstrate. An entry that
        records something NOT happening is the one worth keeping.

        The rejected copy is deliberately not stored: it is the text the lexicon just
        refused to publish, and the terms that tripped it are the useful part.
      */
      await recordAdminAction({
        entityType: 'Product',
        entityId: slug,
        action: 'PUBLISH_BLOCKED',
        actor: auth.identity,
        reason: `Lexicon refused the copy: ${terms}`,
      })
      return { error: `Blocked by the compliance lexicon: ${terms}. Reword and save again.` }
    }
  }

  // ── Money ──────────────────────────────────────────────────────────────────
  const poundPriceCents = parseMoney(formData.get('poundPriceCents'))
  if (poundPriceCents === 'invalid') {
    return { error: 'The price per pound must be an amount like 140 or 140.50.' }
  }

  const variantPrices: Record<string, number> = {}
  if (!base.sizing) {
    for (const variant of base.variants) {
      const price = parseMoney(formData.get(`variant:${variant.sku}`))
      if (price === 'invalid') {
        return { error: `Price for ${variant.name} must be an amount like 24 or 24.50.` }
      }
      if (price !== undefined) variantPrices[variant.sku] = price
    }
  }

  const defaultSizeKey = blankToNull(formData.get('defaultSizeKey'))
  if (defaultSizeKey && base.sizing && !SIZE_KEYS.includes(defaultSizeKey)) {
    return { error: 'Choose one of the four sizes: 1/4, 1/3, 1/2 or 1 lb.' }
  }

  // ── Compliance ─────────────────────────────────────────────────────────────
  const channelRaw = String(formData.get('fulfillmentChannel') ?? 'inherit')
  const fulfillmentChannel = CHANNELS.includes(channelRaw as (typeof CHANNELS)[number])
    ? channelRaw
    : null

  const statesRaw = String(formData.get('directoryStates') ?? '').trim()
  const directoryStates =
    statesRaw === ''
      ? null
      : statesRaw
          .split(/[\s,]+/)
          .map((s) => s.toUpperCase())
          .filter((s) => /^[A-Z]{2}$/.test(s))

  try {
    const data = {
      name,
      shortDescription,
      description,
      specs: specs ?? undefined,
      poundPriceCents: poundPriceCents ?? null,
      defaultSizeKey,
      variantPrices: Object.keys(variantPrices).length > 0 ? variantPrices : undefined,
      notForHumanConsumption: checkbox(formData, 'notForHumanConsumption'),
      ageRestricted: checkbox(formData, 'ageRestricted'),
      pactRegulated: checkbox(formData, 'pactRegulated'),
      fulfillmentChannel,
      directoryStates: directoryStates ?? undefined,
      isActive: checkbox(formData, 'isActive'),
      isFeatured: checkbox(formData, 'isFeatured'),
      updatedBy: auth.identity.email,
    }

    const before = await db.productOverride.findUnique({ where: { slug } })

    const after = await db.productOverride.upsert({
      where: { slug },
      create: { slug, ...data },
      update: data,
    })

    /*
      An override edit changes what a shopper is charged and what the compliance
      flags say a product IS — `pactRegulated` and `ageRestricted` decide how it
      ships and to whom. Both belong in a trail, and `before` being null is itself
      information: it means this product had never been edited before now.
    */
    await recordAdminAction({
      entityType: 'ProductOverride',
      entityId: slug,
      action: before ? 'UPDATE' : 'CREATE',
      actor: auth.identity,
      before,
      after,
      reason: 'Catalogue override saved and published',
    })

    publish(slug)
    return { ok: 'Saved and published.' }
  } catch (error) {
    await reportError(error, {
      source: 'action',
      routePath: ADMIN_PATH,
      context: { stage: 'save-product', slug },
    })
    return { error: 'Could not save. It has been logged.' }
  }
}

/** Discard every edit for one product and fall back to the authored catalogue. */
export async function resetProduct(
  _previous: ProductEditState,
  formData: FormData,
): Promise<ProductEditState> {
  const auth = await guard()
  if ('error' in auth) return auth

  const slug = String(formData.get('slug') ?? '').trim()
  if (!authoredProduct(slug)) return { error: 'Unknown product.' }

  try {
    // Deleting the row IS the reset: with no override, every field inherits.
    const before = await db.productOverride.findUnique({ where: { slug } })
    await db.productOverride.deleteMany({ where: { slug } })

    // `before` is kept here, unlike the subscriber erasure: this row is pricing and
    // compliance configuration, not somebody's personal data, and the discarded
    // values are the whole point of being able to reconstruct the change.
    await recordAdminAction({
      entityType: 'ProductOverride',
      entityId: slug,
      action: 'RESET',
      actor: auth.identity,
      before,
      reason: 'Every override discarded — product reverted to the authored catalogue',
    })

    publish(slug)
    return { ok: 'Edits discarded. Showing the authored version.' }
  } catch (error) {
    await reportError(error, {
      source: 'action',
      routePath: ADMIN_PATH,
      context: { stage: 'reset-product', slug },
    })
    return { error: 'Could not reset. It has been logged.' }
  }
}

/**
 * Publish an edit.
 *
 * The tag is what actually matters — it drops the cached override map that every
 * product, category and shop page reads through. The explicit paths cover the routes
 * whose own render output is cached separately.
 *
 * `updateTag`, not `revalidateTag`. In Next 16 `revalidateTag` serves stale content
 * while it revalidates, so an operator who saved a price would be shown the OLD price
 * on the next render and reasonably conclude the save had failed. `updateTag` expires
 * immediately and is the documented read-your-own-writes API for a Server Action.
 */
function publish(slug: string): void {
  updateTag(CATALOG_TAG)
  revalidatePath(url.product(slug))
  revalidatePath(url.shop())
  revalidatePath('/')
  revalidatePath(ADMIN_PATH)
}

/**
 * Take a built-in product out of the shop, or put it back, from the products list.
 *
 * Built-in products are written in the catalogue file, so they cannot be deleted
 * from here; hiding is the override's `isActive`. Showing again clears the override
 * back to the catalogue's own value when that value is "active", so an untouched
 * product does not read as edited.
 */
export async function setProductVisibility(formData: FormData): Promise<void> {
  const auth = await guard()
  if ('error' in auth) return

  const slug = String(formData.get('slug') ?? '').trim()
  const authored = authoredProduct(slug)
  if (!authored) return
  const show = formData.get('show') === 'true'
  const isActive = show ? (authored.isActive ? null : true) : false

  try {
    const before = await db.productOverride.findUnique({ where: { slug } })
    const after = await db.productOverride.upsert({
      where: { slug },
      create: { slug, isActive, updatedBy: auth.identity.email },
      update: { isActive, updatedBy: auth.identity.email },
    })
    await recordAdminAction({
      entityType: 'ProductOverride',
      entityId: slug,
      action: before ? 'UPDATE' : 'CREATE',
      actor: auth.identity,
      before: before ? { isActive: before.isActive } : null,
      after: { isActive: after.isActive },
      reason: show ? 'Put back in the shop from the products list' : 'Hidden from the shop from the products list',
    })
    publish(slug)
  } catch (error) {
    await reportError(error, { source: 'action', routePath: ADMIN_PATH, context: { stage: 'product-visibility', slug } })
  }
}
