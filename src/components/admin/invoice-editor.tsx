'use client'

import { useActionState, useMemo, useState } from 'react'
import { editOrderInvoice, type InvoiceEditState } from '@/app/actions/admin-invoice'
import { Button } from '@/components/ui/button'
import { parseDollars } from '@/lib/orders/invoice-edit'
import { formatCents } from '@/lib/utils'

const INITIAL: InvoiceEditState = {}

const field = 'min-h-11 w-full rounded-md border border-border-strong bg-surface px-3 text-sm text-foreground'

export interface EditorLine {
  readonly id: string
  readonly name: string
  readonly variant: string
  readonly quantity: number
  readonly unitPriceCents: number
}

const dollars = (cents: number) => (cents / 100).toFixed(2)

/**
 * Edit an order's invoice before the customer pays: quantities, unit prices, shipping
 * and a discount, with the new total worked out as you type. Saving records who changed
 * what and why, and (by default) posts the new invoice into the customer's order chat.
 */
export function InvoiceEditor({
  orderNumber,
  lines,
  shippingCents,
  discountCents,
  /** Subscriber, app and Bitcoin discounts from checkout. Kept, and shown, not editable. */
  earnedDiscountCents,
}: {
  orderNumber: string
  lines: readonly EditorLine[]
  shippingCents: number
  discountCents: number
  earnedDiscountCents: number
}) {
  const [state, formAction, pending] = useActionState(editOrderInvoice, INITIAL)
  const [values, setValues] = useState(() =>
    Object.fromEntries(lines.map((l) => [l.id, { qty: String(l.quantity), price: dollars(l.unitPriceCents) }])),
  )
  const [shipping, setShipping] = useState(dollars(shippingCents))
  const [discount, setDiscount] = useState(dollars(discountCents))

  const preview = useMemo(() => {
    let subtotal = 0
    for (const l of lines) {
      const qty = Number(values[l.id]?.qty)
      const price = parseDollars(values[l.id]?.price ?? '')
      if (!Number.isInteger(qty) || qty < 0 || price === null) return null
      subtotal += qty * price
    }
    const ship = parseDollars(shipping || '0')
    const off = parseDollars(discount || '0')
    if (ship === null || off === null) return null
    return { subtotal, total: subtotal + ship - off - earnedDiscountCents }
  }, [values, shipping, discount, lines, earnedDiscountCents])

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="orderNumber" value={orderNumber} />

      <ul className="divide-y divide-border">
        {lines.map((l) => (
          <li key={l.id} className="grid gap-2 py-3 first:pt-0 md:grid-cols-[minmax(0,1fr)_6rem_8rem] md:items-end">
            <div className="min-w-0">
              <p className="font-medium text-foreground">{l.name}</p>
              <p className="text-xs text-foreground-muted">{l.variant}</p>
            </div>
            <label className="text-xs text-foreground-muted">
              Quantity
              <input
                name={`qty:${l.id}`}
                type="text"
                inputMode="numeric"
                value={values[l.id]?.qty ?? ''}
                onChange={(e) => setValues((v) => ({ ...v, [l.id]: { ...v[l.id]!, qty: e.target.value } }))}
                className={`${field} mt-1 tabular`}
              />
            </label>
            <label className="text-xs text-foreground-muted">
              Unit price ($)
              <input
                name={`price:${l.id}`}
                type="text"
                inputMode="decimal"
                value={values[l.id]?.price ?? ''}
                onChange={(e) => setValues((v) => ({ ...v, [l.id]: { ...v[l.id]!, price: e.target.value } }))}
                className={`${field} mt-1 tabular`}
              />
            </label>
          </li>
        ))}
      </ul>
      <p className="text-xs text-foreground-muted">Set a quantity to 0 to take that item off the invoice.</p>

      <div className="grid gap-3 md:grid-cols-2">
        <label className="text-sm text-foreground">
          Shipping ($)
          <input name="shipping" type="text" inputMode="decimal" value={shipping} onChange={(e) => setShipping(e.target.value)} className={`${field} mt-1 tabular`} />
        </label>
        <label className="text-sm text-foreground">
          Discount ($)
          <input name="discount" type="text" inputMode="decimal" value={discount} onChange={(e) => setDiscount(e.target.value)} className={`${field} mt-1 tabular`} />
        </label>
      </div>

      <div className="rounded-md bg-surface-sunken px-4 py-3 text-sm">
        {preview ? (
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <span className="text-foreground-muted">
              Subtotal <span className="tabular text-foreground">{formatCents(preview.subtotal)}</span>
              {earnedDiscountCents > 0 ? (
                <> · checkout discounts kept <span className="tabular text-foreground">{formatCents(earnedDiscountCents)}</span></>
              ) : null}
            </span>
            <span className={preview.total < 0 ? 'font-medium text-danger-fg' : 'font-medium text-foreground'}>
              New total <span className="tabular">{formatCents(Math.max(0, preview.total))}</span>
            </span>
          </div>
        ) : (
          <span className="text-warning-fg">Check the amounts: each must be a number, like 12.50.</span>
        )}
      </div>

      <label className="block text-sm text-foreground">
        Why it changed
        <textarea
          name="reason"
          rows={2}
          required
          minLength={3}
          maxLength={300}
          placeholder="For example: price agreed for 3 lb in chat."
          className="mt-1 w-full rounded-md border border-border-strong bg-surface p-3 text-sm text-foreground"
        />
      </label>
      <p className="-mt-2 text-xs text-foreground-muted">The customer sees this line with the new invoice.</p>

      <label className="flex min-h-11 items-center gap-3 text-sm text-foreground">
        <input type="checkbox" name="send" defaultChecked className="size-4 accent-[var(--primary)]" />
        Send the updated invoice to the customer&rsquo;s chat
      </label>

      {state.error ? (
        <p role="alert" className="text-sm text-danger-fg">
          {state.error}
        </p>
      ) : null}
      {state.ok ? (
        <p role="status" className="text-sm text-success-fg">
          {state.ok}
        </p>
      ) : null}

      <Button type="submit" variant="secondary" size="sm" loading={pending} disabled={!preview || preview.total < 0}>
        Save invoice
      </Button>
    </form>
  )
}
