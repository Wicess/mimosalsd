'use client'

import { APP_DISCOUNT_PERCENT } from '@/lib/orders/coupons'
import { BRAND } from '@/lib/brand'
import { openInstallGuide, useInstallState } from '@/components/pwa/install-store'

/**
 * The header's install button, beside the account icon.
 *
 * Absent from the server HTML and until the browser has been asked (so it never
 * flashes on a phone that already has the app), absent where the browser cannot
 * install sites at all, and gone for good once the app is installed.
 *
 * It moves, on purpose (owner, 2026-09-14): an arrow dropping into a tray, and one
 * ring spreading from the button every few seconds, with the 5% it is worth pinned
 * to its corner. One tap opens the install sheet, which leads with the discount and
 * then installs: the browser's own dialog where there is one, the steps elsewhere.
 *
 * It appears to the LEFT of the account and cart icons, which are anchored to the
 * right edge, so arriving moves nothing that was already there.
 */
export function InstallButton() {
  const { ready, installed, method } = useInstallState()
  if (!ready || installed || method === 'none') return null

  return (
    <button
      type="button"
      onClick={openInstallGuide}
      className="relative inline-flex min-h-11 min-w-11 cursor-pointer items-center justify-center rounded-full! text-accent transition-[scale] duration-[160ms] active:scale-[0.92] motion-safe:animate-[fade-in_240ms_ease-out] motion-reduce:active:scale-100"
    >
      <span aria-hidden className="absolute inset-1 rounded-full bg-accent/15 ring-1 ring-accent/45" />
      <span
        aria-hidden
        className="absolute inset-1 rounded-full ring-2 ring-accent/60 opacity-0 motion-safe:animate-[install-halo_3.2s_ease-out_infinite]"
      />
      <InstallArrowIcon className="relative size-6" />
      <span
        aria-hidden
        className="tabular absolute -top-0.5 -right-1 rounded-full bg-accent px-1 text-[9px] leading-4 font-bold text-on-accent shadow-sm"
      >
        -{APP_DISCOUNT_PERCENT}%
      </span>
      <span className="sr-only">
        Install the {BRAND.name} app: {APP_DISCOUNT_PERCENT}% off your first order in it
      </span>
    </button>
  )
}

/** A tray with an arrow dropping into it: "install", read at a glance. The arrow moves. */
function InstallArrowIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className={className}
    >
      <path d="M4.5 14.5v3.25A2.25 2.25 0 0 0 6.75 20h10.5a2.25 2.25 0 0 0 2.25-2.25V14.5" />
      <g className="[transform-box:fill-box] motion-safe:animate-[install-drop_3.2s_cubic-bezier(0.32,0.72,0,1)_infinite]">
        <path d="M12 3.5v11" />
        <path d="m7.75 10.25 4.25 4.25 4.25-4.25" />
      </g>
    </svg>
  )
}
