import type { Metadata } from 'next'
import { Suspense } from 'react'
import { NewsletterSignup } from '@/components/account/newsletter-signup'
import { ProfileFrame } from '@/components/account/profile-frame'
import { SUBSCRIBER_DISCOUNT_PERCENT } from '@/lib/orders/coupons'
import { checkoutWelcome } from '@/lib/orders/welcome'
import { getCompanyEmail } from '@/lib/site/company-email.server'

export const metadata: Metadata = {
  title: 'Your subscription',
  robots: { index: false, follow: false },
}

/** Subscribed from this browser: say so, and where the welcome discount stands. Otherwise, the form. */
async function Subscription() {
  const welcome = await checkoutWelcome()
  if (!welcome.subscribedEmail) {
    return (
      <>
        <p className="mt-1 text-sm leading-relaxed text-foreground-muted">
          New batches, restocks and lab results, now and then, and {SUBSCRIBER_DISCOUNT_PERCENT}% off your first order.
        </p>
        <div className="mt-5">
          <NewsletterSignup />
        </div>
      </>
    )
  }
  return (
    <div className="space-y-2">
      <p className="text-sm text-foreground">
        You are subscribed as <strong className="font-semibold">{welcome.subscribedEmail}</strong>.
      </p>
      <p
        className={`rounded-lg px-4 py-3 text-sm font-medium ${
          welcome.subscriberUsed ? 'bg-surface-sunken text-foreground-muted' : 'bg-success-bg text-success-fg'
        }`}
      >
        {welcome.subscriberUsed
          ? `Your ${SUBSCRIBER_DISCOUNT_PERCENT}% welcome discount has been used on an order.`
          : `Your ${SUBSCRIBER_DISCOUNT_PERCENT}% welcome discount is waiting: use this email at checkout.`}
      </p>
    </div>
  )
}

export default async function ProfileSubscriptionPage() {
  const email = await getCompanyEmail()
  return (
    <ProfileFrame current="subscription">
      <h1 className="font-display text-3xl text-foreground">Email subscription</h1>
      <section className="mt-5 rounded-2xl border border-border bg-surface p-5">
        <Suspense fallback={<div className="h-24 animate-pulse rounded-lg bg-surface-sunken motion-reduce:animate-none" aria-hidden />}>
          <Subscription />
        </Suspense>
      </section>
      <section className="mt-4 rounded-2xl border border-border bg-surface-sunken p-5">
        <h2 className="font-display text-lg text-foreground">Unsubscribing</h2>
        <p className="mt-2 text-sm leading-relaxed text-foreground-muted">
          Every email we send has a one-click unsubscribe link at the bottom. It takes effect straight away, and emails
          about your orders are not affected.
        </p>
        <p className="mt-3 text-sm leading-relaxed text-foreground-muted">
          To rejoin after unsubscribing, or for anything else about your emails, write to{' '}
          <a href={`mailto:${email}`} className="font-medium text-foreground underline underline-offset-4">
            {email}
          </a>
          .
        </p>
      </section>
    </ProfileFrame>
  )
}
