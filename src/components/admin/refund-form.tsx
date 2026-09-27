'use client'

import { useActionState } from 'react'
import { issueRefund, type RefundState } from '@/app/actions/admin-refunds'
import { Button } from '@/components/ui/button'
import { PAYMENT_LABELS, PAYMENT_METHODS } from '@/lib/orders/types'
import { Select as SiteSelect } from '@/components/ui/select'

const INITIAL: RefundState = {}

const field =
  'mt-1 min-h-11 w-full rounded-md border border-border-strong bg-surface px-3 text-sm text-foreground'

/**
 * Record a refund.
 *
 * ── The copy is the safety feature ──────────────────────────────────────────
 * This system holds no payment processor, so nothing here sends money. The label
 * is "Record refund" and not "Refund", the panel says the money goes back by hand,
 * and the reference field exists to tie this row to the transaction an operator
 * already made in Cash App or Chime. A control that reads as though it issues a
 * refund, on a system that cannot, is how someone clicks it and walks away
 * believing the customer has been paid.
 *
 * ── Why the reason is required and long ─────────────────────────────────────
 * Ten characters minimum, enforced on the server. "Refund" is not a reason, and the
 * row is append-only — nobody is coming back to fill it in later. The one reading
 * it is likely an auditor, or the same operator in six months with no memory of it.
 */
export function RefundForm({
  token,
  remainingCents,
}: {
  token: string
  remainingCents: number
}) {
  const [state, formAction, pending] = useActionState(issueRefund, INITIAL)

  if (remainingCents === 0) {
    return (
      <p className="text-sm text-foreground-muted">
        This order has been refunded in full. Refund rows are append-only, so there is
        nothing further to record against it.
      </p>
    )
  }

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="token" value={token} />

      <div className="grid gap-3 md:grid-cols-2">
        <div>
          <label htmlFor="refund-amount" className="text-sm text-foreground">
            Amount already sent back
          </label>
          <input
            id="refund-amount"
            name="amount"
            type="text"
            inputMode="decimal"
            /*
              Text, not `type="number"`. A number input lets a browser hand back
              `28.999` or an exponent, and the parser refuses both rather than
              rounding — better to keep the raw string and give a precise error
              than to fight the widget's own idea of a numeric value.
            */
            placeholder={`Up to ${(remainingCents / 100).toFixed(2)}`}
            className={field}
            required
          />
        </div>

        <div>
          <label htmlFor="refund-method" className="text-sm text-foreground">
            Sent by
          </label>
          <SiteSelect
            id="refund-method"
            name="method"
            defaultValue=""
            placeholder="Not recorded"
            options={[
              { value: '', label: 'Not recorded' },
              ...PAYMENT_METHODS.map((method) => ({ value: method, label: PAYMENT_LABELS[method] })),
            ]}
          />
        </div>
      </div>

      <div>
        <label htmlFor="refund-reference" className="text-sm text-foreground">
          Reference <span className="text-foreground-muted">(optional)</span>
        </label>
        <input
          id="refund-reference"
          name="reference"
          type="text"
          placeholder="The note or transaction id on your side"
          className={field}
        />
      </div>

      <div>
        <label htmlFor="refund-reason" className="text-sm text-foreground">
          Reason
        </label>
        <textarea
          id="refund-reason"
          name="reason"
          rows={3}
          minLength={10}
          required
          placeholder="What went wrong, and what was agreed with the customer."
          className="mt-1 w-full rounded-md border border-border-strong bg-surface p-3 text-sm text-foreground"
        />
      </div>

      {state.error && (
        <p role="alert" className="text-sm text-danger-fg">
          {state.error}
        </p>
      )}
      {state.ok && <p className="text-sm text-success-fg">{state.ok}</p>}

      <Button type="submit" variant="secondary" size="sm" loading={pending}>
        Record refund
      </Button>

      <p className="text-xs leading-relaxed text-foreground-muted">
        This writes down a refund you have already sent. It does not move money — we
        hold no card processor, so the transfer goes back the same way it came in.
        The row cannot be edited or deleted afterwards.
      </p>
    </form>
  )
}
