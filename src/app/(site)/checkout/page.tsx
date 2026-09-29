import type { Metadata } from 'next'
import { PageSection } from '@/components/layout/page-section'
import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { resolveCartLive } from '@/lib/catalog/live-cart'
import { readCart } from '@/lib/cart/storage'
import { getVisitorState } from '@/lib/geo/visitor-state'
import Image from 'next/image'
import { CheckoutForm } from '@/components/commerce/checkout-form'
import { displayImageFor } from '@/lib/catalog/sample-images'
import { PAYMENT_SECURITY_STATEMENT } from '@/lib/compliance/disclaimers'
import { ShieldIcon } from '@/components/ui/icon'
import { url } from '@/lib/seo/routes'
import { formatCents } from '@/lib/utils'
import { eligibleSubtotalCents } from '@/lib/orders/coupons'
import { checkoutWelcome } from '@/lib/orders/welcome'
import { trackCart } from '@/lib/cart/track'

export const metadata: Metadata = {
  title: 'Checkout',
  robots: { index: false, follow: false },
}

async function CheckoutBody() {
  const stateCode = await getVisitorState()
  const cart = await resolveCartLive(await readCart(), stateCode)

  if (cart.lines.length === 0) redirect(url.cart())
  // Checkout opened with something in the cart: a step in the Carts funnel.
  await trackCart('CHECKOUT_STARTED', { cart: await readCart(), stateCode: stateCode ?? null })

  const requiresIntendedUse = cart.lines.some((l) => l.product.notForHumanConsumption)
  // What this browser has earned: the 10% for subscribing, the 5% for the app.
  const welcome = await checkoutWelcome()

  return (
    /*
      BOUNDED AND CENTRED, and this is the one page on the site where that is
      right.

      The form column was `1fr`, which on a 1920px display made every field
      roughly 700px wide — a postcode input the width of a paragraph. Capping it
      fixed that but left a 700px hole between the form and the summary, which is
      worse: dead space in the middle of a layout reads as something failing to
      load, where dead space at the edges reads as a margin.

      Elsewhere on this site width is worth filling, because the shop and the
      legality tables are things you scan. Checkout is not scanned. It is one
      task, done once, and every pixel between the label and the box it belongs
      to is a pixel the eye has to travel.
    */
    <div className="mx-auto grid w-full max-w-6xl gap-10 lg:grid-cols-[minmax(0,1fr)_22rem] xl:gap-14">
      <div>
        <CheckoutForm
          {...(stateCode ? { defaultStateCode: stateCode } : {})}
          requiresIntendedUse={requiresIntendedUse}
          subtotalCents={cart.subtotalCents}
          eligibleSubtotalCents={eligibleSubtotalCents(
            cart.lines.map((l) => ({ lineTotalCents: l.lineTotalCents, fulfillmentChannel: l.product.fulfillmentChannel })),
          )}
          shippingCents={stateCode ? cart.shippingTotalCents : null}
          welcome={welcome}
        />
      </div>

      <aside className="lg:sticky lg:top-6 lg:self-start">
        <div className="overflow-hidden rounded-xl border border-border bg-surface">
          <h2 className="border-b border-border px-4 py-3 font-display text-lg text-foreground">
            What you are ordering
          </h2>

          {/*
            THE LINES, IN FULL.

            This was a name and a total. At the moment someone is about to hand
            over an address and an age attestation, "1× Mimosa Hostilis Root Bark
            Powder — $45" does not tell them which of five weights is in the box.
            Every line now carries the photograph, the size, the unit price and
            the quantity, so the last thing checked before submitting is the
            thing actually being bought.
          */}
          <ul className="divide-y divide-border">
            {cart.lines.map((l) => {
              const image = displayImageFor(l.product)
              const discounted = l.unitPriceCents !== l.baseUnitPriceCents
              return (
                <li key={`${l.product.slug}-${l.variant.id}`} className="flex gap-3 p-4">
                  <div className="relative size-16 shrink-0 overflow-hidden rounded-md bg-surface-sunken">
                    {image && (
                      <Image
                        src={image.src}
                        alt=""
                        aria-hidden
                        fill
                        sizes="64px"
                        className="object-cover"
                      />
                    )}
                    {image?.isSample && (
                      <span className="absolute inset-x-0 bottom-0 bg-stone-950/70 py-px text-center text-[8px] font-medium tracking-wide text-white uppercase">
                        Sample
                      </span>
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="font-product text-sm leading-snug font-medium text-foreground">
                      {l.product.name}
                    </p>
                    <p className="tabular mt-1 text-xs text-foreground-muted">
                      {/* The variant is the SIZE. Naming it is the whole point. */}
                      {l.variant.name !== 'Default' && l.variant.name !== 'Single unit' && (
                        <>
                          {l.variant.name}
                          <span aria-hidden> · </span>
                        </>
                      )}
                      {l.line.quantity} × {formatCents(l.unitPriceCents)}
                      {discounted && (
                        <>
                          {' '}
                          <span className="text-success-fg">
                            ({l.bulkTierLabel ?? 'bulk'} price)
                          </span>
                        </>
                      )}
                    </p>
                    {l.product.notForHumanConsumption && (
                      <p className="mt-1 text-xs text-foreground-subtle">
                        Botanical use only
                      </p>
                    )}
                  </div>

                  <p className="tabular font-product shrink-0 text-sm font-semibold text-foreground">
                    {formatCents(l.lineTotalCents)}
                  </p>
                </li>
              )
            })}
          </ul>

          <div className="space-y-1 border-t border-border px-4 py-3 text-sm">
            <div className="flex justify-between">
              <span className="text-foreground-muted">Subtotal</span>
              <span className="tabular text-foreground">{formatCents(cart.subtotalCents)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-foreground-muted">Shipping</span>
              <span className="tabular text-foreground">
                {stateCode ? formatCents(cart.shippingTotalCents) : 'Calculated at submit'}
              </span>
            </div>
            <div className="flex justify-between border-t border-border pt-2 text-base font-semibold">
            {/*
              The Bitcoin saving is NOT shown in this summary.

              It depends on a payment method chosen further down the form, and this
              panel renders on the server before that choice exists. Quoting a total
              here that changes when a radio is clicked is worse than quoting the
              undiscounted one — the discount is announced beside the method itself,
              and confirmed on the invoice.
            */}
              <span className="text-foreground">Before discounts</span>
              <span className="tabular font-product text-foreground">
                {stateCode ? formatCents(cart.totalCents) : '—'}
              </span>
            </div>
            <p className="pt-1 text-xs text-foreground-muted">
              Your discounts and final total are worked out line by line above the Submit button.
            </p>
          </div>

          {cart.compliance.shipmentGroups.length > 1 && (
            <p className="border-t border-border bg-surface-sunken px-4 py-3 text-xs leading-relaxed text-foreground-muted">
              This order ships in {cart.compliance.shipmentGroups.length} separate
              shipments because these products travel under different rules. You are
              charged one shipping figure per shipment, shown above.
            </p>
          )}
        </div>

        {/* Honest, and a genuine differentiator: it is literally true. */}
        <div className="mt-4 rounded-xl border border-border bg-surface-sunken p-4">
          <div className="flex gap-3">
            <ShieldIcon className="mt-0.5 size-5 shrink-0 text-primary" />
            <p className="text-xs leading-relaxed text-foreground-muted">
              {PAYMENT_SECURITY_STATEMENT}
            </p>
          </div>
        </div>
      </aside>
    </div>
  )
}

export default function CheckoutPage() {
  return (
    <main>
      {/* One band. Checkout is a single flow — a rule across the middle of a form reads as a step boundary that does not exist. */}
      <PageSection first>
      {/* The heading shares the content column, so the page reads as one thing. */}
      <div className="mx-auto w-full max-w-6xl">
        <h1 className="font-display text-4xl text-foreground">Checkout</h1>
        <p className="mt-2 text-foreground-muted">
          Eight fields and no card details. A person confirms your order, then sends payment details in your order chat.
        </p>
      </div>
      <div className="mt-8">
        <Suspense
          fallback={<div className="min-h-[70vh] animate-pulse rounded-lg bg-surface-sunken" aria-hidden />}
        >
          <CheckoutBody />
        </Suspense>
      </div>
      </PageSection>
    </main>
  )
}
