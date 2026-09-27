'use client'

import { useActionState, useState } from 'react'
import { submitContact, type ContactState } from '@/app/actions/contact'
import { Button } from '@/components/ui/button'
import { CONTACT_TOPICS, type ContactTopic } from '@/lib/mail/templates'
import { useCompanyEmail } from '@/components/site/company-email'

const TOPIC_KEYS = ['order', 'bulk', 'general'] as const

const FIELD =
  'mt-1 block w-full min-h-11 rounded-md border border-border-strong bg-surface px-3 py-2 text-base text-foreground placeholder:text-foreground-subtle focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring/40'

/**
 * The contact form.
 *
 * Six visible fields, and the order number only appears when the topic makes it
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
    <form action={action} className="rounded-xl border border-border bg-surface p-5 md:p-6">
      <h2 className="font-display text-xl text-foreground">Send us a message</h2>
      <p className="mt-1 text-sm text-foreground-muted">
        Or email the address for your question below — both reach the same people.
      </p>

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
            className={FIELD}
          />
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
            maxLength={200}
            className={FIELD}
          />
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
            It is in the subject line of your confirmation email. With it we can
            usually answer on the first reply rather than the third.
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
          className={`${FIELD} resize-y`}
        />
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

      {state.error && (
        <p role="alert" className="mt-4 text-sm text-danger-fg">
          {state.error}
        </p>
      )}

      <div className="mt-5">
        <Button type="submit" variant="accent" size="lg" loading={pending}>
          Send message
        </Button>
      </div>

      <p className="mt-3 text-xs leading-relaxed text-foreground-subtle">
        We use what you send here to answer you, and nothing else. We cannot give
        legal or medical advice — for what may lawfully ship to your state, our
        per-state pages cite the statute we rely on.
      </p>
    </form>
  )
}
