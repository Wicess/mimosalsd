import { getPostalAddress } from '@/lib/site/postal-address.server'
import { cn } from '@/lib/utils'

/**
 * The business's postal address, as saved in Admin → Settings (owner, 2026-09-28:
 * "put the address on the site").
 *
 * Read from the same setting marketing email uses for CAN-SPAM, so the site and the
 * mail can never show two addresses. Renders nothing until one is saved: an invented
 * address is a false statement, not a placeholder.
 */
export async function PostalAddress({ className }: { className?: string }) {
  const address = await getPostalAddress()
  if (!address) return null
  return <address className={cn('not-italic', className)}>{address}</address>
}
