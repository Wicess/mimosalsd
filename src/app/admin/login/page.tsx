'use client'

import { useActionState, useEffect, useRef } from 'react'
import Image from 'next/image'
import { adminLogin, type LoginState } from '@/app/actions/admin-auth'
import { BRAND } from '@/lib/brand'

const INITIAL: LoginState = {}

/**
 * Admin sign-in, in the owner's chosen design (2026-09-13): a green welcome panel
 * with curved shapes and the site logo centred on it, beside a white panel with
 * pill-shaped fields. On a phone the green becomes a curved header above the form.
 *
 * Two lines of the reference were links to features this panel deliberately does
 * not have — a password-reset flow and self sign-up — so they say what to do
 * instead rather than leading nowhere. The email is only a username; nothing is
 * sent to it.
 *
 * One screen, never a scroll: the page is exactly the viewport tall, and every gap
 * and the logo are sized with min(…, dvh) so they shrink on a short screen instead
 * of pushing the button below the fold.
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
    <main className="fixed inset-0 grid touch-manipulation place-items-center overflow-hidden overscroll-none bg-background p-3 md:p-6">
      <div className="relative flex max-h-full w-full max-w-sm flex-col overflow-hidden rounded-3xl bg-white shadow-2xl md:grid md:h-[min(34rem,100%)] md:max-w-4xl md:grid-cols-[1.1fr_1fr] md:bg-linear-to-b md:from-moss-600 md:to-moss-800">
        {/* ── The green welcome panel ─────────────────────────────────────── */}
        <section className="relative isolate flex flex-col items-center justify-center overflow-hidden shrink-0 rounded-bl-[55%_40%] bg-linear-to-b from-moss-600 to-moss-800 px-6 pt-[min(2.5rem,4.5dvh)] pb-[min(3rem,5.5dvh)] text-center text-white md:rounded-none md:bg-none md:px-10 md:py-[min(3rem,5dvh)]">
          {/* The soft circles behind it. */}
          <span aria-hidden className="absolute -bottom-40 -left-32 -z-10 size-[26rem] rounded-full bg-moss-500/40" />
          <span aria-hidden className="absolute -right-24 -top-28 -z-10 size-72 rounded-full bg-moss-700/50" />
          <span aria-hidden className="absolute -bottom-52 -left-48 -z-10 hidden size-[20rem] rounded-full bg-white md:block" />

          <Image
            src="/brand/logo.png"
            alt={BRAND.name}
            width={1180}
            height={329}
            priority
            sizes="240px"
            className="mx-auto h-auto w-[min(11rem,22dvh)] drop-shadow-[0_6px_18px_rgb(0_0_0/0.35)] md:w-[min(15rem,30dvh)]"
          />

          <h1 className="mt-[min(1.5rem,3dvh)] hidden font-product text-3xl font-medium md:block">Welcome Back!</h1>
          <p className="mt-3 hidden max-w-[16rem] text-sm leading-relaxed text-moss-100 md:block">
            To stay connected with the store, please sign in with your admin details.
          </p>

          <button
            type="button"
            onClick={() => emailRef.current?.focus()}
            className="mt-[min(2rem,4dvh)] hidden min-h-11 w-full max-w-[14rem] cursor-pointer rounded-full border-2 border-white/85 text-sm font-medium tracking-[0.12em] uppercase transition-colors duration-200 hover:bg-white/10 md:block"
          >
            Sign in
          </button>

          <p className="mt-[min(1.5rem,2.5dvh)] text-[10px] tracking-[0.18em] text-moss-200 uppercase md:mt-[min(2.5rem,5dvh)] [@media(max-height:540px)]:hidden">
            Admin panel <span aria-hidden>|</span> Authorised staff only
          </p>
        </section>

        {/* ── The white form panel ────────────────────────────────────────── */}
        <section className="relative flex min-h-0 flex-col justify-center overflow-y-auto overscroll-none [scrollbar-width:none] bg-white [&::-webkit-scrollbar]:hidden px-7 pt-[min(2rem,4dvh)] pb-[min(2.5rem,5dvh)] text-center md:rounded-tr-[18%_28%] md:rounded-bl-[22%_100%] md:px-12 md:py-[min(3rem,5dvh)]">
          <h2 className="font-product text-[min(2.25rem,6dvh)] leading-tight font-semibold tracking-tight text-moss-600 md:text-[min(3rem,7dvh)]">welcome</h2>
          <p className="mt-1.5 text-sm text-stone-600 [@media(max-height:540px)]:mt-0.5 [@media(max-height:540px)]:text-xs">Log in to your account to continue</p>

          <form action={formAction} className="mx-auto mt-[min(1.75rem,3.5dvh)] w-full max-w-xs space-y-[min(1rem,2dvh)] md:mt-[min(2.25rem,4.5dvh)]">
            <div>
              <label htmlFor="email" className="sr-only">
                Email (your username)
              </label>
              <input
                ref={emailRef}
                id="email"
                name="email"
                type="email"
                required
                autoComplete="username"
                placeholder="Email"
                className="min-h-[min(3rem,6.5dvh)] w-full rounded-full! border-0! bg-moss-200/70 px-5 text-center text-base text-stone-900 outline-none! placeholder:text-stone-600 focus-visible:ring-2 focus-visible:ring-moss-500 md:text-sm"
              />
            </div>
            <div>
              <label htmlFor="password" className="sr-only">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                required
                autoComplete="current-password"
                placeholder="Password"
                className="min-h-[min(3rem,6.5dvh)] w-full rounded-full! border-0! bg-moss-200/70 px-5 text-center text-base text-stone-900 outline-none! placeholder:text-stone-600 focus-visible:ring-2 focus-visible:ring-moss-500 md:text-sm"
              />
            </div>

            <p className="text-xs text-stone-700">Forgot your password? Ask the site owner to reset it.</p>

            {state.error && (
              <p role="alert" className="rounded-xl bg-danger-bg px-3 py-2 text-sm text-danger-fg">
                {state.error}
              </p>
            )}

            <button
              type="submit"
              disabled={pending}
              className="mx-auto mt-[min(0.5rem,1dvh)] inline-flex min-h-[min(2.75rem,6dvh)] min-w-40 cursor-pointer items-center justify-center rounded-full bg-moss-500 px-10 text-sm font-semibold tracking-[0.12em] text-white uppercase shadow-md transition-[background-color,scale] duration-150 hover:bg-moss-600 active:scale-[0.97] disabled:cursor-wait disabled:opacity-70"
            >
              {pending ? 'Logging in…' : 'Log in'}
            </button>
          </form>

          <p className="mt-[min(1.5rem,3dvh)] text-sm text-stone-700 [@media(max-height:540px)]:text-xs">
            Don&rsquo;t have an account? <span className="font-medium text-moss-600">Ask the site owner</span>
          </p>
        </section>

        {/*
          The green crescent in the bottom corner on a phone. On the card, not inside the
          form panel: that panel scrolls if a keyboard ever squeezes it, and a shape
          hanging past its edge gave it a scrollbar on screens with room to spare.
        */}
        <span aria-hidden className="pointer-events-none absolute -bottom-10 -left-10 size-20 rounded-full bg-moss-600 md:hidden" />
      </div>
    </main>
  )
}
