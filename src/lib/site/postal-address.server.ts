import 'server-only'
import { cacheTag } from 'next/cache'
import { db } from '@/lib/db/client'
import { SITE_SETTINGS_TAG } from './company-email'
import { DEFAULT_POSTAL_ADDRESS, normalisePostalAddress, POSTAL_ADDRESS_KEY } from './postal-address'

/**
 * Cached under SITE_SETTINGS_TAG, like the company email, so saving it in the admin
 * refreshes everything that read it. A database error is thrown out of here rather
 * than caught, so a failure is never cached as if it were the answer.
 */
async function readStoredPostalAddress(): Promise<string | null> {
  'use cache'
  cacheTag(SITE_SETTINGS_TAG)
  const row = await db.setting.findUnique({
    where: { key: POSTAL_ADDRESS_KEY },
    select: { value: true },
  })
  return row?.value ?? null
}

/** The postal address marketing email carries, as set in the admin; empty if none. */
export async function getPostalAddress(): Promise<string> {
  try {
    return normalisePostalAddress(await readStoredPostalAddress()) ?? DEFAULT_POSTAL_ADDRESS
  } catch {
    // Unreachable database: the default is empty, so a blast refuses rather than
    // going out without the address the law requires.
    return DEFAULT_POSTAL_ADDRESS
  }
}
