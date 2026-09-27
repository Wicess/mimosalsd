'use client'

import { createContext, useContext } from 'react'
import { DEFAULT_COMPANY_EMAIL } from '@/lib/site/company-email'

/**
 * The company email, for client components that cannot await it — the error page is
 * the one that needs it. The (site) layout reads the address on the server and hands
 * it down here, so the error page shows the address set in the admin, not a constant.
 */
const CompanyEmailContext = createContext<string>(DEFAULT_COMPANY_EMAIL)

export function CompanyEmailProvider({ email, children }: { email: string; children: React.ReactNode }) {
  return <CompanyEmailContext value={email}>{children}</CompanyEmailContext>
}

export function useCompanyEmail(): string {
  return useContext(CompanyEmailContext)
}
