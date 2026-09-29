'use client'

import { useActionState } from 'react'
import type { CrudState } from '@/app/actions/admin-crud'
import { Button } from '@/components/ui/button'
import { Select as SiteSelect } from '@/components/ui/select'

const INITIAL: CrudState = {}

const field =
  // 16px on a phone: anything smaller makes iOS zoom the page in when the field takes focus.
  'mt-1 min-h-11 w-full rounded-md border border-border-strong bg-surface px-3 text-[16px] text-foreground md:text-sm'

function Feedback({ state }: { state: CrudState }) {
  if (state.error) {
    return (
      <p role="alert" className="text-sm text-danger-fg">
        {state.error}
      </p>
    )
  }
  if (state.ok) return <p className="text-sm text-success-fg">{state.ok}</p>
  return null
}

/**
 * A collapsible create/edit panel.
 *
 * Uses <details> rather than React state: the form is not the primary content of these
 * pages, and a native disclosure needs no JavaScript to open.
 */
export function CrudPanel({
  summary,
  action,
  children,
}: {
  summary: string
  action: (prev: CrudState, formData: FormData) => Promise<CrudState>
  children: React.ReactNode
}) {
  const [state, formAction, pending] = useActionState(action, INITIAL)

  return (
    <details className="mb-6 rounded-lg border border-border bg-surface">
      <summary className="cursor-pointer px-4 py-3 text-sm font-medium text-foreground">
        {summary}
      </summary>
      <form action={formAction} className="space-y-3 border-t border-border p-4">
        {children}
        <Feedback state={state} />
        <Button type="submit" variant="primary" size="sm" loading={pending}>
          Save
        </Button>
      </form>
    </details>
  )
}

export function Field({
  label,
  name,
  type = 'text',
  required,
  defaultValue,
  placeholder,
  hint,
  autoComplete,
}: {
  label: string
  name: string
  type?: string
  required?: boolean
  defaultValue?: string
  placeholder?: string
  hint?: string
  /**
   * Passed through for the credential forms.
   *
   * A change-password form without `current-password` / `new-password` is the case
   * password managers get wrong: they offer the saved password for the "new" box, or
   * fail to prompt to save the replacement, and the operator ends up locked out of an
   * account they just changed. The hint is what tells the manager which box is which.
   */
  autoComplete?: string
}) {
  return (
    <label className="block text-sm">
      <span className="font-medium text-foreground">{label}</span>
      <input
        name={name}
        type={type}
        required={required}
        defaultValue={defaultValue}
        placeholder={placeholder}
        {...(autoComplete ? { autoComplete } : {})}
        className={field}
      />
      {hint && <span className="mt-1 block text-xs text-foreground-muted">{hint}</span>}
    </label>
  )
}

export function TextArea({
  label,
  name,
  required,
  defaultValue,
  hint,
  rows = 4,
}: {
  label: string
  name: string
  required?: boolean
  defaultValue?: string
  hint?: string
  rows?: number
}) {
  return (
    <label className="block text-sm">
      <span className="font-medium text-foreground">{label}</span>
      <textarea
        name={name}
        rows={rows}
        required={required}
        defaultValue={defaultValue}
        className={`${field} min-h-24 py-2`}
      />
      {hint && <span className="mt-1 block text-xs text-foreground-muted">{hint}</span>}
    </label>
  )
}

export function Select({
  label,
  name,
  options,
  defaultValue,
  hint,
}: {
  label: string
  name: string
  options: ReadonlyArray<readonly [string, string]>
  defaultValue?: string
  hint?: string
}) {
  return (
    <label className="block text-sm">
      <span className="font-medium text-foreground">{label}</span>
      <SiteSelect
        name={name}
        defaultValue={defaultValue ?? options[0]?.[0] ?? ''}
        placeholder="Choose…"
        options={options.map(([value, text]) => ({ value, label: text }))}
      />
      {hint && <span className="mt-1 block text-xs text-foreground-muted">{hint}</span>}
    </label>
  )
}

export function Checkbox({
  label,
  name,
  defaultChecked,
  value,
}: {
  label: string
  name: string
  defaultChecked?: boolean
  value?: string
}) {
  return (
    <label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm text-foreground">
      <input
        type="checkbox"
        name={name}
        value={value}
        defaultChecked={defaultChecked}
        className="size-6 shrink-0 md:size-4 accent-[var(--primary)]"
      />
      {label}
    </label>
  )
}

/** A single-button form for a toggle or a destructive action. */
export function InlineAction({
  action,
  label,
  fields,
  variant = 'secondary',
  confirm,
}: {
  action: (formData: FormData) => Promise<void>
  label: string
  fields: Record<string, string>
  variant?: 'secondary' | 'danger'
  confirm?: string
}) {
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (confirm && !window.confirm(confirm)) e.preventDefault()
      }}
    >
      {Object.entries(fields).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      <Button type="submit" size="sm" variant={variant}>
        {label}
      </Button>
    </form>
  )
}
