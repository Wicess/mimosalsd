import { CompanyEmailProvider } from '@/components/site/company-email'
import { DeferredUI } from '@/components/ui/deferred'
import { getCompanyEmail } from '@/lib/site/company-email.server'

/**
 * Full-screen app pages: no site header, footer, tab bar, cart drawer or floating
 * chat — the page is the whole screen, like a native app. Used by the profile chat.
 * The age gate still applies here, as it does across the storefront.
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const email = await getCompanyEmail()
  return (
    <CompanyEmailProvider email={email}>
      {children}
      <DeferredUI withChat={false} />
    </CompanyEmailProvider>
  )
}
