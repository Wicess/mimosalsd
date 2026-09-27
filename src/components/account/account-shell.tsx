import { url } from '@/lib/seo/routes'

export type AccountSection = 'orders' | 'subscription' | 'chat'

export const ACCOUNT_SECTIONS = [
  {
    id: 'chat',
    label: 'Chat',
    href: url.accountChat(),
    detail: 'Your conversation with our team, full screen.',
  },
  {
    id: 'orders',
    label: 'Orders',
    href: url.accountOrders(),
    detail: 'Every order placed on this device, with its status.',
  },
  {
    id: 'subscription',
    label: 'Subscription',
    href: url.accountSubscription(),
    detail: 'Join our email list, or find out how to leave it.',
  },
] as const satisfies readonly { id: AccountSection; label: string; href: string; detail: string }[]
