'use client'

import Image from 'next/image'
import { useEffect, useId, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { AddSquareIcon, CheckIcon, CopyIcon, CrossIcon, IosShareIcon, MoreHorizontalIcon, MoreIcon } from '@/components/ui/icon'
import { closeInstallGuide, markInstalled, startInstall, useInstallState } from '@/components/pwa/install-store'
import { APP_DISCOUNT_PERCENT, SUBSCRIBER_DISCOUNT_PERCENT } from '@/lib/orders/coupons'
import type { DevicePlatform, InstallMethod } from '@/components/pwa/platform'
import { BRAND } from '@/lib/brand'
import { cn } from '@/lib/utils'

type Step = { readonly text: React.ReactNode; readonly hint?: React.ReactNode }

const chip = 'mx-0.5 inline-flex size-6 translate-y-[5px] items-center justify-center rounded-md bg-surface-sunken text-foreground'
const Share = () => (
  <span className={chip} role="img" aria-label="Share">
    <IosShareIcon className="size-4" />
  </span>
)
const Dots = () => (
  <span className={chip} role="img" aria-label="More">
    <MoreHorizontalIcon className="size-4" />
  </span>
)
const Kebab = () => (
  <span className={chip} role="img" aria-label="Menu">
    <MoreIcon className="size-4" />
  </span>
)
// Decorative: the words beside it already say "Add to Home Screen".
const AddHome = () => (
  <span className={chip} aria-hidden>
    <AddSquareIcon className="size-4" />
  </span>
)
const Strong = ({ children }: { children: React.ReactNode }) => <strong className="font-semibold text-foreground">{children}</strong>

const APP_NAMES: Record<string, string> = {
  instagram: 'Instagram',
  facebook: 'Facebook',
  tiktok: 'TikTok',
  google: 'the Google app',
  linkedin: 'LinkedIn',
  snapchat: 'Snapchat',
  webview: 'this app',
}

/**
 * The steps for THIS device, in the words and icons it actually shows.
 *
 * iPhone Safari changed in iOS 26: the Share button moved behind "•••" in the
 * default compact layout, and the sheet gained an "Open as Web App" switch. The
 * user-agent still says iOS 18_6 there, but Safari's `Version/26` moves, which is
 * what picks the wording. Labels are Apple's own (support.apple.com, iOS 26).
 */
export function stepsFor(method: InstallMethod, platform: DevicePlatform): { steps: Step[]; pointer: 'right' | 'center' | null } {
  const modern = (platform.safariVersion ?? 0) >= 26
  switch (method) {
    case 'ios-safari':
      if (platform.ipad) {
        return {
          pointer: null,
          steps: [
            { text: <>Tap <Share /> <Strong>Share</Strong> at the top right, beside the address bar.</> },
            {
              text: <>Tap <AddHome /> <Strong>Add to Home Screen</Strong>.</>,
              hint: modern ? <>If it is not listed, tap <Strong>More</Strong> first.</> : undefined,
            },
            { text: modern ? <>Leave <Strong>Open as Web App</Strong> on, then tap <Strong>Add</Strong>.</> : <>Tap <Strong>Add</Strong>.</> },
          ],
        }
      }
      return modern
        ? {
            pointer: 'right',
            steps: [
              {
                text: <>Tap <Dots /> at the bottom right, then <Share /> <Strong>Share</Strong>.</>,
                hint: <>Already see <Strong>Share</Strong> in the toolbar? Tap it directly.</>,
              },
              { text: <>Scroll down and tap <AddHome /> <Strong>Add to Home Screen</Strong>.</> },
              { text: <>Leave <Strong>Open as Web App</Strong> on, then tap <Strong>Add</Strong>.</> },
            ],
          }
        : {
            pointer: 'center',
            steps: [
              { text: <>Tap <Share /> <Strong>Share</Strong> in the toolbar at the bottom of the screen.</> },
              {
                text: <>Scroll down and tap <AddHome /> <Strong>Add to Home Screen</Strong>.</>,
                hint: <>Not in the list? Tap <Strong>Edit Actions</Strong> at the bottom and add it.</>,
              },
              { text: <>Tap <Strong>Add</Strong> at the top right.</> },
            ],
          }
    case 'ios-browser':
      return {
        pointer: null,
        steps: [
          {
            text:
              platform.browser === 'chrome' ? (
                <>Tap <Share /> <Strong>Share</Strong> at the right of the address bar.</>
              ) : (
                <>Open the browser menu and tap <Share /> <Strong>Share</Strong>.</>
              ),
          },
          { text: <>Tap <AddHome /> <Strong>Add to Home Screen</Strong>.</>, hint: <>Scroll, or tap <Strong>More</Strong>, if you do not see it.</> },
          { text: <>Tap <Strong>Add</Strong>.</> },
        ],
      }
    case 'in-app': {
      const app = APP_NAMES[platform.inApp ?? 'webview'] ?? 'this app'
      const browser = platform.os === 'ios' ? 'Safari' : 'Chrome'
      return {
        pointer: null,
        steps: [
          { text: <>The browser inside {app} cannot install apps. Tap <Dots /> at the top right.</> },
          { text: <>Choose <Strong>Open in {browser}</Strong> (or <Strong>Open in browser</Strong>).</> },
          { text: <>Tap the install button there. It takes about ten seconds.</> },
        ],
      }
    }
    case 'android-menu':
      return {
        pointer: null,
        steps: [
          {
            text:
              platform.browser === 'samsung' ? (
                <>Tap the menu <Strong>≡</Strong> at the bottom right.</>
              ) : (
                <>Tap <Kebab /> at the top right of the browser.</>
              ),
          },
          { text: <>Tap <Strong>Install app</Strong> or <Strong>Add to Home screen</Strong>.</> },
          { text: <>Tap <Strong>Install</Strong>.</> },
        ],
      }
    case 'desktop-menu':
      return {
        pointer: null,
        steps: [
          { text: <>Click the <Strong>install</Strong> icon at the right end of the address bar.</> },
          {
            text:
              platform.browser === 'edge' ? (
                <>No icon? Open the <Strong>…</Strong> menu, then <Strong>Apps › Install this site as an app</Strong>.</>
              ) : (
                <>No icon? Open the <Kebab /> menu, then <Strong>Cast, save, and share › Install page as app</Strong>.</>
              ),
          },
          { text: <>Click <Strong>Install</Strong>.</> },
        ],
      }
    case 'mac-dock':
      return {
        pointer: null,
        steps: [
          { text: <>In the menu bar, choose <Strong>File › Add to Dock</Strong>.</> },
          { text: <>Click <Strong>Add</Strong>.</> },
        ],
      }
    default:
      return { pointer: null, steps: [] }
  }
}

/**
 * The step-by-step install sheet. Opened by the header's install button or the
 * install prompt whenever the browser has no install dialog of its own — which is
 * every iPhone.
 *
 * A real modal, unlike the prompts: someone asked for it, so it takes focus,
 * traps Escape, and gives focus back when it closes.
 */
export function InstallGuide() {
  const { guideOpen, method, platform, installed } = useInstallState()
  const titleId = useId()
  const closeRef = useRef<HTMLButtonElement>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!guideOpen) return
    const previous = document.activeElement as HTMLElement | null
    closeRef.current?.focus()
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeInstallGuide()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      previous?.focus?.()
    }
  }, [guideOpen])

  if (!guideOpen || installed || !platform) return null
  const { steps, pointer } = stepsFor(method, platform)
  // The browser's own install dialog needs no steps: the sheet offers the discount and one button.
  const direct = method === 'prompt'
  if (steps.length === 0 && !direct) return null
  const inApp = method === 'in-app'
  const confirmable = method === 'ios-safari' || method === 'ios-browser' || method === 'mac-dock'

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href)
      setCopied(true)
    } catch {
      setCopied(false)
    }
  }

  return (
    <div className="fixed inset-0 z-(--z-modal) flex items-end justify-center md:items-center" data-engagement="">
      <button
        type="button"
        tabIndex={-1}
        aria-label="Close"
        onClick={closeInstallGuide}
        className="absolute inset-0 cursor-default bg-stone-950/60 backdrop-blur-[2px] motion-safe:animate-[fade-in_200ms_ease-out]"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={cn(
          'relative w-full rounded-t-3xl border border-b-0 border-border-strong bg-surface px-5 pt-5',
          'pb-[calc(env(safe-area-inset-bottom)+1.25rem)] shadow-2xl',
          'md:max-w-md md:rounded-3xl md:border-b md:pb-6',
          'transition-[translate,opacity] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]',
          'starting:translate-y-full motion-reduce:starting:translate-y-0 motion-reduce:starting:opacity-0 md:starting:translate-y-4 md:starting:opacity-0',
        )}
      >
        <div aria-hidden className="mx-auto -mt-2 mb-4 h-1 w-10 rounded-full bg-border-strong md:hidden" />
        <button
          ref={closeRef}
          type="button"
          onClick={closeInstallGuide}
          aria-label="Close"
          className="absolute top-2 right-2 inline-flex size-11 cursor-pointer items-center justify-center rounded-full text-foreground-muted hover:bg-surface-sunken hover:text-foreground"
        >
          <CrossIcon className="size-5" />
        </button>

        <div className="flex items-center gap-3 pr-10">
          <Image src="/brand/app-icon-v2-192.png" alt="" width={56} height={56} className="size-14 rounded-2xl shadow-md" />
          <div>
            <h2 id={titleId} className="font-display text-xl leading-tight text-foreground">
              {inApp ? 'Open in your browser to install' : `Install ${BRAND.name}`}
            </h2>
            <p className="mt-0.5 text-sm text-foreground-muted">
              {inApp ? 'Then add it to your home screen in a few taps.' : 'Free, no app store. About ten seconds.'}
            </p>
          </div>
        </div>

        {/* The reason to do it, first (owner, 2026-09-14). */}
        <div className="mt-4 flex items-center gap-3 rounded-2xl bg-accent-muted px-4 py-3 ring-1 ring-accent/35">
          <span className="tabular font-display text-2xl leading-none text-accent-fg">{APP_DISCOUNT_PERCENT}%</span>
          <p className="text-sm leading-snug text-foreground">
            <strong className="font-semibold">off your first order</strong> when you place it from the app. It comes off
            automatically at checkout, and adds to your {SUBSCRIBER_DISCOUNT_PERCENT}% subscriber discount.
          </p>
        </div>

        {direct ? null : (
        <ol className="mt-5 space-y-3">
          {steps.map((step, index) => (
            <li
              key={index}
              className="flex gap-3 rounded-2xl bg-surface-sunken/60 p-3 motion-safe:animate-[rise_320ms_var(--ease-enter)_backwards]"
              style={{ animationDelay: `${80 + index * 60}ms` }}
            >
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-on-primary">
                {index + 1}
              </span>
              <div className="min-w-0 pt-1 text-[15px] leading-relaxed text-foreground-muted">
                <p>{step.text}</p>
                {step.hint ? <p className="mt-1 text-xs text-foreground-subtle">{step.hint}</p> : null}
              </div>
            </li>
          ))}
        </ol>
        )}

        <div className="mt-5 flex flex-col gap-2 sm:flex-row-reverse">
          {direct ? (
            <Button type="button" variant="accent" fullWidth onClick={() => void startInstall()}>
              Install now
            </Button>
          ) : null}
          {confirmable ? (
            <Button type="button" variant="accent" fullWidth onClick={markInstalled}>
              I’ve added it
            </Button>
          ) : null}
          {inApp ? (
            <Button type="button" variant="accent" fullWidth onClick={copyLink}>
              {copied ? <CheckIcon className="size-5" /> : <CopyIcon className="size-5" />}
              {copied ? 'Link copied' : 'Copy link'}
            </Button>
          ) : null}
          <Button type="button" variant="secondary" fullWidth onClick={closeInstallGuide}>
            {confirmable || inApp || direct ? 'Later' : 'Got it'}
          </Button>
        </div>

        {/*
          Points at where the button lives: Safari's toolbar is just below this sheet
          on an iPhone, "•••" at its right end on iOS 26, Share in its middle before.
        */}
        {pointer ? (
          <div
            aria-hidden
            className={cn(
              'pointer-events-none absolute -bottom-1 flex flex-col items-center text-primary md:hidden',
              pointer === 'right' ? 'right-6' : 'left-1/2 -translate-x-1/2',
            )}
          >
            <svg viewBox="0 0 24 24" className="size-7 motion-safe:animate-[install-point_1.2s_var(--ease-standard)_infinite]" fill="none" stroke="currentColor" strokeWidth={2.25} strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 4v15M6 13l6 6 6-6" />
            </svg>
          </div>
        ) : null}
      </div>
    </div>
  )
}
