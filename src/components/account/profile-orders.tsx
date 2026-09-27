'use client'

import Link from 'next/link'
import { useEffect, useState, useTransition } from 'react'
import { rememberedOrders } from '@/app/actions/profile-orders'
import { readRememberedTokens } from '@/components/account/remember-order'
import type { ProfileOrder } from '@/lib/account/my-orders'
import { customerStatus } from '@/lib/orders/customer-status'
import { url } from '@/lib/seo/routes'
import { cn, formatCents } from '@/lib/utils'

const TONE = {
  info: 'bg-info-bg text-info-fg',
  warning: 'bg-warning-bg text-warning-fg',
  success: 'bg-success-bg text-success-fg',
  neutral: 'bg-surface-sunken text-foreground-muted',
} as const

/**
 * The customer's orders, shown straight away: the ones the server knows came from
 * this browser, then any whose private link was opened on this device, added as soon
 * as the page has looked. No sign-in, no form.
 */
export function ProfileOrders({ initial }: { initial: readonly ProfileOrder[] }) {
  const [remembered, setRemembered] = useState<readonly ProfileOrder[]>([])
  const [looking, startLooking] = useTransition()

  useEffect(() => {
    const known = new Set(initial.map((order) => order.orderToken))
    const tokens = readRememberedTokens().filter((token) => !known.has(token))
    if (tokens.length === 0) return
    startLooking(async () => {
      setRemembered(await rememberedOrders(tokens))
    })
  }, [initial])

  const orders = [...new Map([...initial, ...remembered].map((order) => [order.orderToken, order])).values()].sort(
    (a, b) => b.createdAt.localeCompare(a.createdAt),
  )

  if (orders.length === 0) {
    return looking ? (
      <div className="h-40 animate-pulse rounded-2xl bg-surface-sunken motion-reduce:animate-none" aria-hidden />
    ) : (
      <div className="rounded-2xl border border-border bg-surface p-6 text-center">
        <p className="font-medium text-foreground">No orders on this device yet</p>
        <p className="mx-auto mt-1 max-w-sm text-sm leading-relaxed text-foreground-muted">
          Orders show up here by themselves when you place them on this device, or when you open the link in your
          order email here.
        </p>
        <a
          href={url.shop()}
          className="mt-4 inline-flex min-h-11 items-center rounded-full! bg-accent px-5 text-sm font-semibold text-on-accent"
        >
          Browse the shop
        </a>
      </div>
    )
  }

  return (
    <ul className="space-y-3">
      {orders.map((order) => {
        const status = customerStatus(order.status)
        const shown = order.items.slice(0, 3)
        const more = order.items.length - shown.length
        return (
          <li key={order.orderToken} className="rounded-2xl border border-border bg-surface p-4 sm:p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs text-foreground-muted">Order ID</p>
                <p className="tabular truncate font-semibold text-foreground">{order.orderNumber}</p>
              </div>
              <span className={cn('shrink-0 rounded-full! px-2.5 py-1 text-xs font-semibold', TONE[status.tone])}>{status.label}</span>
            </div>

            <ul className="mt-3 space-y-1 text-sm text-foreground-muted">
              {shown.map((item, i) => (
                <li key={i} className="truncate">
                  <span className="tabular text-foreground">{item.quantity} ×</span> {item.name}
                  {item.variant && item.variant !== 'Default' && item.variant !== 'Single unit' ? ` · ${item.variant}` : ''}
                </li>
              ))}
              {more > 0 ? <li>and {more} more</li> : null}
            </ul>

            <div className="mt-3 flex items-center justify-between gap-3 border-t border-border pt-3 text-sm">
              <span className="text-foreground-muted" suppressHydrationWarning>
                Placed {new Date(order.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              </span>
              <span className="tabular font-semibold text-foreground">{formatCents(order.totalCents)}</span>
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              <a
                href={url.orderStatus(order.orderToken)}
                className="inline-flex min-h-11 flex-1 items-center justify-center rounded-full! bg-accent px-4 text-sm font-semibold text-on-accent sm:flex-none"
              >
                View order
              </a>
              <Link
                href={url.accountChat()}
                prefetch={false}
                className="inline-flex min-h-11 flex-1 items-center justify-center rounded-full! border border-border-strong px-4 text-sm font-medium text-foreground hover:bg-surface-sunken sm:flex-none"
              >
                Message us about it
              </Link>
            </div>
          </li>
        )
      })}
    </ul>
  )
}
