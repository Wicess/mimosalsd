import Image from 'next/image'
import { notFound } from 'next/navigation'
import { db } from '@/lib/db/client'
import { PrintButton } from '@/components/admin/print-button'
import { BRAND } from '@/lib/brand'
import { getCompanyEmail } from '@/lib/site/company-email.server'
import { jurisdictionName } from '@/lib/compliance/jurisdictions'
import type { UsJurisdictionCode } from '@/lib/compliance/types'
import { PAYMENT_LABELS, type PaymentMethod } from '@/lib/orders/types'
import { formatCents } from '@/lib/utils'
import { welcomeLines } from '@/lib/orders/welcome-lines'

export const metadata = { title: 'Invoice' }

/**
 * ─────────────────────────────────────────────────────────────────────────────
 *  INVOICE AND PACKING SLIPS — one page, printed, then put in a box.
 *
 *  ── Why one packing slip per CHANNEL, not per order ────────────────────────
 *  A cart holding gummies and a vape is two parcels: vapes are PACT-regulated and
 *  ship on a specialist carrier with an adult signature, everything else goes
 *  parcel (CLAUDE.md rule 2). The cart already splits on that boundary and so do
 *  the shipments — so a single packing slip listing every line would be wrong in
 *  the only way that matters, telling a packer to put items in a box they cannot
 *  legally travel in together.
 *
 *  Grouped by `fulfillmentChannel` from the ITEMS rather than by `Shipment` rows,
 *  because the slip is what you print in order to pack, and packing happens before
 *  a shipment record exists. Where shipments do exist the grouping agrees with them
 *  by construction: both derive from the same field.
 *
 *  ── Why the packing slip carries no prices ─────────────────────────────────
 *  Standard practice, and it has a specific reason here beyond gift orders: these
 *  parcels are handled by a third-party carrier under a regime that already
 *  attracts attention. A document inside the box should say what is in the box.
 *
 *  ── Why this is a page and not a PDF ───────────────────────────────────────
 *  A PDF means a renderer in the bundle, a font subset, and a serverless function
 *  with enough memory to run it — for something every operating system can already
 *  do from a print dialog. `@media print` gets the same result with no dependency,
 *  and it stays correct when the brand address changes because it is the same
 *  components as everything else.
 * ─────────────────────────────────────────────────────────────────────────────
 */

function stamp(date: Date | null | undefined): string {
  return date ? date.toISOString().slice(0, 10) : '—'
}

const CHANNEL_LABEL: Record<string, string> = {
  PARCEL: 'Standard parcel',
  PACT_CARRIER: 'PACT Act carrier',
  LOCAL_COURIER: 'Local courier',
}

/** The letterhead, repeated on every document so a loose page is still identifiable. */
function Letterhead({ document, reference, email }: { document: string; reference: string; email: string }) {
  return (
    <header className="flex flex-wrap items-start justify-between gap-4 border-b border-border pb-4">
      <div className="flex items-center gap-4">
        {/*
          The logo is dark green on transparent: right on paper, invisible on the dark
          admin screen. So it sits on a white tile on screen; print styles clear the
          tile, and it prints straight onto the white sheet.
        */}
        <span className="inline-flex shrink-0 rounded-md bg-white px-2.5 py-2 print:p-0">
          <Image src="/brand/logo.png" alt={BRAND.name} width={996} height={440} className="h-10 w-auto" priority />
        </span>
        <div>
          <p className="font-display text-xl text-foreground">{BRAND.legalName}</p>
          <p className="mt-1 text-xs text-foreground-muted">
            {BRAND.domain} · {email}
          </p>
        </div>
      </div>
      <div className="text-right">
        <p className="font-product text-sm font-semibold text-foreground">{document}</p>
        <p className="tabular mt-1 text-xs text-foreground-muted">{reference}</p>
      </div>
    </header>
  )
}

function AddressBlock({
  title,
  lines,
}: {
  title: string
  lines: readonly (string | null | undefined)[]
}) {
  return (
    <div>
      <p className="text-xs font-medium text-foreground-muted">{title}</p>
      <div className="mt-1 text-sm leading-relaxed text-foreground">
        {lines.filter(Boolean).map((line) => (
          <p key={line}>{line}</p>
        ))}
      </div>
    </div>
  )
}

async function Documents({ orderNumber }: { orderNumber: string }) {
  const email = await getCompanyEmail()
  const order = await db.order.findUnique({
    where: { orderNumber },
    include: {
      items: true,
      paymentRequest: true,
      attestations: true,
    },
  })

  if (!order) notFound()

  const shipTo = [
    `${order.firstName} ${order.lastName}`,
    order.addressLine1,
    order.addressLine2,
    `${order.city}, ${order.stateCode} ${order.postalCode}`,
    jurisdictionName(order.stateCode as UsJurisdictionCode),
  ]

  // Grouped in the order the channels first appear, so two printings of the same
  // order produce the same documents in the same sequence.
  const byChannel = new Map<string, typeof order.items>()
  for (const item of order.items) {
    const list = byChannel.get(item.fulfillmentChannel) ?? []
    list.push(item)
    byChannel.set(item.fulfillmentChannel, list)
  }

  /*
    Attestations are evidence, captured at checkout and stored with the order.
    Reprinting the intended-use one on the slip that travels with the goods is the
    point of collecting it: MHRB is lawful as a non-consumable botanical and the box
    should say so (CLAUDE.md rule 3).
  */
  const notForConsumption = order.items.some(
    (item) => item.productLine === 'MIMOSA_HOSTILIS',
  )

  return (
    <div className="space-y-10">
      {/* ── INVOICE ──────────────────────────────────────────────────────── */}
      <article className="print-document rounded-lg border border-border bg-surface p-6 print:rounded-none print:border-0 print:p-0">
        <Letterhead document="Invoice" reference={order.orderNumber} email={email} />

        <div className="mt-5 grid gap-6 md:grid-cols-2">
          <AddressBlock title="Billed to" lines={[order.email, ...shipTo]} />
          <div className="text-sm">
            <p className="text-xs font-medium text-foreground-muted">Details</p>
            <dl className="mt-1 space-y-1">
              <div className="flex justify-between gap-4">
                <dt className="text-foreground-muted">Order placed</dt>
                <dd className="tabular text-foreground">
                  {stamp(order.placedAt ?? order.createdAt)}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-foreground-muted">Payment method</dt>
                <dd className="text-foreground">
                  {order.preferredPaymentMethod
                    ? PAYMENT_LABELS[order.preferredPaymentMethod as PaymentMethod]
                    : '—'}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-foreground-muted">Payment received</dt>
                <dd className="tabular text-foreground">
                  {stamp(order.paidAt ?? order.paymentRequest?.verifiedAt)}
                </dd>
              </div>
            </dl>
          </div>
        </div>

        <table className="mt-6 w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs text-foreground-muted">
              <th className="py-2 font-medium">Item</th>
              <th className="py-2 text-right font-medium">Qty</th>
              <th className="py-2 text-right font-medium">Unit</th>
              <th className="py-2 text-right font-medium">Total</th>
            </tr>
          </thead>
          <tbody>
            {order.items.map((item) => (
              <tr key={item.id} className="border-b border-border">
                <td className="py-2 pr-4">
                  <span className="block text-foreground">{item.productName}</span>
                  <span className="block text-xs text-foreground-muted">
                    {item.variantName}
                  </span>
                </td>
                <td className="tabular py-2 text-right text-foreground">{item.quantity}</td>
                <td className="tabular py-2 text-right text-foreground-muted">
                  {formatCents(item.unitPriceCents)}
                </td>
                <td className="tabular py-2 text-right text-foreground">
                  {formatCents(item.lineTotalCents)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot className="text-sm">
            <tr>
              <td colSpan={3} className="py-1 pr-4 text-right text-foreground-muted">
                Subtotal
              </td>
              <td className="tabular py-1 text-right text-foreground">
                {formatCents(order.subtotalCents)}
              </td>
            </tr>
            {order.discountCents > 0 && (
              <tr>
                <td colSpan={3} className="py-1 pr-4 text-right text-foreground-muted">
                  Discount{order.couponCode ? ` (${order.couponCode})` : ''}
                </td>
                <td className="tabular py-1 text-right text-foreground">
                  −{formatCents(order.discountCents)}
                </td>
              </tr>
            )}
            {welcomeLines(order).map((line) => (
              <tr key={line.key}>
                <td colSpan={3} className="py-1 pr-4 text-right text-foreground-muted">
                  {line.label}
                </td>
                <td className="tabular py-1 text-right text-foreground">
                  −{formatCents(line.cents)}
                </td>
              </tr>
            ))}
            {order.paymentDiscountCents > 0 && (
              <tr>
                <td colSpan={3} className="py-1 pr-4 text-right text-foreground-muted">
                  {/* Frozen at order time so a rate change cannot rewrite an invoice. */}
                  Payment method discount
                </td>
                <td className="tabular py-1 text-right text-foreground">
                  −{formatCents(order.paymentDiscountCents)}
                </td>
              </tr>
            )}
            <tr>
              <td colSpan={3} className="py-1 pr-4 text-right text-foreground-muted">
                Shipping
              </td>
              <td className="tabular py-1 text-right text-foreground">
                {order.shippingCents === 0 ? 'Free' : formatCents(order.shippingCents)}
              </td>
            </tr>
            <tr className="border-t border-border">
              <td colSpan={3} className="py-2 pr-4 text-right font-medium text-foreground">
                Total
              </td>
              <td className="tabular py-2 text-right font-medium text-foreground">
                {formatCents(order.totalCents)}
              </td>
            </tr>
          </tfoot>
        </table>

        <p className="mt-6 text-xs leading-relaxed text-foreground-muted">
          {/*
            Not a tax invoice, and it does not claim to be. No tax is calculated or
            collected anywhere in this system, so a line reading "Tax $0.00" would be
            an assertion about someone's liability that nothing here has established.
          */}
          Payment is made off-site by the method chosen at checkout. This document
          records what was ordered and what was charged.
        </p>
      </article>

      {/* ── PACKING SLIPS, one per fulfilment channel ────────────────────── */}
      {[...byChannel.entries()].map(([channel, items]) => (
        <article
          key={channel}
          className="print-document rounded-lg border border-border bg-surface p-6 print:rounded-none print:border-0 print:p-0"
        >
          <Letterhead
            email={email}
            document="Packing slip"
            reference={`${order.orderNumber}${byChannel.size > 1 ? ` · ${channel}` : ''}`}
          />

          <div className="mt-5 grid gap-6 md:grid-cols-2">
            <AddressBlock title="Ship to" lines={shipTo} />
            <div>
              <p className="text-xs font-medium text-foreground-muted">Carrier</p>
              <p className="mt-1 text-sm leading-relaxed text-foreground">
                {CHANNEL_LABEL[channel] ?? channel}
              </p>
            </div>
          </div>

          <table className="mt-6 w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-foreground-muted">
                <th className="py-2 font-medium">Item</th>
                <th className="py-2 text-right font-medium">Qty</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className="border-b border-border">
                  <td className="py-2 pr-4">
                    <span className="block text-foreground">{item.productName}</span>
                    <span className="block text-xs text-foreground-muted">
                      {item.variantName}
                    </span>
                  </td>
                  <td className="tabular py-2 text-right text-foreground">
                    {item.quantity}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {notForConsumption &&
            items.some((item) => item.productLine === 'MIMOSA_HOSTILIS') && (
              <p className="mt-6 border border-border p-3 text-xs leading-relaxed text-foreground">
                <strong className="font-medium">
                  Mimosa Hostilis root bark is not for human consumption.
                </strong>{' '}
                It is supplied as a raw botanical material for dyeing, soap and
                cosmetic manufacture, craft and botanical research. The buyer
                confirmed this intended use at checkout.
              </p>
            )}

          <p className="mt-6 text-xs leading-relaxed text-foreground-muted">
            No prices appear on this document. Questions about this order:{' '}
            {email}
          </p>
        </article>
      ))}
    </div>
  )
}

export default async function InvoicePage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params

  return (
    <div className="mx-auto max-w-3xl px-4 pb-16 md:px-8">
      {/*
        The only thing on this page that is not the documents, and the only thing
        `@media print` removes.
      */}
      <div className="no-print flex flex-wrap items-center justify-between gap-3 py-6">
        <div>
          <h1 className="font-display text-2xl text-foreground">
            Invoice &amp; packing slips
          </h1>
          <p className="mt-1 text-sm text-foreground-muted">
            Order {slug}. Each document starts on a new page when printed.
          </p>
        </div>
        <div className="flex gap-2">
          <a
            href={`/admin/orders/${slug}`}
            className="inline-flex min-h-11 items-center text-sm text-foreground-muted underline underline-offset-4 hover:text-foreground"
          >
            Back to order
          </a>
          <PrintButton />
        </div>
      </div>

      <Documents orderNumber={slug} />
    </div>
  )
}
