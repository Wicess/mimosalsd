'use client'

import { useActionState } from 'react'
import { moderateReview, type ReviewActionState } from '@/app/actions/admin-reviews'
import { Button } from '@/components/ui/button'

const INITIAL: ReviewActionState = {}

export function ReviewModerationActions({ id }: { id: string }) {
  const [state, formAction, pending] = useActionState(moderateReview, INITIAL)

  if (state.ok) return <span className="text-sm text-success-fg">Done</span>

  return (
    <form action={formAction} className="flex flex-wrap gap-2">
      <input type="hidden" name="id" value={id} />
      <Button type="submit" name="decision" value="APPROVED" size="sm" variant="primary" loading={pending}>
        Approve
      </Button>
      <Button type="submit" name="decision" value="REJECTED" size="sm" variant="secondary" loading={pending}>
        Reject
      </Button>
      {state.error && (
        <p role="alert" className="w-full text-xs text-danger-fg">{state.error}</p>
      )}
    </form>
  )
}
