import { readCart } from '@/lib/cart/storage'
import { resolveCartLive } from '@/lib/catalog/live-cart'
import { getVisitorState } from '@/lib/geo/visitor-state'
import { jurisdictionName } from '@/lib/compliance/jurisdictions'
import { FreeShippingBar } from '@/components/commerce/free-shipping-bar'
import { CartLineRow } from '@/components/commerce/cart-line-row'
import { Button, ButtonLink } from '@/components/ui/button'
import { AlertIcon, CrossIcon, TruckIcon } from '@/components/ui/icon'
import { url } from '@/lib/seo/routes'
import { formatCents } from '@/lib/utils'

const CHANNEL_TITLE: Record<string, string> = {
  PARCEL: 'Shipment 1 — standard parcel',
  PACT_CARRIER: 'Shipment 2 — age-restricted carrier',
  LOCAL_COURIER: 'Shipment — local delivery',
}

export async function CartContents() {
  const stateCode = await getVisitorState()
  const cart = await resolveCartLive(await readCart(), stateCode)

  if (cart.lines.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-surface p-10 text-center">
        <p className="font-display text-xl text-foreground">Your cart is empty</p>
        <p className="mt-2 text-sm text-foreground-muted">
          Everything we sell is batch-tested, and we will tell you what ships to your
          state before you add it.
        </p>
        <ButtonLink href={url.shop()} variant="primary" className="mt-6">
          Browse the shop
        </ButtonLink>
      </div>
    )
  }

  const { compliance } = cart

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_22rem]">
      <div className="space-y-6">
        {/* Blocked items surface HERE, not at checkout. */}
        {/* Neutral, not red — a blocked item is a fact about the law, not an error. */}
        {compliance.blocked.length > 0 && (
          <section className="rounded-lg border border-border bg-surface-sunken p-4 text-foreground">
            <div className="flex gap-3">
              <CrossIcon className="mt-0.5 size-5" />
              <div>
                <h2 className="font-semibold">
                  {compliance.blocked.length === 1
                    ? 'One item cannot ship to your state'
                    : `${compliance.blocked.length} items cannot ship to your state`}
                </h2>
                <ul className="mt-2 space-y-2 text-sm">
                  {compliance.blocked.map(({ item, decision }) => (
                    <li key={item.id}>
                      <span className="font-medium">{item.name}</span> — {decision.reason}
                      {/*
                        Cite the authority here as well as on the PDP. A refusal that
                        names the statute reads as compliance; one that does not reads
                        as an arbitrary decision, and arbitrary decisions get argued
                        with in support tickets.
                      */}
                      {decision.rule.statuteCitation && (
                        <span className="mt-0.5 block text-xs opacity-80">
                          Authority: {decision.rule.statuteCitation}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
                <p className="mt-3 text-sm opacity-90">
                  Remove them below to continue. We cannot ship them, and we will not
                  take an order we cannot fulfil.
                </p>
              </div>
            </div>
          </section>
        )}

        {compliance.restricted.length > 0 && (
          <section className="rounded-lg border border-transparent bg-warning-bg p-4 text-warning-fg">
            <div className="flex gap-3">
              <AlertIcon className="mt-0.5 size-5" />
              <div>
                <h2 className="font-semibold">Conditions apply to some items</h2>
                <ul className="mt-2 space-y-2 text-sm">
                  {compliance.restricted.map(({ item, decision }) => (
                    <li key={item.id}>
                      <span className="font-medium">{item.name}</span> — {decision.reason}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </section>
        )}

        {/*
          One card per fulfillment channel. A cart with gummies and a vape genuinely
          IS two shipments — different carrier, different cost, different promise —
          and showing that here rather than at checkout is the whole point.
        */}
        {compliance.shipmentGroups.length === 0 ? (
          <div className="space-y-3">
            {cart.lines.map((l) => (
              <CartLineRow key={`${l.product.slug}-${l.variant.id}`} line={l} />
            ))}
          </div>
        ) : (
          compliance.shipmentGroups.map((group, index) => {
            const quote = cart.quotes.find((q) => q.channel === group.channel)
            const groupLines = cart.lines.filter(
              (l) => l.product.fulfillmentChannel === group.channel,
            )
            return (
              <section
                key={group.channel}
                className="rounded-lg border border-border bg-surface p-4"
              >
                <header className="flex flex-wrap items-center gap-2 border-b border-border pb-3">
                  <TruckIcon className="size-5 text-foreground-muted" />
                  <h2 className="font-medium text-foreground">
                    {compliance.shipmentGroups.length > 1
                      ? CHANNEL_TITLE[group.channel] ?? group.channel
                      : 'Your shipment'}
                  </h2>
                  {quote && (
                    <span className="ml-auto tabular text-sm text-foreground-muted">
                      {/* Delivery window comes with the order, not the cart. */}
                      {quote.isFree ? 'Free' : formatCents(quote.costCents)}
                    </span>
                  )}
                </header>

                <div className="mt-3 space-y-3">
                  {groupLines.map((l) => (
                    <CartLineRow key={`${l.product.slug}-${l.variant.id}`} line={l} />
                  ))}
                </div>

                {quote?.note && (
                  <p className="mt-3 border-t border-border pt-3 text-xs leading-relaxed text-foreground-muted">
                    {quote.note}
                  </p>
                )}
                {index === 0 && compliance.shipmentGroups.length > 1 && (
                  <p className="mt-3 text-xs text-foreground-muted">
                    Your order arrives in separate shipments because these products are
                    carried under different rules. You are only charged shipping once
                    per shipment.
                  </p>
                )}
              </section>
            )
          })
        )}
      </div>

      <aside className="space-y-4 lg:sticky lg:top-6 lg:self-start">
        <div className="rounded-lg border border-border bg-surface p-4">
          <h2 className="font-display text-xl text-foreground">Summary</h2>

          <div className="mt-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-foreground-muted">Subtotal</span>
              <span className="tabular font-medium text-foreground">
                {formatCents(cart.subtotalCents)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-foreground-muted">Shipping</span>
              <span className="tabular font-medium text-foreground">
                {stateCode ? formatCents(cart.shippingTotalCents) : '—'}
              </span>
            </div>
            <div className="flex justify-between border-t border-border pt-2 text-base">
              <span className="font-medium text-foreground">Total</span>
              <span className="tabular font-semibold text-foreground">
                {stateCode ? formatCents(cart.totalCents) : '—'}
              </span>
            </div>
          </div>

          {!stateCode && (
            <div className="mt-4 rounded-md bg-surface-sunken p-3">
              <p className="text-sm text-foreground-muted">
                Shipping and availability are confirmed against the address you give on
                the next step. Anything we cannot lawfully send there is refused before
                the request is accepted.
              </p>
            </div>
          )}

          {stateCode && (
            <p className="mt-3 text-xs text-foreground-muted">
              Shipping to {jurisdictionName(stateCode)}.{' '}
              <a href={url.cart()} className="underline underline-offset-4">Change</a>
            </p>
          )}

          {compliance.canProceed ? (
            <ButtonLink href={url.checkout()} variant="accent" size="lg" fullWidth className="mt-5">
              Continue to checkout
            </ButtonLink>
          ) : (
            <Button variant="accent" size="lg" fullWidth className="mt-5" disabled>
              {compliance.blocked.length > 0
                ? 'Remove blocked items to continue'
                : 'Choose your state to continue'}
            </Button>
          )}

          <p className="mt-3 text-xs leading-relaxed text-foreground-subtle">
            No payment is taken on this site. You choose how you would like to pay, we check
            the stock and that we can ship to your address, and we contact you with instructions.
          </p>
        </div>

        <FreeShippingBar groups={compliance.shipmentGroups} />
      </aside>
    </div>
  )
}
