'use server'

import { revalidatePath, updateTag } from 'next/cache'
import { z } from 'zod'
import { db } from '@/lib/db/client'
import { requireArea } from '@/lib/admin/guard'
import { recordAdminAction } from '@/lib/admin/audit'
import { COMPANY_EMAIL_KEY, normaliseCompanyEmail, SITE_SETTINGS_TAG } from '@/lib/site/company-email'
import { normalisePostalAddress, POSTAL_ADDRESS_KEY } from '@/lib/site/postal-address'
import type { CrudState } from './admin-crud'

/**
 * Set the company's one email address.
 *
 * Its own action rather than a row in the generic settings form, for three reasons:
 * the value must be a valid address (a typo here is every contact link on the site
 * and the inbox customer mail is delivered to), saving it has to refresh every page
 * that shows it, and the generic form refuses the key so neither check can be skipped.
 */
export async function saveCompanyEmail(_prev: CrudState, formData: FormData): Promise<CrudState> {
  const guard = await requireArea('/admin/settings')
  if (!guard.ok) return { error: guard.error }

  const parsed = z.object({ email: z.string().max(254) }).safeParse({ email: formData.get('email') ?? '' })
  const email = parsed.success ? normaliseCompanyEmail(parsed.data.email) : null
  if (!email) return { error: 'Enter a valid email address, for example sales@snypegate.com.' }

  const before = await db.setting.findUnique({ where: { key: COMPANY_EMAIL_KEY } })
  if (before?.value === email) return { ok: `The company email is already ${email}.` }

  const after = await db.setting.upsert({
    where: { key: COMPANY_EMAIL_KEY },
    update: { value: email, updatedBy: guard.identity.email },
    create: {
      key: COMPANY_EMAIL_KEY,
      value: email,
      label: 'Company email: the one address shown and used across the site',
      group: 'brand',
      updatedBy: guard.identity.email,
    },
  })
  await recordAdminAction({
    entityType: 'Setting',
    entityId: COMPANY_EMAIL_KEY,
    action: before ? 'UPDATE' : 'CREATE',
    actor: guard.identity,
    before,
    after,
    reason: `Company email set to ${email}`,
  })

  // Every cached read of the address, then every page built with it: the contact and
  // bulk pages, the footer of every email, the policies, the FAQ, the structured data.
  updateTag(SITE_SETTINGS_TAG)
  revalidatePath('/', 'layout')
  return { ok: `Saved. The site now uses ${email} everywhere.` }
}

/**
 * Set the postal address every marketing email carries.
 *
 * Its own action for the same reasons as the company email: the value has to look
 * like a real US address (CAN-SPAM makes it a legal statement at the bottom of every
 * blast, not decoration), and saving it must refresh the cached read the blasts use.
 */
export async function savePostalAddress(_prev: CrudState, formData: FormData): Promise<CrudState> {
  const guard = await requireArea('/admin/settings')
  if (!guard.ok) return { error: guard.error }

  const parsed = z.object({ address: z.string().max(400) }).safeParse({ address: formData.get('address') ?? '' })
  const address = parsed.success ? normalisePostalAddress(parsed.data.address) : null
  if (!address) {
    return {
      error:
        'Enter the full postal address, including the ZIP code — a street address, a USPS PO Box or a registered private mailbox.',
    }
  }

  const before = await db.setting.findUnique({ where: { key: POSTAL_ADDRESS_KEY } })
  if (before?.value === address) return { ok: 'That is already the postal address.' }

  const after = await db.setting.upsert({
    where: { key: POSTAL_ADDRESS_KEY },
    update: { value: address, updatedBy: guard.identity.email },
    create: {
      key: POSTAL_ADDRESS_KEY,
      value: address,
      label: 'Postal address: required in the footer of every marketing email',
      group: 'brand',
      updatedBy: guard.identity.email,
    },
  })
  await recordAdminAction({
    entityType: 'Setting',
    entityId: POSTAL_ADDRESS_KEY,
    action: before ? 'UPDATE' : 'CREATE',
    actor: guard.identity,
    before,
    after,
    reason: 'Postal address for marketing email set',
  })

  updateTag(SITE_SETTINGS_TAG)
  revalidatePath('/admin/settings')
  revalidatePath('/admin/campaigns', 'layout')
  return { ok: `Saved. Email blasts will carry: ${address}` }
}
