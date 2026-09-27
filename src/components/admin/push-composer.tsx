'use client'

import Image from 'next/image'
import { useActionState, useState } from 'react'
import { sendPushTest, sendPushToEveryone, type PushSendState } from '@/app/actions/admin-push'
import { Button } from '@/components/ui/button'
import { BRAND } from '@/lib/brand'
import { BODY_MAX, TITLE_MAX } from '@/lib/push/payload'

const FIELD =
  'block min-h-11 w-full rounded-md border border-border-strong bg-surface px-3 text-[16px] text-foreground placeholder:text-foreground-subtle md:text-sm'

const DESTINATIONS = [
  { label: 'Home page', value: '/' },
  { label: 'Shop', value: '/shop' },
  { label: 'Chat', value: '/account/chat' },
  { label: 'Lab results', value: '/lab-results' },
] as const

/**
 * Write a notification, see it as a phone will show it, test it on this device,
 * then send it to everyone. Sending to everyone takes a second, deliberate tap.
 */
export function PushComposer({ subscribers }: { subscribers: number }) {
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [url, setUrl] = useState('/')
  const [confirming, setConfirming] = useState(false)
  const [sent, sendAction, sending] = useActionState<PushSendState, FormData>(async (prev, data) => {
    const result = await sendPushToEveryone(prev, data)
    setConfirming(false)
    if (result.ok) {
      setTitle('')
      setBody('')
    }
    return result
  }, {})
  const [tested, testAction, testing] = useActionState<PushSendState, FormData>(sendPushTest, {})
  const people = `${subscribers} ${subscribers === 1 ? 'device' : 'devices'}`

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
      <form action={sendAction} className="space-y-4 rounded-lg border border-border bg-surface p-4 md:p-5">
        <label className="block text-sm">
          <span className="flex justify-between font-medium text-foreground">
            Title <span className="tabular text-xs font-normal text-foreground-subtle">{title.length}/{TITLE_MAX}</span>
          </span>
          <input name="title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={TITLE_MAX} required placeholder="e.g. Fresh batch just landed" className={`mt-1 ${FIELD}`} />
        </label>
        <label className="block text-sm">
          <span className="flex justify-between font-medium text-foreground">
            Message <span className="tabular text-xs font-normal text-foreground-subtle">{body.length}/{BODY_MAX}</span>
          </span>
          <textarea
            name="body"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            maxLength={BODY_MAX}
            required
            rows={3}
            placeholder="e.g. New Amanita muscaria is in stock, with its lab results."
            className={`mt-1 py-2.5 ${FIELD}`}
          />
        </label>
        <div className="text-sm">
          <label htmlFor="push-url" className="font-medium text-foreground">
            Opens when tapped
          </label>
          <div className="mt-1 flex flex-wrap gap-2">
            {DESTINATIONS.map((d) => (
              <button
                key={d.value}
                type="button"
                onClick={() => setUrl(d.value)}
                aria-pressed={url === d.value}
                className="min-h-9 rounded-full border border-border-strong px-3 text-xs text-foreground-muted hover:bg-surface-sunken aria-pressed:border-primary aria-pressed:bg-primary/15 aria-pressed:text-foreground"
              >
                {d.label}
              </button>
            ))}
          </div>
          <input id="push-url" name="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="e.g. /shop/amanita" className={`mt-2 ${FIELD}`} />
          <p className="mt-1 text-xs text-foreground-subtle">A page on this site, e.g. a product or a blog post. Links to other sites are not allowed.</p>
        </div>

        {sent.error ? <p role="alert" className="text-sm text-danger-fg">{sent.error}</p> : null}
        {sent.ok ? <p role="status" className="rounded-md bg-success-bg p-3 text-sm text-success-fg">{sent.ok}</p> : null}
        {tested.error ? <p role="alert" className="text-sm text-danger-fg">{tested.error}</p> : null}
        {tested.ok ? <p role="status" className="text-sm text-success-fg">{tested.ok}</p> : null}

        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          <Button type="submit" formAction={testAction} variant="secondary" loading={testing} disabled={!title || !body}>
            Send a test to this device
          </Button>
          {confirming ? (
            <>
              <Button type="submit" variant="accent" loading={sending} disabled={!title || !body}>
                Yes, send to {people}
              </Button>
              <Button type="button" variant="ghost" onClick={() => setConfirming(false)} disabled={sending}>
                Cancel
              </Button>
            </>
          ) : (
            <Button type="button" variant="primary" onClick={() => setConfirming(true)} disabled={!title || !body || subscribers === 0}>
              Send to everyone ({people})
            </Button>
          )}
        </div>
      </form>

      {/* What the lock screen shows. The exact look is the phone's; this is close to both. */}
      <div>
        <p className="text-xs font-medium tracking-wide text-foreground-subtle uppercase">Preview</p>
        <div className="mt-2 rounded-[1.75rem] bg-gradient-to-b from-stone-800 to-stone-950 p-4">
          <div className="rounded-2xl bg-white/12 p-3 text-white shadow-lg backdrop-blur">
            <div className="flex items-center gap-2 text-[11px] text-white/70">
              <Image src="/brand/app-icon-192.png" alt="" width={20} height={20} className="size-5 rounded-md" />
              <span className="font-medium tracking-wide uppercase">{BRAND.name}</span>
              <span className="ml-auto">now</span>
            </div>
            <p className="mt-1.5 text-sm font-semibold break-words">{title || 'Your title'}</p>
            <p className="mt-0.5 line-clamp-4 text-sm break-words text-white/85">{body || 'Your message appears here.'}</p>
          </div>
        </div>
      </div>
    </div>
  )
}
