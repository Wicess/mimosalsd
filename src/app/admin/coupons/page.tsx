import { db } from '@/lib/db/client'
import { AdminPage, Cell, DataTable, EmptyState, Row } from '@/components/admin/shell'
import { Badge } from '@/components/ui/badge'
import { CrudPanel, Field, InlineAction } from '@/components/admin/forms'
import { createCoupon, toggleCoupon } from '@/app/actions/admin-coupons'
import { formatCents } from '@/lib/utils'

export const metadata = { title: 'Coupons' }

function day(date: Date | null): string {
  return date ? date.toISOString().slice(0, 10) : '—'
}

/**
 * The status an operator actually needs, which `isActive` alone does not say.
 *
 * A code can be switched on and still not work — not started, expired, used up — and
 * a table showing "active" beside a code customers are being refused is how an
 * operator spends an afternoon on a support thread that the list could have answered.
 */
function status(coupon: {
  isActive: boolean
  startsAt: Date | null
  endsAt: Date | null
  maxRedemptions: number | null
  timesRedeemed: number
}): { label: string; tone: 'success' | 'neutral' | 'warning' } {
  const now = Date.now()
  if (!coupon.isActive) return { label: 'off', tone: 'neutral' }
  if (coupon.endsAt && coupon.endsAt.getTime() <= now) return { label: 'expired', tone: 'neutral' }
  if (coupon.startsAt && coupon.startsAt.getTime() > now) return { label: 'scheduled', tone: 'warning' }
  if (coupon.maxRedemptions !== null && coupon.timesRedeemed >= coupon.maxRedemptions) {
    return { label: 'used up', tone: 'warning' }
  }
  return { label: 'live', tone: 'success' }
}

async function Coupons() {
  const rows = await db.coupon.findMany({ orderBy: { createdAt: 'desc' }, take: 200 })

  const form = (
    <CrudPanel summary="+ New coupon" action={createCoupon}>
      <Field
        label="Code"
        name="code"
        required
        placeholder="SUMMER10"
        hint="Letters, numbers, hyphens. Stored in capitals; customers can type it either way."
      />
      <div className="grid gap-3 md:grid-cols-2">
        <Field label="Percent off" name="percentOff" placeholder="10" hint="1 to 100." />
        <Field label="Or a fixed amount off" name="amountOff" placeholder="5.00" hint="Dollars. Use one, not both." />
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <Field label="Minimum spend" name="minSubtotal" placeholder="50.00" hint="On eligible items. Blank for none." />
        <Field label="Maximum uses" name="maxRedemptions" placeholder="100" hint="Blank for unlimited." />
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <Field label="Starts (UTC)" name="startsAt" type="date" hint="Blank to start now." />
        <Field label="Ends, inclusive (UTC)" name="endsAt" type="date" hint="Works all of this day. Blank for no end." />
      </div>
      <p className="text-xs leading-relaxed text-foreground-muted">
        A code discounts items only — never shipping, and never vapor products, which
        several states restrict discounting on. Terms are fixed once created: orders
        record the code that discounted them, so changing what a code means would
        rewrite those records. Switch it off and create a new one instead.
      </p>
    </CrudPanel>
  )

  if (rows.length === 0) {
    return (
      <>
        {form}
        <EmptyState
          title="No coupons yet"
          hint="Codes apply at checkout behind a “Have a discount code?” link, and every receipt names the code that was used."
        />
      </>
    )
  }

  return (
    <>
      {form}
      <DataTable headers={['Code', 'Discount', 'Minimum', 'Used', 'Window (UTC)', 'Status', '']}>
        {rows.map((coupon) => {
          const s = status(coupon)
          return (
            <Row key={coupon.id}>
              <Cell className="tabular font-medium text-foreground">{coupon.code}</Cell>
              <Cell className="tabular text-foreground">
                {coupon.percentOff !== null
                  ? `${coupon.percentOff}%`
                  : formatCents(coupon.amountOffCents ?? 0)}
              </Cell>
              <Cell className="tabular text-foreground-muted">
                {coupon.minSubtotalCents > 0 ? formatCents(coupon.minSubtotalCents) : '—'}
              </Cell>
              <Cell className="tabular text-foreground">
                {coupon.timesRedeemed}
                {coupon.maxRedemptions !== null ? ` / ${coupon.maxRedemptions}` : ''}
              </Cell>
              <Cell className="tabular text-xs text-foreground-muted">
                {day(coupon.startsAt)} → {coupon.endsAt ? day(new Date(coupon.endsAt.getTime() - 1)) : '—'}
              </Cell>
              <Cell>
                <Badge tone={s.tone}>{s.label}</Badge>
              </Cell>
              <Cell>
                <InlineAction
                  action={toggleCoupon}
                  label={coupon.isActive ? 'Disable' : 'Enable'}
                  fields={{ id: coupon.id }}
                />
              </Cell>
            </Row>
          )
        })}
      </DataTable>
    </>
  )
}

export default function AdminCouponsPage() {
  return (
    <AdminPage
      title="Coupons"
      description="Discount codes for checkout. A cancelled or rejected order gives its use back automatically; an unpaid order holds it until someone cancels it."
    >
      <Coupons />
    </AdminPage>
  )
}
