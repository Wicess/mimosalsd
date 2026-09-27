import { redirect } from 'next/navigation'
import { url } from '@/lib/seo/routes'

/** The profile opens on the chat: it is the default page. */
export default function AccountPage() {
  redirect(url.accountChat())
}
