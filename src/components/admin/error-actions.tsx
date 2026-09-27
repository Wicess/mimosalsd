'use client'

import { useActionState } from 'react'
import { resolveError, type ErrorActionState } from '@/app/actions/admin-errors'
import { Button } from '@/components/ui/button'

const INITIAL: ErrorActionState = {}

/**
 * Resolve / reopen toggle for one error row.
 *
 * A plain form posting to a Server Action, not a fetch. It keeps working with
 * JavaScript still loading, and the pending state comes from `useActionState` rather
 * than a hand-rolled boolean that can desync from the request.
 */
export function ErrorRowActions({ id, resolved }: { id: string; resolved: boolean }) {
  const [state, formAction, pending] = useActionState(resolveError, INITIAL)

  return (
    <form action={formAction} className="flex flex-col items-start gap-1">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="action" value={resolved ? 'reopen' : 'resolve'} />
      <Button type="submit" variant={resolved ? 'ghost' : 'secondary'} size="sm" loading={pending}>
        {resolved ? 'Reopen' : 'Resolve'}
      </Button>
      {state.error ? <span className="text-xs text-danger-fg">{state.error}</span> : null}
    </form>
  )
}
