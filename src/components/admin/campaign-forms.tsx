'use client'

import { useActionState } from 'react'
import type { CrudState } from '@/app/actions/admin-crud'
import { Button } from '@/components/ui/button'

const INITIAL: CrudState = {}

const field =
  'mt-1 min-h-11 w-full rounded-md border border-border-strong bg-surface px-3 text-sm text-foreground'

function Feedback({ state }: { state: CrudState }) {
  if (state.error) {
    return (
      <p role="alert" className="text-sm leading-relaxed text-danger-fg">
        {state.error}
      </p>
    )
  }
  if (state.ok) return <p className="text-sm text-success-fg">{state.ok}</p>
  return null
}

/** Name, subject and message. The same form creates a draft and edits one. */
export function CampaignEditor({
  action,
  id,
  initial,
  submitLabel,
}: {
  action: (prev: CrudState, formData: FormData) => Promise<CrudState>
  id?: string
  initial?: { name: string; subject: string; body: string }
  submitLabel: string
}) {
  const [state, formAction, pending] = useActionState(action, INITIAL)
  return (
    <form action={formAction} className="space-y-4">
      {id ? <input type="hidden" name="id" value={id} /> : null}
      <label className="block text-sm">
        <span className="font-medium text-foreground">Name</span>
        <input
          name="name"
          required
          maxLength={100}
          defaultValue={initial?.name}
          placeholder="September lab reports"
          className={`${field} min-h-11`}
        />
        <span className="mt-1 block text-xs text-foreground-muted">For your own list. Subscribers never see it.</span>
      </label>
      <label className="block text-sm">
        <span className="font-medium text-foreground">Subject</span>
        <input
          name="subject"
          required
          maxLength={150}
          defaultValue={initial?.subject}
          className={`${field} min-h-11`}
        />
      </label>
      <label className="block text-sm">
        <span className="font-medium text-foreground">Message</span>
        <textarea
          name="body"
          required
          rows={14}
          maxLength={10000}
          defaultValue={initial?.body}
          className={`${field} py-2 leading-relaxed`}
        />
        <span className="mt-1 block text-xs leading-relaxed text-foreground-muted">
          Plain text. Leave a blank line between paragraphs. A line on its own like{' '}
          <code className="rounded bg-surface-sunken px-1">[See the lab reports](/lab-results)</code> becomes a
          button, and buttons can only link to pages on this site. The unsubscribe link, the postal address and
          the FDA statement are added for you.
        </span>
      </label>
      <Feedback state={state} />
      <Button type="submit" variant="primary" size="sm" loading={pending}>
        {submitLabel}
      </Button>
    </form>
  )
}

export function SendTestButton({
  action,
  id,
  to,
}: {
  action: (prev: CrudState, formData: FormData) => Promise<CrudState>
  id: string
  to: string
}) {
  const [state, formAction, pending] = useActionState(action, INITIAL)
  return (
    <form action={formAction} className="space-y-2">
      <input type="hidden" name="id" value={id} />
      <Button type="submit" variant="secondary" size="sm" loading={pending}>
        Send a test to {to}
      </Button>
      <Feedback state={state} />
    </form>
  )
}

export function SendShiftButton({
  action,
  id,
  count,
  disabled,
}: {
  action: (prev: CrudState, formData: FormData) => Promise<CrudState>
  id: string
  /** How many this click will send to. */
  count: number
  disabled: boolean
}) {
  const [state, formAction, pending] = useActionState(action, INITIAL)
  return (
    <form
      action={formAction}
      onSubmit={(event) => {
        if (!window.confirm(`Send this blast to ${count} ${count === 1 ? 'person' : 'people'} now? It cannot be recalled.`)) {
          event.preventDefault()
        }
      }}
      className="space-y-2"
    >
      <input type="hidden" name="id" value={id} />
      <Button type="submit" variant="primary" size="sm" loading={pending} disabled={disabled || pending}>
        {pending ? 'Sending…' : `Send to the next ${count}`}
      </Button>
      <Feedback state={state} />
    </form>
  )
}
