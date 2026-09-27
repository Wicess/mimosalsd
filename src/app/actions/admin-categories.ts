'use server'

import { revalidatePath, updateTag } from 'next/cache'
import { getAdminIdentity } from '@/lib/admin/auth'
import { canAccessAdminPath } from '@/lib/admin/areas'
import { recordAdminAction } from '@/lib/admin/audit'
import { db } from '@/lib/db/client'
import { catalog } from '@/lib/catalog/repository'
import { CATALOG_TAG } from '@/lib/catalog/merged'
import { scanText } from '@/lib/compliance/lexicon'
import { reportError } from '@/lib/observability/report-error'
import { url } from '@/lib/seo/routes'

/**
 * ─────────────────────────────────────────────────────────────────────────────
 *  CATEGORY COPY EDITING — the same overlay pattern as products.
 *
 *  Null and blank both mean INHERIT. Clearing a box in the editor restores the
 *  authored value rather than blanking a page that ranks, so no edit here is a
 *  one-way door.
 *
 *  ── The lexicon gate is the point, not a formality ─────────────────────────
 *  CI scans the repository and never sees the database (CLAUDE.md rule 4). Copy
 *  typed into this form is published to a category page — a page an answer engine
 *  quotes — without ever passing a commit. This is the only gate it will meet, so
 *  a refusal is recorded as `PUBLISH_BLOCKED` rather than merely returned: an
 *  entry that records something NOT happening is the evidence the gate ran.
 *
 *  Scoped to the category's own product line, so the MHRB-only extraction and
 *  consumption terms are enforced on root-bark copy and not on gummies.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const ADMIN_PATH = '/admin/categories'

export type CategoryEditState = { error?: string; ok?: string }

const fail = (error: string): CategoryEditState => ({ error })

type CategoryGuard = { identity: { userId: string; email: string } } | { error: string }

async function guard(): Promise<CategoryGuard> {
  const identity = await getAdminIdentity()
  if (!identity) return { error: 'Not signed in.' }
  if (!canAccessAdminPath(identity.role, identity.adminAreas, ADMIN_PATH)) {
    return { error: 'You do not have access to the catalogue.' }
  }
  return { identity: { userId: identity.userId, email: identity.email } }
}

/** Trimmed, or null when the operator left it empty — which means inherit. */
function blankToNull(value: FormDataEntryValue | null): string | null {
  const text = String(value ?? '').trim()
  return text === '' ? null : text
}

function publish(slug: string): void {
  updateTag(CATALOG_TAG)
  revalidatePath(url.category(slug))
  revalidatePath(url.shop())
  revalidatePath('/')
  revalidatePath(ADMIN_PATH)
}

export async function saveCategory(
  _previous: CategoryEditState,
  formData: FormData,
): Promise<CategoryEditState> {
  const auth = await guard()
  if ('error' in auth) return auth

  const slug = String(formData.get('slug') ?? '').trim()
  const base = catalog.getCategory(slug)
  if (!base) return fail('Unknown category.')

  const intro = blankToNull(formData.get('intro'))
  const detail = blankToNull(formData.get('detail'))
  const metaTitle = blankToNull(formData.get('metaTitle'))
  const metaDesc = blankToNull(formData.get('metaDesc'))
  const aboutHeading = blankToNull(formData.get('aboutHeading'))
  const aboutLede = blankToNull(formData.get('aboutLede'))

  /*
    Refused rather than silently dropped.

    `applyCategoryOverride` ignores an About edit on a category with no authored
    `about` block, because half-building one would render a heading over nothing.
    Accepting the input and discarding it would leave an operator looking at a form
    that says it saved and a page that did not change — so the refusal is explicit.
  */
  if ((aboutHeading || aboutLede) && !base.about) {
    return fail(
      'This category has no About block to edit. That section is authored in the catalogue; ask for it to be added before editing its copy here.',
    )
  }

  /*
    Meta length is checked, not truncated.

    Bing ties indexing reliability and grounding eligibility to titles and
    descriptions being present and useful (§13). A description silently cut at 165
    characters mid-sentence is worse than a long one, and worse than telling the
    person writing it.
  */
  if (metaTitle && metaTitle.length > 70) {
    return fail(
      `Meta title is ${metaTitle.length} characters. Keep it under 70 so it is not truncated in results.`,
    )
  }
  if (metaDesc && metaDesc.length > 165) {
    return fail(`Meta description is ${metaDesc.length} characters. Keep it under 165.`)
  }

  const copy = [intro, detail, metaTitle, metaDesc, aboutHeading, aboutLede]
    .filter(Boolean)
    .join('\n')

  if (copy) {
    // `honourDirectives: false`: a compliance-allow directive typed into this form
    // would otherwise switch the gate off for the very words it names. In the
    // repository a directive is reviewed in a diff; in a form field nobody sees it.
    const scan = scanText(copy, { productLines: [base.productLine], honourDirectives: false })
    if (!scan.clean) {
      const terms = scan.blocking.map((m) => `“${m.term}” (${m.reason})`).join('; ')
      await recordAdminAction({
        entityType: 'Category',
        entityId: slug,
        action: 'PUBLISH_BLOCKED',
        actor: auth.identity,
        reason: `Lexicon refused the copy: ${terms}`,
      })
      return fail(`Blocked by the compliance lexicon: ${terms}. Reword and save again.`)
    }
  }

  try {
    const data = {
      intro,
      detail,
      metaTitle,
      metaDesc,
      aboutHeading,
      aboutLede,
      updatedBy: auth.identity.email,
    }

    const before = await db.categoryOverride.findUnique({ where: { slug } })
    const after = await db.categoryOverride.upsert({
      where: { slug },
      create: { slug, ...data },
      update: data,
    })

    await recordAdminAction({
      entityType: 'CategoryOverride',
      entityId: slug,
      action: before ? 'UPDATE' : 'CREATE',
      actor: auth.identity,
      before,
      after,
      reason: 'Category copy saved and published',
    })

    publish(slug)
    return { ok: 'Saved and published.' }
  } catch (error) {
    await reportError(error, {
      source: 'action',
      routePath: ADMIN_PATH,
      context: { stage: 'save-category', slug },
    })
    return fail('Could not save. It has been logged.')
  }
}

/** Discard every edit for one category and fall back to the authored copy. */
export async function resetCategory(
  _previous: CategoryEditState,
  formData: FormData,
): Promise<CategoryEditState> {
  const auth = await guard()
  if ('error' in auth) return auth

  const slug = String(formData.get('slug') ?? '').trim()
  if (!catalog.getCategory(slug)) return fail('Unknown category.')

  try {
    // Deleting the row IS the reset: with no override, every field inherits.
    const before = await db.categoryOverride.findUnique({ where: { slug } })
    await db.categoryOverride.deleteMany({ where: { slug } })

    await recordAdminAction({
      entityType: 'CategoryOverride',
      entityId: slug,
      action: 'RESET',
      actor: auth.identity,
      before,
      reason: 'Every override discarded — category reverted to the authored copy',
    })

    publish(slug)
    return { ok: 'Edits discarded. Showing the authored version.' }
  } catch (error) {
    await reportError(error, {
      source: 'action',
      routePath: ADMIN_PATH,
      context: { stage: 'reset-category', slug },
    })
    return fail('Could not reset. It has been logged.')
  }
}
