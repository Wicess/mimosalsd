'use client'

import { useActionState, useEffect, useRef } from 'react'
import Image from 'next/image'
import { adminLogin, type LoginState } from '@/app/actions/admin-auth'
import { BRAND } from '@/lib/brand'

const INITIAL: LoginState = {}

/**
 * Admin sign-in (redesigned 2026-10-17: "standing in the centre on a background is
 * boring; let it fit the phone, one page, no scroll").
 *
 * No card floating on a backdrop any more. On a phone the page IS the screen: a moss
 * band with the logo across the top, the form filling everything below it, the button
 * in the bottom third where a thumb reaches. On a computer it is a full-screen split,
 * the brand on the left and the form on the right.
 *
 * One screen, never a scroll: the page is fixed to the viewport, and the band, the
 * logo and the gaps are sized with dvh so a short screen (or an open keyboard)
 * shrinks them rather than pushing the button off the bottom.
 *
 * Two links the old reference had (password reset, self sign-up) are features this
 * panel does not have, so the page says what to do instead. The email is only a
 * username; nothing is sent to it.
 */
export default function AdminLoginPage() {
  const [state, formAction, pending] = useActionState(adminLogin, INITIAL)
  const emailRef = useRef<HTMLInputElement>(null)

  /*
    Nothing on this page moves (owner, 2026-09-19). While it is open the document
    itself cannot scroll or bounce, and the storefront's tab-bar gutter is released.
    The email box takes focus only with a mouse: on a phone that focus opened the
    keyboard on arrival and pushed the whole page up.
  */
  useEffect(() => {
    const html = document.documentElement
    const body = document.body
    const before = { html: html.style.cssText, body: body.style.cssText }
    html.style.overflow = 'hidden'
    html.style.overscrollBehavior = 'none'
    body.style.overflow = 'hidden'
    body.style.overscrollBehavior = 'none'
    body.style.paddingBottom = '0'
    if (window.matchMedia('(hover: hover) and (pointer: fine)').matches) emailRef.current?.focus()
    return () => {
      html.style.cssText = before.html
      body.style.cssText = before.body
    }
  }, [])

  return (
    // Fixed to the screen: <body> reserves 3.5rem at the bottom on phones for the
    // storefront's tab bar, which would otherwise make this page scroll by that much.
    <main className="fixed inset-0 flex touch-manipulation flex-col overflow-hidden overscroll-none bg-white md:grid md:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
      {/* ── The brand band (top on a phone, left half on a computer) ─────────── */}
      <section className="relative isolate flex h-[clamp(9.5rem,34dvh,17rem)] shrink-0 flex-col items-center justify-center overflow-hidden bg-linear-to-br from-moss-600 to-moss-800 px-6 text-center text-white md:h-auto md:px-12">
        <span aria-hidden className="absolute -bottom-32 -left-24 -z-10 size-[22rem] rounded-full bg-moss-500/35 md:-bottom-48 md:-left-40 md:size-[34rem]" />
        <span aria-hidden className="absolute -top-24 -right-20 -z-10 size-64 rounded-full bg-moss-900/40 md:size-96" />

        <Image
          src="/brand/logo.png"
          alt={BRAND.name}
          width={1180}
          height={329}
          priority
          sizes="(min-width: 768px) 320px, 220px"
          className="h-auto w-[min(13rem,46vw)] drop-shadow-[0_6px_16px_rgb(0_0_0/0.3)] md:w-[min(20rem,32vw)]"
        />
        <p className="mt-[min(0.75rem,1.5dvh)] text-[13px] text-moss-100 md:mt-6 md:max-w-xs md:text-base md:leading-relaxed">
          <span className="md:hidden">Admin panel, staff only</span>
          <span className="hidden md:inline">
            Orders, chats and the shop, in one place. For the shop&rsquo;s own team.
          </span>
        </p>
      </section>

      {/* ── The form (fills the rest of the screen) ────────────────────────── */}
      <section className="flex min-h-0 flex-1 flex-col px-6 pt-[min(2rem,4dvh)] pb-[max(env(safe-area-inset-bottom),min(1.5rem,3dvh))] md:items-center md:justify-center md:px-12 md:py-10">
        <div className="flex min-h-0 w-full flex-1 flex-col md:max-w-sm md:flex-none">
          <h1 className="font-product text-[min(1.75rem,4.6dvh)] leading-tight font-semibold tracking-[-0.02em] text-balance text-stone-900 md:text-3xl">
            Sign in
          </h1>
          <p className="mt-1 text-sm text-stone-600 [@media(max-height:560px)]:hidden">Use your admin email and password.</p>

          <form action={formAction} className="mt-[min(1.5rem,3dvh)] flex min-h-0 flex-1 flex-col md:mt-8 md:flex-none">
            <div className="space-y-[min(1rem,2dvh)]">
              <div>
                <label htmlFor="email" className="block text-[13px] font-medium text-stone-700">
                  Email
                </label>
                <input
                  ref={emailRef}
                  id="email"
                  name="email"
                  type="email"
                  required
                  autoComplete="username"
                  inputMode="email"
                  className="mt-1.5 min-h-[min(3rem,6.5dvh)] w-full rounded-xl! border border-stone-300! bg-stone-50 px-4 text-base text-stone-900 outline-none! transition-colors focus-visible:border-moss-600! focus-visible:bg-white focus-visible:ring-2 focus-visible:ring-moss-500/40 md:text-sm"
                />
              </div>
              <div>
                <label htmlFor="password" className="block text-[13px] font-medium text-stone-700">
                  Password
                </label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  required
                  autoComplete="current-password"
                  className="mt-1.5 min-h-[min(3rem,6.5dvh)] w-full rounded-xl! border border-stone-300! bg-stone-50 px-4 text-base text-stone-900 outline-none! transition-colors focus-visible:border-moss-600! focus-visible:bg-white focus-visible:ring-2 focus-visible:ring-moss-500/40 md:text-sm"
                />
              </div>

              {state.error && (
                <p role="alert" className="rounded-xl bg-danger-bg px-3 py-2 text-sm text-danger-fg">
                  {state.error}
                </p>
              )}
            </div>

            {/* The button sits in the bottom third on a phone, where the thumb is. */}
            <div className="mt-auto pt-[min(1.25rem,2.5dvh)] md:mt-7 md:pt-0">
              <button
                type="submit"
                disabled={pending}
                className="inline-flex min-h-[min(3.25rem,7dvh)] w-full cursor-pointer items-center justify-center rounded-full bg-moss-600 px-8 text-[15px] font-semibold text-white shadow-sm transition-[background-color,scale] duration-150 ease-out hover:bg-moss-700 active:scale-[0.98] disabled:cursor-wait disabled:opacity-70 motion-reduce:transition-none"
              >
                {pending ? 'Signing in…' : 'Sign in'}
              </button>
              <p className="mt-[min(0.9rem,1.8dvh)] text-center text-[12px] leading-relaxed text-stone-600">
                Forgotten the password, or need an account? Ask the site owner.
              </p>
            </div>
          </form>
        </div>
      </section>
    </main>
  )
}
