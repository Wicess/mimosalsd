import { readCart } from '@/lib/cart/storage'
import { resolveCartLive } from '@/lib/catalog/live-cart'
import { getVisitorState } from '@/lib/geo/visitor-state'
import { CartLineRow } from '@/components/commerce/cart-line-row'
import { FreeShippingBar } from '@/components/commerce/free-shipping-bar'
import { ButtonLink } from '@/components/ui/button'
import { CrossIcon } from '@/components/ui/icon'
import { url } from '@/lib/seo/routes'
import { formatCents } from '@/lib/utils'

/**
 * Cart contents for the slide-over.
 *
 * A Server Component, so the cart cookie and the shipping-eligibility check never
 * reach the client. It renders inside a Suspense boundary in the site layout — a
 * `cookies()` call reached from the layout body would opt every storefront route out
 * of prerendering, which is the same trap the product page hit.
 *
 * Blocked items are surfaced HERE rather than at checkout, and the refusal names the
 * statute, for the reason the cart page already documents: a refusal that cites an
 * authority reads as compliance, one that does not gets argued with in support.
 */
export async function CartDrawerContents() {
  const stateCode = await getVisitorState()
  const cart = await resolveCartLive(await readCart(), stateCode)

  if (cart.lines.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center text-center">
        <p className="font-display text-xl text-foreground">Your cart is empty</p>
        <p className="mt-2 max-w-xs text-sm leading-relaxed text-foreground-muted">
          Everything we sell is batch-tested, and we tell you what ships to your state
          before you add it.
        </p>
        <ButtonLink href={url.shop()} variant="primary" className="mt-6">
          Browse the shop
        </ButtonLink>
      </div>
    )
  }

  const { compliance } = cart

  return (
    <div className="flex min-h-full flex-col">
      {compliance.blocked.length > 0 && (
        <section className="mb-4 rounded-lg border border-border bg-surface-sunken p-4 text-foreground">
          <div className="flex gap-3">
            <CrossIcon className="mt-0.5 size-5 shrink-0" />
            <div>
              <h3 className="font-semibold">
                {compliance.blocked.length === 1
                  ? 'One item cannot ship to your state'
                  : `${compliance.blocked.length} items cannot ship to your state`}
              </h3>
              <ul className="mt-2 space-y-2 text-sm">
                {compliance.blocked.map(({ item, decision }) => (
                  <li key={item.id}>
                    <span className="font-medium">{item.name}</span> — {decision.reason}
                    {decision.rule.statuteCitation && (
                      <span className="mt-0.5 block text-xs opacity-80">
                        Authority: {decision.rule.statuteCitation}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>
      )}

      <ul className="space-y-5">
        {cart.lines.map((line) => (
          <li key={`${line.product.slug}-${line.variant.id}`}>
            <CartLineRow line={line} />
          </li>
        ))}
      </ul>

      {/* Sticks to the bottom of the panel so the total and CTA are always reachable. */}
      <div className="sticky bottom-0 mt-auto -mx-5 border-t border-border bg-surface px-5 pt-4">
        <FreeShippingBar groups={compliance.shipmentGroups} />

        <dl className="mt-3 flex items-baseline justify-between">
          <dt className="text-sm text-foreground-muted">Subtotal</dt>
          <dd className="tabular font-product text-xl font-semibold text-foreground">
            {formatCents(cart.subtotalCents)}
          </dd>
        </dl>
        <p className="mt-1 text-xs leading-relaxed text-foreground-subtle">
          Shipping is confirmed with your order. Payment details
          follow in your order chat.
        </p>

        {compliance.blocked.length > 0 ? (
          <p className="mt-4 rounded-md bg-surface-sunken px-4 py-3 text-center text-sm font-medium text-foreground-muted">
            Remove the blocked items to continue
          </p>
        ) : (
          <ButtonLink
            href={url.checkout()}
            variant="accent"
            size="lg"
            fullWidth
            className="mt-4"
          >
            Continue to order request
          </ButtonLink>
        )}
      </div>
    </div>
  )
}

/** Reserves the panel's shape while the cart streams in. */
export function CartDrawerSkeleton() {
  return (
    <div className="animate-pulse space-y-5" aria-hidden>
      <div className="h-20 rounded-lg bg-surface-sunken" />
      <div className="h-20 rounded-lg bg-surface-sunken" />
      <div className="h-12 rounded-md bg-surface-sunken" />
    </div>
  )
}
