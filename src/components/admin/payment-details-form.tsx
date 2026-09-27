'use client'

import { useActionState, useMemo, useState } from 'react'
import { sendPaymentDetails, type SendPaymentDetailsState } from '@/app/actions/issue-payment'
import { Button } from '@/components/ui/button'
import { PAYMENT_LABELS, type PaymentMethod } from '@/lib/orders/types'
import {
  buildPaymentInstructions,
  normalizeAppleCashRecipient,
  normalizeCashtag,
  normalizeChimeSign,
} from '@/lib/payments/instructions'
import { cn } from '@/lib/utils'

const INITIAL: SendPaymentDetailsState = {}

const FIELD =
  'mt-1 block min-h-12 w-full rounded-lg border bg-surface px-3.5 text-base text-foreground placeholder:text-foreground-subtle focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring/40'

const PAY_TO_LABEL: Record<PaymentMethod, { label: string; placeholder: string; hint: string }> = {
  CASHAPP: { label: '$Cashtag', placeholder: '$YourCashtag', hint: 'The Cash App account the customer pays.' },
  CHIME: { label: '$ChimeSign', placeholder: '$YourChimeSign', hint: 'The Chime account the customer pays with Pay Anyone.' },
  APPLE_CASH: { label: 'Apple Cash phone number or email', placeholder: '(512) 555-0134', hint: 'The number or Apple Account email that receives Apple Cash.' },
  BITCOIN: { label: 'Bitcoin address', placeholder: 'bc1q…', hint: 'Paste it from your wallet. The checksum is verified before anything is sent.' },
}

export interface PaymentFormOrder {
  readonly orderNumber: string
  readonly totalCents: number
  readonly method: PaymentMethod
  readonly payBy: string
  readonly email: string
  readonly hasChat: boolean
  readonly reissue: boolean
}

/**
 * The owner's payment-details form, opened from the new-order notification on a
 * phone. One screen, thumb-sized fields, pre-filled wherever the shop already knows
 * the answer, and a live preview of exactly what the customer will be told, so the
 * details are checked before they are sent rather than after.
 */
export function PaymentDetailsForm({
  order,
  suggestions,
  btcQuote,
}: {
  order: PaymentFormOrder
  /** Pre-fill per method: the handle already issued to this order, else the pool's pick. */
  suggestions: Partial<Record<PaymentMethod, { payTo: string; payToName?: string }>>
  btcQuote: { amount: string; rateUsd: number; source: string; at: string } | null
}) {
  const [state, action, pending] = useActionState(sendPaymentDetails, INITIAL)
  const [method, setMethod] = useState<PaymentMethod>(order.method)
  const [payTo, setPayTo] = useState(suggestions[order.method]?.payTo ?? '')
  const [payToName, setPayToName] = useState(suggestions[order.method]?.payToName ?? '')
  const [btcAmount, setBtcAmount] = useState(btcQuote?.amount ?? '')
  const [quoteMinutes, setQuoteMinutes] = useState('60')

  const bitcoinOrder = order.method === 'BITCOIN'

  function chooseMethod(next: PaymentMethod) {
    setMethod(next)
    setPayTo(suggestions[next]?.payTo ?? '')
    setPayToName(suggestions[next]?.payToName ?? '')
  }

  /*
    What the customer will actually be sent: "MIMOSALSD" becomes "$MIMOSALSD" and
    "512 555 0134" becomes "(512) 555-0134" on the server, so the preview applies
    the same rules instead of echoing the raw typing.
  */
  const checked = useMemo(() => {
    const raw = payTo.trim()
    if (!raw || method === 'BITCOIN') return { value: raw, error: null as string | null }
    const result =
      method === 'CASHAPP' ? normalizeCashtag(raw) : method === 'CHIME' ? normalizeChimeSign(raw) : normalizeAppleCashRecipient(raw)
    return result.ok ? { value: result.value, error: null } : { value: raw, error: result.error }
  }, [payTo, method])

  const preview = useMemo(() => {
    if (!checked.value || checked.error || (method === 'BITCOIN' && !btcAmount.trim())) return null
    return buildPaymentInstructions({
      method,
      payTo: checked.value,
      payToName: payToName.trim() || undefined,
      amountCents: order.totalCents,
      btcAmount: btcAmount.trim() || undefined,
      btcRateUsd: btcQuote?.rateUsd,
      // A preview, counted from when the price was fetched; the real deadline is set when it is sent.
      btcQuoteUntil:
        method === 'BITCOIN' && btcQuote
          ? new Date(new Date(btcQuote.at).getTime() + Number(quoteMinutes) * 60_000).toISOString()
          : undefined,
      orderId: order.orderNumber,
      payBy: order.payBy,
    })
  }, [method, checked, payToName, btcAmount, quoteMinutes, btcQuote, order])

  if (state.sent) {
    const ok = (good: boolean) => (good ? 'border-success-fg/30 bg-success-bg text-success-fg' : 'border-danger-fg/30 bg-danger-bg text-danger-fg')
    return (
      <div role="status" className="space-y-4 rounded-xl border border-border bg-surface p-5">
        <p className="font-display text-xl text-foreground">
          {state.sent.reissued ? 'Payment details sent again' : 'Order verified and payment details sent'}
        </p>
        <p className="text-sm text-foreground-muted">{state.sent.headline}</p>
        <ul className="grid gap-2 text-sm">
          <li className={cn('rounded-lg border px-3 py-2', ok(state.sent.email === 'sent'))}>
            {state.sent.email === 'sent' ? `Emailed to ${order.email}` : 'Email failed. It has been reported; send the details to the customer another way.'}
          </li>
          <li className={cn('rounded-lg border px-3 py-2', ok(state.sent.chat === 'sent'))}>
            {state.sent.chat === 'sent'
              ? "Posted in the customer's chat"
              : state.sent.chat === 'no-chat'
                ? 'No chat on file for this order, so it went by email only'
                : 'Posting to chat failed. It has been reported.'}
          </li>
          <li className={cn('rounded-lg border px-3 py-2', ok(state.sent.invoiceAttached))}>
            {state.sent.invoiceAttached ? 'Invoice image attached' : 'The invoice image could not be drawn; the details went as text.'}
          </li>
        </ul>
        <dl className="grid gap-1 text-sm">
          {state.sent.summary.map((row) => (
            <div key={row.label} className="flex gap-3">
              <dt className="w-28 shrink-0 text-foreground-muted">{row.label}</dt>
              <dd className="min-w-0 font-medium break-all text-foreground">{row.value}</dd>
            </div>
          ))}
        </dl>
        <div className="flex flex-wrap gap-3">
          <a href={`/admin/orders/${order.orderNumber}`} className="inline-flex min-h-11 items-center rounded-md bg-primary px-4 text-sm font-medium text-on-primary">
            Back to the order
          </a>
          <a href={`/admin/orders/${order.orderNumber}/payment`} className="inline-flex min-h-11 items-center rounded-md border border-border-strong px-4 text-sm font-medium text-foreground">
            Send different details
          </a>
        </div>
      </div>
    )
  }

  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="orderNumber" value={order.orderNumber} />
      <input type="hidden" name="method" value={method} />
      {btcQuote && method === 'BITCOIN' ? <input type="hidden" name="btcRateUsd" value={btcQuote.rateUsd} /> : null}

      <fieldset>
        <legend className="text-sm font-medium text-foreground">Payment method</legend>
        <div className="mt-2 grid grid-cols-2 gap-2 md:grid-cols-4">
          {(['CASHAPP', 'CHIME', 'APPLE_CASH', 'BITCOIN'] as const).map((m) => {
            // Switching to or from Bitcoin would change the discounted total.
            const disabled = (m === 'BITCOIN') !== bitcoinOrder
            return (
              <button
                key={m}
                type="button"
                disabled={disabled}
                aria-pressed={method === m}
                onClick={() => chooseMethod(m)}
                className={cn(
                  'min-h-12 rounded-lg border px-3 text-sm font-medium transition-colors motion-reduce:transition-none',
                  method === m ? 'border-primary bg-primary text-on-primary' : 'border-border-strong bg-surface text-foreground',
                  disabled && 'cursor-not-allowed opacity-40',
                )}
              >
                {PAYMENT_LABELS[m]}
                {m === order.method ? <span className="block text-[11px] font-normal opacity-80">customer chose</span> : null}
              </button>
            )
          })}
        </div>
      </fieldset>

      <div>
        <label htmlFor="payTo" className="block text-sm font-medium text-foreground">
          {PAY_TO_LABEL[method].label}
        </label>
        <input
          id="payTo"
          name="payTo"
          required
          value={payTo}
          onChange={(e) => setPayTo(e.target.value)}
          placeholder={PAY_TO_LABEL[method].placeholder}
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          inputMode={method === 'APPLE_CASH' ? 'email' : 'text'}
          aria-invalid={state.field === 'payTo' || undefined}
          className={cn(FIELD, method === 'BITCOIN' && 'font-mono text-sm', state.field === 'payTo' ? 'border-danger-fg' : 'border-border-strong')}
        />
        {checked.error ? (
          <p className="mt-1 text-xs text-danger-fg">{checked.error}</p>
        ) : (
          <p className="mt-1 text-xs text-foreground-muted">{PAY_TO_LABEL[method].hint}</p>
        )}
      </div>

      {method !== 'BITCOIN' ? (
        <div>
          <label htmlFor="payToName" className="block text-sm font-medium text-foreground">
            Name on the account <span className="font-normal text-foreground-muted">(optional)</span>
          </label>
          <input
            id="payToName"
            name="payToName"
            value={payToName}
            onChange={(e) => setPayToName(e.target.value)}
            placeholder="Shown so the customer can check it matches"
            className={cn(FIELD, 'border-border-strong')}
          />
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label htmlFor="btcAmount" className="block text-sm font-medium text-foreground">
              Amount in BTC
            </label>
            <input
              id="btcAmount"
              name="btcAmount"
              required
              inputMode="decimal"
              value={btcAmount}
              onChange={(e) => setBtcAmount(e.target.value)}
              placeholder="0.00123456"
              aria-invalid={state.field === 'btcAmount' || undefined}
              className={cn(FIELD, 'font-mono', state.field === 'btcAmount' ? 'border-danger-fg' : 'border-border-strong')}
            />
            <p className="mt-1 text-xs text-foreground-muted">
              {btcQuote
                ? `Worked out at $${Math.round(btcQuote.rateUsd).toLocaleString('en-US')} per BTC (${btcQuote.source}), rounded up. Change it if you need to.`
                : 'The live price could not be fetched. Enter the BTC amount yourself.'}
            </p>
          </div>
          <div>
            <label htmlFor="btcQuoteMinutes" className="block text-sm font-medium text-foreground">
              Amount holds for
            </label>
            <select
              id="btcQuoteMinutes"
              name="btcQuoteMinutes"
              value={quoteMinutes}
              onChange={(e) => setQuoteMinutes(e.target.value)}
              className={cn(FIELD, 'border-border-strong')}
            >
              <option value="30">30 minutes</option>
              <option value="60">1 hour</option>
              <option value="120">2 hours</option>
              <option value="1440">24 hours</option>
            </select>
          </div>
        </div>
      )}

      {preview ? (
        <section aria-label="What the customer will receive" className="rounded-xl border border-border bg-surface-sunken p-4">
          <p className="text-xs font-medium tracking-wide text-foreground-subtle uppercase">The customer will receive</p>
          <p className="mt-2 font-medium text-foreground">{preview.headline}</p>
          <dl className="mt-2 grid gap-1 text-sm">
            {preview.summary.map((row) => (
              <div key={row.label} className="flex gap-3">
                <dt className="w-28 shrink-0 text-foreground-muted">{row.label}</dt>
                <dd className="min-w-0 font-medium break-all text-foreground">{row.value}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-2 text-xs text-foreground-muted">
            With the invoice image and the step-by-step {PAYMENT_LABELS[method]} instructions, by email to {order.email}
            {order.hasChat ? ' and in their chat on the site.' : '. (No chat on file for this order.)'}
          </p>
        </section>
      ) : null}

      {state.error ? (
        <p role="alert" className="rounded-lg border border-danger-fg/30 bg-danger-bg px-3 py-2 text-sm text-danger-fg">
          {state.error}
        </p>
      ) : null}

      <Button type="submit" variant="accent" size="lg" loading={pending} className="w-full md:w-auto">
        {order.reissue ? 'Send these details again' : 'Verify order and send payment details'}
      </Button>
    </form>
  )
}
