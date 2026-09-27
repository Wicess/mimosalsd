'use client'

import Link from 'next/link'
import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { BanIcon, CheckIcon, CopyIcon, CrossIcon, TrashIcon } from '@/components/ui/icon'
import { ORDER_STATUS_TONE, orderStatusLabel } from '@/lib/orders/status-tone'
import { formatCents } from '@/lib/utils'
import { PresenceDot } from '@/components/chat/presence-dot'
import { exactTime, initials, lastSeen } from './format'
import type { InboxProfile } from './types'

/**
 * The customer, as far as the business knows them — the "profile" beside the chat.
 *
 * WHAM keeps a customer's identity in its header and their history behind a
 * separate profile page, because WHAM customers have accounts. Here the operator
 * gets it in one panel: the quotable handle, the email they typed, when they first
 * wrote, the IP a block would act on, and every order placed under that email,
 * each one link away.
 *
 * The order match is by an email the customer TYPED, and the panel says so. It is a
 * lead for the operator to check, never proof of who they are talking to.
 */
export function ProfilePanel({
  profile,
  now,
  onClose,
  onToggleOpen,
  onBlock,
  onUnblock,
  onDelete,
  busy,
}: {
  profile: InboxProfile
  now: number
  onClose?: () => void
  onToggleOpen: () => void
  onBlock: () => void
  onUnblock: () => void
  onDelete: () => void
  busy: boolean
}) {
  const [copied, setCopied] = useState(false)

  const copyHandle = async () => {
    if (!profile.publicId) return
    try {
      await navigator.clipboard.writeText(profile.publicId)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1500)
    } catch {
      // Clipboard refused (insecure context, permissions). The handle is on screen.
    }
  }

  const status = profile.typing ? 'typing…' : profile.online ? 'Active now' : lastSeen(profile.customerLastSeenAt, now)

  return (
    <div className="flex h-full min-h-0 flex-col bg-surface">
      <div className="flex items-center justify-between gap-2 border-b px-4 py-3">
        <p className="text-xs font-semibold tracking-wider text-foreground-muted uppercase">Customer</p>
        {onClose ? (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close customer details"
            className="grid size-9 place-items-center rounded-lg text-foreground-muted hover:bg-surface-sunken hover:text-foreground"
          >
            <CrossIcon className="size-4" />
          </button>
        ) : null}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <div className="flex flex-col items-center px-4 pt-6 pb-5 text-center">
          <span className="relative grid size-16 place-items-center rounded-full bg-accent-muted font-product text-lg font-semibold text-accent-fg">
            {initials(profile.displayName)}
            <span className="absolute right-0.5 bottom-0.5 flex rounded-full bg-surface p-[3px]">
              <PresenceDot online={profile.online || profile.typing} />
            </span>
          </span>
          <p className="mt-3 max-w-full truncate font-product text-base font-semibold text-foreground">
            {profile.displayName}
          </p>
          <p className="mt-0.5 text-xs text-foreground-muted">{status}</p>
          {profile.publicId ? (
            <button
              type="button"
              onClick={() => void copyHandle()}
              className="mt-2.5 inline-flex min-h-8 items-center gap-1.5 rounded-full bg-surface-sunken px-3 font-mono text-[12px] text-foreground hover:bg-border-subtle"
              aria-label={`Copy reference ${profile.publicId}`}
            >
              {profile.publicId}
              {copied ? <CheckIcon className="size-3.5 text-success-fg" /> : <CopyIcon className="size-3.5 text-foreground-subtle" />}
            </button>
          ) : null}
          <div className="mt-3 flex flex-wrap justify-center gap-1.5">
            <Badge tone={profile.isOpen ? 'warning' : 'neutral'}>{profile.isOpen ? 'Open' : 'Closed'}</Badge>
            {profile.blocked ? (
              <Badge tone="danger" icon={<BanIcon className="size-3" />}>
                Blocked
              </Badge>
            ) : null}
          </div>
        </div>

        <dl className="divide-y border-y text-[13px]">
          <Field label="Email">
            {profile.email ? (
              <a href={`mailto:${profile.email}`} className="break-all text-foreground underline underline-offset-4">
                {profile.email}
              </a>
            ) : (
              <span className="text-foreground-subtle">Not given yet</span>
            )}
          </Field>
          {profile.name && profile.name !== profile.displayName ? <Field label="Name">{profile.name}</Field> : null}
          {profile.subject ? <Field label="Topic">{profile.subject}</Field> : null}
          <Field label="First contact">{exactTime(profile.firstSeen)}</Field>
          <Field label="IP address">
            {profile.lastIp ? (
              <span className="font-mono text-[12px]">{profile.lastIp}</span>
            ) : (
              <span className="text-foreground-subtle">Not recorded — they have not written yet</span>
            )}
          </Field>
        </dl>

        <section className="px-4 py-4" aria-labelledby="profile-orders">
          <h3 id="profile-orders" className="text-xs font-semibold tracking-wider text-foreground-muted uppercase">
            Orders{profile.orders.length ? ` · ${profile.orders.length}` : ''}
          </h3>
          {profile.orders.length === 0 ? (
            <p className="mt-2 text-[13px] leading-relaxed text-foreground-subtle">
              {profile.email ? 'No orders under this email.' : 'No email yet, so no orders can be matched.'}
            </p>
          ) : (
            <>
              <ul className="mt-2 space-y-1.5">
                {profile.orders.map((o) => (
                  <li key={o.orderNumber}>
                    <Link
                      href={`/admin/orders/${o.orderNumber}`}
                      className="flex items-center gap-2 rounded-lg border bg-background px-3 py-2.5 hover:border-border-strong"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-mono text-[12px] font-medium text-foreground">
                          {o.orderNumber}
                        </span>
                        <span className="block text-[11px] text-foreground-subtle">
                          {new Date(o.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </span>
                      </span>
                      <Badge tone={ORDER_STATUS_TONE[o.status] ?? 'neutral'} className="shrink-0 px-2 py-0.5 text-[10px]">
                        {orderStatusLabel(o.status)}
                      </Badge>
                      <span className="tabular shrink-0 text-[13px] font-semibold text-foreground">
                        {formatCents(o.totalCents)}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-[11px] leading-relaxed text-foreground-subtle">
                Matched by the email they typed, which is not verified. Check the order before discussing it.
              </p>
            </>
          )}
        </section>
      </div>

      <div className="grid gap-2 border-t p-4">
        <button
          type="button"
          onClick={onToggleOpen}
          disabled={busy}
          className="min-h-10 rounded-lg border px-3 text-sm font-medium text-foreground hover:border-border-strong disabled:opacity-50"
        >
          {profile.isOpen ? 'Close conversation' : 'Reopen conversation'}
        </button>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={profile.blocked ? onUnblock : onBlock}
            disabled={busy}
            className={`inline-flex min-h-10 items-center justify-center gap-1.5 rounded-lg px-3 text-sm font-medium disabled:opacity-50 ${
              profile.blocked ? 'bg-danger-bg text-danger-fg' : 'border text-danger-fg hover:bg-danger-bg'
            }`}
          >
            <BanIcon className="size-4" />
            {profile.blocked ? 'Unblock' : 'Block'}
          </button>
          <button
            type="button"
            onClick={onDelete}
            disabled={busy}
            className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-lg border px-3 text-sm font-medium text-danger-fg hover:bg-danger-bg disabled:opacity-50"
          >
            <TrashIcon className="size-4" />
            Delete
          </button>
        </div>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[6.5rem_1fr] gap-3 px-4 py-2.5">
      <dt className="text-foreground-subtle">{label}</dt>
      <dd className="min-w-0 text-foreground">{children}</dd>
    </div>
  )
}
