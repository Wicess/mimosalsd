'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { recordAdminAction } from '@/lib/admin/audit'
import { requireArea } from '@/lib/admin/guard'
import { db } from '@/lib/db/client'
import type { CrudState } from '@/app/actions/admin-crud'

/**
 * Promoters: people who send us customers. Attribution only — this site moves no
 * money, so there are no commissions to calculate here, only the record of what
 * each promoter's links brought in.
 *
 * A promoter is never deleted, only archived: orders carry their id, and deleting
 * one would quietly detach the credit from orders already placed.
 */

const LIST = '/admin/promoters'
const ok = (message: string): CrudState => ({ ok: message })
const fail = (error: string): CrudState => ({ error })

const promoterSchema = z.object({
  name: z.string().trim().min(2, 'Give the promoter a name.').max(120),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .min(2)
    .max(40)
    .regex(/^[a-z0-9-]+$/, 'Handles are lowercase letters, numbers and hyphens.'),
  email: z.union([z.string().trim().email('Enter a valid email address.').max(200), z.literal('')]),
  notes: z.string().trim().max(2000),
})

function read(formData: FormData) {
  return promoterSchema.safeParse({
    name: formData.get('name'),
    slug: formData.get('slug'),
    email: formData.get('email') ?? '',
    notes: formData.get('notes') ?? '',
  })
}

export async function createPromoter(_prev: CrudState, formData: FormData): Promise<CrudState> {
  const guard = await requireArea(LIST)
  if (!guard.ok) return fail(guard.error)
  const parsed = read(formData)
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? 'Check the values.')

  const taken = await db.promoter.findUnique({ where: { slug: parsed.data.slug }, select: { id: true } })
  if (taken) return fail(`The handle "${parsed.data.slug}" is already in use.`)

  const created = await db.promoter.create({
    data: {
      name: parsed.data.name,
      slug: parsed.data.slug,
      email: parsed.data.email || null,
      notes: parsed.data.notes || null,
    },
  })
  await recordAdminAction({
    entityType: 'Promoter',
    entityId: created.id,
    action: 'CREATE',
    actor: guard.identity,
    after: created,
  })
  revalidatePath(LIST)
  return ok(`${created.name} added.`)
}

export async function updatePromoter(_prev: CrudState, formData: FormData): Promise<CrudState> {
  const guard = await requireArea(LIST)
  if (!guard.ok) return fail(guard.error)
  const id = String(formData.get('id') ?? '')
  const parsed = read(formData)
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? 'Check the values.')

  const before = await db.promoter.findUnique({ where: { id } })
  if (!before) return fail('That promoter no longer exists.')
  const clash = await db.promoter.findUnique({ where: { slug: parsed.data.slug }, select: { id: true } })
  if (clash && clash.id !== id) return fail(`The handle "${parsed.data.slug}" is already in use.`)

  const after = await db.promoter.update({
    where: { id },
    data: {
      name: parsed.data.name,
      slug: parsed.data.slug,
      email: parsed.data.email || null,
      notes: parsed.data.notes || null,
    },
  })
  await recordAdminAction({
    entityType: 'Promoter',
    entityId: id,
    action: 'UPDATE',
    actor: guard.identity,
    before,
    after,
  })
  revalidatePath(`${LIST}/${id}`)
  revalidatePath(LIST)
  return ok('Saved.')
}

export async function togglePromoter(formData: FormData): Promise<void> {
  const guard = await requireArea(LIST)
  if (!guard.ok) return
  const id = String(formData.get('id') ?? '')
  const current = await db.promoter.findUnique({ where: { id }, select: { archived: true, name: true } })
  if (!current) return

  await db.promoter.update({ where: { id }, data: { archived: !current.archived } })
  await recordAdminAction({
    entityType: 'Promoter',
    entityId: id,
    action: 'UPDATE',
    actor: guard.identity,
    before: { archived: current.archived },
    after: { archived: !current.archived },
    reason: current.archived ? `Restored ${current.name}` : `Archived ${current.name}`,
  })
  revalidatePath(`${LIST}/${id}`)
  revalidatePath(LIST)
}

/**
 * Point an existing tracking link at a promoter, or take it back. Only future
 * orders move: the credit on orders already placed is stamped on the order.
 */
export async function assignLink(formData: FormData): Promise<void> {
  const guard = await requireArea(LIST)
  if (!guard.ok) return
  const linkId = String(formData.get('linkId') ?? '')
  const promoterId = String(formData.get('promoterId') ?? '') || null

  const link = await db.trackingLink.findUnique({ where: { id: linkId }, select: { slug: true, promoterId: true } })
  if (!link) return
  if (promoterId) {
    const promoter = await db.promoter.findUnique({ where: { id: promoterId }, select: { id: true } })
    if (!promoter) return
  }

  await db.trackingLink.update({ where: { id: linkId }, data: { promoterId } })
  await recordAdminAction({
    entityType: 'TrackingLink',
    entityId: linkId,
    action: 'UPDATE',
    actor: guard.identity,
    before: { promoterId: link.promoterId },
    after: { promoterId },
    reason: promoterId ? `/r/${link.slug} assigned` : `/r/${link.slug} unassigned`,
  })
  if (promoterId) revalidatePath(`${LIST}/${promoterId}`)
  if (link.promoterId) revalidatePath(`${LIST}/${link.promoterId}`)
  revalidatePath(LIST)
  revalidatePath('/admin/links')
}
