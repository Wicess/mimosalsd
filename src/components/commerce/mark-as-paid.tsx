'use client'

import { useActionState } from 'react'
import { claimPayment, type ClaimState } from '@/app/actions/claim-payment'
import { Button } from '@/components/ui/button'
import { CheckIcon } from '@/components/ui/icon'

const INITIAL: ClaimState = {}

/**
 * "I've sent the payment."
 *
 * A claim, not a confirmation — the copy is careful about that. The customer is
 * telling us they have paid; a human still verifies receipt. Wording that implied
 * the order was confirmed would create an expectation we cannot honour and a support
 * burden when it turns out the payment never arrived.
 */
export function MarkAsPaid({ token }: { token: string }) {
  const [state, formAction, pending] = useActionState(claimPayment, INITIAL)

  if (state.done) {
    return (
      <div className="flex gap-3 rounded-lg bg-success-bg p-4 text-success-fg">
        <CheckIcon className="mt-0.5 size-5" />
        <div>
          <p className="font-medium">Thanks — we are checking for your payment.</p>
          <p className="mt-1 text-sm opacity-90">
            You do not need to do anything else. We will email you as soon as it clears.
          </p>
        </div>
      </div>
    )
  }

  return (
    <form action={formAction}>
      <input type="hidden" name="token" value={token} />
      <Button type="submit" variant="secondary" loading={pending}>
        I&rsquo;ve sent the payment
      </Button>
      {state.error && (
        <p role="alert" className="mt-2 text-sm text-danger-fg">
          {state.error}
        </p>
      )}
    </form>
  )
}
