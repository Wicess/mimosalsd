import type { Metadata } from 'next'
import { Suspense } from 'react'
import { unsubscribe } from '@/app/actions/unsubscribe'
import { BRAND } from '@/lib/brand'
import { subscriberForLink } from '@/lib/newsletter/unsubscribe-store'
import { getCompanyEmail } from '@/lib/site/company-email.server'

export const metadata: Metadata = {
  title: 'Unsubscribe',
  robots: { index: false, follow: false },
}

/**
 * Where the unsubscribe link in every blast lands.
 *
 * Outside the storefront layout on purpose: no age gate, no navigation, nothing
 * standing between someone and opting out. It ASKS before it acts, because link
 * scanners open every URL in a message and a page that unsubscribed on sight
 * would opt out everyone whose mail is scanned. Mail clients' own one-click
 * button uses /api/newsletter/unsubscribe instead.
 */

type SearchParams = Promise<Record<string, string | string[] | undefined>>

const one = (value: string | string[] | undefined) => (typeof value === 'string' ? value : '')

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-5 py-16">
      <p className="text-xs font-medium tracking-[0.2em] text-foreground-subtle uppercase">{BRAND.name}</p>
      <h1 className="mt-3 font-display text-3xl text-foreground">{title}</h1>
      <div className="mt-4 space-y-4 text-base leading-relaxed text-foreground-muted">{children}</div>
    </main>
  )
}

async function Unsubscribe({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams
  const status = one(params.status)
  const contact = await getCompanyEmail()
  const writeIn = (
    <p>
      If you would still like to stop hearing from us, write to{' '}
      <a href={`mailto:${contact}?subject=unsubscribe`} className="text-foreground underline underline-offset-4">
        {contact}
      </a>{' '}
      and we will take you off the list by hand.
    </p>
  )

  if (status === 'done') {
    return (
      <Card title="You are unsubscribed">
        <p>You will not get marketing email from us again. Emails about an order you place still arrive.</p>
      </Card>
    )
  }
  if (status === 'already') {
    return (
      <Card title="Already unsubscribed">
        <p>This address was already off the list. Nothing more to do.</p>
      </Card>
    )
  }

  const s = one(params.s)
  const t = one(params.t)
  const subscriber = s && t && status !== 'invalid' ? await subscriberForLink(s, t) : null
  if (!subscriber) {
    return (
      <Card title="This link does not work">
        <p>It may have been copied incompletely, or it may be from a test email.</p>
        {writeIn}
      </Card>
    )
  }
  if (!subscriber.active) {
    return (
      <Card title="Already unsubscribed">
        <p>{subscriber.masked} was already off the list. Nothing more to do.</p>
      </Card>
    )
  }

  return (
    <Card title="Unsubscribe from our emails?">
      <p>
        Stop marketing email to <span className="font-medium text-foreground">{subscriber.masked}</span>. Emails
        about an order you place are not affected.
      </p>
      <form action={unsubscribe}>
        <input type="hidden" name="s" value={s} />
        <input type="hidden" name="t" value={t} />
        <button
          type="submit"
          className="inline-flex min-h-11 items-center rounded-md bg-primary px-5 text-sm font-medium text-on-primary shadow-sm hover:bg-primary-hover"
        >
          Unsubscribe
        </button>
      </form>
    </Card>
  )
}

export default function UnsubscribePage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <Suspense fallback={<main className="min-h-dvh" aria-hidden />}>
      <Unsubscribe searchParams={searchParams} />
    </Suspense>
  )
}
