'use client'

import { useActionState, useEffect } from 'react'
import { subscribeToNewsletter, type NewsletterSignupState } from '@/app/actions/newsletter'
import { Button } from '@/components/ui/button'
import { BRAND } from '@/lib/brand'
import { rememberNewsletterSubscribed } from '@/components/pwa/newsletter-flag'

const INITIAL: NewsletterSignupState = {}

export function NewsletterSignup() {
  const [state, action, pending] = useActionState(subscribeToNewsletter, INITIAL)
  // Signed up here, so the site's sign-up pop-up has nothing left to ask.
  useEffect(() => {
    if (state.ok) rememberNewsletterSubscribed()
  }, [state.ok])

  if (state.ok) {
    return (
      <p role="status" className="rounded-lg bg-success-bg p-4 text-sm leading-relaxed text-success-fg">
        {state.ok}
      </p>
    )
  }

  return (
    <form action={action} className="space-y-4">
      <label className="block text-sm">
        <span className="font-medium text-foreground">Email address</span>
        <input
          type="email"
          name="email"
          required
          autoComplete="email"
          className="mt-1 block min-h-11 w-full rounded-md border border-border-strong bg-surface px-3 text-[16px] text-foreground md:text-sm"
        />
      </label>
      {/* Hidden from people; see the action. */}
      <input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden className="hidden" />
      <label className="flex items-start gap-3 text-sm leading-relaxed text-foreground-muted">
        <input type="checkbox" name="consent" required className="mt-1 size-5 shrink-0 md:size-4" />
        <span>
          I agree to receive marketing emails from {BRAND.name}. I can unsubscribe at any time.
        </span>
      </label>
      {state.error ? (
        <p role="alert" className="text-sm text-danger-fg">
          {state.error}
        </p>
      ) : null}
      <Button type="submit" disabled={pending}>
        {pending ? 'Signing you up…' : 'Subscribe'}
      </Button>
    </form>
  )
}
