'use client'

import { useActionState, useEffect, useRef, useState } from 'react'
import { submitContact, type ContactState } from '@/app/actions/contact'
import { Button } from '@/components/ui/button'
import { CONTACT_TOPICS, type ContactTopic } from '@/lib/mail/templates'
import { useCompanyEmail } from '@/components/site/company-email'
import {
  CONTACT_FIELD_ORDER,
  fixFieldsMessage,
  formValues,
  validateContactFields,
  type FieldErrors,
} from '@/lib/forms/fields'

const TOPIC_KEYS = ['order', 'bulk', 'general'] as const

const FIELD =
  'mt-1 block w-full min-h-11 rounded-md border border-border-strong bg-surface px-3 py-2 text-base text-foreground placeholder:text-foreground-subtle focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring/40 aria-invalid:border-danger-fg aria-invalid:ring-1 aria-invalid:ring-danger-fg'

/** The `name` of the field an event came from, if it came from one. */
function fieldName(target: EventTarget): string | null {
  return target instanceof HTMLElement ? target.getAttribute('name') : null
}

/** A field's message, tied to the input for screen readers. */
function FieldError({ id, message }: { id: string; message: string | undefined }) {
  if (!message) return null
  return (
    <p id={`${id}-error`} role="alert" className="mt-1 text-sm text-danger-fg">
      {message}
    </p>
  )
}

/**
 * The contact form.
 *
 * Seven visible fields, and the order number only appears when the topic makes it
 * relevant — asking every sender for an order number they may not have is how a
 * form teaches people to skip it on the one occasion it matters.
 *
 * `defaultTopic` lets a page arrive with the right one already chosen: /bulk
 * links here with `?topic=bulk`, so a wholesale enquiry starts one field ahead
 * and routes to the wholesale inbox without the sender having to know it exists.
 *
 * Progressive by construction: it is a real <form> with a Server Action, so it
 * submits and works before hydration. The only thing JavaScript adds is the
 * inline success state instead of a navigation.
 */
export function ContactForm({ defaultTopic = 'general' }: { defaultTopic?: ContactTopic }) {
  const [state, action, pending] = useActionState<ContactState, FormData>(submitContact, {})
  const [topic, setTopic] = useState<ContactTopic>(defaultTopic)
  const email = useCompanyEmail()

  /*
    Nothing is sent until name, email, phone and message are right (owner, 2026-11-23).
    The same rules as the server (lib/forms/fields.ts) run on submit; a failing field
    shows what to do, the cursor goes to the first, and each message clears as that
    field is edited. After a first attempt, leaving a field re-checks it.
  */
  const formRef = useRef<HTMLFormElement>(null)
  const [clientErrors, setClientErrors] = useState<FieldErrors>({})
  const [edited, setEdited] = useState<ReadonlySet<string>>(new Set())
  const [attempted, setAttempted] = useState(false)
  const errors: FieldErrors = {
    ...Object.fromEntries(Object.entries(state.errors ?? {}).filter(([k]) => !edited.has(k))),
    ...clientErrors,
  }
  const errorCount = Object.keys(errors).length
  const invalid = (id: string) =>
    ({ 'aria-invalid': Boolean(errors[id]) || undefined, 'aria-describedby': errors[id] ? `contact-${id}-error` : undefined }) as const

  const checkAll = (form: HTMLFormElement) => validateContactFields(formValues(form, CONTACT_FIELD_ORDER))
  const focusFirst = (found: FieldErrors) => {
    const first = CONTACT_FIELD_ORDER.find((name) => found[name])
    if (first) document.getElementById(`contact-${first}`)?.focus()
  }

  // A refusal from the server lands on its first field, as one from here does.
  useEffect(() => {
    if (state.errors) focusFirst(state.errors)
  }, [state])

  const onSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    const found = checkAll(event.currentTarget)
    setAttempted(true)
    setEdited(new Set())
    setClientErrors(found)
    if (Object.keys(found).length > 0) {
      event.preventDefault()
      focusFirst(found)
    }
  }
  const onEdit = (event: React.FormEvent<HTMLFormElement>) => {
    const name = fieldName(event.target)
    if (!name) return
    setEdited((prev) => (prev.has(name) ? prev : new Set(prev).add(name)))
    setClientErrors((prev) => {
      if (!(name in prev)) return prev
      const next = { ...prev }
      delete next[name]
      return next
    })
  }
  const onLeave = (event: React.FocusEvent<HTMLFormElement>) => {
    const name = fieldName(event.target)
    if (!attempted || !name || !formRef.current) return
    const message = checkAll(formRef.current)[name]
    setClientErrors((prev) => {
      if (message) return prev[name] === message ? prev : { ...prev, [name]: message }
      if (!(name in prev)) return prev
      const next = { ...prev }
      delete next[name]
      return next
    })
  }

  // Rendered straight from the action's result. Mirroring it into local state via
  // an effect would be a second source of truth for a boolean we already have.
  if (state.ok) {
    return (
      <div
        role="status"
        className="rounded-xl border border-border bg-surface-sunken p-6"
      >
        <h2 className="font-display text-xl text-foreground">Message sent</h2>
        <p className="mt-2 leading-relaxed text-foreground-muted">
          A copy is on its way to your inbox so you have a record of exactly what you
          sent. A person reads every one of these — we reply within one business day,
          US business hours.
        </p>
        <p className="mt-3 text-sm text-foreground-subtle">
          It went to {email}.
        </p>
      </div>
    )
  }

  return (
    <form
      ref={formRef}
      action={action}
      onSubmit={onSubmit}
      onChange={onEdit}
      onBlur={onLeave}
      noValidate
      className="rounded-xl border border-border bg-surface p-5 md:p-6"
    >
      <h2 className="font-display text-xl text-foreground">Send us a message</h2>
      <p className="mt-1 text-sm text-foreground-muted">
        The form and the email address beside it land in the same inbox. Every field is
        required unless it says otherwise.
      </p>

      {errorCount > 0 ? (
        <div role="alert" className="mt-4 rounded-lg bg-danger-bg p-4 text-sm text-danger-fg">
          <p className="font-medium">{fixFieldsMessage(errorCount)}</p>
          <ul className="mt-1.5 list-disc space-y-0.5 pl-4">
            {CONTACT_FIELD_ORDER.filter((name) => errors[name]).map((name) => (
              <li key={name}>
                <a href={`#contact-${name}`} className="underline underline-offset-2">
                  {errors[name]}
                </a>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <div>
          <label htmlFor="contact-name" className="block text-sm font-medium text-foreground">
            Your name
          </label>
          <input
            id="contact-name"
            name="name"
            required
            autoComplete="name"
            maxLength={120}
            {...invalid('name')}
            className={FIELD}
          />
          <FieldError id="contact-name" message={errors.name} />
        </div>

        <div>
          <label htmlFor="contact-email" className="block text-sm font-medium text-foreground">
            Email
          </label>
          <input
            id="contact-email"
            name="email"
            type="email"
            required
            autoComplete="email"
            inputMode="email"
            maxLength={200}
            {...invalid('email')}
            className={FIELD}
          />
          <FieldError id="contact-email" message={errors.email} />
        </div>

        <div className="md:col-span-2">
          <label htmlFor="contact-phone" className="block text-sm font-medium text-foreground">
            Phone
          </label>
          <input
            id="contact-phone"
            name="phone"
            type="tel"
            required
            autoComplete="tel"
            inputMode="tel"
            maxLength={30}
            placeholder="(555) 123-4567"
            {...invalid('phone')}
            aria-describedby={errors.phone ? 'contact-phone-error' : 'contact-phone-hint'}
            className={FIELD}
          />
          {errors.phone ? (
            <FieldError id="contact-phone" message={errors.phone} />
          ) : (
            <p id="contact-phone-hint" className="mt-1 text-xs text-foreground-subtle">
              With the area code, and the country code if you are outside the US. We call
              only if email does not reach you.
            </p>
          )}
        </div>
      </div>

      <fieldset className="mt-4">
        <legend className="text-sm font-medium text-foreground">
          What is this about?
        </legend>
        {/*
          Radios rather than a <select>. Three options fit, and a native select on
          a phone opens a full-screen wheel for a choice that is faster made by
          looking at it. It also routes the message, so the sender should be able
          to SEE where it is going.
        */}
        <div className="mt-2 grid gap-2 min-[520px]:grid-cols-3">
          {TOPIC_KEYS.map((key) => (
            <label
              key={key}
              className={[
                'flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors',
                topic === key
                  ? 'border-primary bg-primary-muted text-primary'
                  : 'border-border-strong bg-surface text-foreground hover:bg-surface-sunken',
              ].join(' ')}
            >
              <input
                type="radio"
                name="topic"
                value={key}
                checked={topic === key}
                onChange={() => setTopic(key)}
                className="size-4 accent-current"
              />
              {CONTACT_TOPICS[key].short}
            </label>
          ))}
        </div>
      </fieldset>

      {topic === 'order' && (
        <div className="mt-4">
          <label
            htmlFor="contact-order"
            className="block text-sm font-medium text-foreground"
          >
            Order ID{' '}
            <span className="font-normal text-foreground-muted">(if you have it)</span>
          </label>
          <input
            id="contact-order"
            name="orderNumber"
            maxLength={40}
            placeholder="PSY-000123"
            className={`${FIELD} tabular`}
          />
          <p className="mt-1 text-xs text-foreground-subtle">
            Find it in the subject of your confirmation email. Quoting it saves a
            round of back-and-forth before we can look at the order.
          </p>
        </div>
      )}

      <div className="mt-4">
        <label htmlFor="contact-message" className="block text-sm font-medium text-foreground">
          Message
        </label>
        <textarea
          id="contact-message"
          name="message"
          required
          rows={6}
          minLength={10}
          maxLength={4000}
          {...invalid('message')}
          className={`${FIELD} resize-y`}
        />
        <FieldError id="contact-message" message={errors.message} />
      </div>

      {/*
        Honeypot. Hidden from sight AND from assistive technology, because a
        screen-reader user filling a field they were told about would be silently
        rejected. `tabIndex={-1}` keeps it out of the keyboard path too.
      */}
      <div aria-hidden className="hidden">
        <label htmlFor="contact-company">Company</label>
        <input id="contact-company" name="company" tabIndex={-1} autoComplete="off" />
      </div>

      {state.error && errorCount === 0 ? (
        <p role="alert" className="mt-4 text-sm text-danger-fg">
          {state.error}
        </p>
      ) : null}

      <div className="mt-5">
        <Button type="submit" variant="accent" size="lg" loading={pending}>
          Send message
        </Button>
      </div>

      <p className="mt-3 text-xs leading-relaxed text-foreground-subtle">
        Your message is used only to reply to you. Legal and medical advice are
        outside what we can offer; the state pages show which statute we rely on
        for what may ship to you.
      </p>
    </form>
  )
}
