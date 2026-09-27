'use client'

import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { useActionState, useCallback, useEffect, useRef, useState } from 'react'
import { subscribeToNewsletter, type NewsletterSignupState } from '@/app/actions/newsletter'
import { Button } from '@/components/ui/button'
import { BellIcon, CheckIcon, MailIcon } from '@/components/ui/icon'
import { InstallGuide } from '@/components/pwa/install-guide'
import { startInstall, useInstallState } from '@/components/pwa/install-store'
import { isLikelyBot } from '@/components/pwa/platform'
import { hasJoinedNewsletter, rememberNewsletterSubscribed } from '@/components/pwa/newsletter-flag'
import { PromptCard } from '@/components/pwa/prompt-card'
import { enablePushNotifications, preparePush, syncPushSubscription, usePushStatus } from '@/components/pwa/push-client'
import { BRAND } from '@/lib/brand'
import { APP_DISCOUNT_PERCENT, SUBSCRIBER_DISCOUNT_PERCENT } from '@/lib/orders/coupons'

/**
 * ─────────────────────────────────────────────────────────────────────────────
 *  THE ENGAGEMENT PROMPTS — the email sign-up, the install nudge, and the
 *  notifications ask, one at a time and in that order (owner's brief,
 *  2026-09-13):
 *
 *   1. EMAIL. Appears 10 seconds in. Closed, it comes back 10 seconds later, and
 *      keeps doing so until the visitor subscribes. Then it never shows again.
 *   2. INSTALL takes over, on the same rhythm, until the app is installed (or the
 *      visitor says they added it, on an iPhone, which cannot tell us).
 *   3. NOTIFICATIONS, once installed, until they are on or the browser blocks them.
 *
 *  Inside the installed app the order is notifications first: that is what the
 *  app is for, and on an iPhone the app keeps its storage apart from Safari's, so
 *  it cannot know the visitor already subscribed there.
 *
 *  Never over another dialog (the age gate, the cart, the chat), never while the
 *  tab is hidden, never on checkout, the cart or an order page — asking for an
 *  email in the middle of paying costs orders — and never to a crawler.
 * ─────────────────────────────────────────────────────────────────────────────
 */

export const REPEAT_MS = 10_000
const QUIET_PATHS = ['/checkout', '/cart', '/order', '/offline', '/account']

type Stage = 'newsletter' | 'install' | 'notifications'

/** Another dialog is on screen: the age gate, the cart drawer, the chat. */
function anotherDialogOpen(): boolean {
  return Array.from(document.querySelectorAll<HTMLElement>('[role="dialog"]')).some((el) => {
    if (el.closest('[data-engagement]') || el.closest('[aria-hidden="true"]') || el.closest('[inert]')) return false
    return typeof el.checkVisibility === 'function' ? el.checkVisibility() : el.offsetParent !== null
  })
}

export function EngagementPrompts() {
  const pathname = usePathname() ?? '/'
  const install = useInstallState()
  const push = usePushStatus()
  const [newsletterDone, setNewsletterDone] = useState(hasJoinedNewsletter)
  // The stage a card was opened for. Held while it is open, so a card can show its
  // "done" message after the step it asked for is already complete.
  const [openStage, setOpenStage] = useState<Stage | null>(null)
  const [attempt, setAttempt] = useState(0)
  const [bot] = useState(() => isLikelyBot(navigator.userAgent))

  const quiet = bot || QUIET_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))
  const canInstall = install.ready && !install.installed && install.method !== 'none'
  const canNotify = push === 'default'

  const order: Stage[] = install.standalone ? ['notifications', 'newsletter', 'install'] : ['newsletter', 'install', 'notifications']
  const stage =
    order.find((s) => (s === 'newsletter' ? !newsletterDone : s === 'install' ? canInstall : canNotify && (install.installed || install.method === 'none'))) ??
    null

  // Keep an existing push subscription alive and linked to this visitor.
  useEffect(() => {
    void syncPushSubscription()
  }, [])

  // Warm the key and the service worker, so "Turn on" has nothing to wait for.
  useEffect(() => {
    if (stage === 'notifications') void preparePush()
  }, [stage])

  const open = openStage !== null
  const everOpened = useRef(false)
  useEffect(() => {
    if (!stage || open || quiet || !install.ready) return
    // The first one counts its 10 seconds from when the page began loading, not from
    // when this deferred code arrived; after that, 10 seconds from the last close.
    const delay = everOpened.current ? REPEAT_MS : Math.max(1500, REPEAT_MS - performance.now())
    const timer = window.setTimeout(() => {
      if (document.visibilityState === 'hidden' || anotherDialogOpen()) {
        setAttempt((n) => n + 1)
        return
      }
      everOpened.current = true
      setOpenStage(stage)
    }, delay)
    return () => window.clearTimeout(timer)
  }, [stage, open, quiet, install.ready, attempt])

  const close = useCallback(() => setOpenStage(null), [])
  const newsletterSubscribed = useCallback(() => {
    rememberNewsletterSubscribed()
    setNewsletterDone(true)
    setOpenStage(null)
  }, [])
  // Navigating to a quiet page puts the card away, and the 10 seconds start again
  // after it; installing from the header meanwhile retires the install card.
  if (quiet && openStage !== null) setOpenStage(null)
  const showing = quiet || (openStage === 'install' && !canInstall) ? null : openStage

  return (
    <>
      <PromptCard
        open={showing === 'newsletter'}
        onClose={close}
        title={`Get ${SUBSCRIBER_DISCOUNT_PERCENT}% off your first order`}
        icon={<MailIcon className="size-6" />}
        header={<Image src="/brand/logo.png" alt={BRAND.name} width={996} height={440} sizes="90px" className="h-8 w-auto" />}
      >
        <NewsletterForm path={pathname} onDone={newsletterSubscribed} />
      </PromptCard>

      <PromptCard
        open={showing === 'install'}
        onClose={close}
        title={`Get the app: ${APP_DISCOUNT_PERCENT}% off`}
        icon={<Image src="/brand/app-icon-192.png" alt="" width={44} height={44} className="size-11" />}
      >
        <p className="mt-1 text-sm leading-relaxed text-foreground-muted">
          {install.method === 'in-app'
            ? 'Open this page in your browser to add the app to your home screen.'
            : `On your home screen in seconds, with order updates and replies as notifications, and ${APP_DISCOUNT_PERCENT}% off your first order placed in the app.`}
        </p>
        <div className="mt-3 flex gap-2">
          <Button
            type="button"
            variant="accent"
            size="sm"
            onClick={() => {
              close()
              void startInstall()
            }}
          >
            {install.method === 'prompt' ? 'Install' : 'Show me how'}
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={close}>
            Not now
          </Button>
        </div>
      </PromptCard>

      <PromptCard
        open={showing === 'notifications'}
        onClose={close}
        title="Turn on notifications"
        icon={<BellIcon className="size-6" />}
      >
        <NotificationsAsk onDone={close} />
      </PromptCard>

      <InstallGuide />
    </>
  )
}

function NewsletterForm({ path, onDone }: { path: string; onDone: () => void }) {
  const [state, action, pending] = useActionState<NewsletterSignupState, FormData>(subscribeToNewsletter, {})

  useEffect(() => {
    if (!state.ok) return
    const timer = window.setTimeout(onDone, 2200)
    return () => window.clearTimeout(timer)
  }, [state.ok, onDone])

  if (state.ok) {
    return (
      <p role="status" className="mt-1 flex items-center gap-2 text-sm text-success-fg">
        <CheckIcon className="size-5 shrink-0" />
        You’re on the list. Use this email at checkout and {SUBSCRIBER_DISCOUNT_PERCENT}% comes off your first order.
      </p>
    )
  }

  return (
    <form action={action} className="mt-1">
      <p className="text-sm leading-relaxed text-foreground-muted">
        Subscribe for new batches, lab results and member-only offers, and take {SUBSCRIBER_DISCOUNT_PERCENT}% off
        your first order at checkout.
      </p>
      <div className="mt-3 flex gap-2">
        <label className="min-w-0 flex-1">
          <span className="sr-only">Email address</span>
          <input
            type="email"
            name="email"
            required
            autoComplete="email"
            inputMode="email"
            placeholder="you@example.com"
            className="block min-h-11 w-full rounded-md border border-border-strong bg-surface px-3 text-[16px] text-foreground placeholder:text-foreground-subtle md:text-sm"
          />
        </label>
        <Button type="submit" variant="accent" size="sm" disabled={pending}>
          {pending ? 'Joining…' : 'Subscribe'}
        </Button>
      </div>
      {/* Subscribing IS the agreement, and the line below says so before the tap. */}
      <input type="hidden" name="consent" value="on" />
      <input type="hidden" name="source" value="site-popup" />
      <input type="hidden" name="path" value={path} />
      <input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden className="hidden" />
      {state.error ? (
        <p role="alert" className="mt-2 text-sm text-danger-fg">
          {state.error}
        </p>
      ) : null}
      <p className="mt-2 text-xs leading-relaxed text-foreground-subtle">
        By subscribing you agree to marketing emails from {BRAND.name}. Unsubscribe any time.
      </p>
    </form>
  )
}

function NotificationsAsk({ onDone }: { onDone: () => void }) {
  const [result, setResult] = useState<'idle' | 'working' | 'on' | 'blocked' | 'failed'>('idle')

  useEffect(() => {
    if (result !== 'on' && result !== 'blocked') return
    const timer = window.setTimeout(onDone, result === 'on' ? 1800 : 4000)
    return () => window.clearTimeout(timer)
  }, [result, onDone])

  if (result === 'on') {
    return (
      <p role="status" className="mt-1 flex items-center gap-2 text-sm text-success-fg">
        <CheckIcon className="size-5 shrink-0" />
        Notifications are on.
      </p>
    )
  }

  return (
    <>
      <p className="mt-1 text-sm leading-relaxed text-foreground-muted">
        Replies from our team and updates on your order, straight to your lock screen.
      </p>
      {result === 'blocked' ? (
        <p role="alert" className="mt-2 text-sm text-danger-fg">
          Notifications are blocked for this site. You can allow them in your browser or phone settings.
        </p>
      ) : null}
      {result === 'failed' ? (
        <p role="alert" className="mt-2 text-sm text-danger-fg">
          That didn’t work. Please try again.
        </p>
      ) : null}
      <div className="mt-3 flex gap-2">
        <Button
          type="button"
          variant="accent"
          size="sm"
          disabled={result === 'working'}
          onClick={async () => {
            setResult('working')
            const outcome = await enablePushNotifications()
            if (outcome === 'subscribed') setResult('on')
            else if (outcome === 'denied') setResult('blocked')
            else if (outcome === 'dismissed') onDone()
            else setResult('failed')
          }}
        >
          {result === 'working' ? 'Turning on…' : 'Turn on'}
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={onDone}>
          Not now
        </Button>
      </div>
    </>
  )
}
