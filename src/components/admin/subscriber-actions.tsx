'use client'

import { useActionState, useState } from 'react'
import {
  addSubscriber,
  deleteSubscriber,
  toggleSubscriber,
  type SubscriberState,
} from '@/app/actions/admin-subscribers'
import { Button } from '@/components/ui/button'

const INITIAL: SubscriberState = {}

const FIELD =
  'min-h-11 w-full rounded-md border border-border-strong bg-surface px-3 text-sm text-foreground placeholder:text-foreground-subtle'

/** Subscribe / unsubscribe. Never destructive — the row and its consent trail survive. */
export function SubscriberToggle({ id, active }: { id: string; active: boolean }) {
  const [state, formAction, pending] = useActionState(toggleSubscriber, INITIAL)

  return (
    <form action={formAction} className="inline-flex flex-col items-start gap-1">
      <input type="hidden" name="id" value={id} />
      <Button type="submit" variant={active ? 'secondary' : 'ghost'} size="sm" loading={pending}>
        {active ? 'Unsubscribe' : 'Re-subscribe'}
      </Button>
      {state.error ? <span className="text-xs text-danger-fg">{state.error}</span> : null}
    </form>
  )
}

/**
 * Permanent erasure, behind a typed confirmation.
 *
 * Collapsed by default so it is never adjacent to the ordinary unsubscribe button.
 * Deleting the row destroys the record of what this person consented to, which is the
 * one thing you cannot reconstruct — so it asks for the address to be retyped rather
 * than relying on a click being deliberate.
 */
export function SubscriberDelete({ id, email }: { id: string; email: string }) {
  const [state, formAction, pending] = useActionState(deleteSubscriber, INITIAL)
  const [open, setOpen] = useState(false)

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="min-h-11 text-xs text-foreground-subtle underline underline-offset-4 hover:text-danger-fg"
      >
        Erase
      </button>
    )
  }

  return (
    <form action={formAction} className="flex flex-col gap-2">
      <input type="hidden" name="id" value={id} />
      <label className="text-xs text-foreground-muted">
        Type <span className="font-medium text-foreground">{email}</span> to erase
        permanently
        <input name="confirm" className={`${FIELD} mt-1`} autoComplete="off" required />
      </label>
      <div className="flex gap-2">
        <Button type="submit" variant="danger" size="sm" loading={pending}>
          Erase
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
      {state.error ? <span className="text-xs text-danger-fg">{state.error}</span> : null}
    </form>
  )
}

/** Add an address by hand. Records `source: admin` — never a forged opt-in. */
export function AddSubscriber() {
  const [state, formAction, pending] = useActionState(addSubscriber, INITIAL)

  return (
    <form action={formAction} className="flex flex-col gap-2 md:flex-row md:items-start">
      <div className="flex-1">
        <label htmlFor="new-subscriber" className="sr-only">
          Email address
        </label>
        <input
          id="new-subscriber"
          name="email"
          type="email"
          required
          placeholder="name@example.com"
          className={FIELD}
          autoComplete="off"
        />
        {state.error ? (
          <p className="mt-1 text-xs text-danger-fg">{state.error}</p>
        ) : state.ok ? (
          <p className="mt-1 text-xs text-success-fg">{state.ok}</p>
        ) : (
          <p className="mt-1 text-xs text-foreground-subtle">
            Recorded with source “admin”. Only add an address you have consent for.
          </p>
        )}
      </div>
      <Button type="submit" variant="secondary" loading={pending}>
        Add subscriber
      </Button>
    </form>
  )
}
