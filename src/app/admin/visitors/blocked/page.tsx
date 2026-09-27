import Link from 'next/link'
import { AdminPage, Cell, DataTable, EmptyState, Row } from '@/components/admin/shell'
import { CrudPanel, Field, InlineAction, TextArea } from '@/components/admin/forms'
import { blockIp, unblockIp } from '@/app/actions/admin-blocked-ips'
import { db } from '@/lib/db/client'

export const metadata = { title: 'Blocked addresses' }

async function Blocked() {
  const rows = await db.blockedIp.findMany({ orderBy: { createdAt: 'desc' }, take: 500 })

  return (
    <>
      <CrudPanel summary="Block an address" action={blockIp}>
        <Field
          label="IP address"
          name="ip"
          required
          placeholder="203.0.113.7"
          hint="One exact address, IPv4 or IPv6. A chat thread's profile panel shows the visitor's; you can also block from there."
        />
        <TextArea
          label="Reason"
          name="reason"
          required
          rows={3}
          hint="Kept in the audit trail. Never shown to the visitor."
        />
      </CrudPanel>

      {rows.length === 0 ? (
        <EmptyState
          title="No blocked addresses"
          hint="Block an address above, or from a chat thread. Blocked addresses get a refusal page on every storefront page and API route."
        />
      ) : (
        <DataTable headers={['Address', 'Reason', 'Source', 'Blocked', '']}>
          {rows.map((row) => (
            <Row key={row.ip}>
              <Cell className="tabular font-medium break-all text-foreground">{row.ip}</Cell>
              <Cell className="text-sm text-foreground-muted">{row.reason ?? '—'}</Cell>
              <Cell className="text-sm text-foreground-muted">
                {row.publicId ? `Chat ${row.publicId}` : row.threadId ? 'Chat' : 'Added by hand'}
              </Cell>
              <Cell className="tabular text-xs text-foreground-muted">
                {row.createdAt.toISOString().slice(0, 16).replace('T', ' ')}
                {row.createdBy ? <span className="block">{row.createdBy}</span> : null}
              </Cell>
              <Cell>
                <InlineAction
                  action={unblockIp}
                  label="Unblock"
                  fields={{ ip: row.ip }}
                  confirm={`Unblock ${row.ip}? Every page will accept it again within about a minute.`}
                />
              </Cell>
            </Row>
          ))}
        </DataTable>
      )}
    </>
  )
}

export default function AdminBlockedIpsPage() {
  return (
    <AdminPage
      title="Blocked addresses"
      description="Addresses the whole storefront refuses, pages and API routes alike, with a plain page telling them how to reach us. The admin stays reachable from any address. Changes take effect within about a minute. Never block a search engine's crawler: the site would drop out of results."
      actions={
        <Link
          href="/admin/visitors"
          className="inline-flex min-h-11 items-center rounded-md border border-border-strong bg-surface px-3 text-sm font-medium text-foreground hover:bg-surface-sunken"
        >
          Visitors
        </Link>
      }
    >
      <Blocked />
    </AdminPage>
  )
}
