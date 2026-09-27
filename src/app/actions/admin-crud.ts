'use server'

import { revalidatePath, updateTag } from 'next/cache'
import { z } from 'zod'
import { COMPANY_EMAIL_KEY } from '@/lib/site/company-email'
import { POSTAL_ADDRESS_KEY } from '@/lib/site/postal-address'
import { requireArea } from '@/lib/admin/guard'
import { LAB_TAG } from '@/lib/catalog/merged'
import { recordAdminAction } from '@/lib/admin/audit'
import { db } from '@/lib/db/client'
import { hashPassword } from '@/lib/admin/password'
import { ADMIN_AREA_SLUGS } from '@/lib/admin/areas'
import { scanText } from '@/lib/compliance/lexicon'
import { readTarget } from '@/lib/links/redirect'
import { LINK_PLATFORMS, suggestSlug } from '@/lib/links/platforms'
import { absoluteUrl } from '@/lib/seo/routes'
import { LOCATIONS } from '@/lib/locations/locations'

export type CrudState = { error?: string; ok?: string }

const ok = (message: string): CrudState => ({ ok: message })
const fail = (error: string): CrudState => ({ error })

// ── Announcements ───────────────────────────────────────────────────────────

const announcementSchema = z.object({
  title: z.string().trim().min(3, 'Give it a title.').max(160),
  body: z.string().trim().min(10, 'Write the message.').max(2000),
  severity: z.enum(['INFO', 'WARNING', 'CRITICAL']),
  isActive: z.coerce.boolean(),
})

export async function saveAnnouncement(
  _prev: CrudState,
  formData: FormData,
): Promise<CrudState> {
  const guard = await requireArea('/admin/announcements')
  if (!guard.ok) return fail(guard.error)

  const parsed = announcementSchema.safeParse({
    title: formData.get('title'),
    body: formData.get('body'),
    severity: formData.get('severity'),
    isActive: formData.get('isActive') === 'on',
  })
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? 'Check the values.')

  // A banner is content on every page. It goes through the same gate as everything else.
  // Form input: a directive typed into the banner must not disable the gate.
  const scan = scanText(`${parsed.data.title} ${parsed.data.body}`, { honourDirectives: false })
  if (!scan.clean) {
    // CI never sees the database, so this branch is the only record that the gate
    // ran on a banner that appears on every page of the site.
    await recordAdminAction({
      entityType: 'Announcement',
      entityId: String(formData.get('id') ?? 'new'),
      action: 'PUBLISH_BLOCKED',
      actor: guard.identity,
      reason: `Lexicon refused the copy: ${scan.blocking.map((m) => m.term).join(', ')}`,
    })
    return fail(
      `Blocked by the compliance lexicon: ${scan.blocking.map((m) => m.term).join(', ')}.`,
    )
  }

  const id = String(formData.get('id') ?? '')
  const before = id ? await db.announcement.findUnique({ where: { id } }) : null
  const after = id
    ? await db.announcement.update({ where: { id }, data: parsed.data })
    : await db.announcement.create({ data: parsed.data })

  await recordAdminAction({
    entityType: 'Announcement',
    entityId: after.id,
    action: id ? 'UPDATE' : 'CREATE',
    actor: guard.identity,
    before,
    after,
    reason: 'Site-wide banner saved',
  })

  revalidatePath('/admin/announcements')
  return ok(id ? 'Announcement updated.' : 'Announcement created.')
}

export async function toggleAnnouncement(formData: FormData): Promise<void> {
  const guard = await requireArea('/admin/announcements')
  if (!guard.ok) return

  const id = String(formData.get('id') ?? '')
  const current = await db.announcement.findUnique({ where: { id } })
  if (!current) return
  await db.announcement.update({ where: { id }, data: { isActive: !current.isActive } })
  await recordAdminAction({
    entityType: 'Announcement',
    entityId: id,
    action: current.isActive ? 'UNPUBLISH' : 'PUBLISH',
    actor: guard.identity,
    reason: current.isActive ? 'Banner taken down' : 'Banner shown site-wide',
  })
  revalidatePath('/admin/announcements')
}

// ── Tracking links ──────────────────────────────────────────────────────────

const linkSchema = z.object({
  /** The social platform (or email, or other) the link is for: tags every visit it brings. */
  platform: z.string().trim().refine((value) => LINK_PLATFORMS.some((p) => p.key === value), 'Choose where you will post the link.'),
  label: z.string().trim().min(2, 'Say what the link is for, like "Bio link".').max(120),
  targetUrl: z.string().trim().max(500).optional(),
  slug: z
    .string()
    .trim()
    .max(40)
    .regex(/^[a-z0-9-]*$/, 'Lowercase letters, numbers and hyphens only.')
    .optional(),
})

/**
 * Make a tracking link for a post on a platform (owner, 2026-09-14): pick the
 * platform, say what it is for, and the link is ready to copy. The address is
 * suggested from both ("instagram-bio") unless one is typed, and made unique.
 */
export async function createTrackingLink(
  _prev: CrudState,
  formData: FormData,
): Promise<CrudState> {
  const guard = await requireArea('/admin/links')
  if (!guard.ok) return fail(guard.error)

  const parsed = linkSchema.safeParse({
    platform: formData.get('platform') ?? '',
    label: formData.get('label'),
    targetUrl: formData.get('targetUrl') || undefined,
    slug: formData.get('slug') || undefined,
  })
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? 'Check the values.')

  // Read at request time: an origin baked in at build would be the build's, not the site's.
  const target = readTarget(parsed.data.targetUrl || '/', absoluteUrl('/'))
  if (!target.ok) return fail(target.error)

  const typed = parsed.data.slug?.replace(/^-+|-+$/g, '')
  if (typed && typed.length < 2) return fail('Make the link address at least two characters.')
  const base = typed || suggestSlug(parsed.data.platform, parsed.data.label)
  let slug = base
  for (let n = 2; await db.trackingLink.findUnique({ where: { slug }, select: { id: true } }); n++) {
    if (typed) return fail(`The address "${typed}" is already in use.`)
    slug = `${base.slice(0, 36)}-${n}`
  }

  const created = await db.trackingLink.create({
    data: { slug, label: parsed.data.label, targetUrl: target.value, source: parsed.data.platform },
  })
  await recordAdminAction({
    entityType: 'TrackingLink',
    entityId: created.id,
    action: 'CREATE',
    actor: guard.identity,
    after: created,
    reason: `Created /r/${slug} for ${parsed.data.platform}`,
  })
  revalidatePath('/admin/links')
  return ok(`Created ${absoluteUrl(`/r/${slug}`)}. Copy it from the list below.`)
}

export async function toggleTrackingLink(formData: FormData): Promise<void> {
  const guard = await requireArea('/admin/links')
  if (!guard.ok) return
  const id = String(formData.get('id') ?? '')
  const current = await db.trackingLink.findUnique({ where: { id } })
  if (!current) return
  await db.trackingLink.update({ where: { id }, data: { isActive: !current.isActive } })
  await recordAdminAction({
    entityType: 'TrackingLink',
    entityId: id,
    action: 'UPDATE',
    actor: guard.identity,
    reason: `${current.isActive ? 'Disabled' : 'Enabled'} /r/${current.slug}`,
  })
  revalidatePath('/admin/links')
}

// ── Settings ────────────────────────────────────────────────────────────────

export async function saveSetting(_prev: CrudState, formData: FormData): Promise<CrudState> {
  const guard = await requireArea('/admin/settings')
  if (!guard.ok) return fail(guard.error)

  const parsed = z
    .object({
      key: z.string().trim().min(2).max(80).regex(/^[a-z0-9._-]+$/i, 'Invalid key.'),
      label: z.string().trim().min(2).max(160),
      value: z.string().max(4000),
      group: z.string().trim().max(40).default('general'),
    })
    .safeParse({
      key: formData.get('key'),
      label: formData.get('label'),
      value: formData.get('value') ?? '',
      group: formData.get('group') || 'general',
    })
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? 'Check the values.')
  // The company email has its own form, which validates the address and refreshes
  // every page that shows it. Saving it here would skip both.
  if (parsed.data.key === COMPANY_EMAIL_KEY) return fail('Change the company email with the Company email form above.')
  if (parsed.data.key === POSTAL_ADDRESS_KEY) return fail('Change the postal address with the Postal address form above.')

  // Settings are shown to customers. Same gate as any other copy.
  // Form input: a directive typed into a setting must not disable the gate.
  const scan = scanText(parsed.data.value, { honourDirectives: false })
  if (!scan.clean) {
    await recordAdminAction({
      entityType: 'Setting',
      entityId: parsed.data.key,
      action: 'PUBLISH_BLOCKED',
      actor: guard.identity,
      reason: `Lexicon refused the value: ${scan.blocking.map((m) => m.term).join(', ')}`,
    })
    return fail(`Blocked by the lexicon: ${scan.blocking.map((m) => m.term).join(', ')}.`)
  }

  const before = await db.setting.findUnique({ where: { key: parsed.data.key } })
  const after = await db.setting.upsert({
    where: { key: parsed.data.key },
    update: { ...parsed.data, updatedBy: guard.identity.email },
    create: { ...parsed.data, updatedBy: guard.identity.email },
  })
  await recordAdminAction({
    entityType: 'Setting',
    entityId: parsed.data.key,
    action: before ? 'UPDATE' : 'CREATE',
    actor: guard.identity,
    before,
    after,
    reason: `Setting ${parsed.data.key} saved`,
  })
  revalidatePath('/admin/settings')
  return ok(`Saved ${parsed.data.key}.`)
}

// ── Payment handles ─────────────────────────────────────────────────────────

export async function addPaymentHandle(
  _prev: CrudState,
  formData: FormData,
): Promise<CrudState> {
  const guard = await requireArea('/admin/payments')
  if (!guard.ok) return fail(guard.error)

  const parsed = z
    .object({
      method: z.enum(['CASHAPP', 'CHIME', 'APPLE_CASH']),
      handle: z.string().trim().min(2, 'Enter the handle.').max(120),
      label: z.string().trim().max(80).optional(),
    })
    .safeParse({
      method: formData.get('method'),
      handle: formData.get('handle'),
      label: formData.get('label') || undefined,
    })
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? 'Check the values.')

  const exists = await db.paymentHandle.findFirst({
    where: { method: parsed.data.method, handle: parsed.data.handle },
  })
  if (exists) return fail('That handle is already in the pool.')

  const created = await db.paymentHandle.create({ data: parsed.data })
  /*
    The handle VALUE is redacted by the audit writer, not omitted here. Payment
    handles are server-only and rotated precisely so they cannot be harvested
    (CLAUDE.md rule 7); a pool of live handles sitting in a readable log is the
    same exposure arriving more slowly. What the trail records is that the pool
    grew, by whom, and for which method.
  */
  await recordAdminAction({
    entityType: 'PaymentHandle',
    entityId: created.id,
    action: 'CREATE',
    actor: guard.identity,
    after: created,
    reason: `Added a ${parsed.data.method} handle to the rotation pool`,
  })
  revalidatePath('/admin/payments')
  return ok('Handle added to the pool.')
}

/**
 * Burn a handle.
 *
 * Deliberately irreversible: a burned handle is never reissued. Once an account has
 * been frozen or scraped, putting it back into rotation just sends the next customer's
 * money somewhere it cannot be received.
 */
export async function burnPaymentHandle(formData: FormData): Promise<void> {
  const guard = await requireArea('/admin/payments')
  if (!guard.ok) return
  const id = String(formData.get('id') ?? '')
  const reason = String(formData.get('reason') ?? '').slice(0, 300) || 'Burned by an operator.'
  await db.paymentHandle.update({
    where: { id },
    data: { burnedAt: new Date(), burnReason: reason, isActive: false },
  })
  // Irreversible by design, so the trail matters more here than anywhere else in
  // this file: the operator's own stated reason is carried through verbatim.
  await recordAdminAction({
    entityType: 'PaymentHandle',
    entityId: id,
    action: 'BURN',
    actor: guard.identity,
    reason,
  })
  revalidatePath('/admin/payments')
}

// ── Team ────────────────────────────────────────────────────────────────────

const teamSchema = z.object({
  email: z.string().trim().email('Enter a valid email.').max(200),
  name: z.string().trim().min(2, 'Enter a name.').max(120),
  role: z.enum(['SUPERADMIN', 'ADMIN', 'STAFF']),
  password: z.string().min(12, 'Use at least 12 characters.').max(200).optional().or(z.literal('')),
  areas: z.array(z.string()).default([]),
})

export async function saveTeamMember(_prev: CrudState, formData: FormData): Promise<CrudState> {
  // Team management is SUPERADMIN-only, enforced by canAccessAdminPath.
  const guard = await requireArea('/admin/team')
  if (!guard.ok) return fail(guard.error)

  const areas = formData.getAll('areas').map(String).filter((a) => ADMIN_AREA_SLUGS.includes(a))
  const parsed = teamSchema.safeParse({
    email: formData.get('email'),
    name: formData.get('name'),
    role: formData.get('role'),
    password: formData.get('password') ?? '',
    areas,
  })
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? 'Check the values.')

  const email = parsed.data.email.toLowerCase()
  const existing = await db.adminUser.findUnique({ where: { email } })

  if (!existing && !parsed.data.password) {
    return fail('A new user needs a password of at least 12 characters.')
  }

  const data = {
    name: parsed.data.name,
    role: parsed.data.role as never,
    adminAreas: parsed.data.role === 'STAFF' ? parsed.data.areas : [],
    ...(parsed.data.password ? { passwordHash: hashPassword(parsed.data.password) } : {}),
  }

  const after = existing
    ? await db.adminUser.update({ where: { id: existing.id }, data })
    : await db.adminUser.create({
        data: { email, passwordHash: hashPassword(parsed.data.password!), ...data },
      })

  /*
    The most security-sensitive write in the panel: it grants roles and areas, and
    it can set somebody else's password. Both `before` and `after` are captured so a
    privilege escalation is visible as a diff rather than inferred from the current
    state — and the password hash is redacted out of both by the audit writer.
  */
  await recordAdminAction({
    entityType: 'AdminUser',
    entityId: after.id,
    action: existing ? 'UPDATE' : 'CREATE',
    actor: guard.identity,
    before: existing,
    after,
    reason: existing
      ? `Updated ${email} — role ${parsed.data.role}${parsed.data.password ? ', password reset' : ''}`
      : `Created ${email} with role ${parsed.data.role}`,
  })

  revalidatePath('/admin/team')
  return ok(
    `${existing ? 'Updated' : 'Created'} ${email}. Permission changes take effect at their next sign-in.`,
  )
}

export async function toggleTeamMember(formData: FormData): Promise<void> {
  const guard = await requireArea('/admin/team')
  if (!guard.ok) return
  const id = String(formData.get('id') ?? '')
  const user = await db.adminUser.findUnique({ where: { id } })
  if (!user) return
  // Never let the last active SUPERADMIN disable themselves out of the panel.
  if (user.isActive && user.role === 'SUPERADMIN') {
    const others = await db.adminUser.count({
      where: { role: 'SUPERADMIN', isActive: true, id: { not: id } },
    })
    if (others === 0) return
  }
  await db.adminUser.update({ where: { id }, data: { isActive: !user.isActive } })
  await recordAdminAction({
    entityType: 'AdminUser',
    entityId: id,
    action: 'UPDATE',
    actor: guard.identity,
    reason: `${user.isActive ? 'Disabled' : 'Re-enabled'} ${user.email} (${user.role})`,
  })
  revalidatePath('/admin/team')
}

// ── Lab batches ─────────────────────────────────────────────────────────────

export async function toggleBatchPublished(formData: FormData): Promise<void> {
  const guard = await requireArea('/admin/lab-batches')
  if (!guard.ok) return
  const id = String(formData.get('id') ?? '')
  const batch = await db.labBatch.findUnique({ where: { id }, include: { results: true } })
  if (!batch) return

  // Refuse to publish a batch that has no contaminant panel. Potency alone is not a
  // safety test, and a COA that looks complete but is not is worse than none.
  if (!batch.isPublished) {
    const panels = new Set(batch.results.map((r) => r.panel))
    const required = ['HEAVY_METALS', 'PESTICIDES', 'MYCOTOXINS', 'SOLVENTS']
    if (required.some((p) => !panels.has(p))) return
  }

  await db.labBatch.update({ where: { id }, data: { isPublished: !batch.isPublished } })
  // Publishing a COA is a safety claim about a batch a customer already holds.
  await recordAdminAction({
    entityType: 'LabBatch',
    entityId: id,
    action: batch.isPublished ? 'UNPUBLISH' : 'PUBLISH',
    actor: guard.identity,
    reason: `Batch ${batch.batchCode} ${batch.isPublished ? 'withdrawn from' : 'published to'} /lab-results`,
  })
  /*
    The storefront reads published batches through a tagged cache now, so the tag has
    to be invalidated or a newly published certificate stays invisible for as long as
    the entry lives. revalidatePath alone was enough when the data came from a
    constant; it is not enough now.
  */
  updateTag(LAB_TAG)
  revalidatePath('/admin/lab-batches')
  revalidatePath('/lab-results')
  revalidatePath(`/lab-results/${batch.batchCode.toLowerCase()}`)
  revalidatePath('/sitemap.xml')
}

// ── Locations ───────────────────────────────────────────────────────────────

export async function noteLocationBlockers(): Promise<number> {
  // Locations are static data today. Surfaced so the count is honest in the UI.
  return LOCATIONS.filter((l) => !l.isPublished).length
}
