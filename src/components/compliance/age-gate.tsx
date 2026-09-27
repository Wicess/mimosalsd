'use client'

import { useEffect, useId, useState, useSyncExternalStore } from 'react'
import { Button } from '@/components/ui/button'
import { BRAND } from '@/lib/brand'

const STORAGE_KEY = 'age-verified-v1'
/** Re-ask after 30 days. A permanent cookie is not a defensible record. */
const TTL_MS = 30 * 24 * 60 * 60 * 1000

/**
 * ─────────────────────────────────────────────────────────────────────────────
 *  AGE GATE — Layer 1 of four. Read this before changing it.
 *
 *  TWO things are load-bearing here and both are easy to get wrong:
 *
 *  1. IT MUST NOT HIDE CONTENT FROM CRAWLERS.
 *     Organic search is this business's ONLY acquisition channel — paid ads are
 *     prohibited in this category. An interstitial that Googlebot resolves as the
 *     page body would destroy the entire funnel. So the real page always renders in
 *     the DOM underneath; this is an overlay, never a redirect and never a content
 *     swap. Crawlers are additionally passed through server-side via isCrawler().
 *
 *  2. IT IS NOT SUFFICIENT ON ITS OWN.
 *     A self-declaration modal is NOT compliant in most jurisdictions. This is the
 *     friction-light first layer. Real identity verification happens at checkout
 *     (Layer 2), adult signature at delivery (Layer 3), and an evidence record is
 *     persisted (Layer 4). Do not let anyone "simplify" the checkout by pointing at
 *     this component — it would not survive an enforcement review.
 *
 *     This layer asks a yes/no question. It previously collected a date of birth,
 *     which looked more rigorous and was not: an unverified date a visitor types is
 *     the same self-declaration as a button, with three more fields of friction on
 *     the way into the site. Nothing consumed it — the date was validated, discarded,
 *     and never stored or sent anywhere. Checkout records its own 21+ attestation
 *     (`AGE_21_PLUS`) independently of this dialog.
 *
 *     BE CLEAR ABOUT WHAT THIS DOES NOT DO. Layer 2 — `createAgeVerifier` in
 *     lib/compliance/age.ts — is scaffolding: the interface and a development stub
 *     exist, and nothing calls them. Until a real vendor is wired in, every age
 *     signal on this site is self-declared. Simplifying this dialog did not cause
 *     that, and making it harder to click would not fix it.
 * ─────────────────────────────────────────────────────────────────────────────
 */
function subscribe(onChange: () => void): () => void {
  window.addEventListener('storage', onChange)
  return () => window.removeEventListener('storage', onChange)
}

function readVerified(): boolean {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return false
    const { at } = JSON.parse(raw) as { at: number }
    return Date.now() - at <= TTL_MS
  } catch {
    // Private mode, blocked storage, malformed value — ask again rather than
    // silently letting someone through.
    return false
  }
}

/**
 * The server snapshot is `true` — "already verified" — so the gate is NEVER present
 * in server-rendered HTML. That is deliberate and it is the crawler guarantee: there
 * is no overlay in the document a bot receives, only the real page. The gate mounts
 * on the client after hydration.
 */
function readVerifiedOnServer(): boolean {
  return true
}

export function AgeGate() {
  const verified = useSyncExternalStore(subscribe, readVerified, readVerifiedOnServer)
  const [dismissed, setDismissed] = useState(false)
  const [declined, setDeclined] = useState(false)
  const headingId = useId()
  const descId = useId()

  const open = !verified && !dismissed

  useEffect(() => {
    if (!open) return
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previous
    }
  }, [open])

  function confirmAdult() {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ at: Date.now() }))
    } catch {
      // Storage unavailable — allow this session through rather than trapping them.
    }
    setDismissed(true)
  }

  /**
   * "No" does not close the gate.
   *
   * A refusal that simply dismissed the dialog would leave an under-age visitor on
   * the site, which is worse than not asking. It swaps the panel for a refusal that
   * has no way past it, and stores nothing — so the answer is not remembered and a
   * mistaken tap is recoverable by reloading.
   */
  function declineAdult() {
    setDeclined(true)
  }

  if (!open) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={headingId}
      aria-describedby={descId}
      className="fixed inset-0 z-(--z-age-gate) flex items-center justify-center bg-stone-950/80 p-4 backdrop-blur-sm"
    >
      <div className="w-full max-w-[21rem] rounded-2xl border border-border bg-surface p-5 shadow-xl motion-safe:animate-[bubble-in_180ms_var(--ease-out-expo)] md:max-w-md md:p-6">
        {declined ? (
          <>
            <h2 id={headingId} className="font-display text-xl text-foreground md:text-2xl">
              You need to be {BRAND.minimumAge} to shop here
            </h2>
            <p id={descId} className="mt-3 text-sm leading-relaxed text-foreground-muted">
              Everything we sell is age-restricted, so we cannot let you browse the
              store. Thanks for being straight with us.
            </p>
            {/*
              No "go back" control. A button that reopened the question would make the
              refusal a formality, which is the opposite of the point. Reloading still
              works if someone mis-tapped.
            */}
          </>
        ) : (
          <>
            <h2 id={headingId} className="font-display text-xl text-foreground md:text-2xl">
              Are you {BRAND.minimumAge} or older?
            </h2>
            <p id={descId} className="mt-2 text-sm leading-relaxed text-foreground-muted">
              {BRAND.name} sells products for adults {BRAND.minimumAge} and over.
            </p>

            {/*
              Yes first and visually dominant, No plain — but both are real buttons at
              the full 44px target. Making the refusal a tiny text link is the dark
              pattern this kind of gate usually ships with.
            */}
            <div className="mt-5 flex flex-col gap-2.5 md:mt-6 md:gap-3">
              <Button type="button" variant="accent" fullWidth onClick={confirmAdult}>
                Yes, I am {BRAND.minimumAge} or older
              </Button>
              <Button type="button" variant="secondary" fullWidth onClick={declineAdult}>
                No
              </Button>
            </div>

            <p className="mt-3 text-[11px] leading-relaxed text-foreground-subtle md:mt-4 md:text-xs">
              By continuing you confirm your answer is accurate. Providing false
              information to purchase age-restricted products is unlawful.
            </p>
          </>
        )}
      </div>
    </div>
  )
}
