'use client'

import { useActionState, useState, useSyncExternalStore, useTransition } from 'react'
import { PaymentMark } from '@/components/commerce/payment-mark'
import {
  previewCoupon,
  submitOrder,
  type CheckoutState,
  type CouponPreview,
} from '@/app/actions/checkout'
import { JURISDICTIONS } from '@/lib/compliance/jurisdictions'
import {
  INTENDED_USE_ATTESTATION,
} from '@/lib/compliance/disclaimers'
import { PAYMENT_LABELS, PAYMENT_METHODS, type PaymentMethod } from '@/lib/orders/types'
import { discountPercent } from '@/lib/orders/payment-discount'
import { APP_DISCOUNT_PERCENT, orderTotals, SUBSCRIBER_DISCOUNT_PERCENT } from '@/lib/orders/coupons'
import type { CheckoutWelcome } from '@/lib/orders/welcome'
import { isStandalone, openInstallGuide, useInstallState } from '@/components/pwa/install-store'
import { BRAND } from '@/lib/brand'
import { formatCents } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { AlertIcon } from '@/components/ui/icon'
import { Select } from '@/components/ui/select'

const INITIAL: CheckoutState = {}

// Whether this page is running inside the installed app. It cannot change while the page is open.
const noSubscribe = () => () => {}
const serverFalse = () => false

/**
 * Brand marks, copied from the WHAM asset set.
 *
 * A payment chooser with no logos asks the customer to read four words and decide;
 * with them it is recognition, which is faster and reads as a real checkout. Apple's
 * mark sits under the "Apple Cash" label deliberately — the asset is the Pay glyph,
 * the product we can actually accept is Cash, and the label is what governs.
 */

function Field({
  id,
  label,
  error,
  children,
  hint,
}: {
  id: string
  label: string
  error?: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <div>
      {/* Visible label, never placeholder-only — placeholders vanish on focus. */}
      <label htmlFor={id} className="block text-sm font-medium text-foreground">
        {label}
      </label>
      {children}
      {hint && !error && <p className="mt-1 text-xs text-foreground-muted">{hint}</p>}
      {error && (
        <p id={`${id}-error`} role="alert" className="mt-1 text-sm text-danger-fg">
          {error}
        </p>
      )}
    </div>
  )
}

const inputClass =
  'mt-1 min-h-11 w-full rounded-md border border-border-strong bg-surface px-3 text-base text-foreground'

/**
 * Checkout.
 *
 * EIGHT visible fields. Competitors run ~15-field card checkouts; every field past
 * the eighth costs 4–6% completion. We can afford eight because there is no payment
 * step — spend that advantage on conversion rather than adding "nice to have" inputs.
 *
 * Single page with three grouped sections, not a multi-page wizard. On mobile a wizard
 * adds navigation cost and hides progress.
 *
 * No motion anywhere in this component. Motion in checkout reads as instability, and
 * instability reads as scam.
 */
export function CheckoutForm({
  defaultStateCode,
  requiresIntendedUse,
  subtotalCents,
  eligibleSubtotalCents,
  shippingCents,
  welcome,
}: {
  defaultStateCode?: string
  requiresIntendedUse: boolean
  /** Goods only. The Bitcoin saving is quoted against this, never against shipping. */
  subtotalCents: number
  /** Goods a discount may reduce: everything but vapes. */
  eligibleSubtotalCents: number
  /** Null until the shipping state is known. */
  shippingCents: number | null
  /** What this browser has earned: see lib/orders/welcome.ts. */
  welcome: CheckoutWelcome
}) {
  const [state, formAction, pending] = useActionState(submitOrder, INITIAL)
  const errors = state.errors ?? {}
  /*
    Tracked so the saving can be shown the moment Bitcoin is picked rather than after
    submission. The server recomputes it from the same function — this is a preview,
    never the figure of record.
  */
  const [method, setMethod] = useState<PaymentMethod>(PAYMENT_METHODS[0]!)

  /*
    The applied coupon, as the SERVER evaluated it. Never computed here: whether a
    code applies depends on the database and on which lines are vapes, and a figure
    the browser invented would be a promise the order does not keep.

    Cleared the moment the code box is edited. Otherwise a customer applies SAVE10,
    changes it to SAVE20 without pressing Apply, and sees SAVE10's discount while
    SAVE20 is the code that gets submitted.
  */
  const [coupon, setCoupon] = useState<CouponPreview | null>(null)
  const [codeInput, setCodeInput] = useState('')
  const [applying, startApplying] = useTransition()
  const appliedCents = coupon?.ok ? coupon.discountCents : 0

  /*
    Through `orderTotals` — the same function the server totals the order with — so
    the Bitcoin saving shown here stacks on the post-coupon amount exactly as the
    invoice will. Shipping is not known to this form and does not affect the payment
    discount, so it is passed as zero and only that figure is read back.
  */
  /*
    The welcome discounts, previewed. The 10% shows for the address this browser
    subscribed with, or once "subscribe" is ticked; the 5% when this browser installed
    the app or the page is open inside it. The server decides again when the order is
    placed, and the order page shows what it decided.
  */
  const [email, setEmail] = useState(welcome.subscribedEmail ?? '')
  const [subscribe, setSubscribe] = useState(false)
  const standalone = useSyncExternalStore(noSubscribe, isStandalone, serverFalse)
  const install = useInstallState()
  const knownSubscriber = Boolean(welcome.subscribedEmail) && email.trim().toLowerCase() === welcome.subscribedEmail
  const subscriber = knownSubscriber ? !welcome.subscriberUsed : subscribe
  const app = (welcome.appInstalled || standalone) && !welcome.appUsed
  const canGetApp = !app && !welcome.appUsed && install.ready && !install.installed && install.method !== 'none'

  const preview = orderTotals({
    subtotalCents,
    shippingCents: shippingCents ?? 0,
    couponDiscountCents: appliedCents,
    paymentMethod: method,
    eligibleSubtotalCents,
    subscriber,
    appInstalled: app,
  })
  const discountCents = preview.paymentDiscountCents
  const anyDiscount =
    preview.couponDiscountCents + preview.subscriberDiscountCents + preview.appDiscountCents + preview.paymentDiscountCents > 0

  return (
    <form action={formAction} className="space-y-8" noValidate>
      {state.formError && (
        <div role="alert" className="rounded-lg bg-danger-bg p-4 text-danger-fg">
          <div className="flex gap-3">
            <AlertIcon className="mt-0.5 size-5" />
            <p className="text-sm">{state.formError}</p>
          </div>
        </div>
      )}

      <fieldset>
        <legend className="font-display text-xl text-foreground">1. Contact</legend>
        <p className="mt-1 text-sm text-foreground-muted">
          We use this to send your payment instructions and tracking.
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field id="email" label="Email" error={errors.email}>
            <input
              id="email"
              name="email"
              type="email"
              required
              autoComplete="email"
              inputMode="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              aria-invalid={Boolean(errors.email)}
              aria-describedby={errors.email ? 'email-error' : undefined}
              className={inputClass}
            />
          </Field>
          <Field id="phone" label="Phone" error={errors.phone}>
            <input
              id="phone"
              name="phone"
              type="tel"
              required
              autoComplete="tel"
              inputMode="tel"
              aria-invalid={Boolean(errors.phone)}
              className={inputClass}
            />
          </Field>
        </div>
        {knownSubscriber ? (
          <p
            className={`mt-3 rounded-lg px-4 py-3 text-sm font-medium ${
              welcome.subscriberUsed ? 'bg-surface-sunken text-foreground-muted' : 'bg-success-bg text-success-fg'
            }`}
          >
            {welcome.subscriberUsed
              ? 'You are subscribed with this email. Its 10% welcome discount was used on an earlier order.'
              : `You are subscribed with this email: ${SUBSCRIBER_DISCOUNT_PERCENT}% off this order.`}
          </p>
        ) : (
          <label className="mt-3 flex cursor-pointer gap-3 rounded-lg border border-border bg-surface-sunken/60 p-3 text-sm text-foreground">
            <input
              type="checkbox"
              name="subscribe"
              checked={subscribe}
              onChange={(event) => setSubscribe(event.target.checked)}
              className="mt-0.5 size-4 shrink-0 accent-[var(--primary)]"
            />
            <span>
              <strong className="font-semibold">Take {SUBSCRIBER_DISCOUNT_PERCENT}% off this order</strong> by subscribing
              to our emails: new batches, lab results and member offers.
              <span className="mt-0.5 block text-xs text-foreground-muted">
                Once per email address. Unsubscribe any time from any email.
              </span>
            </span>
          </label>
        )}
        {/* Tells the server this order comes from inside the installed app. */}
        <input type="hidden" name="appMode" value={standalone ? 'standalone' : 'browser'} />
      </fieldset>

      <fieldset>
        <legend className="font-display text-xl text-foreground">2. Delivery</legend>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field id="firstName" label="First name" error={errors.firstName}>
            <input id="firstName" name="firstName" required autoComplete="given-name" className={inputClass} />
          </Field>
          <Field id="lastName" label="Last name" error={errors.lastName}>
            <input id="lastName" name="lastName" required autoComplete="family-name" className={inputClass} />
          </Field>
          <div className="sm:col-span-2">
            <Field id="addressLine1" label="Street address" error={errors.addressLine1}>
              <input
                id="addressLine1"
                name="addressLine1"
                required
                autoComplete="address-line1"
                className={inputClass}
              />
            </Field>
          </div>
          <div className="sm:col-span-2">
            <Field id="addressLine2" label="Apartment, suite (optional)">
              <input id="addressLine2" name="addressLine2" autoComplete="address-line2" className={inputClass} />
            </Field>
          </div>
          <Field id="city" label="City" error={errors.city}>
            <input id="city" name="city" required autoComplete="address-level2" className={inputClass} />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field id="stateCode" label="State" error={errors.stateCode}>
              {/* The site's own dropdown, not the phone's system menu. The server action still validates it. */}
              <Select
                id="stateCode"
                name="stateCode"
                defaultValue={defaultStateCode ?? ''}
                placeholder="Choose…"
                options={JURISDICTIONS.map((j) => ({ value: j.code, label: j.name }))}
                invalid={Boolean(errors.stateCode)}
                className="mt-0"
              />
            </Field>
            <Field id="postalCode" label="ZIP" error={errors.postalCode}>
              <input
                id="postalCode"
                name="postalCode"
                required
                inputMode="numeric"
                autoComplete="postal-code"
                className={inputClass}
              />
            </Field>
          </div>
        </div>
        <p className="mt-3 text-xs text-foreground-muted">
          We re-check what we can legally ship against this address, not the state you
          were browsing with.
        </p>
      </fieldset>

      <fieldset>
        <legend className="font-display text-xl text-foreground">3. Payment</legend>
        <p className="mt-1 text-sm text-foreground-muted">
          No payment is taken here. Choose how you would like to pay and we will send
          instructions once we have checked the stock and that we can ship to your address.
        </p>

        {/*
          Two across on a phone, so each mark has room to be read at a glance; four
          across from a tablet up. A radio dot in the corner says "pick one" the way
          every payment form does, and fills when chosen.
        */}
        <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-2.5">
          {PAYMENT_METHODS.map((m) => {
            const active = m === method
            const off = discountPercent(m)
            return (
              <label
                key={m}
                className={[
                  'relative flex min-h-24 cursor-pointer flex-col items-center justify-center gap-2.5 rounded-lg border px-3 pt-6 pb-3.5 text-center md:min-h-22',
                  'transition-[color,background-color,border-color,box-shadow] duration-[160ms] ease-[var(--ease-standard)]',
                  'has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ring',
                  active
                    ? 'border-primary bg-primary-muted shadow-[inset_0_0_0_1px_var(--primary)]'
                    : 'border-border bg-surface hover:border-border-strong hover:bg-surface-sunken',
                ].join(' ')}
              >
                <input
                  type="radio"
                  name="paymentMethod"
                  value={m}
                  checked={active}
                  onChange={() => setMethod(m)}
                  required
                  className="sr-only"
                />
                <span
                  aria-hidden
                  className={[
                    'absolute top-2.5 left-2.5 grid size-4 place-items-center rounded-full border transition-colors duration-[160ms]',
                    active ? 'border-primary bg-primary' : 'border-border-strong bg-transparent',
                  ].join(' ')}
                >
                  <span
                    className={[
                      'size-1.5 rounded-full bg-background transition-transform duration-[160ms] ease-[var(--ease-standard)] motion-reduce:transition-none',
                      active ? 'scale-100' : 'scale-0',
                    ].join(' ')}
                  />
                </span>
                {/*
                  The mark is decorative: the label beneath it already names the method,
                  and a screen reader announcing "Cash App logo, Cash App" is noise.
                */}
                <PaymentMark method={m} className="h-10 md:h-8" />
                <span className="text-sm leading-tight font-medium text-foreground">{PAYMENT_LABELS[m]}</span>
                {off > 0 && (
                  <span className="tabular absolute top-2 right-2 rounded-full bg-accent px-2 py-0.5 text-[11px] leading-4 font-semibold text-on-accent">
                    {off}% off
                  </span>
                )}
              </label>
            )
          })}
        </div>
        {errors.paymentMethod && (
          <p role="alert" className="mt-2 text-sm text-danger-fg">{errors.paymentMethod}</p>
        )}

        {/*
          Quoted the moment Bitcoin is picked, not after submission. `aria-live` because
          the total changes without the customer having moved focus anywhere near it.
        */}
        {discountCents > 0 && (
          <p
            aria-live="polite"
            className="mt-3 rounded-lg bg-success-bg px-4 py-3 text-sm font-medium text-success-fg"
          >
            {discountPercent(method)}% Bitcoin discount applied — {formatCents(discountCents)} off
            your items{appliedCents > 0 ? ', after your code' : ''}. Confirmed on the invoice we
            send you.
          </p>
        )}
      </fieldset>

      {/*
        ── Collapsed by default, and that is the design rather than a compromise ──
        A visible coupon box tells every customer that a discount exists which they do
        not have. The well-documented result is that some of them leave to go looking
        for one and do not come back. Behind a disclosure, the customer who has a code
        finds the box in one click and the customer who does not never learns there
        was one to miss.

        It also keeps checkout inside its field budget. And `<details>` opens with no
        JavaScript, so a customer on a slow connection can still enter a code — the
        server validates it on submit regardless of whether Apply was ever pressed.

        Open automatically when the server has an error for it, so a refused code is
        never hidden behind a closed disclosure.
      */}
      <details
        className="group/code rounded-lg border border-border"
        {...(errors.couponCode || coupon ? { open: true } : {})}
      >
        <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 px-4 text-sm text-foreground [&::-webkit-details-marker]:hidden">
          <span>Have a discount code?</span>
          <span
            aria-hidden
            className="text-foreground-subtle transition-transform group-open/code:rotate-45 motion-reduce:transition-none"
          >
            +
          </span>
        </summary>

        <div className="border-t border-border px-4 pt-3 pb-4">
          <label htmlFor="couponCode" className="text-sm text-foreground">
            Code
          </label>
          <div className="mt-1 flex gap-2">
            <input
              id="couponCode"
              name="couponCode"
              value={codeInput}
              onChange={(event) => {
                setCodeInput(event.target.value)
                setCoupon(null)
              }}
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              maxLength={40}
              aria-invalid={Boolean(errors.couponCode || (coupon && !coupon.ok))}
              aria-describedby="couponCode-status"
              className={`${inputClass} uppercase`}
            />
            <Button
              type="button"
              variant="secondary"
              size="md"
              loading={applying}
              disabled={codeInput.trim() === ''}
              onClick={() =>
                startApplying(async () => {
                  setCoupon(await previewCoupon(codeInput))
                })
              }
            >
              Apply
            </Button>
          </div>

          <p id="couponCode-status" aria-live="polite" className="mt-2 text-sm">
            {coupon?.ok ? (
              <span className="text-success-fg">
                {coupon.code} applied — {formatCents(coupon.discountCents)} off your items.
              </span>
            ) : coupon && !coupon.ok ? (
              <span className="text-danger-fg">{coupon.error}</span>
            ) : errors.couponCode ? (
              <span className="text-danger-fg">{errors.couponCode}</span>
            ) : (
              <span className="text-foreground-muted">
                Codes apply to items, not shipping, and not to vapor products.
              </span>
            )}
          </p>
        </div>
      </details>

      {requiresIntendedUse && (
        <fieldset className="rounded-lg border border-border bg-surface-sunken p-4">
          <legend className="sr-only">Intended use</legend>
          {/*
            The only attestation left, and the only one that was ever specific to what
            is in the cart. Age is established by the gate before the site is browsable,
            so re-asking it here recorded nothing the journey did not already have.
          */}
          <label className="flex cursor-pointer gap-3 text-sm text-foreground">
            <input
              type="checkbox"
              name="intendedUseConfirmed"
              required
              className="mt-1 size-4 shrink-0 accent-[var(--primary)]"
            />
            <span>{INTENDED_USE_ATTESTATION}</span>
          </label>
          {errors.intendedUseConfirmed && (
            <p role="alert" className="mt-2 text-sm text-danger-fg">{errors.intendedUseConfirmed}</p>
          )}
        </fieldset>
      )}

      {/*
        EVERY LINE OF THE SUM, right above the button that commits to it: the goods,
        each discount taken off them in the order the invoice takes them, shipping,
        and the total. Through the same formula the server stores the order with.
      */}
      <section aria-labelledby="checkout-total" className="rounded-xl border border-border bg-surface p-4 sm:p-5">
        <h2 id="checkout-total" className="font-display text-lg text-foreground">
          Your total
        </h2>
        <dl className="mt-3 space-y-1.5 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-foreground-muted">Items</dt>
            <dd className="tabular text-foreground">{formatCents(preview.subtotalCents)}</dd>
          </div>
          {preview.couponDiscountCents > 0 ? (
            <div className="flex justify-between gap-4">
              <dt className="text-foreground-muted">Code {coupon?.ok ? coupon.code : ''}</dt>
              <dd className="tabular text-success-fg">−{formatCents(preview.couponDiscountCents)}</dd>
            </div>
          ) : null}
          {preview.subscriberDiscountCents > 0 ? (
            <div className="flex justify-between gap-4">
              <dt className="text-foreground-muted">Subscriber discount ({SUBSCRIBER_DISCOUNT_PERCENT}%)</dt>
              <dd className="tabular text-success-fg">−{formatCents(preview.subscriberDiscountCents)}</dd>
            </div>
          ) : null}
          {preview.appDiscountCents > 0 ? (
            <div className="flex justify-between gap-4">
              <dt className="text-foreground-muted">App discount ({APP_DISCOUNT_PERCENT}%)</dt>
              <dd className="tabular text-success-fg">−{formatCents(preview.appDiscountCents)}</dd>
            </div>
          ) : null}
          {preview.paymentDiscountCents > 0 ? (
            <div className="flex justify-between gap-4">
              <dt className="text-foreground-muted">Bitcoin discount ({discountPercent(method)}%)</dt>
              <dd className="tabular text-success-fg">−{formatCents(preview.paymentDiscountCents)}</dd>
            </div>
          ) : null}
          {anyDiscount ? (
            <div className="flex justify-between gap-4 border-t border-dashed border-border pt-1.5">
              <dt className="text-foreground-muted">Items after discounts</dt>
              <dd className="tabular text-foreground">
                {formatCents(
                  preview.subtotalCents -
                    preview.couponDiscountCents -
                    preview.subscriberDiscountCents -
                    preview.appDiscountCents -
                    preview.paymentDiscountCents,
                )}
              </dd>
            </div>
          ) : null}
          <div className="flex justify-between gap-4">
            <dt className="text-foreground-muted">Shipping</dt>
            <dd className="tabular text-foreground">
              {shippingCents === null ? 'Added for your state' : shippingCents === 0 ? 'Free' : `+${formatCents(shippingCents)}`}
            </dd>
          </div>
          <div className="flex justify-between gap-4 border-t border-border pt-2 text-base font-semibold">
            <dt className="text-foreground">Total</dt>
            <dd aria-live="polite" className="tabular font-product text-foreground">
              {formatCents(preview.totalCents)}
              {shippingCents === null ? <span className="text-sm font-normal text-foreground-muted"> + shipping</span> : null}
            </dd>
          </div>
        </dl>
        {preview.subtotalCents > eligibleSubtotalCents && anyDiscount ? (
          <p className="mt-2 text-xs text-foreground-muted">Discounts come off items, not shipping, and not vapor products.</p>
        ) : null}
        {canGetApp ? (
          <p className="mt-3 rounded-lg bg-accent-muted px-3 py-2.5 text-xs leading-relaxed text-foreground">
            <strong className="font-semibold">Another {APP_DISCOUNT_PERCENT}% off</strong> when you place your first order from
            the {BRAND.name} app.{' '}
            <button type="button" onClick={openInstallGuide} className="cursor-pointer font-semibold text-accent-fg underline underline-offset-4">
              Get the app
            </button>
          </p>
        ) : null}
        <p className="mt-2 text-xs text-foreground-muted">We confirm every figure on the invoice we send you.</p>
      </section>

      <Button type="submit" variant="accent" size="lg" fullWidth loading={pending}>
        {pending ? 'Submitting your order' : 'Submit order request'}
      </Button>
    </form>
  )
}
