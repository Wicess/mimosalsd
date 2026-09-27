'use client'

import { useActionState } from 'react'
import { advanceOrder, type AdminOrderState } from '@/app/actions/admin-orders'
import { Button } from '@/components/ui/button'

const INITIAL: AdminOrderState = {}

const NEXT_LABEL: Record<string, string> = {
  AWAITING_PAYMENT: 'Verify & issue payment details',
  PAID: 'Confirm payment received',
  PACKED: 'Mark packed',
  SHIPPED: 'Mark shipped',
  DELIVERED: 'Mark delivered',
  REJECTED: 'Reject',
  CANCELLED: 'Cancel',
  REFUNDED: 'Refund',
}

/**
 * The transitions available from an order's current state.
 *
 * Destructive actions render as a separate, visually subordinate row — an operator
 * working at speed through a queue should never have "Reject" sitting where
 * "Mark packed" was a moment ago.
 */
export function OrderActions({
  token,
  orderNumber,
  transitions,
}: {
  token: string
  /** For the link to the payment page, which is where an order is verified now. */
  orderNumber: string
  transitions: readonly string[]
}) {
  const [state, formAction, pending] = useActionState(advanceOrder, INITIAL)

  const destructive = new Set(['REJECTED', 'CANCELLED', 'REFUNDED'])
  const forward = transitions.filter((t) => !destructive.has(t) && t !== 'AWAITING_PAYMENT')
  const canIssue = transitions.includes('AWAITING_PAYMENT')
  const risky = transitions.filter((t) => destructive.has(t))

  if (transitions.length === 0) {
    return <p className="text-sm text-foreground-subtle">No further action.</p>
  }

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="token" value={token} />

      <div className="flex flex-wrap gap-2">
        {canIssue && (
          <a
            href={`/admin/orders/${orderNumber}/payment`}
            className="inline-flex min-h-11 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-on-primary hover:bg-primary-hover"
          >
            Send payment details
          </a>
        )}
        {forward.map((next) => (
          <Button
            key={next}
            type="submit"
            name="next"
            value={next}
            variant={next === 'PAID' ? 'accent' : 'primary'}
            size="sm"
            loading={pending}
          >
            {NEXT_LABEL[next] ?? next}
          </Button>
        ))}
      </div>

      {risky.length > 0 && (
        <div className="flex flex-wrap gap-2 border-t border-border pt-2">
          {risky.map((next) => (
            <Button
              key={next}
              type="submit"
              name="next"
              value={next}
              variant="secondary"
              size="sm"
              loading={pending}
              className="text-danger-fg"
            >
              {NEXT_LABEL[next] ?? next}
            </Button>
          ))}
        </div>
      )}

      <input
        type="text"
        name="note"
        placeholder="Note (optional) — recorded on the order event"
        className="min-h-11 w-full rounded-md border border-border-strong bg-surface px-3 text-sm text-foreground"
      />

      {state.error && (
        <p role="alert" className="text-sm text-danger-fg">
          {state.error}
        </p>
      )}
    </form>
  )
}
