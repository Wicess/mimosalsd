'use client'

import { useActionState, useState } from 'react'
import { updateStateRule, type RuleUpdateState } from '@/app/actions/admin-state-rules'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select as SiteSelect } from '@/components/ui/select'

const INITIAL: RuleUpdateState = {}

export interface EditableRule {
  readonly stateCode: string
  readonly stateName: string
  readonly productLine: string
  readonly status: string
  readonly statuteCitation: string
  readonly statuteUrl: string
  readonly notes: string
  readonly minAge: number
  readonly requiresAdultSignature: boolean
  readonly requiresProductDirectory: boolean
  readonly watch: boolean
  readonly lastReviewedAt: string
}

const field =
  'mt-1 min-h-11 w-full rounded-md border border-border-strong bg-surface px-3 text-sm text-foreground'

export function StateRuleEditor({ rule }: { rule: EditableRule }) {
  const [state, formAction, pending] = useActionState(updateStateRule, INITIAL)
  const [open, setOpen] = useState(false)
  /**
   * Mirrors the select purely to drive the "citation required" hint.
   *
   * The select itself is UNCONTROLLED (`defaultValue`). It was controlled, and that was
   * a real defect: after a refused submit React resets the form, and a controlled
   * select whose bound state had not changed did not get re-synced — it silently fell
   * back to its first option. An operator correcting a validation error and resubmitting
   * would have flipped a BLOCKED rule to ALLOWED without ever touching the field.
   *
   * With `defaultValue`, React's reset restores the rule's actual status.
   */
  const [status, setStatus] = useState(rule.status)

  const tone =
    rule.status === 'BLOCKED' ? 'danger' : rule.status === 'RESTRICTED' ? 'warning' : 'success'

  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex min-h-11 w-full cursor-pointer flex-wrap items-center gap-3 text-left"
      >
        <span className="font-medium text-foreground">{rule.stateName}</span>
        <span className="text-sm text-foreground-muted">
          {rule.productLine.replace(/_/g, ' ').toLowerCase()}
        </span>
        <Badge tone={tone}>{rule.status.toLowerCase()}</Badge>
        {rule.watch && <Badge tone="info">watch</Badge>}
        <span className="ml-auto text-xs text-foreground-subtle">
          reviewed {rule.lastReviewedAt}
        </span>
      </button>

      {open && (
        <form action={formAction} className="mt-4 space-y-3 border-t border-border pt-4">
          <input type="hidden" name="stateCode" value={rule.stateCode} />
          <input type="hidden" name="productLine" value={rule.productLine} />
          {/* The server compares against this and refuses an unconfirmed status change. */}
          <input type="hidden" name="originalStatus" value={rule.status} />

          <div className="grid gap-3 md:grid-cols-2">
            <label className="block text-sm">
              <span className="font-medium text-foreground">Status</span>
              <SiteSelect
                name="status"
                defaultValue={rule.status}
                onChange={setStatus}
                placeholder="Choose…"
                options={[
                  { value: 'ALLOWED', label: 'Allowed' },
                  { value: 'RESTRICTED', label: 'Restricted' },
                  { value: 'BLOCKED', label: 'Blocked' },
                ]}
              />
            </label>

            <label className="block text-sm">
              <span className="font-medium text-foreground">Minimum age</span>
              <input name="minAge" type="number" min={18} max={21} defaultValue={rule.minAge} className={field} />
            </label>
          </div>

          <label className="block text-sm">
            <span className="font-medium text-foreground">
              Statute citation{status !== 'ALLOWED' && <span className="text-danger-fg"> *</span>}
            </span>
            <input
              name="statuteCitation"
              defaultValue={rule.statuteCitation}
              placeholder="e.g. La. R.S. 40:989.1"
              className={field}
            />
            {status !== 'ALLOWED' && (
              <span className="mt-1 block text-xs text-foreground-muted">
                Required. A restriction with no cited authority reads as arbitrary, and
                the legality page will not publish without it.
              </span>
            )}
          </label>

          <label className="block text-sm">
            <span className="font-medium text-foreground">Statute URL</span>
            <input name="statuteUrl" type="url" defaultValue={rule.statuteUrl} className={field} />
          </label>

          <label className="block text-sm">
            <span className="font-medium text-foreground">Customer-facing explanation</span>
            <textarea
              name="notes"
              rows={4}
              defaultValue={rule.notes}
              className={`${field} min-h-24 py-2`}
            />
            <span className="mt-1 block text-xs text-foreground-muted">
              Shown verbatim in the cart when we refuse an item, and on the state page.
              Write it for a customer, not for a lawyer.
            </span>
          </label>

          <div className="flex flex-wrap gap-4 text-sm">
            {[
              ['requiresAdultSignature', 'Adult signature required', rule.requiresAdultSignature],
              ['requiresProductDirectory', 'State product directory applies', rule.requiresProductDirectory],
              ['watch', 'Legislation pending — flag for review', rule.watch],
            ].map(([name, label, checked]) => (
              <label key={name as string} className="flex min-h-11 cursor-pointer items-center gap-2 text-foreground">
                <input
                  type="checkbox"
                  name={name as string}
                  defaultChecked={checked as boolean}
                  className="size-6 shrink-0 md:size-4 accent-[var(--primary)]"
                />
                {label as string}
              </label>
            ))}
          </div>

          {status !== rule.status && (
            <label className="flex cursor-pointer gap-2 rounded-md bg-warning-bg p-3 text-sm text-warning-fg">
              <input
                type="checkbox"
                name="confirmStatusChange"
                className="mt-0.5 size-6 shrink-0 md:size-4 accent-[var(--primary)]"
              />
              <span>
                I am deliberately changing this rule from{' '}
                <strong>{rule.status.toLowerCase()}</strong> to{' '}
                <strong>{status.toLowerCase()}</strong>. This changes what we will sell
                and to whom, immediately.
              </span>
            </label>
          )}

          <label className="block text-sm">
            <span className="font-medium text-foreground">Reason for this change</span>
            <input
              name="reason"
              required
              minLength={3}
              placeholder="e.g. HB 1234 signed 3 Sep 2026; effective immediately"
              className={field}
            />
            <span className="mt-1 block text-xs text-foreground-muted">
              Written to the audit log. This is what someone reads in a year when they
              ask why we stopped shipping here.
            </span>
          </label>

          {state.error && (
            <p role="alert" className="text-sm text-danger-fg">
              {state.error}
            </p>
          )}
          {state.ok && <p className="text-sm text-success-fg">{state.ok}</p>}

          <Button type="submit" variant="primary" size="sm" loading={pending}>
            Save — takes effect immediately
          </Button>
        </form>
      )}
    </div>
  )
}
