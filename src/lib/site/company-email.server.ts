import 'server-only'
import { cacheTag } from 'next/cache'
import { db } from '@/lib/db/client'
import {
  COMPANY_EMAIL_KEY,
  DEFAULT_COMPANY_EMAIL,
  fillCompanyEmail,
  normaliseCompanyEmail,
  SITE_SETTINGS_TAG,
} from './company-email'

/**
 * The stored value, cached under SITE_SETTINGS_TAG so it costs one query per cache
 * lifetime rather than one per render, and so saving it in the admin refreshes every
 * page that shows it (see saveCompanyEmail). A database error is thrown out of here
 * rather than caught, so a failure is never cached as if it were the answer.
 */
async function readStoredCompanyEmail(): Promise<string | null> {
  'use cache'
  cacheTag(SITE_SETTINGS_TAG)
  const row = await db.setting.findUnique({
    where: { key: COMPANY_EMAIL_KEY },
    select: { value: true },
  })
  return row?.value ?? null
}

/** The company's one email address, as set in the admin. */
export async function getCompanyEmail(): Promise<string> {
  try {
    return normaliseCompanyEmail(await readStoredCompanyEmail()) ?? DEFAULT_COMPANY_EMAIL
  } catch {
    // The database is unreachable. The default is the real address, so the page still
    // tells people how to reach the business.
    return DEFAULT_COMPANY_EMAIL
  }
}

/** Fill the address into copy prepared with COMPANY_EMAIL_TOKEN. */
export async function withCompanyEmail<T>(value: T): Promise<T> {
  return fillCompanyEmail(value, await getCompanyEmail())
}
