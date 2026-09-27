import type { Metadata } from 'next'
import { AccountChat } from '@/components/account/account-chat'

export const metadata: Metadata = {
  title: 'Chat',
  robots: { index: false, follow: false },
}

/** The profile's default page: the chat, full screen, with the other profile pages at the top. */
export default function AccountChatPage() {
  return <AccountChat />
}
