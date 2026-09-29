'use client'

import { useActionState, useState } from 'react'
import {
  submitBulkEnquiry,
  type BulkState,
} from '@/app/actions/bulk'
import { CADENCES, VOLUME_BANDS } from '@/lib/bulk/options'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/select'
import { cn } from '@/lib/utils'

export interface QuoteCategory {
  readonly slug: string
  readonly name: string
}
export interface QuoteState {
  readonly code: string
  readonly name: string
}

const FIELD =
  'mt-1 block w-full min-h-11 rounded-xl border border-border-strong bg-surface px-3.5 py-2 text-base text-foreground placeholder:text-foreground-subtle focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring/40'

/**
 * The bulk quote request.
 *
 * A quote in this category needs four things — the product line, the quantity,
 * the destination state and how often it repeats — and a mailto reliably gets
 * three of them at best. Every missing one is a round trip before a price can be
 * given, so the form asks for all four and the first reply can carry a figure.
 *
 * CATEGORIES, NOT PRODUCTS. The owner prices bulk orders per product line and
 * settles the exact product on the reply, so the form asks only which lines the
 * buyer wants. It used to list every product as a checkbox too, which made a long
 * form longer and asked a first-time buyer to know the catalogue before a price.
 * The categories post as slugs, and the server resolves them against the live
 * catalogue rather than trusting labels sent by the browser.
 *
 * At least one category and a volume are required. The dropdowns are not native
 * selects (see components/ui/select.tsx), and browsers do not validate the hidden
 * inputs behind them, so both are checked here before the form is sent, and again
 * on the server.
 */
export function BulkQuoteForm({
  categories,
  states,
}: {
  categories: readonly QuoteCategory[]
  states: readonly QuoteState[]
}) {
  const [state, action, pending] = useActionState<BulkState, FormData>(
    submitBulkEnquiry,
    {},
  )
  const [picked, setPicked] = useState<readonly string[]>([])
  const [volume, setVolume] = useState('')
  const [missing, setMissing] = useState<{ categories?: boolean; volume?: boolean }>({})

  function toggleCategory(slug: string) {
    setPicked((current) =>
      current.includes(slug) ? current.filter((s) => s !== slug) : [...current, slug],
    )
    setMissing((m) => ({ ...m, categories: false }))
  }

  function checkRequired(event: React.FormEvent<HTMLFormElement>) {
    const next = { categories: picked.length === 0, volume: volume === '' }
    setMissing(next)
    if (next.categories || next.volume) {
      event.preventDefault()
      const first = next.categories ? 'bulk-categories' : 'bulk-volume-label'
      document.getElementById(first)?.scrollIntoView({ block: 'center', behavior: 'smooth' })
    }
  }

  if (state.ok) {
    return (
      <div role="status" className="rounded-2xl border border-border bg-surface-sunken p-6">
        <h3 className="font-display text-xl text-foreground">Enquiry sent</h3>
        <p className="mt-2 max-w-[62ch] leading-relaxed text-foreground-muted">
          A copy is on its way to your inbox with everything you selected, so you have
          a record of exactly what you asked for. A person prices these individually —
          we reply within one business day, US business hours, with a figure rather
          than a range.
        </p>
      </div>
    )
  }

  return (
    <form
      action={action}
      onSubmit={checkRequired}
      className="rounded-2xl border border-border bg-surface p-5 md:p-7"
    >
      <div className="grid gap-5 md:grid-cols-2">
        <div>
          <label htmlFor="bulk-name" className="block text-sm font-medium text-foreground">
            Your name
          </label>
          <input id="bulk-name" name="name" required autoComplete="name" maxLength={120} className={FIELD} />
        </div>
        <div>
          <label htmlFor="bulk-company" className="block text-sm font-medium text-foreground">
            Company <span className="font-normal text-foreground-muted">(optional)</span>
          </label>
          <input id="bulk-company" name="company" autoComplete="organization" maxLength={160} className={FIELD} />
        </div>
        <div>
          <label htmlFor="bulk-email" className="block text-sm font-medium text-foreground">
            Email
          </label>
          <input id="bulk-email" name="email" type="email" required autoComplete="email" maxLength={200} className={FIELD} />
        </div>
        <div>
          <label htmlFor="bulk-phone" className="block text-sm font-medium text-foreground">
            Phone
          </label>
          {/*
            `type="tel"` for the numeric keypad, and no pattern. Extensions,
            brackets and +1 are all how real people write a number; the server
            counts digits rather than judging the shape, because a form that
            rejects "(512) 555-0134 x2" teaches the sender to lie to it.
          */}
          <input
            id="bulk-phone"
            name="phone"
            type="tel"
            required
            autoComplete="tel"
            inputMode="tel"
            maxLength={32}
            placeholder="(512) 555-0134"
            className={FIELD}
          />
        </div>
      </div>

      <fieldset
        id="bulk-categories"
        className="mt-6 scroll-mt-28"
        aria-describedby={missing.categories ? 'bulk-categories-error' : undefined}
      >
        <legend className="text-sm font-medium text-foreground">
          Which categories?{' '}
          <span className="font-normal text-foreground-muted">Choose every line you want priced</span>
        </legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {categories.map((c) => {
            const on = picked.includes(c.slug)
            return (
              <label
                key={c.slug}
                className={cn(
                  'inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full border px-4 text-sm transition-colors duration-150 ease-[var(--ease-standard)] motion-reduce:transition-none',
                  on
                    ? 'border-primary bg-primary text-on-primary'
                    : 'border-border-strong bg-surface text-foreground hover:bg-surface-sunken',
                )}
              >
                <input
                  type="checkbox"
                  name="categories"
                  value={c.slug}
                  checked={on}
                  onChange={() => toggleCategory(c.slug)}
                  className="sr-only"
                />
                {c.name}
              </label>
            )
          })}
        </div>
        {missing.categories && (
          <p id="bulk-categories-error" role="alert" className="mt-2 text-sm text-danger-fg">
            Choose at least one category.
          </p>
        )}
      </fieldset>


      <div className="mt-6 grid gap-5 md:grid-cols-3">
        <div>
          <span id="bulk-volume-label" className="block scroll-mt-28 text-sm font-medium text-foreground">
            Roughly how much
          </span>
          <Select
            name="volume"
            labelId="bulk-volume-label"
            placeholder="Choose a volume"
            options={VOLUME_BANDS.map((v) => ({ value: v, label: v }))}
            invalid={missing.volume}
            describedBy="bulk-volume-error"
            onChange={(v) => {
              setVolume(v)
              setMissing((m) => ({ ...m, volume: false }))
            }}
          />
          {missing.volume && (
            <p id="bulk-volume-error" role="alert" className="mt-2 text-sm text-danger-fg">
              Choose roughly how much you need.
            </p>
          )}
        </div>
        <div>
          <span id="bulk-cadence-label" className="block text-sm font-medium text-foreground">
            How often
          </span>
          <Select
            name="cadence"
            labelId="bulk-cadence-label"
            placeholder="Not sure"
            options={[{ value: '', label: 'Not sure' }, ...CADENCES.map((c) => ({ value: c, label: c }))]}
          />
        </div>
        <div>
          <span id="bulk-state-label" className="block text-sm font-medium text-foreground">
            Shipping to
          </span>
          {/*
            The destination changes what can be sent and what shipping costs, so a
            quote without it is a quote we would have to revise.
          */}
          <Select
            name="stateCode"
            labelId="bulk-state-label"
            placeholder="Choose a state"
            options={states.map((s) => ({ value: s.code, label: s.name }))}
          />
        </div>
      </div>

      <div className="mt-5">
        <label htmlFor="bulk-message" className="block text-sm font-medium text-foreground">
          Anything else <span className="font-normal text-foreground-muted">(optional)</span>
        </label>
        <textarea id="bulk-message" name="message" rows={4} maxLength={4000} className={`${FIELD} resize-y`} />
      </div>

      {/* Honeypot — hidden from sight and from assistive technology. */}
      <div aria-hidden className="hidden">
        <label htmlFor="bulk-website">Website</label>
        <input id="bulk-website" name="website" tabIndex={-1} autoComplete="off" />
      </div>

      {state.error && (
        <p role="alert" className="mt-5 text-sm text-danger-fg">
          {state.error}
        </p>
      )}

      <div className="mt-6">
        <Button type="submit" variant="accent" size="lg" loading={pending}>
          Request a quote
        </Button>
      </div>

      <p className="mt-3 text-xs leading-relaxed text-foreground-subtle">
        We use what you send here to price your enquiry and nothing else. A person
        replies with your quote, and payment is arranged once you accept it.
      </p>
    </form>
  )
}
