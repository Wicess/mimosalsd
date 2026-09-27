import { db } from '@/lib/db/client'
import { PAYMENT_LABELS, PAYMENT_METHODS } from '@/lib/orders/types'
import { AdminPage, Cell, DataTable, Row, StatCard } from '@/components/admin/shell'
import { Badge } from '@/components/ui/badge'
import { AlertIcon } from '@/components/ui/icon'
import { CrudPanel, Field, InlineAction, Select } from '@/components/admin/forms'
import { addPaymentHandle, burnPaymentHandle } from '@/app/actions/admin-crud'

async function Payments() {
  const handles = await db.paymentHandle.findMany({ orderBy: { createdAt: 'desc' } })
  /*
    Handles are entered by hand for each order, when its payment details are sent
    (the order's payment page). Sending one records it here, which is what makes a
    burn possible: a burned handle can never be sent to a customer again. So these
    cards count what is on record, not a pool waiting to be used.
  */
  const onRecord = (method: string) => handles.filter((h) => h.method === method && h.isActive && !h.burnedAt).length

  return (
    <>
      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        {PAYMENT_METHODS.map((m) => (
          <StatCard
            key={m}
            label={PAYMENT_LABELS[m]}
            value={m === 'BITCOIN' ? 'auto' : String(onRecord(m))}
            hint={m === 'BITCOIN' ? 'unique address per order' : 'handles on record'}
          />
        ))}
      </div>

      <div className="mb-6 rounded-lg bg-info-bg p-4 text-info-fg">
        <div className="flex gap-3">
          <AlertIcon className="mt-0.5 size-5 shrink-0" />
          <div>
          <p className="text-sm leading-relaxed">
            You enter the handle for each order by hand, when you send that order its
            payment details (open the order, then send payment details). Every handle you
            send is recorded here. If an account is frozen or scraped, burn its handle:
            a burned handle can never be sent to a customer again.
          </p>
          <p className="mt-2 text-sm leading-relaxed">
            Handles are never rendered into a public page. A customer sees one only on
            their own order page, after you have sent it. A handle that appears
            in static HTML gets scraped within days and the receiving account frozen —
            revenue then stops with no error anywhere to explain why.
          </p>
          </div>
        </div>
      </div>

      <CrudPanel summary="+ Record a handle in advance (optional)" action={addPaymentHandle}>
        <Select
          label="Method"
          name="method"
          options={[['CASHAPP', 'Cash App'], ['CHIME', 'Chime'], ['APPLE_CASH', 'Apple Cash']]}
        />
        <Field label="Handle" name="handle" required placeholder="$acmebotanicals" />
        <Field label="Label" name="label" placeholder="Primary account" />
      </CrudPanel>

      {handles.length > 0 && (
        <DataTable headers={['Method', 'Handle', 'Issued', 'Last used', 'Status', '']}>
          {handles.map((h) => (
            <Row key={h.id}>
              <Cell className="text-foreground">
                {PAYMENT_LABELS[h.method as keyof typeof PAYMENT_LABELS] ?? h.method}
              </Cell>
              <Cell className="tabular text-foreground">{h.handle}</Cell>
              <Cell className="tabular text-foreground-muted">{h.timesIssued}</Cell>
              <Cell className="tabular text-xs text-foreground-muted">
                {h.lastUsedAt?.toISOString().slice(0, 10) ?? '—'}
              </Cell>
              <Cell>
                {h.burnedAt ? (
                  <Badge tone="danger">burned</Badge>
                ) : h.isActive ? (
                  <Badge tone="success">active</Badge>
                ) : (
                  <Badge tone="neutral">off</Badge>
                )}
              </Cell>
              <Cell>
                {!h.burnedAt && (
                  <InlineAction
                    action={burnPaymentHandle}
                    label="Burn"
                    variant="danger"
                    fields={{ id: h.id }}
                    confirm="Burning a handle is permanent — it is never reissued. Continue?"
                  />
                )}
              </Cell>
            </Row>
          ))}
        </DataTable>
      )}
    </>
  )
}

export default function AdminPaymentsPage() {
  return (
    <AdminPage
      title="Payment handles"
      description="The Cash App, Chime and Apple Cash handles you have sent to customers, entered per order. Apple Cash — not Apple Pay: real Apple Pay needs a card processor we deliberately do not have, which is what keeps PCI scope at zero."
    >
      <Payments />
    </AdminPage>
  )
}
